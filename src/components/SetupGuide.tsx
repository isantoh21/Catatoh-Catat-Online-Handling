import React, { useState } from 'react';
import { Database, Code2, Terminal, CheckCircle2, Copy, Monitor } from 'lucide-react';

export default function SetupGuide() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const sqlSchema = `-- 1. Hapus instalasi lama agar bersih (Hati-hati: Data lama akan di-reset)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS students CASCADE;

-- 2. Aktifkan Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Buat Tabel Students (Terkunci pada ID User Auth)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  nama_lengkap TEXT NOT NULL,
  nomor_whatsapp TEXT NOT NULL CHECK (nomor_whatsapp LIKE '62%'),
  nominal_spp NUMERIC NOT NULL DEFAULT 100000,
  status_aktif BOOLEAN DEFAULT true
);

-- 4. Buat Tabel Payments (Terkunci pada ID User Auth)
CREATE TABLE payments (
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

-- 5. Buat Tabel Expenses (Terkunci pada ID User Auth)
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  nama_pengeluaran TEXT NOT NULL,
  nominal NUMERIC NOT NULL,
  tanggal DATE NOT NULL,
  bulan TEXT NOT NULL,
  tahun INT NOT NULL
);

-- 6. WAJIB: Aktifkan Keamanan RLS di Semua Tabel
-- Dengan RLS aktif, akses PUBLIK/ANON otomatis DIBLOKIR 100%.
ALTER TABLE students ADD COLUMN IF NOT EXISTS kelompok TEXT;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Tambah kolom user_id dan jam pulang khusus jika tabel absensi sudah ada di Supabase
ALTER TABLE IF EXISTS teachers ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE IF EXISTS teachers ADD COLUMN IF NOT EXISTS custom_departure_start TEXT;
ALTER TABLE IF EXISTS teachers ADD COLUMN IF NOT EXISTS custom_departure_end TEXT;
ALTER TABLE IF EXISTS teachers ADD COLUMN IF NOT EXISTS active_work_days TEXT;
ALTER TABLE IF EXISTS attendance_settings ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE IF EXISTS attendance_settings ADD COLUMN IF NOT EXISTS face_match_threshold NUMERIC DEFAULT 0.44;
CREATE SEQUENCE IF NOT EXISTS attendance_settings_id_seq;
ALTER TABLE IF EXISTS attendance_settings ALTER COLUMN id SET DEFAULT nextval('attendance_settings_id_seq');
ALTER TABLE IF EXISTS attendance_logs ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE IF EXISTS attendance_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS leave_requests ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();
ALTER TABLE IF EXISTS students ADD COLUMN IF NOT EXISTS face_descriptor TEXT;
ALTER TABLE IF EXISTS student_attendance_logs ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'in';
ALTER TABLE IF EXISTS student_attendance_logs ADD COLUMN IF NOT EXISTS snapshot TEXT;
ALTER TABLE IF EXISTS student_attendance_logs ADD COLUMN IF NOT EXISTS photo TEXT;

-- Tabel absensi siswa
CREATE TABLE IF NOT EXISTS student_attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID DEFAULT auth.uid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  waktu TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'Hadir',
  type TEXT DEFAULT 'in',
  snapshot TEXT,
  photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE student_attendance_logs ENABLE ROW LEVEL SECURITY;

-- 7. Bersihkan Policy Lama jika ada
DROP POLICY IF EXISTS "Allow ALL on students for authenticated users" ON students;
DROP POLICY IF EXISTS "Allow ALL on payments for authenticated users" ON payments;
DROP POLICY IF EXISTS "Isolasi data students" ON students;
DROP POLICY IF EXISTS "Isolasi data payments" ON payments;
DROP POLICY IF EXISTS "Isolasi data expenses" ON expenses;
DROP POLICY IF EXISTS "Isolasi data teachers per user" ON teachers;
DROP POLICY IF EXISTS "Isolasi data attendance_settings per user" ON attendance_settings;
DROP POLICY IF EXISTS "Isolasi data attendance_logs per user" ON attendance_logs;
DROP POLICY IF EXISTS "Isolasi data leave_requests per user" ON leave_requests;
DROP POLICY IF EXISTS "Isolasi data student_attendance_logs per user" ON student_attendance_logs;
DROP POLICY IF EXISTS "Public membaca guru untuk absen" ON teachers;
DROP POLICY IF EXISTS "Public membaca pengaturan absen" ON attendance_settings;
DROP POLICY IF EXISTS "Public membuat log absen" ON attendance_logs;
DROP POLICY IF EXISTS "Public membaca log absen" ON attendance_logs;
DROP POLICY IF EXISTS "Public membuat pengajuan izin" ON leave_requests;
DROP POLICY IF EXISTS "Public membuat log absen siswa" ON student_attendance_logs;
DROP POLICY IF EXISTS "Public membaca log absen siswa" ON student_attendance_logs;
DROP POLICY IF EXISTS "Public membaca siswa untuk absen" ON students;

-- 8. Aturan Isolasi Data Per Akun (Strict Multi-Tenant Policy)
-- HANYA user yang sudah login (authenticated) yang bisa membaca/menulis data mereka sendiri (auth.uid() = user_id).
CREATE POLICY "Isolasi data students per user" 
ON students FOR ALL TO authenticated 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Isolasi data payments per user" 
ON payments FOR ALL TO authenticated 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Isolasi data expenses per user" 
ON expenses FOR ALL TO authenticated 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Isolasi data teachers per user" 
ON teachers FOR ALL TO authenticated 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Isolasi data attendance_settings per user" 
ON attendance_settings FOR ALL TO authenticated 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Isolasi data attendance_logs per user" 
ON attendance_logs FOR ALL TO authenticated 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Isolasi data leave_requests per user" 
ON leave_requests FOR ALL TO authenticated 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Isolasi data student_attendance_logs per user" 
ON student_attendance_logs FOR ALL TO authenticated 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. (Opsional) Aktifkan Realtime
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE students, payments, expenses;
`;

  const supabaseClientCode = `import { createClient } from '@supabase/supabase-js';

// URL dan Anon Key didapatkan dari dashboard Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// NOTE: Untuk client component (browser), disarankan menggunakan 
// createBrowserClient dari @supabase/ssr. Namun ini adalah client default:
export const supabase = createClient(supabaseUrl, supabaseAnonKey);`;

  const middlewareCode = `import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Ambil sesi user saat ini
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  
  // Jika belum login dan mencoba akses route internal (selain /login), redirect ke /login
  if (!user && !isAuthRoute && request.nextUrl.pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Jika sudah login tapi mencoba akses /login, redirect ke /dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};`;

  const envCode = `NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`;

  const nextJsUsageCode = `import { supabase } from '@/lib/supabaseClient';

// Contoh Server Component di Next.js (App Router)
export default async function Page() {
  const { data: students } = await supabase.from('students').select('*');

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Daftar Siswa</h1>
      <ul className="space-y-2">
        {students?.map(student => (
          <li key={student.id} className="p-3 border rounded">
            {student.nama_lengkap} - {student.nomor_whatsapp}
          </li>
        ))}
      </ul>
    </div>
  );
}`;

  const electronMainCode = `const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'CATATOH - Catat Online Handling',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Jika sudah dibundle, buka dist/index.html
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    win.loadURL('http://localhost:3000');
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});`;

  const packageJsonExeSnippet = `{
  "main": "electron-main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "electron:build": "npm run build && electron-builder"
  },
  "build": {
    "appId": "com.catatoh.app",
    "productName": "CATATOH - Catat Online Handling",
    "directories": {
      "output": "dist-exe"
    },
    "files": [
      "dist/**/*",
      "electron-main.js"
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "public/favicon.ico"
    }
  }
}`;

  return (
    <div className="flex-1 overflow-auto bg-slate-50 text-slate-800 p-6 md:p-10 font-sans">
      <div className="max-w-4xl w-full mx-auto space-y-6 pb-12">
        
        {/* Header */}
        <div className="bg-indigo-900 p-8 rounded-2xl shadow-sm border border-indigo-800 text-indigo-100">
          <div className="flex items-center gap-4 mb-4">
             <div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center text-indigo-900 font-bold text-2xl">C</div>
             <div>
               <h1 className="text-2xl font-bold text-white mb-1">Setup CATATOH (Catat Online Handling)</h1>
               <p className="text-indigo-300 uppercase tracking-widest text-[10px] font-semibold">Panduan Integrasi Aplikasi Multifungsi Sekolah</p>
             </div>
          </div>
          <p className="text-indigo-200 text-sm">
            Panduan lengkap integrasi Next.js / Vite, Tailwind CSS, Electron, dan Supabase untuk aplikasi CATATOH.
          </p>
        </div>

        {/* 1. SQL Schema */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-700">1. Skema SQL (Supabase)</h2>
          </div>
          <p className="text-slate-500 mb-4 text-xs">
            Jalankan skema ini di menu <strong>SQL Editor</strong> pada dashboard Supabase Anda.
          </p>
          <div className="relative group">
            <button
              onClick={() => copyToClipboard(sqlSchema, 'sql')}
              className="absolute right-4 top-4 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-2"
            >
              {copied === 'sql' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <pre className="bg-slate-50 border border-slate-100 text-slate-800 p-6 rounded-xl overflow-x-auto text-xs font-mono shadow-inner">
              <code>{sqlSchema}</code>
            </pre>
          </div>
        </div>

        {/* 2. Supabase Connection */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <Terminal className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-700">2. Koneksi Next.js & Supabase</h2>
          </div>
          
          <div className="space-y-6">
            {/* Step A */}
            <div>
              <h3 className="font-bold text-slate-800 mb-2 text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                A. Instalasi Dependency
              </h3>
              <p className="text-xs text-slate-500 mb-2">Jalankan perintah ini di terminal proyek Next.js Anda (termasuk SSR untuk middleware):</p>
              <div className="bg-slate-50 border border-slate-100 text-indigo-600 p-4 rounded-xl font-mono text-xs font-bold shadow-inner">
                npm install @supabase/supabase-js @supabase/ssr
              </div>
            </div>

            {/* Step B */}
            <div>
              <h3 className="font-bold text-slate-800 mb-2 text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                B. Environment Variables (.env.local)
              </h3>
              <p className="text-xs text-slate-500 mb-2">Buat file <code>.env.local</code> di root folder dan isi dengan URL dan Anon Key dari Project Settings Supabase.</p>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(envCode, 'env')}
                  className="absolute right-4 top-4 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-2"
                >
                  {copied === 'env' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
                <pre className="bg-slate-50 border border-slate-100 text-slate-800 p-6 rounded-xl overflow-x-auto text-xs font-mono shadow-inner">
                  <code>{envCode}</code>
                </pre>
              </div>
            </div>

            {/* Step C */}
            <div>
              <h3 className="font-bold text-slate-800 mb-2 text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                C. Buat File lib/supabaseClient.ts
              </h3>
              <p className="text-xs text-slate-500 mb-2">Buat file baru di <code>lib/supabaseClient.ts</code> (atau <code>src/lib/supabaseClient.ts</code>) dan paste kode berikut:</p>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(supabaseClientCode, 'client')}
                  className="absolute right-4 top-4 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-2"
                >
                  {copied === 'client' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
                <pre className="bg-slate-50 border border-slate-100 text-slate-800 p-6 rounded-xl overflow-x-auto text-xs font-mono shadow-inner">
                  <code>{supabaseClientCode}</code>
                </pre>
              </div>
            </div>

            {/* Step D */}
            <div>
              <h3 className="font-bold text-slate-800 mb-2 text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                D. Buat File Middleware (middleware.ts)
              </h3>
              <p className="text-xs text-slate-500 mb-2">Buat file <code>middleware.ts</code> di root proyek Anda untuk memproteksi rute dari user yang belum login:</p>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(middlewareCode, 'middleware')}
                  className="absolute right-4 top-4 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-2"
                >
                  {copied === 'middleware' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
                <pre className="bg-slate-50 border border-slate-100 text-slate-800 p-6 rounded-xl overflow-x-auto text-xs font-mono shadow-inner">
                  <code>{middlewareCode}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Usage Example */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <Code2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-700">3. Contoh Penggunaan (App Router)</h2>
          </div>
          <p className="text-slate-500 mb-4 text-xs">
            Anda dapat memanggil Supabase client langsung di dalam Server Component untuk melakukan fetch data <i>students</i> atau <i>payments</i> secara aman di server.
          </p>
          <div className="relative group">
            <button
              onClick={() => copyToClipboard(nextJsUsageCode, 'usage')}
              className="absolute right-4 top-4 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-2"
            >
              {copied === 'usage' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <pre className="bg-slate-50 border border-slate-100 text-slate-800 p-6 rounded-xl overflow-x-auto text-xs font-mono shadow-inner">
              <code>{nextJsUsageCode}</code>
            </pre>
          </div>
        </div>

        {/* 4. Desktop App EXE Build Guide */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-700">4. Panduan Export ke Aplikasi Desktop Windows (.EXE)</h2>
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full">
                ✓ 100% Pre-Configured (Siap Compile)
              </span>
            </div>
          </div>
          <p className="text-slate-500 mb-6 text-xs leading-relaxed">
            Seluruh berkas pendukung (<code>main.js</code>, <code>package.json</code>, dan dependencies Electron) sudah dikonfigurasi 100% di dalam proyek ini. Anda tidak perlu mengedit kode apa pun!
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-slate-800 mb-2 text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                Langkah 1: Download & Buka Proyek di VS Code
              </h3>
              <p className="text-xs text-slate-500 mb-2">Export / Download proyek ini ke komputer lokal Anda, lalu buka foldernya di VS Code (<code>File &gt; Open Folder...</code>).</p>
            </div>

            <div>
              <h3 className="font-bold text-slate-800 mb-2 text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                Langkah 2: Jalankan Perintah Compile di Terminal VS Code
              </h3>
              <p className="text-xs text-slate-500 mb-2">Buka Terminal VS Code (<code>Ctrl + `</code>) lalu jalankan dua perintah berikut:</p>
              <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs font-bold shadow-inner space-y-1">
                <div>npm install</div>
                <div className="text-yellow-400">npm run build:exe</div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <h4 className="font-bold text-emerald-800 text-xs mb-1">🎉 Hasil Akhir:</h4>
              <p className="text-xs text-emerald-700">
                Folder baru <code>dist_electron/</code> akan otomatis dibuat. File installer <strong>CATATOH Setup 1.0.0.exe</strong> siap di-install &amp; dijalankan di Windows!
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer info */}
        <div className="text-center text-xs font-medium text-slate-400 mt-6 pb-6 uppercase tracking-widest">
          File <code className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono lowercase tracking-normal">src/lib/supabaseClient.ts</code> dan <code className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono lowercase tracking-normal">supabase_schema.sql</code> juga telah dibuat di workspace proyek ini.
        </div>
      </div>
    </div>
  );
}
