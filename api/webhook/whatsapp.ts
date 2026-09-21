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

async function analyzeReceiptWithGemini(imageUrl: string, messageCaption?: string): Promise<ReceiptAnalysisResult | null> {
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

    let imagePart: any = null;

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
   - "confidenceNotes": ringkasan singkat hasil bacaan.

Teks pesan pendamping: "${messageCaption || ""}"

Kembalikan HANYA JSON murni yang valid:
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
    return JSON.parse(cleanJson) as ReceiptAnalysisResult;
  } catch (err: any) {
    console.error("[GEMINI VISION WEBHOOK ERROR]", err);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // Setup CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-appkey, x-authkey');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET (Verification / Ping from Webhook Providers or Meta)
  if (req.method === 'GET') {
    const query = req.query || {};

    // Support Meta WhatsApp Cloud API Webhook Challenge
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    if (mode === 'subscribe' && challenge) {
      return res.status(200).send(challenge);
    }

    return res.status(200).json({
      status: 'ok',
      service: 'Catatoh WhatsApp Universal Inbound Webhook',
      endpoint: '/api/webhook/whatsapp',
      environment: 'vercel-serverless',
      methods_supported: ['POST', 'GET'],
      universal_mode: true,
      auto_matching: 'enabled',
      timestamp: new Date().toISOString(),
      message: 'Universal Webhook Catatoh aktif dan siap menerima data pembayaran SPP.',
    });
  }

  // Handle POST (Incoming Webhook from WhatsApp Gateway)
  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      const query = req.query || {};

      // Ekstraksi Token / Keys
      const appkey = payload.appkey || query.appkey || req.headers["x-appkey"] || "";
      const authkey = payload.authkey || query.authkey || req.headers["x-authkey"] || "";
      const explicitUserId = (query.user_id || payload.user_id || "").toString();

      // Normalisasi Pengirim dari berbagai schema provider (Starsender, Fonnte, Wablas, UltraMsg, W-API, Meta)
      const rawSender = payload.sender 
        || payload.from 
        || payload.phone 
        || payload.number 
        || payload.wa_number 
        || payload.data?.from 
        || payload.data?.sender
        || payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from
        || "";
      const senderPhone = normalizePhoneDigits(rawSender.toString());

      // Ekstraksi Teks dan Gambar Bukti
      const messageText = (
        payload.message 
        || payload.caption 
        || payload.text 
        || payload.body 
        || payload.data?.message 
        || payload.data?.body
        || payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body
        || payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.image?.caption
        || ""
      ).toString();

      const proofImageUrl = (
        payload.file 
        || payload.url 
        || payload.media 
        || payload.image 
        || payload.attachment 
        || payload.data?.file 
        || payload.data?.url
        || payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.image?.url
        || ""
      ).toString();

      const senderName = (
        payload.name 
        || payload.sender_name 
        || payload.pushName 
        || payload.data?.name 
        || payload.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name
        || "Wali Siswa"
      ).toString();

      // =========================================================================
      // ATURAN 1: ABAIKAN PESAN TANPA GAMBAR
      // =========================================================================
      if (!proofImageUrl || proofImageUrl.trim() === "") {
        return res.status(200).json({
          status: "ignored",
          reason: "no_image_attached",
          message: "Pesan teks diterima tanpa lampiran bukti transfer. Moderasi tidak dipicu.",
        });
      }

      // =========================================================================
      // ATURAN 2: ANALISIS DENGAN GEMINI VISION / FALLBACK KEYWORDS
      // =========================================================================
      const geminiAnalysis = await analyzeReceiptWithGemini(proofImageUrl, messageText);

      if (geminiAnalysis) {
        if (!geminiAnalysis.isTransferReceipt || geminiAnalysis.statusTransaksi === 'GAGAL') {
          return res.status(200).json({
            status: "ignored",
            reason: "not_a_valid_transfer_receipt",
            message: geminiAnalysis.statusTransaksi === 'GAGAL'
              ? "Gambar struk transfer berstatus GAGAL. Moderasi SPP tidak dipicu."
              : "Gambar terdeteksi bukan struk/bukti transfer bank atau e-wallet resmi. Moderasi tidak dipicu.",
            detectedNotes: geminiAnalysis.confidenceNotes,
          });
        }
      } else {
        const lowerText = messageText.toLowerCase();
        const hasPaymentKeyword = PAYMENT_KEYWORDS.some(kw => lowerText.includes(kw));
        if (!hasPaymentKeyword) {
          return res.status(200).json({
            status: "ignored",
            reason: "no_payment_intent",
            message: "Gambar dan pesan tidak mengindikasikan bukti pembayaran transfer SPP.",
          });
        }
      }

      const detectedBulan = (geminiAnalysis?.bulan && INDONESIAN_MONTHS.includes(geminiAnalysis.bulan))
        ? geminiAnalysis.bulan
        : detectMonthFromText(messageText);

      const detectedNominal = (geminiAnalysis?.nominal && geminiAnalysis.nominal > 0)
        ? geminiAnalysis.nominal
        : detectNominalFromText(messageText);

      const detectedDate = geminiAnalysis?.tanggal || new Date().toISOString().split("T")[0];
      const detectedTime = geminiAnalysis?.waktu || new Date().toTimeString().slice(0, 5);
      const currentYear = geminiAnalysis?.tahun || new Date().getFullYear();

      // =========================================================================
      // ATURAN 3: UNIVERSAL STUDENT & USER_ID AUTO-MATCHING
      // =========================================================================
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

      // Jika targetUserId belum ditemukan, ambil default user admin dari user_settings
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
        confidence_notes: geminiAnalysis?.confidenceNotes || (geminiAnalysis ? "Terverifikasi AI Vision" : "Deteksi Otomatis"),
        status: "pending",
      };

      // =========================================================================
      // ATURAN 4: SIMPAN KE SUPABASE (PERMANEN DI CLOUD)
      // =========================================================================
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

      // =========================================================================
      // ATURAN 5: AUTO-REPLY WHATSAPP KE ORANG TUA
      // =========================================================================
      if (appkey && authkey && senderPhone) {
        const studentNameStr = matchedStudent ? `ananda ${matchedStudent.nama_lengkap}` : "ananda";
        const nominalStr = finalNominal > 0 ? ` sebesar Rp ${finalNominal.toLocaleString("id-ID")}` : "";
        const replyMsg = `Halo Ayah/Bunda, bukti pembayaran SPP ${studentNameStr} untuk bulan ${detectedBulan}${nominalStr} pada tanggal ${detectedDate} telah kami terima dan masuk antrean verifikasi bendahara sekolah. Kami akan segera mengonfirmasi status pembayarannya. Terima kasih! 🙏`;

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
          console.warn("[AUTO-REPLY WA FAILED]", replyErr);
        }
      }

      return res.status(200).json({
        status: "success",
        message: "Webhook diterima dan diproses oleh Vercel Serverless Function.",
        verificationId: insertedId || "cached",
        studentMatched: !!matchedStudent,
        studentName: matchedStudent?.nama_lengkap || null,
        targetUserId: targetUserId || null,
        detectedNominal: finalNominal,
        detectedBulan: detectedBulan,
      });

    } catch (err: any) {
      console.error("[WEBHOOK HANDLER FATAL ERROR]", err);
      return res.status(500).json({
        status: "error",
        message: err.message || "Gagal memproses webhook.",
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
