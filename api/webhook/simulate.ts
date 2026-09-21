import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lzvrhtaewonmpsaiezai.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dnJodGFld29ubXBzYWllemFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MDE5NDQsImV4cCI6MjEwMzM3Nzk0NH0.UfWotWAZQjaqTTjoa5GKS5dq1Zda3V6wQlaCpHRNGI8';
const serverSupabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, studentId, studentName, senderPhone, messageText, proofImageUrl, bulan, nominal, tanggal, waktu, bank } = req.body || {};

    const currentYear = new Date().getFullYear();
    const verificationRecord = {
      user_id: userId || null,
      student_id: studentId || null,
      sender_phone: senderPhone || '6281234567890',
      sender_name: studentName || 'Wali Murid (Simulasi)',
      message_text: messageText || 'Assalamualaikum, ini bukti transfer SPP bulan ' + (bulan || 'Maret'),
      proof_image_url: proofImageUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
      bulan: bulan || 'Maret',
      tahun: currentYear,
      nominal: nominal ? Number(nominal) : 100000,
      tanggal_transfer: tanggal || new Date().toISOString().split('T')[0],
      waktu_transfer: waktu || new Date().toTimeString().slice(0, 5),
      bank_pengirim: bank || 'BCA Mobile',
      nama_rekening_pengirim: 'Wali Siswa (Simulasi)',
      confidence_notes: 'Simulasi Bukti Transfer Valid (Vercel Test)',
      status: 'pending',
    };

    let insertedId = 'sim_' + Date.now();
    try {
      const { data, error } = await serverSupabase
        .from('payment_verifications')
        .insert([verificationRecord])
        .select('id')
        .maybeSingle();

      if (data?.id) {
        insertedId = data.id;
      }
    } catch (e) {
      console.warn('Gagal simpan simulasi ke Supabase:', e);
    }

    return res.status(200).json({
      success: true,
      message: 'Simulasi bukti transfer berhasil dibuat dan disimpan!',
      data: {
        id: insertedId,
        ...verificationRecord,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
