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
  namaSiswa?: string;
  statusTransaksi: string;
  confidenceNotes: string;
}

// Ekstraksi nomor HP PENGIRIM secara akurat (BUKAN nomor penerima/bot sekolah)
async function extractSenderPhone(payload: any): Promise<string> {
  if (!payload) return '';
  const p = payload.payload || payload;

  // 1. Kumpulkan nomor penerima / bot pemilik akun WhatsApp untuk DIBLOKIR agar tidak tertukar
  const receiverNumbers = new Set<string>();
  const addReceiver = (val: any) => {
    if (typeof val === 'string' && val.trim()) {
      const clean = normalizePhoneDigits(val.split('@')[0].replace(/\D/g, ''));
      if (clean.length >= 8) receiverNumbers.add(clean);
    }
  };
  addReceiver(payload.me?.id);
  addReceiver(payload.sessionInfo?.me?.id);
  addReceiver(p.to);
  addReceiver(payload.to);
  addReceiver(payload.sessionInfo?.to);

  const isReceiver = (phone: string): boolean => {
    if (!phone || phone.length < 8) return false;
    const clean = normalizePhoneDigits(phone);
    for (const r of receiverNumbers) {
      if (clean === r || clean.endsWith(r.slice(-8)) || r.endsWith(clean.slice(-8))) {
        return true;
      }
    }
    return false;
  };

  // 2. Kumpulan kandidat field nomor pengirim yang valid (dari yang paling spesifik)
  const rawCandidates: any[] = [
    p.from,
    p._data?.key?.remoteJid,
    p._data?.remoteJid,
    p.sender?.id,
    p.sender?.phone,
    p.sender?.number,
    p._data?.key?.participantPn,
    p._data?.key?.remoteJidPn,
    p._data?.participant,
    p._data?.author,
    p._data?.from,
    p.participant,
    p.author,
    p.chatId,
    p.phone,
    p.number,
    p.wa_number,
    p.fromMe ? null : p.from,
  ];

  // 3. Periksa kandidat nomor WhatsApp murni (@c.us atau @s.whatsapp.net)
  for (const c of rawCandidates) {
    if (typeof c === 'string' && (c.includes('@c.us') || c.includes('@s.whatsapp.net'))) {
      const num = normalizePhoneDigits(c.split('@')[0].replace(/\D/g, ''));
      if (num.length >= 8 && !isReceiver(num)) {
        return num;
      }
    }
  }

  // 4. Cari dari message ID (format: false_628xxxxxx@c.us_...)
  const msgId = typeof p.id === 'string' ? p.id : '';
  const idMatch = msgId.match(/false_([0-9]{9,15})@(c\.us|s\.whatsapp\.net)/);
  if (idMatch && idMatch[1]) {
    const num = normalizePhoneDigits(idMatch[1]);
    if (num.length >= 8 && !isReceiver(num)) {
      return num;
    }
  }

  // 5. Jika pengirim menggunakan LID WhatsApp (format: xxxxxxx@lid)
  const rawLid = [p.from, p._data?.key?.remoteJid, p.chatId].find(
    (x) => typeof x === 'string' && x.includes('@lid')
  );
  if (rawLid) {
    // Coba ambil nomor telepon nyata dari Contact API
    try {
      const GATEWAY_PUBLIC = 'http://13.140.178.167:29001';
      const GATEWAY_KEY = process.env.WAHA_API_KEY || process.env.WHATSAPP_API_KEY || 'askdj2934u9jd923dj3jdoi23nuiurio32od23oed2omi3290rmmoiejrw';
      const session = payload.session || 'default';
      const contactUrl = `${GATEWAY_PUBLIC}/api/contacts/${encodeURIComponent(rawLid)}?session=${encodeURIComponent(session)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const cRes = await fetch(contactUrl, {
        headers: { 'X-Api-Key': GATEWAY_KEY },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (cRes.ok) {
        const contactData = await cRes.json();
        const contactNum = contactData?.number || contactData?.id?.split('@')[0];
        if (contactNum) {
          const cleanNum = normalizePhoneDigits(contactNum);
          if (cleanNum.length >= 8 && !isReceiver(cleanNum)) {
            return cleanNum;
          }
        }
      }
    } catch (_) {}
  }

  // 6. Scan string payload untuk nomor WhatsApp pengirim (EKSKLUSIFKAN nomor penerima)
  try {
    const rawJson = JSON.stringify(payload);
    const jidMatches = rawJson.match(/\b(628\d{7,12}|08\d{8,11})@(c\.us|s\.whatsapp\.net)\b/g);
    if (jidMatches && jidMatches.length > 0) {
      for (const m of jidMatches) {
        const num = normalizePhoneDigits(m.split('@')[0].replace(/\D/g, ''));
        if (num.length >= 8 && !isReceiver(num)) {
          return num;
        }
      }
    }
  } catch (_) {}

  // 7. Kandidat non-LID digit umum (yang bukan receiver)
  for (const c of rawCandidates) {
    if (typeof c === 'string' && c.trim() && !c.includes('@lid')) {
      const clean = normalizePhoneDigits(c.replace(/\D/g, ''));
      if (clean.length >= 8 && !isReceiver(clean)) {
        return clean;
      }
    }
  }

  return '';
}

// Download image securely from Gateway VPS or external URL and convert to Base64
async function resolveAndDownloadImage(rawUrl: string): Promise<{ dataUri: string; mimeType: string; base64: string } | null> {
  if (!rawUrl) return null;

  if (rawUrl.startsWith("data:image/")) {
    const match = rawUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      return { dataUri: rawUrl, mimeType: match[1], base64: match[2] };
    }
  }

  let targetUrl = rawUrl;
  const GATEWAY_PUBLIC = 'http://13.140.178.167:29001';
  const GATEWAY_KEY = process.env.WAHA_API_KEY || process.env.WHATSAPP_API_KEY || 'askdj2934u9jd923dj3jdoi23nuiurio32od23oed2omi3290rmmoiejrw';

  // Replace internal docker localhost/127.0.0.1 with public VPS IP
  if (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1') || targetUrl.startsWith('/api/files/')) {
    targetUrl = targetUrl.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, GATEWAY_PUBLIC);
    if (targetUrl.startsWith('/')) {
      targetUrl = `${GATEWAY_PUBLIC}${targetUrl}`;
    }
  }

  try {
    const headers: Record<string, string> = {};
    if (targetUrl.includes('13.140.178.167') || targetUrl.includes('/api/files/')) {
      headers['X-Api-Key'] = GATEWAY_KEY;
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
  messageCaption?: string,
  customApiKey?: string
): Promise<ReceiptAnalysisResult | null> {
  const apiKey = customApiKey 
    || process.env.GEMINI_API_KEY 
    || process.env.VITE_GEMINI_API_KEY 
    || Buffer.from('QVEuQWI4Uk42SlZCMjl4WGQ4Y2RIME11RlVkTTVUaUlqZGc2V0huZWs4RUtGeTZEVWo2MUE=', 'base64').toString('utf8');
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
   - "namaSiswa": nama siswa atau ananda jika tertulis di kolom berita/catatan transfer atau di caption.
   - "statusTransaksi": 'BERHASIL' / 'PENDING' / 'GAGAL'.
   - "confidenceNotes": ringkasan singkat hasil bacaan struk (misal: "Struk BCA Mobile Rp 150.000 atas nama Budi").

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
  "namaSiswa": "NamaSiswaJikaAda",
  "statusTransaksi": "BERHASIL",
  "confidenceNotes": "..."
}`;

    let response;
    const modelCandidates = ["gemini-2.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash"];
    let lastError: any = null;

    for (const model of modelCandidates) {
      try {
        response = await ai.models.generateContent({
          model,
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
        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[GEMINI MODEL ${model} FAILED]`, err.message || err.status || err);
      }
    }

    if (!response || !response.text) {
      console.error("[GEMINI VISION ALL MODELS FAILED]", lastError);
      return null;
    }

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[GEMINI VISION NO JSON FOUND]", text);
      return null;
    }
    const parsed = JSON.parse(jsonMatch[0]);
    // Pastikan isTransferReceipt murni boolean
    parsed.isTransferReceipt = parsed.isTransferReceipt === true || String(parsed.isTransferReceipt).toLowerCase() === 'true';
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
      service: "CATATOH SPP - Inbound WhatsApp Webhook",
      timestamp: new Date().toISOString(),
      supportedProviders: ["WhatsApp Gateway", "Starsender", "Fonnte", "Wablas", "UltraMsg", "W-API", "Meta Cloud"]
    });
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      const query = req.query || {};

      // 1. Abaikan pesan keluar dari nomor bot/akun sendiri
      if (payload.payload?.fromMe === true || payload.fromMe === true) {
        return res.status(200).json({
          status: "ignored",
          reason: "outgoing_message_from_self",
          message: "Pesan keluar dari akun sendiri diabaikan.",
        });
      }

      // 2. Abaikan pesan grup, channel/newsletter, dan status broadcast (HANYA PRIVATE CHAT)
      const rawFrom = String(payload.payload?.from || payload.from || payload.chatId || payload.payload?.chatId || "").toLowerCase();
      const isGroup = payload.payload?.isGroup === true || payload.isGroup === true || rawFrom.endsWith("@g.us") || Boolean(payload.payload?.participant && rawFrom.endsWith("@g.us"));
      const isNewsletter = rawFrom.endsWith("@newsletter") || rawFrom.includes("newsletter");
      const isStatus = rawFrom.includes("broadcast") || rawFrom.includes("status@broadcast") || payload.payload?.isStatus === true;

      if (isGroup || isNewsletter || isStatus) {
        return res.status(200).json({
          status: "ignored",
          reason: isGroup ? "group_message" : (isNewsletter ? "channel_newsletter" : "status_broadcast"),
          message: "Hanya pesan private chat (jalur pribadi) yang diproses ke moderasi.",
        });
      }

      // 3. Abaikan stiker, voice note/audio, video, reaksi, dan pesan non-gambar
      const msgType = String(payload.payload?.type || payload.type || payload.payload?._data?.type || "").toLowerCase();
      const ignoredTypes = ['sticker', 'ptt', 'audio', 'voice', 'video', 'reaction', 'call_log', 'protocol', 'notification', 'location', 'contact'];
      if (ignoredTypes.includes(msgType)) {
        return res.status(200).json({
          status: "ignored",
          reason: `non_image_type_${msgType}`,
          message: "Stiker, audio, video, dan reaksi diabaikan. Hanya gambar struk transfer yang diproses.",
        });
      }

      // 4. Resolusi Akun Sekolah (User ID) untuk Isolasi Data Multi-Tenant
      let targetUserId = (query.userId || query.user_id || payload.userId || payload.user_id || "").toString();

      // Coba identifikasi dari session (format: user_<uid16>)
      if (!targetUserId && payload.session && typeof payload.session === 'string' && payload.session.startsWith('user_')) {
        const cleanSessPrefix = payload.session.replace('user_', '');
        try {
          const { data: users } = await serverSupabase
            .from("user_settings")
            .select("user_id");
          const matchedUser = users?.find((u: any) => 
            (u.user_id || "").replace(/[^a-zA-Z0-9]/g, '').startsWith(cleanSessPrefix)
          );
          if (matchedUser?.user_id) {
            targetUserId = matchedUser.user_id;
          }
        } catch (_) {}
      }

      // Ekstraksi Pengirim secara cerdas (BUKAN nomor penerima/bot sekolah)
      const senderPhone = await extractSenderPhone(payload);

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

      // Ekstraksi Gambar Bukti dari Gateway & Provider Lain
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
          message: "Pesan diterima tanpa lampiran gambar struk transfer. Moderasi tidak dipicu.",
        });
      }

      // Cek mimetype media jika ada: harus berformat gambar (image/*)
      const rawMime = String(payload.payload?.media?.mimetype || payload.payload?.mimetype || '').toLowerCase();
      if (rawMime && !rawMime.startsWith('image/')) {
        return res.status(200).json({
          status: "ignored",
          reason: "non_image_mimetype",
          message: "Lampiran bukan berformat gambar. Moderasi diabaikan.",
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

      // Pencocokan Siswa Terdaftar dengan ISOLASI KETAT per Akun Pengguna
      let matchedStudent: any = null;

      try {
        let studentQuery = serverSupabase
          .from("students")
          .select("id, nama_lengkap, kelompok, user_id, nominal_spp, nomor_whatsapp")
          .eq("status_aktif", true);

        // Jika akun sekolah sudah teridentifikasi, batasi pencarian HANYA ke siswa milik akun tersebut
        if (targetUserId) {
          studentQuery = studentQuery.eq("user_id", targetUserId);
        }

        const { data: students } = await studentQuery;

        if (students && students.length > 0) {
          // 1. Cocokkan berdasarkan nomor HP WhatsApp orang tua (8 digit belakang)
          if (senderPhone && senderPhone.length >= 8) {
            const suffix8 = senderPhone.slice(-8);
            matchedStudent = students.find((s: any) => {
              const cleanS = (s.nomor_whatsapp || "").replace(/\D/g, "");
              if (!cleanS || cleanS.length < 8) return false;
              const cleanSuffix = cleanS.slice(-8);
              return cleanS === senderPhone 
                || senderPhone.endsWith(cleanSuffix) 
                || cleanS.endsWith(suffix8);
            });
          }

          // 2. Jika belum cocok nomornya, coba cocokkan nama siswa di caption pesan
          if (!matchedStudent && messageText && messageText.trim().length >= 3) {
            const lowerMsg = messageText.toLowerCase();
            matchedStudent = students.find((s: any) => {
              const name = (s.nama_lengkap || "").trim().toLowerCase();
              if (name.length >= 3 && lowerMsg.includes(name)) {
                return true;
              }
              return false;
            });
          }

          if (matchedStudent && !targetUserId) {
            targetUserId = matchedStudent.user_id;
          }
        }
      } catch (lookupErr) {
        console.warn("[WEBHOOK LOOKUP STUDENTS ERROR]", lookupErr);
      }

      // Validasi Isolasi: Jika akun sekolah tidak dapat ditentukan, tolak pesan
      if (!targetUserId) {
        console.log(`[WEBHOOK IGNORED] Tidak dapat mengidentifikasi akun sekolah (user_id). Pesan diabaikan demi isolasi data.`);
        return res.status(200).json({
          status: "ignored",
          reason: "unauthorized_or_unknown_account",
          message: "Akun sekolah penerima tidak dapat diverifikasi."
        });
      }

      // Cari Kunci Gemini API dari ENV atau database user_settings
      let geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!geminiApiKey && targetUserId) {
        try {
          const { data: userConf } = await serverSupabase
            .from("user_settings")
            .select("wa_gateway_config")
            .eq("user_id", targetUserId)
            .maybeSingle();
          if (userConf?.wa_gateway_config?.geminiApiKey) {
            geminiApiKey = userConf.wa_gateway_config.geminiApiKey;
          }
        } catch (_) {}
      }
      if (!geminiApiKey) {
        try {
          const { data: allUsers } = await serverSupabase
            .from("user_settings")
            .select("wa_gateway_config")
            .not("wa_gateway_config", "is", null);
          const found = allUsers?.find((u: any) => u.wa_gateway_config?.geminiApiKey);
          if (found?.wa_gateway_config?.geminiApiKey) {
            geminiApiKey = found.wa_gateway_config.geminiApiKey;
          }
        } catch (_) {}
      }
      if (!geminiApiKey) {
        geminiApiKey = Buffer.from('QVEuQWI4Uk42SlZCMjl4WGQ4Y2RIME11RlVkTTVUaUlqZGc2V0huZWs4RUtGeTZEVWo2MUE=', 'base64').toString('utf8');
      }

      // Analisis Gambar dengan Gemini Vision AI
      let geminiAnalysis: ReceiptAnalysisResult | null = null;
      if (downloadedImage) {
        geminiAnalysis = await analyzeReceiptWithGemini(
          { mimeType: downloadedImage.mimeType, base64: downloadedImage.base64 },
          messageText,
          geminiApiKey
        );
      }

      // Jika ada nama siswa terdeteksi di struk oleh Gemini dan belum ada matchedStudent, coba cocokkan kembali
      if (!matchedStudent && geminiAnalysis?.namaSiswa) {
        try {
          const targetName = geminiAnalysis.namaSiswa.toLowerCase();
          const { data: students } = await serverSupabase
            .from("students")
            .select("id, nama_lengkap, kelompok, user_id, nominal_spp, nomor_whatsapp")
            .eq("status_aktif", true);

          if (students) {
            matchedStudent = students.find((s: any) => {
              const name = (s.nama_lengkap || "").toLowerCase();
              return targetName.includes(name) || name.includes(targetName);
            });
            if (matchedStudent && !targetUserId) {
              targetUserId = matchedStudent.user_id;
            }
          }
        } catch (_) {}
      }

      // 1. Validasi: HANYA gambar yang terbukti secara tegas sebagai struk transfer resmi yang diizinkan
      const isVerifiedReceipt = Boolean(
        geminiAnalysis && (
          geminiAnalysis.isTransferReceipt === true ||
          String(geminiAnalysis.isTransferReceipt).toLowerCase() === 'true'
        )
      );

      if (!isVerifiedReceipt) {
        console.log(`[WEBHOOK IGNORE] Gambar dari ${senderPhone || 'pengirim'} BUKAN bukti transfer/struk pembayaran yang sah. Ditolak.`);
        return res.status(200).json({
          status: "ignored",
          reason: "not_a_transfer_receipt",
          message: "Gambar yang dikirim terdeteksi bukan bukti transfer/struk pembayaran sah. Hanya struk transfer resmi yang diizinkan masuk ke moderasi."
        });
      }

      // 2. Validasi: HANYA nomor HP siswa yang terdaftar yang masuk ke laman moderasi
      if (!matchedStudent) {
        console.log(`[WEBHOOK IGNORE] Nomor ${senderPhone || 'tidak dikenal'} bukan nomor WhatsApp siswa yang terdaftar.`);
        return res.status(200).json({
          status: "ignored",
          reason: "unregistered_student_number",
          message: "Nomor pengirim tidak terdaftar di data siswa. Bukti transfer hanya diproses dari nomor HP siswa yang terdaftar.",
          senderPhone
        });
      }

      // Deteksi Nilai Nominal dan Bulan
      const detectedBulan = (geminiAnalysis?.bulan && INDONESIAN_MONTHS.includes(geminiAnalysis.bulan))
        ? geminiAnalysis.bulan
        : detectMonthFromText(messageText);

      const detectedNominal = (geminiAnalysis?.nominal && geminiAnalysis.nominal > 0)
        ? geminiAnalysis.nominal
        : detectNominalFromText(messageText);

      // Validasi format tanggal dari Gemini (harus YYYY-MM-DD nyata, bukan placeholder)
      const rawGeminiDate = geminiAnalysis?.tanggal || "";
      const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(rawGeminiDate) && rawGeminiDate !== "YYYY-MM-DD";
      const detectedDate = isValidDate ? rawGeminiDate : new Date().toISOString().split("T")[0];
      const rawGeminiTime = geminiAnalysis?.waktu || "";
      const isValidTime = /^\d{2}:\d{2}$/.test(rawGeminiTime) && rawGeminiTime !== "HH:mm";
      const detectedTime = isValidTime ? rawGeminiTime : new Date().toTimeString().slice(0, 5);
      const currentYear = geminiAnalysis?.tahun || new Date().getFullYear();

      const finalNominal = (geminiAnalysis?.nominal && geminiAnalysis.nominal > 0) 
        ? geminiAnalysis.nominal 
        : (matchedStudent?.nominal_spp || detectedNominal);

      // Tentukan catatan verifikasi AI
      const confidenceNotes = geminiAnalysis?.confidenceNotes || (geminiApiKey ? "Terverifikasi AI Vision" : "Menunggu Verifikasi Manual");

      const resolvedSenderName = matchedStudent?.nama_lengkap 
        || senderName 
        || (senderPhone ? `Pengirim ${senderPhone}` : "Wali Siswa");

      const verificationPayload: Record<string, any> = {
        user_id: targetUserId || null,
        student_id: matchedStudent?.id || null,
        sender_phone: senderPhone || "",
        sender_name: resolvedSenderName,
        message_text: messageText || "",
        proof_image_url: proofImageUrl,
        bulan: detectedBulan,
        tahun: currentYear,
        nominal: Number(finalNominal) || 0,
        tanggal_transfer: detectedDate,
        waktu_transfer: detectedTime,
        bank_pengirim: geminiAnalysis?.bankPengirim || "Bank / E-Wallet",
        confidence_notes: confidenceNotes,
        status: "pending",
      };

      if (geminiAnalysis?.bankTujuan) {
        verificationPayload.bank_tujuan = geminiAnalysis.bankTujuan;
      }
      if (geminiAnalysis?.namaPengirim) {
        verificationPayload.nama_rekening_pengirim = geminiAnalysis.namaPengirim;
      }

      // Simpan ke Supabase (payment_verifications)
      let insertedId = null;
      let dbError: any = null;
      try {
        const { data: insertedData, error: insertError } = await serverSupabase
          .from("payment_verifications")
          .insert([verificationPayload])
          .select("id")
          .maybeSingle();

        if (insertError) {
          dbError = insertError.message || insertError;
          console.error("[SUPABASE INSERT ERROR]", insertError);
        } else if (insertedData) {
          insertedId = insertedData.id;
        }
      } catch (dbErr: any) {
        dbError = dbErr?.message || dbErr;
        console.error("[SUPABASE CONNECTION ERROR]", dbErr);
      }

      // Auto-reply via WhatsApp jika pesan masuk dari nomor valid
      if (senderPhone) {
        const studentNameStr = matchedStudent ? `ananda *${matchedStudent.nama_lengkap}*` : "ananda";
        const nominalStr = finalNominal > 0 ? ` sebesar *Rp ${finalNominal.toLocaleString("id-ID")}*` : "";
        const replyMsg = `Halo Ayah/Bunda, bukti pembayaran SPP ${studentNameStr} untuk bulan *${detectedBulan}*${nominalStr} pada tanggal *${detectedDate}* telah kami terima dan masuk antrean moderasi bendahara sekolah. Kami akan segera mengonfirmasi status pembayarannya. Terima kasih! 🙏`;

        // Kirim auto-reply langsung via Gateway VPS menggunakan sesi yang sesuai
        try {
          const activeSession = payload.session 
            || (targetUserId ? `user_${targetUserId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}` : 'default');
          const gatewayBase = 'http://13.140.178.167:29001';
          const gatewayKey = process.env.WAHA_API_KEY || process.env.WHATSAPP_API_KEY || 'askdj2934u9jd923dj3jdoi23nuiurio32od23oed2omi3290rmmoiejrw';
          await fetch(`${gatewayBase}/api/sendText`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': gatewayKey,
            },
            body: JSON.stringify({
              session: activeSession,
              chatId: `${senderPhone}@c.us`,
              text: replyMsg,
            }),
          });
        } catch (replyErr) {
          console.warn("[WA AUTO-REPLY FAILED]", replyErr);
        }
      }

      return res.status(200).json({
        status: "success",
        message: "Bukti transfer pembayaran berhasil diterima dan masuk moderasi.",
        recordId: insertedId,
        matchedStudent: matchedStudent ? matchedStudent.nama_lengkap : null,
        detectedNominal: finalNominal,
        detectedBulan: detectedBulan,
        dbError: dbError || undefined,
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
