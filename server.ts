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
    const apiKey = process.env.GEMINI_API_KEY;
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
  // Match numbers formatted like 150.000 or 150,000 or 150000
  const match = text.match(/(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+(?:\s*(?:ribu|rb))?|\d{4,9})/i);
  if (match) {
    const rawNum = match[1].replace(/[.,]/g, '');
    const parsed = parseInt(rawNum, 10);
    if (!isNaN(parsed) && parsed >= 10000 && parsed <= 50000000) {
      return parsed;
    }
  }
  return 100000;
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

async function analyzeReceiptWithGemini(imageUrl: string, messageCaption?: string): Promise<ReceiptAnalysisResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY tidak ditemukan, fallback ke parser reguler.");
    return null;
  }

  try {
    const ai = getGemini();

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
      const imgRes = await fetch(imageUrl, { signal: controller.signal });
      clearTimeout(timeout);

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
   - "nominal": angka bulat murni transfer (misal 150000). Jika ada kode unik misal Rp 150.123, masukkan 150123.
   - "tanggal": format YYYY-MM-DD (misal 2026-03-21) dari tanggal transaksi di struk.
   - "waktu": format HH:mm 24 jam (misal 08:35) dari jam transfer di struk.
   - "bulan": nama bulan dalam bahasa Indonesia (Januari-Desember) yang bersangkutan.
   - "bankPengirim": nama bank / e-wallet pengirim (misal BCA, BRI, Mandiri, BSI, DANA).
   - "bankTujuan": nama bank tujuan atau rekening penerima jika terlihat.
   - "namaPengirim": nama pemilik rekening pengirim jika tertera.
   - "statusTransaksi": 'BERHASIL' / 'PENDING' / 'GAGAL'.
   - "confidenceNotes": ringkasan singkat hasil bacaan (contoh: "Struk BCA Mobile Berhasil Rp 150.000 tgl 21/03/2026 09:12 WIB").

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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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

    const text = response.text || "";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    console.log("[GEMINI VISION RECEIPT ANALYSIS SUCCESS]", parsed);
    return parsed as ReceiptAnalysisResult;
  } catch (err: any) {
    console.error("[GEMINI VISION RECEIPT ANALYSIS ERROR]", err);
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
      if (!geminiAnalysis.isTransferReceipt) {
        console.log("[INBOUND REJECTED BY GEMINI] Bukan bukti transfer:", geminiAnalysis.confidenceNotes);
        return res.json({
          status: "ignored",
          reason: "not_a_transfer_receipt",
          message: "Gambar diterima tetapi bukan struk/bukti transfer yang valid. Moderasi SPP tidak dipicu.",
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

    const detectedNominal = (geminiAnalysis?.nominal && geminiAnalysis.nominal > 0)
      ? geminiAnalysis.nominal
      : detectNominalFromText(messageText);

    const detectedDate = geminiAnalysis?.tanggal || new Date().toISOString().split("T")[0];
    const detectedTime = geminiAnalysis?.waktu || new Date().toTimeString().slice(0, 5);
    const currentYear = geminiAnalysis?.tahun || new Date().getFullYear();

    // Cari kecocokan data siswa di Supabase berdasarkan nomor WhatsApp pengirim
    let matchedStudent: any = null;
    let targetUserId = explicitUserId;

    if (senderPhone) {
      const suffix8 = senderPhone.slice(-8); // 8 digit terakhir untuk toleransi format 08 / 62
      try {
        let studentQuery = serverSupabase
          .from("students")
          .select("id, nama_lengkap, kelompok, user_id, nominal_spp, nomor_whatsapp")
          .eq("status_aktif", true);

        if (targetUserId) {
          studentQuery = studentQuery.eq("user_id", targetUserId);
        }

        const { data: students } = await studentQuery;

        if (students && students.length > 0) {
          matchedStudent = students.find((s: any) => {
            const cleanS = (s.nomor_whatsapp || "").replace(/\D/g, "");
            return cleanS.endsWith(suffix8) || senderPhone.endsWith(cleanS.slice(-8));
          });

          if (matchedStudent && !targetUserId) {
            targetUserId = matchedStudent.user_id;
          }
        }
      } catch (err) {
        console.warn("Gagal lookup siswa di Supabase:", err);
      }
    }

    const verificationRecord: CachedVerification = {
      id: "verif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      user_id: targetUserId || undefined,
      student_id: matchedStudent?.id || null,
      student_name: matchedStudent?.nama_lengkap || senderName,
      student_kelompok: matchedStudent?.kelompok || "-",
      sender_phone: senderPhone,
      sender_name: senderName,
      message_text: messageText,
      proof_image_url: proofImageUrl,
      bulan: detectedBulan,
      tahun: currentYear,
      nominal: (geminiAnalysis?.nominal && geminiAnalysis.nominal > 0) ? geminiAnalysis.nominal : (matchedStudent?.nominal_spp || detectedNominal),
      tanggal_transfer: detectedDate,
      waktu_transfer: detectedTime,
      bank_pengirim: geminiAnalysis?.bankPengirim || undefined,
      bank_tujuan: geminiAnalysis?.bankTujuan || undefined,
      nama_rekening_pengirim: geminiAnalysis?.namaPengirim || undefined,
      confidence_notes: geminiAnalysis?.confidenceNotes || (geminiAnalysis ? "Terverifikasi Gemini Vision" : undefined),
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
            sender_name: senderName,
            message_text: messageText,
            proof_image_url: verificationRecord.proof_image_url,
            bulan: detectedBulan,
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
      const studentNameStr = matchedStudent ? `ananda ${matchedStudent.nama_lengkap}` : "ananda";
      const bankInfoStr = verificationRecord.bank_pengirim ? ` melalui ${verificationRecord.bank_pengirim}` : "";
      const nominalStr = verificationRecord.nominal > 0 ? ` sebesar Rp ${verificationRecord.nominal.toLocaleString("id-ID")}` : "";
      const replyMsg = `Halo Ayah/Bunda, bukti pembayaran SPP ${studentNameStr} untuk bulan ${detectedBulan}${nominalStr}${bankInfoStr} pada tanggal ${detectedDate} telah kami terima dan masuk antrean verifikasi bendahara sekolah. Kami akan segera mengonfirmasi status pembayarannya. Terima kasih! 🙏`;

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
      proof_image_url: proofImageUrl || "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80",
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
            proof_image_url: verificationRecord.proof_image_url,
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
  let list = memoryVerifications;
  if (userId) {
    list = memoryVerifications.filter(v => !v.user_id || v.user_id === userId);
  }
  res.json({
    success: true,
    data: list,
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
    const result = JSON.parse(rawText);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Gemini attendance verification error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to process attendance with Gemini Vision",
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
    const result = JSON.parse(rawText);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Gemini register face error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to analyze face photo with Gemini",
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    const defaultGreeting = isStudent
      ? (isDatang 
          ? `Selamat datang ${name || "Siswa"}, absensi hadirmu berhasil dicatat. Semangat belajarnya hari ini!`
          : `Terima kasih ${name || "Siswa"}, absensi pulangmu tercatat. Hati-hati di jalan dan selamat istirahat!`)
      : (isDatang 
          ? `Selamat datang ${name || "Bapak/Ibu Guru"}, absensi datang Anda berhasil dicatat. Selamat bertugas!` 
          : `Terima kasih ${name || "Bapak/Ibu Guru"}, absensi pulang berhasil dicatat. Selamat beristirahat dan hati-hati di jalan!`);

    const greeting = response.text?.trim().replace(/^["']|["']$/g, "") || defaultGreeting;

    return res.json({
      success: true,
      greeting,
    });
  } catch (error: any) {
    console.error("Gemini generate-greeting error:", error);
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
