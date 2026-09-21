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
