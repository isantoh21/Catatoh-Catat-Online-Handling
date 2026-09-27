import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

// Supabase client instance for serverless webhook processing
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://lzvrhtaewonmpsaiezai.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
  || process.env.SUPABASE_SERVICE_KEY 
  || process.env.VITE_SUPABASE_ANON_KEY 
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dnJodGFld29ubXBzYWllemFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MDE5NDQsImV4cCI6MjEwMzM3Nzk0NH0.UfWotWAZQjaqTTjoa5GKS5dq1Zda3V6wQlaCpHRNGI8';
const serverSupabase = createClient(supabaseUrl, supabaseKey);

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

function detectNominalFromText(text: string): number {
  if (!text) return 100000;
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

const PAYMENT_KEYWORDS = [
  'transfer', 'bukti', 'spp', 'bayar', 'struk', 'tf', 'rekening', 'mutasi', 'setor', 'lunas', 'bca', 'bri', 'mandiri', 'bsi', 'dana', 'gopay', 'ovo', 'biaya'
];

interface ReceiptAnalysisResult {
  isTransferReceipt: boolean;
  nominal: number;
  tanggal: string;
  waktu: string;
  bulan: string;
  tahun: number;
  bankPengirim: string;
  bankTujuan: string;
  namaPengirim: string;
  statusTransaksi: string;
  confidenceNotes: string;
}

// Download image securely from WAHA VPS or external URL and convert to Base64
async function resolveAndDownloadImage(rawUrl: string): Promise<{ dataUri: string; mimeType: string; base64: string } | null> {
  if (!rawUrl) return null;

  if (rawUrl.startsWith("data:image/")) {
    const match = rawUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      return { dataUri: rawUrl, mimeType: match[1], base64: match[2] };
    }
  }

  let targetUrl = rawUrl;
  const WAHA_PUBLIC = 'http://13.140.178.167:29001';
  const WAHA_KEY = process.env.WAHA_API_KEY || 'askdj2934u9jd923dj3jdoi23nuiurio32od23oed2omi3290rmmoiejrw';

  // Replace internal docker localhost/127.0.0.1 with public VPS IP
  if (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1') || targetUrl.startsWith('/api/files/')) {
    targetUrl = targetUrl.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, WAHA_PUBLIC);
    if (targetUrl.startsWith('/')) {
      targetUrl = `${WAHA_PUBLIC}${targetUrl}`;
    }
  }

  try {
    const headers: Record<string, string> = {};
    if (targetUrl.includes('13.140.178.167') || targetUrl.includes('/api/files/')) {
      headers['X-Api-Key'] = WAHA_KEY;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const imgRes = await fetch(targetUrl, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (imgRes.ok) {
      const buffer = await imgRes.arrayBuffer();
      const mimeType = (imgRes.headers.get("content-type") || "image/jpeg").split(';')[0];
      const base64Data = Buffer.from(buffer).toString("base64");
      const dataUri = `data:${mimeType};base64,${base64Data}`;
      return { dataUri, mimeType, base64: base64Data };
    } else {
      console.warn(`[IMAGE FETCH FAILED] HTTP ${imgRes.status} for ${targetUrl}`);
    }
  } catch (err) {
    console.error(`[IMAGE FETCH ERROR] ${targetUrl}:`, err);
  }

  return null;
}

async function analyzeReceiptWithGemini(
  imageInfo: { mimeType: string; base64: string }, 
  messageCaption?: string
): Promise<ReceiptAnalysisResult | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const imagePart = {
      inlineData: {
        mimeType: imageInfo.mimeType,
        data: imageInfo.base64,
      }
    };

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
   - "confidenceNotes": ringkasan singkat hasil bacaan.

Teks pesan pengirim: "${messageCaption || ''}"

Kembalikan HANYA format JSON valid tanpa tanda backtick atau markdown:
{
  "isTransferReceipt": true/false,
  "nominal": 0,
  "tanggal": "YYYY-MM-DD",
  "waktu": "HH:mm",
  "bulan": "NamaBulan",
  "tahun": 2026,
  "bankPengirim": "NamaBank",
  "bankTujuan": "BankTujuan",
  "namaPengirim": "NamaDiStruk",
  "statusTransaksi": "BERHASIL",
  "confidenceNotes": "..."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            imagePart,
            { text: prompt }
          ]
        }
      ]
    });

    const text = response.text || "";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    return parsed as ReceiptAnalysisResult;
  } catch (error) {
    console.error("[GEMINI VISION ERROR]", error);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-appkey, x-authkey");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: "online",
      service: "CATATOH SPP - Inbound WhatsApp Webhook (WAHA Compatible)",
      timestamp: new Date().toISOString(),
      supportedProviders: ["WAHA", "Starsender", "Fonnte", "Wablas", "UltraMsg", "W-API", "Meta Cloud"]
    });
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      const query = req.query || {};

      // Abaikan pesan keluar dari nomor bot/WAHA sendiri
      if (payload.payload?.fromMe === true || payload.fromMe === true) {
        return res.status(200).json({
          status: "ignored",
          reason: "outgoing_message_from_self",
          message: "Pesan keluar dari akun sendiri diabaikan.",
        });
      }

      const explicitUserId = (query.user_id || payload.user_id || "").toString();

      // Normalisasi Pengirim dari berbagai schema provider (WAHA, Starsender, Fonnte, Wablas, UltraMsg, W-API, Meta)
      const rawSender = payload.payload?.from
        || payload.sender 
        || payload.from 
        || payload.phone 
        || payload.number 
        || payload.wa_number 
        || payload.data?.from 
        || payload.data?.sender
        || payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from
        || "";
      const senderPhone = normalizePhoneDigits(rawSender.toString().replace('@c.us', ''));

      // Ekstraksi Teks Caption
      const messageText = (
        payload.payload?.body
        || payload.payload?.caption
        || payload.message 
        || payload.caption 
        || payload.text 
        || payload.body 
        || payload.data?.message 
        || payload.data?.body
        || payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body
        || payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.image?.caption
        || ""
      ).toString();

      // Ekstraksi Gambar Bukti dari WAHA & Provider Lain
      let rawProofUrl = (
        payload.payload?.media?.url
        || payload.payload?.url
        || payload.media?.url
        || payload.file 
        || payload.url 
        || payload.media 
        || payload.image 
        || payload.attachment 
        || payload.data?.file 
        || payload.data?.url
        || payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.image?.url
        || ""
      ).toString();

      const hasMedia = payload.payload?.hasMedia === true || payload.hasMedia === true || Boolean(rawProofUrl);

      // Abaikan pesan teks murni tanpa lampiran gambar
      if (!hasMedia && (!rawProofUrl || rawProofUrl.trim() === "")) {
        return res.status(200).json({
          status: "ignored",
          reason: "no_image_attached",
          message: "Pesan teks diterima tanpa lampiran bukti transfer. Moderasi tidak dipicu.",
        });
      }

      // Download gambar dan ubah ke Base64 Data URI
      const downloadedImage = await resolveAndDownloadImage(rawProofUrl);
      const proofImageUrl = downloadedImage?.dataUri || rawProofUrl;

      const senderName = (
        payload.payload?._data?.notifyName
        || payload.payload?.notifyName
        || payload.name 
        || payload.sender_name 
        || payload.pushName 
        || payload.data?.name 
        || payload.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name
        || "Wali Siswa"
      ).toString();

      // Analisis Gambar dengan Gemini Vision (jika tersedia)
      let geminiAnalysis: ReceiptAnalysisResult | null = null;
      if (downloadedImage) {
        geminiAnalysis = await analyzeReceiptWithGemini(
          { mimeType: downloadedImage.mimeType, base64: downloadedImage.base64 },
          messageText
        );
      }

      // Deteksi Nilai Nominal dan Bulan
      const detectedBulan = (geminiAnalysis?.bulan && INDONESIAN_MONTHS.includes(geminiAnalysis.bulan))
        ? geminiAnalysis.bulan
        : detectMonthFromText(messageText);

      const detectedNominal = (geminiAnalysis?.nominal && geminiAnalysis.nominal > 0)
        ? geminiAnalysis.nominal
        : detectNominalFromText(messageText);

      const detectedDate = geminiAnalysis?.tanggal || new Date().toISOString().split("T")[0];
      const detectedTime = geminiAnalysis?.waktu || new Date().toTimeString().slice(0, 5);
      const currentYear = geminiAnalysis?.tahun || new Date().getFullYear();

      // Universal Student & User_Id Auto-Matching
      let matchedStudent: any = null;
      let targetUserId = explicitUserId;

      if (senderPhone) {
        const suffix8 = senderPhone.slice(-8);
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
        } catch (lookupErr) {
          console.warn("[WEBHOOK LOOKUP STUDENTS ERROR]", lookupErr);
        }
      }

      // Ambil default admin dari user_settings jika belum ada targetUserId
      if (!targetUserId) {
        try {
          const { data: defaultUser } = await serverSupabase
            .from("user_settings")
            .select("user_id")
            .limit(1)
            .maybeSingle();

          if (defaultUser?.user_id) {
            targetUserId = defaultUser.user_id;
          }
        } catch (userErr) {
          console.warn("[WEBHOOK DEFAULT USER LOOKUP ERROR]", userErr);
        }
      }

      const finalNominal = (geminiAnalysis?.nominal && geminiAnalysis.nominal > 0) 
        ? geminiAnalysis.nominal 
        : (matchedStudent?.nominal_spp || detectedNominal);

      const verificationPayload = {
        user_id: targetUserId || null,
        student_id: matchedStudent?.id || null,
        sender_phone: senderPhone,
        sender_name: matchedStudent?.nama_lengkap || senderName,
        message_text: messageText,
        proof_image_url: proofImageUrl,
        bulan: detectedBulan,
        tahun: currentYear,
        nominal: finalNominal,
        tanggal_transfer: detectedDate,
        waktu_transfer: detectedTime,
        bank_pengirim: geminiAnalysis?.bankPengirim || "Bank / E-Wallet",
        bank_tujuan: geminiAnalysis?.bankTujuan || undefined,
        nama_rekening_pengirim: geminiAnalysis?.namaPengirim || senderName,
        confidence_notes: geminiAnalysis?.confidenceNotes || (geminiAnalysis ? "Terverifikasi AI Vision" : "Menunggu Verifikasi Manual (Gambar Diterima)"),
        status: "pending",
      };

      // Simpan ke Supabase (payment_verifications)
      let insertedId = null;
      try {
        const { data: insertedData, error: insertError } = await serverSupabase
          .from("payment_verifications")
          .insert([verificationPayload])
          .select("id")
          .maybeSingle();

        if (insertError) {
          console.error("[SUPABASE INSERT ERROR]", insertError);
        } else if (insertedData) {
          insertedId = insertedData.id;
        }
      } catch (dbErr) {
        console.error("[SUPABASE CONNECTION ERROR]", dbErr);
      }

      // Auto-reply via WAHA jika pesan masuk dari nomor valid
      if (senderPhone) {
        const studentNameStr = matchedStudent ? `ananda ${matchedStudent.nama_lengkap}` : "ananda";
        const nominalStr = finalNominal > 0 ? ` sebesar Rp ${finalNominal.toLocaleString("id-ID")}` : "";
        const replyMsg = `Halo Ayah/Bunda, bukti pembayaran SPP ${studentNameStr} untuk bulan ${detectedBulan}${nominalStr} pada tanggal ${detectedDate} telah kami terima dan masuk antrean moderasi bendahara sekolah. Kami akan segera mengonfirmasi status pembayarannya. Terima kasih! 🙏`;

        // Kirim auto-reply langsung via WAHA VPS
        try {
          const wahaBase = 'http://13.140.178.167:29001';
          const wahaKey = process.env.WAHA_API_KEY || 'askdj2934u9jd923dj3jdoi23nuiurio32od23oed2omi3290rmmoiejrw';
          await fetch(`${wahaBase}/api/sendText`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': wahaKey,
            },
            body: JSON.stringify({
              session: 'default',
              chatId: `${senderPhone}@c.us`,
              text: replyMsg,
            }),
          });
        } catch (replyErr) {
          console.warn("[WAHA AUTO-REPLY FAILED]", replyErr);
        }
      }

      return res.status(200).json({
        status: "success",
        message: "Bukti transfer pembayaran berhasil diterima dan masuk moderasi.",
        recordId: insertedId,
        matchedStudent: matchedStudent ? matchedStudent.nama_lengkap : null,
        detectedNominal: finalNominal,
        detectedBulan: detectedBulan,
      });

    } catch (error: any) {
      console.error("[WEBHOOK PROCESS ERROR]", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Internal Webhook Error",
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
