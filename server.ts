import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Supabase client instance for server webhook processing
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lzvrhtaewonmpsaiezai.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dnJodGFld29ubXBzYWllemFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MDE5NDQsImV4cCI6MjEwMzM3Nzk0NH0.UfWotWAZQjaqTTjoa5GKS5dq1Zda3V6wQlaCpHRNGI8';
const serverSupabase = createClient(supabaseUrl, supabaseAnonKey);

// In-memory cache for incoming payment verifications
interface CachedVerification {
  id: string;
  user_id?: string;
  student_id?: string | null;
  student_name?: string;
  student_kelompok?: string;
  sender_phone: string;
  sender_name?: string;
  message_text?: string;
  proof_image_url: string;
  bulan: string;
  tahun: number;
  nominal: number;
  tanggal_transfer?: string;
  waktu_transfer?: string;
  bank_pengirim?: string;
  bank_tujuan?: string;
  nama_rekening_pengirim?: string;
  confidence_notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason?: string;
  created_at: string;
  updated_at?: string;
}

const memoryVerifications: CachedVerification[] = [];

// Body parser for JSON with large payload (for base64 webcam photos)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Lazy initialization for Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY || Buffer.from('QVEuQWI4Uk42SlZCMjl4WGQ4Y2RIME11RlVkTTVUaUlqZGc2V0huZWs4RUtGeTZEVWo2MUE=', 'base64').toString('utf8');
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured");
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString(),
  });
});

// Helper to extract Indonesian month from text
const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function detectMonthFromText(text: string): string {
  if (!text) return INDONESIAN_MONTHS[new Date().getMonth()];
  const lower = text.toLowerCase();
  for (const m of INDONESIAN_MONTHS) {
    if (lower.includes(m.toLowerCase())) {
      return m;
    }
  }
  return INDONESIAN_MONTHS[new Date().getMonth()];
}

// Helper to extract nominal amount from text (e.g. 150.000 or 150000)
function detectNominalFromText(text: string): number {
  if (!text) return 100000;
  // Buang pecahan sen (,00 atau .00) di akhir angka agar tidak terbaca puluhan/ratusan juta
  const cleanedText = text.replace(/([.,])00(?!\d)/g, '');
  const match = cleanedText.match(/(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+(?:\s*(?:ribu|rb))?|\d{4,9})/i);
  if (match) {
    const rawNum = match[1].replace(/[.,]/g, '');
    let parsed = parseInt(rawNum, 10);
    if (!isNaN(parsed) && parsed >= 10000 && parsed <= 50000000) {
      // Genapkan ke nominal asli jika ada biaya admin transfer 2500 (misal 752500 -> 750000)
      if (parsed > 10000 && (parsed % 5000 === 2500 || String(parsed).endsWith('2500'))) {
        parsed = parsed - 2500;
      }
      return parsed;
    }
  }
  return 100000;
}

// Helper untuk membersihkan dan menormalkan nominal dari AI Gemini
// Mengantisipasi kesalahan umum AI membaca format sen di struk Indonesia (misal 750.000,00 terbaca 75000000)
// Serta menggenapkan biaya admin transfer 2.500 (misal 752.500 -> 750.000, 502.500 -> 500.000)
function parseReceiptNominal(rawNominal: any, expectedStudentSpp?: number): number {
  if (rawNominal === undefined || rawNominal === null || rawNominal === '') return 0;
  
  let num = 0;
  if (typeof rawNominal === 'number') {
    num = Math.round(rawNominal);
  } else {
    let str = String(rawNominal).trim().replace(/^(?:rp|idr)\.?\s*/i, '');
    // Cek jika berakhiran sen ,00 atau .00 -> WAJIB dibuang
    if (/[,.]00$/.test(str)) {
      str = str.slice(0, -3);
    } else if (/[,.]\d{2}$/.test(str)) {
      str = str.slice(0, -3);
    }
    // Hapus pemisah ribuan titik/koma
    str = str.replace(/[.,\s]/g, '');
    num = parseInt(str, 10);
    if (isNaN(num)) num = 0;
  }

  // 1. Jika ada data SPP siswa dan angka terbaca tepat 100x lipat dari SPP (karena membaca ',00')
  // Contoh: Siswa SPP Rp 750.000, struk tertulis 750.000,00 lalu terbaca 75.000.000 (75000000)
  if (expectedStudentSpp && expectedStudentSpp > 0) {
    if (num === expectedStudentSpp * 100) {
      console.log(`[NOMINAL FIX SERVER] Memperbaiki nominal terbaca x100 (${num} -> ${expectedStudentSpp}) sesuai nominal SPP siswa`);
      return expectedStudentSpp;
    }
    // Jika siswa SPP 750.000 dan transfer menyertakan admin 2500 (752500), genapkan ke SPP siswa
    if (num === expectedStudentSpp + 2500) {
      console.log(`[NOMINAL FIX SERVER] Menggenapkan transfer SPP + biaya admin 2500 (${num} -> ${expectedStudentSpp})`);
      return expectedStudentSpp;
    }
  }

  // 2. Koreksi umum pembacaan sen: Jika nominal berakhiran 00 dan nilainya di atas 10 juta (misal 75000000, 75250000, 25000000)
  // dan jika dibagi 100 menghasilkan angka SPP wajar (Rp 20.000 - Rp 5.000.000)
  if (num >= 10000000 && num % 100 === 0) {
    const candidate = num / 100;
    if (expectedStudentSpp && (candidate === expectedStudentSpp || candidate === expectedStudentSpp + 2500)) {
      num = candidate;
    } else if (num >= 50000000 && candidate >= 50000 && candidate <= 5000000) {
      console.log(`[NOMINAL FIX SERVER] Mendeteksi nominal berlebih akibat pecahan sen (,00): ${num} -> ${candidate}`);
      num = candidate;
    }
  }

  // 3. Genapkan biaya admin transfer bank Rp 2.500 ke nominal asli SPP
  // Contoh: 752500 -> 750000, 502500 -> 500000, 402500 -> 400000
  if (num > 10000 && (num % 5000 === 2500 || String(num).endsWith('2500'))) {
    console.log(`[NOMINAL FIX SERVER] Menggenapkan biaya admin transfer 2500: ${num} -> ${num - 2500}`);
    num = num - 2500;
  }

  return num;
}

// Helper to normalize phone number to clean digits starting with 62
function normalizePhoneDigits(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  return digits;
}

// Interface for Gemini receipt analysis
interface ReceiptAnalysisResult {
  isTransferReceipt: boolean; // STRICT check: only true if it's a real transfer/payment proof
  nominal: number;
  tanggal: string; // YYYY-MM-DD
  waktu: string;   // HH:mm
  bulan: string;   // Indonesian month
  tahun: number;
  bankPengirim: string;
  bankTujuan: string;
  namaPengirim: string;
  statusTransaksi: string; // 'BERHASIL', 'PENDING', 'GAGAL'
  confidenceNotes: string;
}

// Keywords to detect payment intent when offline / fallback
const PAYMENT_KEYWORDS = [
  'transfer', 'bukti', 'spp', 'bayar', 'struk', 'tf', 'rekening', 'mutasi', 'setor', 'lunas', 'bca', 'bri', 'mandiri', 'bsi', 'dana', 'gopay', 'ovo', 'biaya'
];

// Konfigurasi AI Provider Fallback:
// 1. Prioritas Utama: Google Gemini Free Tier
// 2. Prioritas Kedua (Fallback Pertama jika Gemini sibuk/limit): Sumopod (GPT-5 Nano, fallback GPT-6 Luna)
// 3. Prioritas Ketiga (Fallback Terakhir jika Sumopod sibuk, menolak, atau out of budget): KoboldLLM

const SUMOPOD_CONFIG = {
  baseUrl: (process.env.SUMOPOD_BASE_URL || process.env.GLM_BASE_URL || "https://ai.sumopod.com/v1").replace(/\/+$/, ""),
  apiKey: process.env.SUMOPOD_API_KEY || process.env.GLM_API_KEY || "sk-DFe4pA8Vmm2p4OIr01pwJw",
  models: [
    "gpt-5-nano",
    "gpt-6-luna",
    "glm-5.3-flash",
    "deepseek-v4.1-flash:netra"
  ]
};

const KOBOILLM_CONFIG = {
  baseUrl: (process.env.CUSTOM_AI_BASE_URL || process.env.KOBOILLM_BASE_URL || "https://api.koboillm.com/v1").replace(/\/+$/, ""),
  apiKey: process.env.CUSTOM_AI_API_KEY || process.env.KOBOILLM_API_KEY || "sk-wMaVBOWC1G69emLkQ5T9Ng",
  models: [
    "gemini/gemini-3.1-flash-lite",
    "vertex_ai/gemini-3.1-flash-lite",
    "gemini/gemini-2.5-flash-lite",
    "vertex_ai/gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite"
  ]
};

function isBudgetOrRejectionOrBusyError(status: number, errorText: string): boolean {
  if ([400, 401, 402, 403, 429, 500, 502, 503, 504].includes(status)) return true;
  const lower = (errorText || "").toLowerCase();
  const keywords = [
    "budget", "quota", "insufficient", "balance", "credit", "arrear", "payment required",
    "rate limit", "too many requests", "busy", "overloaded", "rejected", "refusal", "refuse",
    "capacity", "exhausted", "limit exceeded", "unauthorized", "forbidden"
  ];
  return keywords.some(k => lower.includes(k));
}

async function executeOpenAiCompatibleChat(
  providerName: string,
  baseUrl: string,
  apiKey: string,
  models: string[],
  messages: any[],
  temperature = 0.1
): Promise<{ text: string | null; isBudgetOrRejection: boolean }> {
  let isBudgetOrRejection = false;

  for (const model of models) {
    try {
      console.log(`[${providerName} SERVER] Mencoba model: ${model}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      let res: Response;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages,
            temperature
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn(`[${providerName} SERVER MODEL ${model} FAILED] HTTP ${res.status}:`, errText.slice(0, 200));
        if (isBudgetOrRejectionOrBusyError(res.status, errText)) {
          isBudgetOrRejection = true;
          const lower = errText.toLowerCase();
          if (res.status === 402 || res.status === 401 || res.status === 403 || lower.includes("budget") || lower.includes("quota") || lower.includes("balance") || lower.includes("insufficient")) {
            console.warn(`[${providerName} SERVER OUT OF BUDGET / REJECTED] Akun menolak atau saldo habis, alihkan ke provider berikutnya.`);
            return { text: null, isBudgetOrRejection: true };
          }
        }
        continue;
      }

      const data: any = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      if (content) {
        console.log(`[${providerName} SERVER SUCCESS] Berhasil via model ${model}`);
        return { text: content, isBudgetOrRejection: false };
      }
    } catch (err: any) {
      console.warn(`[${providerName} SERVER MODEL ${model} ERROR]`, err.message || err);
      if (err.name === 'AbortError' || isBudgetOrRejectionOrBusyError(0, err.message || '')) {
        isBudgetOrRejection = true;
      }
    }
  }

  return { text: null, isBudgetOrRejection };
}

async function analyzeReceiptWithMultiTierFallback(
  imagePart: { inlineData: { mimeType: string; data: string } },
  prompt: string
): Promise<ReceiptAnalysisResult | null> {
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: {
            url: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
          }
        }
      ]
    }
  ];

  // 1. Dulukan GLM dari Sumopod
  console.log("[AI FALLBACK SERVER] Mencoba GLM dari Sumopod (Priority 1 Fallback)...");
  try {
    const sumopodRes = await executeOpenAiCompatibleChat(
      "SUMOPOD GLM",
      SUMOPOD_CONFIG.baseUrl,
      SUMOPOD_CONFIG.apiKey,
      SUMOPOD_CONFIG.models,
      messages,
      0.1
    );

    if (sumopodRes.text) {
      const jsonMatch = sumopodRes.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        parsed.isTransferReceipt = parsed.isTransferReceipt === true || String(parsed.isTransferReceipt).toLowerCase() === 'true';
        return parsed as ReceiptAnalysisResult;
      }
    }
    console.warn("[AI FALLBACK SERVER] Sumopod GLM sibuk, menolak, atau out of budget. Beralih ke KoboldLLM...");
  } catch (err: any) {
    console.warn("[AI FALLBACK SERVER] Sumopod GLM error, beralih ke KoboldLLM:", err.message || err);
  }

  // 2. Fallback ke KoboldLLM
  console.log("[AI FALLBACK SERVER] Mencoba KoboldLLM (Final Fallback)...");
  try {
    const koboldRes = await executeOpenAiCompatibleChat(
      "KOBOILLM",
      KOBOILLM_CONFIG.baseUrl,
      KOBOILLM_CONFIG.apiKey,
      KOBOILLM_CONFIG.models,
      messages,
      0.1
    );

    if (koboldRes.text) {
      const jsonMatch = koboldRes.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        parsed.isTransferReceipt = parsed.isTransferReceipt === true || String(parsed.isTransferReceipt).toLowerCase() === 'true';
        return parsed as ReceiptAnalysisResult;
      }
    }
  } catch (err: any) {
    console.error("[AI FALLBACK SERVER] KoboldLLM error:", err.message || err);
  }

  console.error("[AI FALLBACK SERVER ALL FAILED] Seluruh provider gagal menganalisis struk.");
  return null;
}

// Backward compatibility alias
async function analyzeReceiptWithCustomProvider(
  imagePart: { inlineData: { mimeType: string; data: string } },
  prompt: string
): Promise<ReceiptAnalysisResult | null> {
  return await analyzeReceiptWithMultiTierFallback(imagePart, prompt);
}

async function analyzeReceiptWithGemini(imageUrl: string, messageCaption?: string): Promise<ReceiptAnalysisResult | null> {
  const apiKey = process.env.GEMINI_API_KEY || Buffer.from('QVEuQWI4Uk42SlZCMjl4WGQ4Y2RIME11RlVkTTVUaUlqZGc2V0huZWs4RUtGeTZEVWo2MUE=', 'base64').toString('utf8');

  let imagePart: any = null;

  // If it's a data url
  if (imageUrl.startsWith("data:image/")) {
    const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      imagePart = {
        inlineData: {
          mimeType: match[1],
          data: match[2],
        }
      };
    }
  } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    // Download image buffer for Gemini
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const imgRes = await fetch(imageUrl, { signal: controller.signal });
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
        const base64Data = Buffer.from(buffer).toString("base64");
        imagePart = {
          inlineData: {
            mimeType: mimeType.split(";")[0],
            data: base64Data,
          }
        };
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!imagePart) {
    return null;
  }

  const prompt = `Anda adalah sistem verifikasi keuangan sekolah khusus memeriksa bukti transfer bank / m-Banking / e-Wallet / struk ATM pembayaran SPP di Indonesia.
Analisis gambar ini dengan SANGAT KETAT dan teliti.

TUGAS UTAMA:
1. Tentukan apakah gambar ini ADALAH BUKTI TRANSFER BANK / STRUK RESMI PEMBAYARAN:
   - Jika ini BUKAN bukti transfer (misalnya: foto selfie, foto anak/siswa, pemandangan, meme, stiker WhatsApp, foto tugas/dokumen lain, struk belanja minimarket/makanan, tangkapan layar chat biasa):
     Maka Anda WAJIB mengisi "isTransferReceipt": false.
   - Jika ini ADALAH screenshot transaksi transfer m-banking resmi (BCA, BRImo, Livin Mandiri, BSI Mobile, BNI, Seabank, Bank Jago, dll.), e-wallet (DANA, OVO, GoPay, ShopeePay), QRIS receipt, atau struk transfer fisik mesin ATM:
     Maka isi "isTransferReceipt": true.

2. Jika isTransferReceipt true:
   - "nominal": angka bulat murni transfer dalam Rupiah (integer tanpa sen).
     ⚠️ ATURAN SANGAT KRUSIAL FORMAT NOMINAL & SEN RUPIAH DI STRUK INDONESIA:
     * Pada struk bank/m-Banking/ATM Indonesia (BCA, Mandiri, BRI, BNI, BSI, DANA, dll.), format uang sangat sering menyertakan 2 digit pecahan desimal sen di belakang koma, seperti "Rp 750.000,00" atau "750.000,00".
     * Bagian ",00" atau ".00" di paling belakang adalah SEN (nol sen), BUKAN tambahan angka nol nominal rupiah!
     * JANGAN SEKALI-KALI memasukkan angka sen (,00) sebagai nol nominal!
     * CONTOH PEMBACAAN YANG BENAR:
       - Struk bertuliskan "Rp 750.000,00" atau "750.000,00" artinya Tujuh Ratus Lima Puluh Ribu Rupiah -> isi "nominal": 750000 (BUKAN 75000000!).
       - Struk bertuliskan "Rp 150.000,00" -> isi "nominal": 150000 (BUKAN 15000000!).
       - Struk bertuliskan "Rp 50.000,00" -> isi "nominal": 50000 (BUKAN 5000000!).
       - Struk bertuliskan "Rp 1.500.000,00" -> isi "nominal": 1500000 (BUKAN 150000000!).
       - Struk bertuliskan "Rp 250.000" -> isi "nominal": 250000.
       - Jika ada kode unik transfer misal Rp 150.123, masukkan 150123.
     * ⚠️ ATURAN BIAYA ADMIN BANK (Rp 2.500):
       - Jika pada struk terdapat lebihan 2.500 karena biaya transfer BI-FAST (misal tertulis Rp 752.500, Rp 502.500, Rp 402.500, Rp 252.500), MAKA BULATKAN KE NOMINAL ASLI SPP (buang 2.500):
         752.500 -> isi "nominal": 750000
         502.500 -> isi "nominal": 500000
         402.500 -> isi "nominal": 400000
         252.500 -> isi "nominal": 250000
   - "tanggal": format YYYY-MM-DD (misal 2026-03-21) dari tanggal transaksi di struk.
   - "waktu": format HH:mm 24 jam (misal 08:35) dari jam transfer di struk.
   - "bulan": nama bulan dalam bahasa Indonesia (Januari-Desember) yang bersangkutan.
   - "bankPengirim": nama bank / e-wallet pengirim (misal BCA, BRI, Mandiri, BSI, DANA).
   - "bankTujuan": nama bank tujuan atau rekening penerima jika terlihat.
   - "namaPengirim": nama pemilik rekening pengirim jika tertera.
   - "statusTransaksi": 'BERHASIL' / 'PENDING' / 'GAGAL'.
   - "confidenceNotes": ringkasan singkat hasil bacaan (contoh: "Struk BCA Mobile Berhasil Rp 750.000 tgl 21/03/2026 09:12 WIB").

Teks pesan pendamping yang dikirim pengirim: "${messageCaption || ""}"

Kembalikan HANYA JSON murni yang valid sesuai format berikut:
{
  "isTransferReceipt": boolean,
  "nominal": number,
  "tanggal": string,
  "waktu": string,
  "bulan": string,
  "tahun": number,
  "bankPengirim": string,
  "bankTujuan": string,
  "namaPengirim": string,
  "statusTransaksi": string,
  "confidenceNotes": string
}`;

  if (!apiKey) {
    console.warn("GEMINI_API_KEY tidak ditemukan, beralih ke custom fallback provider.");
    return await analyzeReceiptWithCustomProvider(imagePart, prompt);
  }

  try {
    const ai = getGemini();

    const modelCandidates = ["gemini-2.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash"];
    let response: any = null;
    let lastError: any = null;

    for (const model of modelCandidates) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                imagePart,
              ]
            }
          ],
          config: {
            responseMimeType: "application/json",
          },
        });
        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[GEMINI SERVER MODEL ${model} FAILED]`, err.message || err.status || err);
      }
    }

    if (!response || !response.text) {
      console.warn("[GEMINI SERVER ALL MODELS FAILED, SWITCHING TO CUSTOM FALLBACK]", lastError);
      return await analyzeReceiptWithCustomProvider(imagePart, prompt);
    }

    const text = response.text || "";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    console.log("[GEMINI VISION RECEIPT ANALYSIS SUCCESS]", parsed);
    return parsed as ReceiptAnalysisResult;
  } catch (err: any) {
    console.error("[GEMINI VISION RECEIPT ANALYSIS ERROR, TRYING CUSTOM FALLBACK]", err);
    try {
      return await analyzeReceiptWithCustomProvider(imagePart, prompt);
    } catch (fbErr) {
      console.error("[CUSTOM PROVIDER FALLBACK ERROR]", fbErr);
    }
    return null;
  }
}

// =========================================================================
// 1. OUTBOUND API: Kirim Pesan WhatsApp via Gateway Provider (Proxy)
// =========================================================================
app.post("/api/whatsapp/send", async (req, res) => {
  try {
    const { apiUrl, appkey, authkey, to, message, file } = req.body;

    if (!appkey || !authkey || !to || !message) {
      return res.status(400).json({
        success: false,
        error: "Parameter appkey, authkey, to, dan message wajib diisi."
      });
    }

    const targetUrl = apiUrl || "https://app.starsender.online/api/sendText";
    const cleanTo = normalizePhoneDigits(to);

    const formData = new URLSearchParams();
    formData.append("appkey", appkey);
    formData.append("authkey", authkey);
    formData.append("to", cleanTo);
    formData.append("message", message);
    if (file) {
      formData.append("file", file);
    }

    const gatewayResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Catatoh-SPP-Gateway/1.0",
      },
      body: formData.toString(),
    });

    const responseText = await gatewayResponse.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return res.json({
      success: gatewayResponse.ok,
      status: gatewayResponse.status,
      data: responseData,
    });
  } catch (error: any) {
    console.error("WhatsApp Gateway send error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Gagal menghubungi server WhatsApp Gateway.",
    });
  }
});

// =========================================================================
// 2. INBOUND WEBHOOK: Menerima Pesan & Bukti Pembayaran dari Provider WA
// =========================================================================
app.get("/api/webhook/whatsapp", (req, res) => {
  const query = req.query || {};
  const mode = query["hub.mode"];
  const challenge = query["hub.challenge"];
  if (mode === "subscribe" && challenge) {
    return res.send(challenge);
  }

  return res.json({
    status: "ok",
    service: "Catatoh WhatsApp Universal Inbound Webhook",
    endpoint: "/api/webhook/whatsapp",
    environment: "node-express",
    methods_supported: ["POST", "GET"],
    universal_mode: true,
    auto_matching: "enabled",
    timestamp: new Date().toISOString(),
    message: "Universal Webhook Catatoh aktif dan siap menerima data pembayaran SPP.",
  });
});

app.post("/api/webhook/whatsapp", async (req, res) => {
  try {
    const payload = req.body || {};
    const query = req.query || {};

    // Ambil token / keys (bisa dari body, headers, atau query URL)
    const appkey = payload.appkey || query.appkey || req.headers["x-appkey"] || "";
    const authkey = payload.authkey || query.authkey || req.headers["x-authkey"] || "";
    const explicitUserId = (query.user_id || payload.user_id || "").toString();

    // Ambil data pengirim
    const rawSender = payload.sender || payload.from || payload.phone || payload.number || payload.wa_number || payload.data?.from || "";
    const senderPhone = normalizePhoneDigits(rawSender.toString());

    // Ambil isi teks dan file/gambar
    const messageText = (payload.message || payload.caption || payload.text || payload.body || payload.data?.message || "").toString();
    const proofImageUrl = (payload.file || payload.url || payload.media || payload.image || payload.attachment || payload.data?.file || "").toString();
    const senderName = (payload.name || payload.sender_name || payload.pushName || payload.data?.name || "Orang Tua Siswa").toString();

    // =========================================================================
    // ATURAN KETAT 1: HANYA GAMBAR YANG DITERIMA
    // Chat teks biasa, pesan suara, atau stiker TANPA gambar langsung diabaikan.
    // Tidak akan mentrigger notifikasi ataupun antrean moderasi SPP.
    // =========================================================================
    if (!proofImageUrl || proofImageUrl.trim() === "") {
      console.log("[INBOUND IGNORED] Pesan teks biasa tanpa bukti transfer:", messageText.slice(0, 50));
      return res.json({
        status: "ignored",
        reason: "no_image_attached",
        message: "Pesan diabaikan karena bukan pengiriman bukti transfer berupa gambar.",
      });
    }

    // =========================================================================
    // ATURAN KETAT 2: ANALISIS GEMINI VISION (HANYA BUKTI TRANSFER YANG LOLOS)
    // =========================================================================
    console.log("[INBOUND PROCESSING] Menganalisis gambar bukti transfer dengan Gemini Vision...");
    const geminiAnalysis = await analyzeReceiptWithGemini(proofImageUrl, messageText);

    if (geminiAnalysis) {
      if (!geminiAnalysis.isTransferReceipt || geminiAnalysis.statusTransaksi === 'GAGAL') {
        console.log("[INBOUND REJECTED BY GEMINI] Bukan bukti transfer valid / status gagal:", geminiAnalysis.confidenceNotes);
        return res.json({
          status: "ignored",
          reason: "not_a_valid_transfer_receipt",
          message: geminiAnalysis.statusTransaksi === 'GAGAL'
            ? "Gambar struk transfer berstatus GAGAL. Moderasi SPP tidak dipicu."
            : "Gambar diterima tetapi bukan struk/bukti transfer yang valid. Moderasi SPP tidak dipicu.",
          detectedNotes: geminiAnalysis.confidenceNotes,
        });
      }
    } else {
      // Fallback jika Gemini sedang offline: Cek apakah ada kata kunci pembayaran di teks pesan
      const lowerText = messageText.toLowerCase();
      const hasPaymentKeyword = PAYMENT_KEYWORDS.some(kw => lowerText.includes(kw));
      if (!hasPaymentKeyword) {
        console.log("[INBOUND REJECTED FALLBACK] Gambar tidak menyertakan indikasi bukti transfer:", messageText.slice(0, 40));
        return res.json({
          status: "ignored",
          reason: "no_payment_intent",
          message: "Gambar dan pesan tidak mengindikasikan bukti transfer pembayaran. Moderasi tidak dipicu.",
        });
      }
    }

    console.log("[INBOUND WEBHOOK WA VALID RECEIPT ACCEPTED]", {
      sender: senderPhone,
      geminiVerified: !!geminiAnalysis?.isTransferReceipt,
      nominal: geminiAnalysis?.nominal,
      tanggal: geminiAnalysis?.tanggal,
      waktu: geminiAnalysis?.waktu,
      bank: geminiAnalysis?.bankPengirim,
      appkey: appkey ? "PRESENT" : "MISSING",
    });

    // Deteksi bulan & perkiraan nominal (prioritas dari Gemini Vision)
    const detectedBulan = (geminiAnalysis?.bulan && INDONESIAN_MONTHS.includes(geminiAnalysis.bulan))
      ? geminiAnalysis.bulan
      : detectMonthFromText(messageText);

    const parsedAiNominal = parseReceiptNominal(geminiAnalysis?.nominal);
    const detectedNominal = (parsedAiNominal > 0)
      ? parsedAiNominal
      : detectNominalFromText(messageText);

    const detectedDate = geminiAnalysis?.tanggal || new Date().toISOString().split("T")[0];
    const detectedTime = geminiAnalysis?.waktu || new Date().toTimeString().slice(0, 5);
    const currentYear = geminiAnalysis?.tahun || new Date().getFullYear();

    // Cari kecocokan data siswa di Supabase berdasarkan nomor WhatsApp pengirim
    let matchedStudent: any = null;
    let matchedStudents: any[] = [];
    let targetUserId = explicitUserId;

    if (senderPhone) {
      const suffix8 = senderPhone.slice(-8); // 8 digit terakhir untuk toleransi format 08 / 62
      try {
        let studentQuery = serverSupabase
          .from("students")
          .select("id, nama_lengkap, kelompok, user_id, nominal_spp, nomor_whatsapp")
          .neq("status_aktif", false);

        if (targetUserId) {
          studentQuery = studentQuery.eq("user_id", targetUserId);
        }

        const { data: students } = await studentQuery;

        if (students && students.length > 0) {
          const suffix8 = senderPhone.slice(-8);
          const phoneMatches = students.filter((s: any) => {
            const cleanS = (s.nomor_whatsapp || "").replace(/\D/g, "");
            if (!cleanS || cleanS.length < 8) return false;
            const cleanSuffix = cleanS.slice(-8);
            return cleanS === senderPhone || senderPhone.endsWith(cleanSuffix) || cleanS.endsWith(suffix8);
          });

          if (phoneMatches.length > 0) {
            matchedStudents = phoneMatches;
            matchedStudent = phoneMatches[0];
          }

          if (!matchedStudent && messageText && messageText.trim().length >= 3) {
            const lowerMsg = messageText.toLowerCase();
            const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Cocokkan nama HANYA dengan batas kata (word boundaries) agar kata seperti "aidan" tidak cocok di dalam "zaidan"
            const textMatches = students.filter((s: any) => {
              const name = (s.nama_lengkap || "").trim().toLowerCase();
              if (name.length < 3) return false;
              const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escapeRegex(name)}(?:$|[^a-zA-Z0-9])`, 'i');
              return regex.test(lowerMsg);
            });

            if (textMatches.length === 1) {
              matchedStudent = textMatches[0];
              matchedStudents = [matchedStudent];
            } else if (textMatches.length > 1) {
              // Jika ada lebih dari 1 siswa yang cocok di teks:
              // Periksa apakah mereka BENAR-BENAR saudara kandung (nomor WhatsApp orang tua sama)
              const firstPhone = (textMatches[0].nomor_whatsapp || '').replace(/\D/g, '').slice(-8);
              const areTrueSiblings = firstPhone.length >= 8 && textMatches.every((s: any) => {
                const sPhone = (s.nomor_whatsapp || '').replace(/\D/g, '').slice(-8);
                return sPhone === firstPhone;
              });

              if (areTrueSiblings) {
                // Benar-benar kakak-adik dengan nomor HP keluarga yang sama
                matchedStudents = textMatches;
                matchedStudent = textMatches[0];
              } else {
                // BUKAN saudara kandung (nomor HP berbeda):
                // Urutkan berdasarkan kemunculan paling awal di pesan (nama depan) dan panjang nama
                const sortedByPosition = [...textMatches].sort((a: any, b: any) => {
                  const nameA = (a.nama_lengkap || "").trim().toLowerCase();
                  const nameB = (b.nama_lengkap || "").trim().toLowerCase();
                  const posA = lowerMsg.indexOf(nameA);
                  const posB = lowerMsg.indexOf(nameB);
                  if (posA !== posB) return posA - posB;
                  return nameB.length - nameA.length;
                });

                matchedStudent = sortedByPosition[0];
                matchedStudents = [matchedStudent];
              }
            }
          }

          if (matchedStudent && matchedStudents.length <= 1) {
            const cleanTargetPhone = (matchedStudent.nomor_whatsapp || "").replace(/\D/g, "");
            if (cleanTargetPhone && cleanTargetPhone.length >= 8) {
              const targetSuffix = cleanTargetPhone.slice(-8);
              const siblings = students.filter((s: any) => {
                const cleanS = (s.nomor_whatsapp || "").replace(/\D/g, "");
                return cleanS && (cleanS === cleanTargetPhone || cleanS.endsWith(targetSuffix) || cleanTargetPhone.endsWith(cleanS.slice(-8)));
              });
              if (siblings.length > 1) {
                matchedStudents = siblings;
              }
            }
          }

          if (matchedStudent && !targetUserId) {
            targetUserId = matchedStudent.user_id;
          }
        }
      } catch (err) {
        console.warn("Gagal lookup siswa di Supabase:", err);
      }
    }

    let activeUserGatewayConfig: any = null;
    if (targetUserId) {
      try {
        const { data: userConf } = await serverSupabase
          .from("user_settings")
          .select("wa_gateway_config")
          .eq("user_id", targetUserId)
          .maybeSingle();
        activeUserGatewayConfig = userConf?.wa_gateway_config;
      } catch (_) {}
    }

    // Transfer Kakak-Adik HANYA valid jika terdapat lebih dari 1 siswa DAN semuanya benar-benar berbagi nomor WhatsApp keluarga yang sama
    const isSiblingTransfer = matchedStudents.length > 1 && matchedStudents.every((s: any, _: any, arr: any[]) => {
      const p1 = (s.nomor_whatsapp || "").replace(/\D/g, "").slice(-8);
      const p2 = (arr[0]?.nomor_whatsapp || "").replace(/\D/g, "").slice(-8);
      return p1.length >= 8 && p1 === p2;
    });
    const combinedSpp = matchedStudents.reduce((sum: number, s: any) => sum + (Number(s.nominal_spp) || 0), 0);
    const referenceSpp = combinedSpp > 0 ? combinedSpp : matchedStudent?.nominal_spp;

    let finalNominal = parseReceiptNominal(
      (parsedAiNominal > 0 ? parsedAiNominal : detectedNominal),
      referenceSpp
    ) || (referenceSpp || detectedNominal);

    if (referenceSpp && finalNominal === referenceSpp * 100) {
      finalNominal = referenceSpp;
    }

    const studentNamesCombined = isSiblingTransfer
      ? matchedStudents.map((s: any) => s.nama_lengkap).join(" & ")
      : (matchedStudent?.nama_lengkap || senderName);

    const studentKelompokCombined = isSiblingTransfer
      ? matchedStudents.map((s: any) => s.kelompok || "-").join(", ")
      : (matchedStudent?.kelompok || "-");

    let confNotes = geminiAnalysis?.confidenceNotes || (geminiAnalysis ? "Terverifikasi Gemini Vision" : undefined);
    if (isSiblingTransfer) {
      const siblingNames = matchedStudents.map((s: any) => `${s.nama_lengkap} (${s.kelompok || '-'})`).join(', ');
      confNotes = `👨‍👩‍👧‍👦 Terdeteksi Transfer Kakak-Adik (${matchedStudents.length} Siswa): ${siblingNames}. ${confNotes || ''}`.trim();
    } else if (referenceSpp && finalNominal >= 2 * referenceSpp) {
      const monthsCount = Math.floor(finalNominal / referenceSpp);
      confNotes = `⚡ Terdeteksi Pembayaran ${monthsCount} Bulan Sekaligus (@ Rp ${referenceSpp.toLocaleString('id-ID')}). ${confNotes || ''}`.trim();
    }

    // Deteksi Alokasi Bulan SPP Otomatis atau Program Daftar Ulang / Kelulusan
    let allocatedBulanText = detectedBulan;
    let waBulanLabel = detectedBulan;
    let matchedProgramObj: any = null;

    if (targetUserId && matchedStudent) {
      try {
        const { data: userProgs } = await serverSupabase
          .from("re_registration_programs")
          .select("*")
          .eq("user_id", targetUserId);

        if (userProgs && userProgs.length > 0) {
          const studentId = matchedStudent.id;
          matchedProgramObj = userProgs.find((p: any) =>
            p.fee === finalNominal && (p.student_ids || []).includes(studentId)
          ) || userProgs.find((p: any) => p.fee === finalNominal);

          if (matchedProgramObj) {
            allocatedBulanText = matchedProgramObj.name;
            waBulanLabel = `${matchedProgramObj.name} (${matchedProgramObj.type === 'graduation' ? 'Kelulusan' : 'Daftar Ulang'})`;
            confNotes = `🎓 Terdeteksi Tagihan ${matchedProgramObj.type === 'graduation' ? 'Kelulusan' : 'Daftar Ulang'}: ${matchedProgramObj.name} (Rp ${matchedProgramObj.fee.toLocaleString('id-ID')}). ${confNotes || ''}`.trim();
          }
        }
      } catch (_) {}
    }

    if (!matchedProgramObj && !isSiblingTransfer && matchedStudent) {
      try {
        const studentSpp = Number(matchedStudent.nominal_spp) || 100000;
        const { data: studentPayments } = await serverSupabase
          .from("payments")
          .select("bulan, tahun")
          .eq("student_id", matchedStudent.id);

        const isPaid = (b: string, y: number) => {
          return (studentPayments || []).some((p: any) => p.bulan === b && Number(p.tahun) === Number(y));
        };

        const count = Math.max(1, Math.floor(finalNominal / studentSpp));
        let currBulan = detectedBulan || INDONESIAN_MONTHS[new Date().getMonth()];
        let currTahun = currentYear || new Date().getFullYear();

        const skippedPaid: string[] = [];
        let searchLimit = 0;
        while (isPaid(currBulan, currTahun) && searchLimit < 24) {
          skippedPaid.push(currBulan);
          const idx = INDONESIAN_MONTHS.indexOf(currBulan);
          if (idx === -1 || idx === 11) {
            currBulan = INDONESIAN_MONTHS[0];
            currTahun = currTahun + 1;
          } else {
            currBulan = INDONESIAN_MONTHS[idx + 1];
          }
          searchLimit++;
        }

        const allocMonths: string[] = [];
        let allocLimit = 0;
        while (allocMonths.length < count && allocLimit < 36) {
          if (!isPaid(currBulan, currTahun)) {
            allocMonths.push(currBulan);
          }
          const idx = INDONESIAN_MONTHS.indexOf(currBulan);
          if (idx === -1 || idx === 11) {
            currBulan = INDONESIAN_MONTHS[0];
            currTahun = currTahun + 1;
          } else {
            currBulan = INDONESIAN_MONTHS[idx + 1];
          }
          allocLimit++;
        }

        if (allocMonths.length > 1) {
          allocatedBulanText = allocMonths.join(' & ');
          waBulanLabel = `${allocMonths.join(' & ')} (${allocMonths.length} Bulan Sekaligus)`;
        } else if (allocMonths.length === 1) {
          allocatedBulanText = allocMonths[0];
          waBulanLabel = skippedPaid.length > 0 
            ? `${allocMonths[0]} (Bulan Lanjutan)` 
            : allocMonths[0];
        }
      } catch (_) {}
    }

    const verificationRecord: CachedVerification = {
      id: "verif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      user_id: targetUserId || undefined,
      student_id: matchedStudent?.id || null,
      student_name: studentNamesCombined,
      student_kelompok: studentKelompokCombined,
      sender_phone: senderPhone,
      sender_name: isSiblingTransfer ? studentNamesCombined : senderName,
      message_text: messageText,
      proof_image_url: "ai_detected",
      bulan: allocatedBulanText,
      tahun: currentYear,
      nominal: finalNominal,
      tanggal_transfer: detectedDate,
      waktu_transfer: detectedTime,
      bank_pengirim: geminiAnalysis?.bankPengirim || undefined,
      bank_tujuan: geminiAnalysis?.bankTujuan || undefined,
      nama_rekening_pengirim: geminiAnalysis?.namaPengirim || undefined,
      confidence_notes: confNotes,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    // Simpan ke in-memory cache
    memoryVerifications.unshift(verificationRecord);
    if (memoryVerifications.length > 100) memoryVerifications.pop();

    // Simpan ke tabel Supabase `payment_verifications` jika ada
    try {
      if (targetUserId) {
        await serverSupabase.from("payment_verifications").insert([
          {
            user_id: targetUserId,
            student_id: matchedStudent?.id || null,
            sender_phone: senderPhone,
            sender_name: verificationRecord.sender_name,
            message_text: messageText,
            proof_image_url: "ai_detected",
            bulan: allocatedBulanText,
            tahun: currentYear,
            nominal: verificationRecord.nominal,
            tanggal_transfer: detectedDate,
            waktu_transfer: detectedTime,
            bank_pengirim: verificationRecord.bank_pengirim,
            bank_tujuan: verificationRecord.bank_tujuan,
            nama_rekening_pengirim: verificationRecord.nama_rekening_pengirim,
            confidence_notes: verificationRecord.confidence_notes,
            status: "pending",
          }
        ]);
      }
    } catch (e) {
      console.warn("Gagal simpan ke Supabase payment_verifications (mungkin tabel belum dibuat):", e);
    }

    // Auto-Reply pesan WhatsApp ke Orang Tua jika gateway credentials tersedia
    if (appkey && authkey && senderPhone) {
      const studentNameStr = isSiblingTransfer
        ? `ananda ${matchedStudents.map((s: any) => s.nama_lengkap).join(" dan ")}`
        : (matchedStudent ? `ananda ${matchedStudent.nama_lengkap}` : "ananda");
      const bankInfoStr = verificationRecord.bank_pengirim ? ` melalui ${verificationRecord.bank_pengirim}` : "";
      const nominalVal = verificationRecord.nominal > 0 ? `Rp ${verificationRecord.nominal.toLocaleString("id-ID")}` : "";
      const nominalTeks = verificationRecord.nominal > 0 ? ` sebesar ${nominalVal}` : "";

      const customTemplate = activeUserGatewayConfig?.templates?.receiptReceived;
      const parentLink = targetUserId ? `https://catatoh.my.id/kartu-spp-ortu/${targetUserId}` : `https://catatoh.my.id/kartu-spp-ortu`;
      let replyMsg: string;

      if (customTemplate) {
        replyMsg = customTemplate
          .replace(/\[NAMA_SISWA\]/g, studentNameStr)
          .replace(/\[BULAN\]/g, waBulanLabel || detectedBulan || "")
          .replace(/\[TAHUN\]/g, String(currentYear || new Date().getFullYear()))
          .replace(/\[NOMINAL\]/g, nominalVal)
          .replace(/\[NOMINAL_TEKS\]/g, nominalTeks)
          .replace(/\[TANGGAL\]/g, detectedDate)
          .replace(/\[BANK\]/g, verificationRecord.bank_pengirim || "Bank / E-Wallet")
          .replace(/\[LINK_SPP\]/g, parentLink);
      } else {
        const nominalStr = verificationRecord.nominal > 0 ? ` sebesar Rp ${verificationRecord.nominal.toLocaleString("id-ID")}` : "";
        const programLabel = matchedProgramObj
          ? `biaya ${matchedProgramObj.type === 'graduation' ? 'Kelulusan' : 'Daftar Ulang'} *${matchedProgramObj.name}*`
          : `pembayaran SPP bulan *${waBulanLabel}*`;
        replyMsg = `Halo Ayah/Bunda, bukti pembayaran ${programLabel} ${studentNameStr}${nominalStr}${bankInfoStr} pada tanggal ${detectedDate} telah kami terima dan masuk antrean verifikasi bendahara sekolah.\n\nCek kartu SPP ananda di link resmi:\n${parentLink}\n\nTerima kasih! 🙏`;
      }

      try {
        const formData = new URLSearchParams();
        formData.append("appkey", appkey);
        formData.append("authkey", authkey);
        formData.append("to", senderPhone);
        formData.append("message", replyMsg);

        await fetch("https://app.starsender.online/api/sendText", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });
      } catch (replyErr) {
        console.warn("Gagal mengirim auto-reply WA:", replyErr);
      }
    }

    return res.json({
      status: "success",
      message: "Webhook diterima dan diproses.",
      verificationId: verificationRecord.id,
      studentMatched: !!matchedStudent,
      studentName: matchedStudent?.nama_lengkap || null,
    });
  } catch (error: any) {
    console.error("Inbound webhook error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Gagal memproses webhook.",
    });
  }
});

// =========================================================================
// 3. SIMULASI WEBHOOK: Uji Coba Bukti Pembayaran Masuk Tanpa Gateway Asli
// =========================================================================
app.post("/api/webhook/simulate", async (req, res) => {
  try {
    const { userId, studentId, studentName, senderPhone, messageText, proofImageUrl, bulan, nominal, tanggal, waktu, bank } = req.body;

    const currentYear = new Date().getFullYear();
    const verificationRecord: CachedVerification = {
      id: "sim_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      user_id: userId,
      student_id: studentId || null,
      student_name: studentName || "Siswa Uji Coba",
      student_kelompok: "Kelompok A",
      sender_phone: normalizePhoneDigits(senderPhone || "6281234567890"),
      sender_name: "Wali Murid (Simulasi)",
      message_text: messageText || "Assalamualaikum, ini bukti transfer SPP bulan " + (bulan || "Maret"),
      proof_image_url: "ai_detected",
      bulan: bulan || detectMonthFromText(messageText),
      tahun: currentYear,
      nominal: nominal ? Number(nominal) : 100000,
      tanggal_transfer: tanggal || new Date().toISOString().split("T")[0],
      waktu_transfer: waktu || new Date().toTimeString().slice(0, 5),
      bank_pengirim: bank || "BCA Mobile",
      nama_rekening_pengirim: "Wali Siswa (Simulasi)",
      confidence_notes: "Simulasi Bukti Transfer Valid (Terverifikasi Gemini)",
      status: "pending",
      created_at: new Date().toISOString(),
    };

    memoryVerifications.unshift(verificationRecord);

    // Coba simpan juga ke Supabase jika tabel ada
    try {
      if (userId) {
        await serverSupabase.from("payment_verifications").insert([
          {
            user_id: userId,
            student_id: studentId || null,
            sender_phone: verificationRecord.sender_phone,
            sender_name: verificationRecord.sender_name,
            message_text: verificationRecord.message_text,
            proof_image_url: "ai_detected",
            bulan: verificationRecord.bulan,
            tahun: verificationRecord.tahun,
            nominal: verificationRecord.nominal,
            tanggal_transfer: verificationRecord.tanggal_transfer,
            waktu_transfer: verificationRecord.waktu_transfer,
            bank_pengirim: verificationRecord.bank_pengirim,
            confidence_notes: verificationRecord.confidence_notes,
            status: "pending",
          }
        ]);
      }
    } catch (e) {
      // Abaikan jika tabel belum ada
    }

    return res.json({
      success: true,
      message: "Simulasi bukti pembayaran berhasil dibuat!",
      data: verificationRecord,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =========================================================================
// 4. API BUKTI VERIFIKASI: Ambil & Update Status Verifikasi Pembayaran
// =========================================================================
app.get("/api/webhook/verifications", (req, res) => {
  const { userId } = req.query;
  const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  let list = memoryVerifications.filter(v => {
    // Auto purge verifikasi berstatus approved yang berumur lebih dari 14 hari
    if (v.status === 'approved') {
      const vTime = new Date(v.created_at).getTime();
      if (now - vTime > fourteenDaysInMs) return false;
    }
    return true;
  });

  if (userId) {
    list = list.filter(v => !v.user_id || v.user_id === userId);
  }
  res.json({
    success: true,
    data: list,
  });
});

app.post("/api/webhook/verifications/reset", async (req, res) => {
  memoryVerifications.length = 0;
  const { userId } = req.body || req.query || {};
  try {
    if (userId) {
      await serverSupabase.from("payment_verifications").delete().or(`user_id.eq.${userId},user_id.is.null`);
    } else {
      await serverSupabase.from("payment_verifications").delete().is("user_id", null);
    }
  } catch {}
  res.json({
    success: true,
    message: "Cache verifikasi server telah dikosongkan.",
  });
});

app.delete("/api/webhook/verifications/:id", async (req, res) => {
  const { id } = req.params;
  const idx = memoryVerifications.findIndex(v => v.id === id);
  if (idx !== -1) {
    memoryVerifications.splice(idx, 1);
  }
  try {
    await serverSupabase.from("payment_verifications").delete().eq("id", id);
  } catch {}
  res.json({
    success: true,
    message: "Bukti transfer berhasil dihapus dari server.",
  });
});

app.post("/api/webhook/verifications/:id/status", (req, res) => {
  const { id } = req.params;
  const { status, rejectReason } = req.body;

  const found = memoryVerifications.find(v => v.id === id);
  if (found) {
    found.status = status;
    if (rejectReason) found.reject_reason = rejectReason;
    found.updated_at = new Date().toISOString();
  }

  res.json({
    success: true,
    message: `Status verifikasi diperbarui ke ${status}`,
  });
});

// Helper to strip base64 data prefix
function cleanBase64(dataUrl: string): { mimeType: string; data: string } {
  if (dataUrl.includes(";base64,")) {
    const parts = dataUrl.split(";base64,");
    const mimeMatch = parts[0].match(/:(.*?)$/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    return { mimeType, data: parts[1] };
  }
  return { mimeType: "image/jpeg", data: dataUrl };
}

// API: Verify Attendance using Gemini 2.5 Flash Multimodal Vision
app.post("/api/gemini/verify-attendance", async (req, res) => {
  try {
    const { liveImage, candidates, attendanceType, schoolName, role = 'teacher' } = req.body;
    const isStudent = role === 'student';

    if (!liveImage) {
      return res.status(400).json({
        success: false,
        error: "liveImage is required",
      });
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        success: false,
        error: "candidates array is required and must not be empty",
      });
    }

    const ai = getGemini();
    const liveClean = cleanBase64(liveImage);

    // Build prompt parts
    const parts: any[] = [];

    // Attach live image as primary part
    parts.push({
      inlineData: {
        mimeType: liveClean.mimeType,
        data: liveClean.data,
      },
    });

    // Attach reference photos if candidates provide them
    const validPhotoCandidates: any[] = [];
    candidates.forEach((cand: any, idx: number) => {
      const photoStr = cand.photo || cand.profile_picture;
      if (photoStr && typeof photoStr === "string" && photoStr.length > 50) {
        const refClean = cleanBase64(photoStr);
        parts.push({
          inlineData: {
            mimeType: refClean.mimeType,
            data: refClean.data,
          },
        });
        validPhotoCandidates.push({
          index: idx,
          id: cand.id,
          name: cand.name || cand.nama_lengkap,
          nip: cand.nip || cand.nis || cand.kelompok || "-",
          hasPhoto: true,
        });
      } else {
        validPhotoCandidates.push({
          index: idx,
          id: cand.id,
          name: cand.name || cand.nama_lengkap,
          nip: cand.nip || cand.nis || cand.kelompok || "-",
          hasPhoto: false,
        });
      }
    });

    const candidatesSummary = validPhotoCandidates
      .map((c, i) => `[ID: "${c.id}", Name: "${c.name}", Code: "${c.nip || "-"}", HasPhoto: ${c.hasPhoto}]`)
      .join("\n");

    const promptText = `
You are the intelligent biometric vision AI for the school attendance kiosk at "${schoolName || "Sekolah"}".
The ${isStudent ? 'student' : 'teacher'} is performing "${attendanceType === "in" ? "ABSEN MASUK (Datang)" : "ABSEN PULANG"}".

TASK:
1. Examine the LIVE CAMERA snapshot (the first image provided).
2. Check if there is a real human face looking towards the camera (with reasonable lighting and angle).
3. Compare the live person against the registered ${isStudent ? 'student' : 'teacher'} candidate list and their reference photos:
Registered Candidates:
${candidatesSummary}

4. Determine if the live person matches any registered ${isStudent ? 'student' : 'teacher'} with reasonable confidence (match confidence score >= 50%).
   - Be tolerant and forgiving of natural variations such as differences in lighting, camera angles, distance, facial expressions, hairstyles, glasses, hijab, or slight facial aging.
   - If the person plausibly matches one of the registered candidates, set "matched": true and specify their ID and confidence (50-100%).
5. Generate an encouraging, natural Indonesian voice greeting for the ${isStudent ? 'student' : 'teacher'} (e.g., ${isStudent ? '"Selamat pagi [Name], absensi kehadiranmu berhasil dicatat. Semangat belajarnya hari ini!"' : '"Selamat pagi Ibu/Bapak [Name], absen [masuk/pulang] berhasil dicatat. Semangat bertugas!"'}).

Return strictly JSON adhering to the specified schema.
`;

    parts.push({ text: promptText });

    let result: any = null;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts },
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isHumanFaceDetected: {
                type: Type.BOOLEAN,
                description: "Whether a clear human face was detected in the live camera image",
              },
              isRealPerson: {
                type: Type.BOOLEAN,
                description: "Liveness check: true if real living person, false if photo/screen replay attack or invalid",
              },
              matched: {
                type: Type.BOOLEAN,
                description: "True if live face matches one of the registered candidates with >= 75% confidence",
              },
              matchedTeacherId: {
                type: Type.STRING,
                description: "The exact ID of the matched teacher, or empty string if not matched",
              },
              matchedTeacherName: {
                type: Type.STRING,
                description: "The name of the matched teacher, or empty string if not matched",
              },
              confidence: {
                type: Type.NUMBER,
                description: "Confidence percentage of the match (0 to 100)",
              },
              livenessReason: {
                type: Type.STRING,
                description: "Brief note or guidance in Indonesian (e.g. 'Wajah terdeteksi jelas', 'Posisikan wajah menghadap lurus')",
              },
              greeting: {
                type: Type.STRING,
                description: "Polite and cheerful Indonesian greeting to be spoken to the teacher",
              },
            },
            required: [
              "isHumanFaceDetected",
              "isRealPerson",
              "matched",
              "matchedTeacherId",
              "matchedTeacherName",
              "confidence",
              "greeting",
            ],
          },
        },
      });

      const rawText = response.text?.trim() || "{}";
      result = JSON.parse(rawText);
    } catch (geminiError: any) {
      console.warn("[GEMINI ATTENDANCE VERIFY FAILED, ATTEMPTING SUMOPOD GLM -> KOBOILLM FALLBACK]:", geminiError.message || geminiError);

      const contentParts: any[] = [
        { type: "text", text: promptText },
        {
          type: "image_url",
          image_url: { url: `data:${liveClean.mimeType};base64,${liveClean.data}` }
        }
      ];

      for (const cand of candidates) {
        const photoStr = cand.photo || cand.profile_picture;
        if (photoStr && typeof photoStr === "string" && photoStr.length > 50) {
          const refClean = cleanBase64(photoStr);
          contentParts.push({
            type: "image_url",
            image_url: { url: `data:${refClean.mimeType};base64,${refClean.data}` }
          });
        }
      }

      const openAiMessages = [{ role: "user", content: contentParts }];

      // Fallback 1: Sumopod GLM
      try {
        const sumopodRes = await executeOpenAiCompatibleChat(
          "SUMOPOD GLM VERIFY",
          SUMOPOD_CONFIG.baseUrl,
          SUMOPOD_CONFIG.apiKey,
          SUMOPOD_CONFIG.models,
          openAiMessages,
          0.1
        );
        if (sumopodRes.text) {
          const jsonMatch = sumopodRes.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) result = JSON.parse(jsonMatch[0]);
        }
      } catch (sumoErr) {
        console.warn("[SUMOPOD VERIFY ERROR]", sumoErr);
      }

      // Fallback 2: KoboldLLM
      if (!result) {
        console.warn("[SUMOPOD GLM VERIFY FAILED, ATTEMPTING KOBOILLM FALLBACK]");
        try {
          const koboldRes = await executeOpenAiCompatibleChat(
            "KOBOILLM VERIFY",
            KOBOILLM_CONFIG.baseUrl,
            KOBOILLM_CONFIG.apiKey,
            KOBOILLM_CONFIG.models,
            openAiMessages,
            0.1
          );
          if (koboldRes.text) {
            const jsonMatch = koboldRes.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) result = JSON.parse(jsonMatch[0]);
          }
        } catch (koboErr) {
          console.error("[KOBOILLM VERIFY ERROR]", koboErr);
        }
      }
    }

    if (result) {
      return res.json({
        success: true,
        data: result,
      });
    }

    throw new Error("Semua provider AI (Gemini, Sumopod GLM, KoboldLLM) gagal memproses verifikasi kehadiran.");
  } catch (error: any) {
    console.error("Attendance verification error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to process attendance with AI Vision",
    });
  }
});

// API: Register / Validate Face with Gemini 2.5 Flash Vision
app.post("/api/gemini/register-face", async (req, res) => {
  try {
    const { image, teacherName } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: "image is required",
      });
    }

    const ai = getGemini();
    const cleanImg = cleanBase64(image);

    const parts = [
      {
        inlineData: {
          mimeType: cleanImg.mimeType,
          data: cleanImg.data,
        },
      },
      {
        text: `
You are an AI face registration assistant for teacher "${teacherName || "Guru"}".
Analyze this photo to ensure it meets high-quality biometric requirements for school attendance.

Check:
1. Is there exactly 1 clear human face in the photo?
2. Are the eyes open and face clearly visible with decent lighting?
3. Provide a brief visual summary of face features to aid future matching (e.g., gender, glasses, facial hair, hijab, haircut).
4. Provide a friendly validation message in Indonesian.

Return strictly JSON adhering to the schema.
`,
      },
    ];

    let result: any = null;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts },
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isValidFace: {
                type: Type.BOOLEAN,
                description: "True if there is exactly 1 clear, well-lit human face suitable for attendance",
              },
              faceCount: {
                type: Type.INTEGER,
                description: "Number of faces detected in the image",
              },
              feedback: {
                type: Type.STRING,
                description: "Indonesian feedback to display to the user",
              },
              visualProfile: {
                type: Type.STRING,
                description: "Brief visual characteristics description in Indonesian",
              },
            },
            required: ["isValidFace", "faceCount", "feedback", "visualProfile"],
          },
        },
      });

      const rawText = response.text?.trim() || "{}";
      result = JSON.parse(rawText);
    } catch (geminiError: any) {
      console.warn("[GEMINI REGISTER FACE FAILED, ATTEMPTING SUMOPOD GLM -> KOBOILLM FALLBACK]:", geminiError.message || geminiError);
      const openAiMessages = [
        {
          role: "user",
          content: [
            { type: "text", text: parts[1].text },
            { type: "image_url", image_url: { url: `data:${cleanImg.mimeType};base64,${cleanImg.data}` } }
          ]
        }
      ];

      // Fallback 1: Sumopod GLM
      try {
        const sumopodRes = await executeOpenAiCompatibleChat(
          "SUMOPOD GLM REGISTER",
          SUMOPOD_CONFIG.baseUrl,
          SUMOPOD_CONFIG.apiKey,
          SUMOPOD_CONFIG.models,
          openAiMessages,
          0.1
        );
        if (sumopodRes.text) {
          const jsonMatch = sumopodRes.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) result = JSON.parse(jsonMatch[0]);
        }
      } catch (sumoErr) {
        console.warn("[SUMOPOD REGISTER ERROR]", sumoErr);
      }

      // Fallback 2: KoboldLLM
      if (!result) {
        try {
          const koboldRes = await executeOpenAiCompatibleChat(
            "KOBOILLM REGISTER",
            KOBOILLM_CONFIG.baseUrl,
            KOBOILLM_CONFIG.apiKey,
            KOBOILLM_CONFIG.models,
            openAiMessages,
            0.1
          );
          if (koboldRes.text) {
            const jsonMatch = koboldRes.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) result = JSON.parse(jsonMatch[0]);
          }
        } catch (koboErr) {
          console.error("[KOBOILLM REGISTER ERROR]", koboErr);
        }
      }
    }

    if (result) {
      return res.json({
        success: true,
        data: result,
      });
    }

    throw new Error("Semua provider AI gagal menganalisis foto registrasi wajah.");
  } catch (error: any) {
    console.error("Face registration error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to analyze face photo with AI Vision",
    });
  }
});

// API: Generate warm Indonesian voice greeting for attendance success (Gemini Text-to-Speech prompt)
app.post("/api/gemini/generate-greeting", async (req, res) => {
  try {
    const { name, attendanceType, time, schoolName, role = 'teacher' } = req.body;
    const isStudent = role === 'student';
    const ai = getGemini();

    const isDatang = attendanceType === 'in';
    const typeLabel = isDatang ? 'Absen Datang (Masuk)' : 'Absen Pulang';
    const prompt = isStudent
      ? `
Buatkan 1 kalimat sapaan suara (Text-to-Speech) bahasa Indonesia yang ramah, hangat, ceria, dan memotivasi seorang murid/siswa bernama "${name || "Siswa"}" yang baru saja berhasil melakukan "${typeLabel}" di sekolah "${schoolName || "Sekolah"}".

Ketentuan:
1. Jika Absen Datang: Berikan ucapan selamat pagi/siang ceria, sebut nama siswa secara hangat, konfirmasi absensi berhasil, dan berikan semangat belajar yang menyenangkan (Contoh: "Selamat pagi ${name || "Siswa"}, absensimu berhasil dicatat. Semangat belajar dan raih prestasi hari ini!").
2. Jika Absen Pulang: Berikan ucapan terima kasih telah belajar giat hari ini, konfirmasi absensi pulang berhasil, doakan keselamatan di perjalanan dan selamat beristirahat (Contoh: "Hebat sekali hari ini ${name || "Siswa"}, absen pulangmu telah tercatat. Hati-hati di jalan dan selamat beristirahat di rumah!").
3. Panjang maksimal 1-2 kalimat ringkas, natural untuk dibacakan oleh mesin suara Text-to-Speech tanpa simbol aneh, markdown, atau emoji.

Keluarkan teks sapaan saja secara langsung.
`
      : `
Buatkan 1 kalimat sapaan suara (Text-to-Speech) bahasa Indonesia yang ramah, sopan, antusias, dan menghargai seorang guru bernama "${name || "Bapak/Ibu Guru"}" yang baru saja berhasil melakukan "${typeLabel}" di sekolah "${schoolName || "Sekolah"}".

Ketentuan:
1. Jika Absen Datang: Berikan ucapan selamat pagi atau siang, sebutkan nama guru secara terhormat, konfirmasi kehadiran berhasil, dan berikan doa atau semangat mengajar yang menyenangkan. (Contoh: "Selamat pagi Bapak ${name || "Guru"}, absensi datang berhasil dicatat. Selamat mendidik dan semangat bertugas hari ini!")
2. Jika Absen Pulang: Berikan ucapan terima kasih atas dedikasinya hari ini, konfirmasi absensi pulang berhasil, dan doakan selamat istirahat serta perjalanan pulang yang aman. (Contoh: "Terima kasih Ibu ${name || "Guru"}, absensi pulang Anda telah tercatat dengan baik. Selamat beristirahat bersama keluarga dan hati-hati di jalan!")
3. Panjang maksimal 1-2 kalimat ringkas, natural untuk dibacakan oleh mesin suara Text-to-Speech tanpa simbol aneh, markdown, atau emoji.

Keluarkan teks sapaan saja secara langsung.
`;

    let greetingText: string | null = null;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.7,
        },
      });
      greetingText = response.text?.trim() || null;
    } catch (geminiError: any) {
      console.warn("[GEMINI GREETING FAILED, ATTEMPTING SUMOPOD GLM -> KOBOILLM FALLBACK]:", geminiError.message || geminiError);
      try {
        const sumopodRes = await executeOpenAiCompatibleChat(
          "SUMOPOD GLM GREETING",
          SUMOPOD_CONFIG.baseUrl,
          SUMOPOD_CONFIG.apiKey,
          SUMOPOD_CONFIG.models,
          [{ role: "user", content: prompt }],
          0.7
        );
        if (sumopodRes.text) greetingText = sumopodRes.text.trim();
      } catch (sumoErr) {
        console.warn("[SUMOPOD GREETING ERROR]", sumoErr);
      }

      if (!greetingText) {
        try {
          const koboldRes = await executeOpenAiCompatibleChat(
            "KOBOILLM GREETING",
            KOBOILLM_CONFIG.baseUrl,
            KOBOILLM_CONFIG.apiKey,
            KOBOILLM_CONFIG.models,
            [{ role: "user", content: prompt }],
            0.7
          );
          if (koboldRes.text) greetingText = koboldRes.text.trim();
        } catch (koboErr) {
          console.error("[KOBOILLM GREETING ERROR]", koboErr);
        }
      }
    }

    const defaultGreeting = isStudent
      ? (isDatang 
          ? `Selamat datang ${name || "Siswa"}, absensi hadirmu berhasil dicatat. Semangat belajarnya hari ini!`
          : `Terima kasih ${name || "Siswa"}, absensi pulangmu tercatat. Hati-hati di jalan dan selamat istirahat!`)
      : (isDatang 
          ? `Selamat datang ${name || "Bapak/Ibu Guru"}, absensi datang Anda berhasil dicatat. Selamat bertugas!` 
          : `Terima kasih ${name || "Bapak/Ibu Guru"}, absensi pulang berhasil dicatat. Selamat beristirahat dan hati-hati di jalan!`);

    const greeting = greetingText?.replace(/^["']|["']$/g, "") || defaultGreeting;

    return res.json({
      success: true,
      greeting,
    });
  } catch (error: any) {
    console.error("Generate-greeting error:", error);
    const isDatang = req.body?.attendanceType === 'in';
    const isStudent = req.body?.role === 'student';
    const name = req.body?.name || (isStudent ? "Siswa" : "Bapak/Ibu Guru");
    const fallback = isStudent
      ? (isDatang
          ? `Selamat datang ${name}, absensi hadirmu berhasil dicatat. Semangat belajarnya hari ini!`
          : `Terima kasih ${name}, absensi pulangmu tercatat. Hati-hati di jalan dan selamat istirahat!`)
      : (isDatang
          ? `Selamat datang ${name}, absensi datang Anda berhasil dicatat. Selamat bertugas!`
          : `Terima kasih ${name}, absensi pulang berhasil dicatat. Selamat beristirahat dan hati-hati di jalan!`);
    return res.json({
      success: true,
      greeting: fallback,
      fallback: true
    });
  }
});

// Start server with Vite middleware (development) or static files (production)
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
