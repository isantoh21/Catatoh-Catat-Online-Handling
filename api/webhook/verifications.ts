import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lzvrhtaewonmpsaiezai.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dnJodGFld29ubXBzYWllemFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MDE5NDQsImV4cCI6MjEwMzM3Nzk0NH0.UfWotWAZQjaqTTjoa5GKS5dq1Zda3V6wQlaCpHRNGI8';
const serverSupabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch verifications list
  if (req.method === 'GET') {
    try {
      const { userId } = req.query || {};
      if (!userId) {
        return res.status(200).json({ success: true, data: [] });
      }

      let query = serverSupabase
        .from('payment_verifications')
        .select(`
          *,
          students (
            nama_lengkap,
            kelompok
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) {
        return res.status(200).json({ success: true, data: [] });
      }

      // Auto purge bukti bayar approved > 14 hari
      const fourteenDaysAgoIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      serverSupabase
        .from('payment_verifications')
        .delete()
        .eq('user_id', userId)
        .eq('status', 'approved')
        .lt('created_at', fourteenDaysAgoIso)
        .then(() => {}, () => {});

      const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      const mapped = (data || [])
        .filter((item: any) => {
          if (item.status === 'approved') {
            const itemTime = new Date(item.updated_at || item.created_at).getTime();
            if (now - itemTime > fourteenDaysInMs) return false;
          }
          return true;
        })
        .map((item: any) => ({
          ...item,
          student_name: item.students?.nama_lengkap || item.sender_name || 'Siswa',
          student_kelompok: item.students?.kelompok || '-',
        }));

      return res.status(200).json({ success: true, data: mapped });
    } catch (e: any) {
      return res.status(200).json({ success: true, data: [] });
    }
  }

  // POST: Update verification status or details (nominal, bulan, etc.)
  if (req.method === 'POST') {
    try {
      const { id, status, rejectReason, nominal, bulan, tahun, tanggal_transfer, waktu_transfer } = req.body || {};
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID is required' });
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (status) updateData.status = status;
      if (rejectReason !== undefined) updateData.reject_reason = rejectReason;
      if (nominal !== undefined) updateData.nominal = Number(nominal);
      if (bulan !== undefined) updateData.bulan = bulan;
      if (tahun !== undefined) updateData.tahun = Number(tahun);
      if (tanggal_transfer !== undefined) updateData.tanggal_transfer = tanggal_transfer;
      if (waktu_transfer !== undefined) updateData.waktu_transfer = waktu_transfer;

      const { error } = await serverSupabase
        .from('payment_verifications')
        .update(updateData)
        .eq('id', id);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({
        success: true,
        message: `Data verifikasi berhasil diperbarui`,
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // DELETE: Delete verification (single or all)
  if (req.method === 'DELETE') {
    try {
      const { id, userId } = req.query || req.body || {};
      if (id) {
        const { error } = await serverSupabase
          .from('payment_verifications')
          .delete()
          .eq('id', id);

        if (error) {
          return res.status(500).json({ success: false, error: error.message });
        }
        return res.status(200).json({ success: true, message: 'Bukti transfer berhasil dihapus.' });
      }

      if (userId) {
        const { error } = await serverSupabase
          .from('payment_verifications')
          .delete()
          .eq('user_id', userId);

        if (error) {
          return res.status(500).json({ success: false, error: error.message });
        }
        return res.status(200).json({ success: true, message: 'Semua bukti verifikasi berhasil dikosongkan.' });
      }

      return res.status(400).json({ success: false, error: 'id atau userId wajib disertakan.' });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
