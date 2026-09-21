-- Skema Database Supabase untuk Sistem SPP Multi-Tenant
-- Jalankan di SQL Editor di Dashboard Supabase Anda.

-- 1. Ekstensi UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Tabel Data Siswa (Students)
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  nama_lengkap TEXT NOT NULL,
  nomor_whatsapp TEXT NOT NULL CHECK (nomor_whatsapp LIKE '62%'),
  nominal_spp NUMERIC NOT NULL DEFAULT 100000,
  kelompok TEXT,
  status_aktif BOOLEAN DEFAULT true
);

-- 4. Tabel Transaksi SPP (Payments)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  bulan TEXT NOT NULL,
  tahun INT NOT NULL,
  nominal_dibayar NUMERIC NOT NULL,
  tanggal_bayar DATE NOT NULL,
  waktu_bayar TIME,
  status TEXT NOT NULL CHECK (status IN ('Lunas', 'Belum'))
);

-- 5. Tabel Pengeluaran Sekolah (Expenses)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  nama_pengeluaran TEXT NOT NULL,
  nominal NUMERIC NOT NULL,
  tanggal DATE NOT NULL,
  bulan TEXT NOT NULL,
  tahun INT NOT NULL
);

-- 6. WAJIB: Aktifkan Row Level Security (RLS) di semua tabel
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 7. Bersihkan Policy Lama jika ada
DROP POLICY IF EXISTS "Allow ALL on students for authenticated users" ON students;
DROP POLICY IF EXISTS "Allow ALL on payments for authenticated users" ON payments;
DROP POLICY IF EXISTS "Isolasi data students" ON students;
DROP POLICY IF EXISTS "Isolasi data payments" ON payments;
DROP POLICY IF EXISTS "Isolasi data expenses" ON expenses;
DROP POLICY IF EXISTS "Isolasi data students per user" ON students;
DROP POLICY IF EXISTS "Isolasi data payments per user" ON payments;
DROP POLICY IF EXISTS "Isolasi data expenses per user" ON expenses;

-- 8. Buat Aturan Keamanan Berlapis (Strict Multi-Tenant Policy)
CREATE POLICY "Isolasi data students per user" ON students FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Isolasi data payments per user" ON payments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Isolasi data expenses per user" ON expenses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 12. Tabel Data Guru (Teachers)
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  nip TEXT,
  username TEXT,
  pin TEXT,
  face_descriptor JSONB
);

-- 13. Tabel Pengaturan Jam & Lokasi Presensi (Attendance Settings)
CREATE TABLE IF NOT EXISTS attendance_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  timezone TEXT DEFAULT 'Asia/Jakarta',
  arrival_start TIME DEFAULT '06:00',
  arrival_end TIME DEFAULT '07:30',
  departure_start TIME DEFAULT '15:00',
  departure_end TIME DEFAULT '18:00',
  admin_wa_number TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  location_radius NUMERIC DEFAULT 50,
  face_match_threshold NUMERIC DEFAULT 0.44
);

-- 14. Tabel Log Absensi Guru (Attendance Logs)
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'present',
  photo TEXT,
  location JSONB
);

-- 15. Tabel Pengajuan Izin/Sakit/Cuti Guru (Leave Requests)
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('izin', 'sakit', 'cuti')),
  reason TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. PERINTAH UPDATE / MIGRASI SKEMA GURU & LOG ABSENSI (Jalankan di Supabase SQL Editor)
ALTER TABLE IF EXISTS teachers ADD COLUMN IF NOT EXISTS nip TEXT;
ALTER TABLE IF EXISTS teachers ALTER COLUMN username DROP NOT NULL;
ALTER TABLE IF EXISTS teachers ALTER COLUMN pin DROP NOT NULL;
ALTER TABLE IF EXISTS teachers DROP CONSTRAINT IF EXISTS teachers_username_key;
ALTER TABLE IF EXISTS teachers ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();

ALTER TABLE IF EXISTS attendance_settings ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE IF EXISTS attendance_settings ADD COLUMN IF NOT EXISTS face_match_threshold NUMERIC DEFAULT 0.44;
CREATE SEQUENCE IF NOT EXISTS attendance_settings_id_seq;
ALTER TABLE IF EXISTS attendance_settings ALTER COLUMN id SET DEFAULT nextval('attendance_settings_id_seq');

ALTER TABLE IF EXISTS attendance_logs ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE IF EXISTS attendance_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS attendance_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS attendance_logs ADD COLUMN IF NOT EXISTS photo TEXT;
ALTER TABLE IF EXISTS leave_requests ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();

-- 17. OPTIMASI PENYIMPANAN SUPER MINIMAL & AUTO PURGE 1 MINGGU SEKALI
-- Membuat index agar query & penghapusan data 7 hari sangat cepat
CREATE INDEX IF NOT EXISTS idx_attendance_logs_created_at ON attendance_logs(created_at);

-- Fungsi SQL untuk membersihkan log presensi yang berusia lebih dari 7 hari
CREATE OR REPLACE FUNCTION purge_old_attendance_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM attendance_logs WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 18. WAJIB: Aktifkan RLS di semua Tabel Absensi
ALTER TABLE IF EXISTS teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leave_requests ENABLE ROW LEVEL SECURITY;

-- 19. Bersihkan Policy Absensi Lama (jika ada)
DROP POLICY IF EXISTS "Isolasi data teachers per user" ON teachers;
DROP POLICY IF EXISTS "Isolasi data attendance_settings per user" ON attendance_settings;
DROP POLICY IF EXISTS "Isolasi data attendance_logs per user" ON attendance_logs;
DROP POLICY IF EXISTS "Isolasi data leave_requests per user" ON leave_requests;
DROP POLICY IF EXISTS "Public membaca guru untuk absen" ON teachers;
DROP POLICY IF EXISTS "Public membaca pengaturan absen" ON attendance_settings;
DROP POLICY IF EXISTS "Public membuat log absen" ON attendance_logs;
DROP POLICY IF EXISTS "Public membaca log absen" ON attendance_logs;
DROP POLICY IF EXISTS "Public membuat pengajuan izin" ON leave_requests;

-- 20. Aturan Keamanan RLS untuk Admin (Hak Akses Spesifik Per Akun Admin)
CREATE POLICY "Isolasi data teachers per user" ON teachers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Isolasi data attendance_settings per user" ON attendance_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Isolasi data attendance_logs per user" ON attendance_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Isolasi data leave_requests per user" ON leave_requests FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 21. Aturan Keamanan RLS untuk Portal Presensi Kiosk Publik
CREATE POLICY "Public membaca guru untuk absen" ON teachers FOR SELECT TO anon USING (true);
CREATE POLICY "Public menambah guru dari kiosk" ON teachers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public perbarui wajah guru dari kiosk" ON teachers FOR UPDATE TO anon USING (true);
CREATE POLICY "Public membaca pengaturan absen" ON attendance_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Public membuat log absen" ON attendance_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public membaca log absen" ON attendance_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Public hapus log absen lama" ON attendance_logs FOR DELETE TO anon USING (created_at < NOW() - INTERVAL '7 days');
CREATE POLICY "Public membuat pengajuan izin" ON leave_requests FOR INSERT TO anon WITH CHECK (true);


