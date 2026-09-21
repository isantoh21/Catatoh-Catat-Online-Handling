ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS face_descriptor TEXT;
CREATE TABLE IF NOT EXISTS student_attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID DEFAULT auth.uid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  waktu TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL
);
ALTER TABLE student_attendance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolasi data student_attendance_logs per user" ON student_attendance_logs;
CREATE POLICY "Isolasi data student_attendance_logs per user" ON student_attendance_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Kebijakan Akses Publik Kartu SPP Orang Tua
DROP POLICY IF EXISTS "Public membaca siswa untuk kartu spp ortu" ON students;
DROP POLICY IF EXISTS "Public membaca pembayaran untuk kartu spp ortu" ON payments;
DROP POLICY IF EXISTS "Public membaca profil sekolah untuk kartu spp ortu" ON user_settings;

CREATE POLICY "Public membaca siswa untuk kartu spp ortu" ON students FOR SELECT TO anon USING (true);
CREATE POLICY "Public membaca pembayaran untuk kartu spp ortu" ON payments FOR SELECT TO anon USING (true);
CREATE POLICY "Public membaca profil sekolah untuk kartu spp ortu" ON user_settings FOR SELECT TO anon USING (true);

-- Fungsi RPC untuk mencari kartu SPP orang tua berdasarkan nomor HP, tahun berjalan, dan filter id sekolah (Aman, Terisolasi, & Ringan)
DROP FUNCTION IF EXISTS get_parent_spp_card(text, int);
DROP FUNCTION IF EXISTS get_parent_spp_card(text, int, uuid);

CREATE OR REPLACE FUNCTION get_parent_spp_card(p_phone text, p_year int, p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  student_id uuid,
  nama_lengkap text,
  kelompok text,
  nomor_whatsapp text,
  user_id uuid,
  bulan text,
  tahun int,
  tanggal_bayar date,
  waktu_bayar time
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as student_id,
    s.nama_lengkap,
    s.kelompok,
    s.nomor_whatsapp,
    s.user_id,
    p.bulan,
    p.tahun,
    p.tanggal_bayar,
    p.waktu_bayar
  FROM students s
  LEFT JOIN payments p ON p.student_id = s.id AND p.tahun = p_year
  WHERE 
    (p_user_id IS NULL OR s.user_id = p_user_id)
    AND (
      s.nomor_whatsapp = p_phone
      OR s.nomor_whatsapp = '62' || LTRIM(p_phone, '0')
      OR s.nomor_whatsapp = '0' || SUBSTRING(p_phone FROM 3)
      OR REPLACE(REPLACE(s.nomor_whatsapp, '+', ''), ' ', '') = REPLACE(REPLACE(p_phone, '+', ''), ' ', '')
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_parent_spp_card(text, int, uuid) TO anon, authenticated;

-- Tabel Verifikasi Bukti Pembayaran WhatsApp Inbound Webhook
CREATE TABLE IF NOT EXISTS payment_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  sender_phone TEXT NOT NULL,
  sender_name TEXT,
  message_text TEXT,
  proof_image_url TEXT NOT NULL,
  bulan TEXT,
  tahun INT,
  nominal NUMERIC DEFAULT 0,
  tanggal_transfer DATE,
  waktu_transfer TEXT,
  bank_pengirim TEXT,
  bank_tujuan TEXT,
  nama_rekening_pengirim TEXT,
  confidence_notes TEXT,
  status TEXT DEFAULT 'pending',
  reject_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin kelola bukti pembayaran" ON payment_verifications;
CREATE POLICY "Admin kelola bukti pembayaran" 
ON payment_verifications FOR ALL 
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Webhook publik simpan bukti pembayaran" ON payment_verifications;
CREATE POLICY "Webhook publik simpan bukti pembayaran" 
ON payment_verifications FOR INSERT 
TO public
WITH CHECK (true);

-- Index performa pencarian bukti pembayaran
CREATE INDEX IF NOT EXISTS idx_payment_verifications_user_id ON payment_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_status ON payment_verifications(status);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_phone ON payment_verifications(sender_phone);
