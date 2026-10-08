import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import { 
  ScanFace, 
  MessageCircle, 
  Wallet, 
  Bot, 
  Receipt, 
  ArrowRight, 
  CheckCircle2, 
  Check, 
  X,
  CreditCard,
  FileText,
  Clock,
  Printer,
  ChevronRight,
  ShieldCheck,
  Building
} from 'lucide-react';

interface HomeViewProps {
  schoolName?: string;
  schoolLogo?: string;
}

export default function HomeView({ schoolName = 'CATATOH', schoolLogo = '' }: HomeViewProps) {
  const navigate = useNavigate();
  const [activeWorkflow, setActiveWorkflow] = useState<'spp' | 'presensi' | 'wa' | 'ocr' | 'portal'>('spp');

  return (
    <div className="min-h-screen bg-[#fafafc] text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Floating Island Navbar */}
      <PublicNavbar schoolName={schoolName} schoolLogo={schoolLogo} />

      {/* HERO SECTION */}
      <section className="pt-32 sm:pt-40 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Sistem Operasional & Keuangan Sekolah</span>
          </div>

          {/* Clean Editorial Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-950 leading-[1.12]">
            Kelola SPP, Presensi Wajah, dan WhatsApp Sekolah Tanpa Selisih Kas.
          </h1>

          {/* Grounded Subheadline */}
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Satu sistem pencatatan terpusat untuk bendahara, guru piket, dan orang tua murid. Rekapitulasi otomatis, kuitansi digital sah, dan notifikasi kehadiran langsung ke ponsel wali murid.
          </p>

          {/* Nested CTA Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/login?mode=register')}
              className="group pl-6 pr-2 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-all duration-200 active:scale-98 shadow-sm flex items-center gap-3 cursor-pointer"
            >
              <span>Daftar Akun Sekolah Gratis</span>
              <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <ArrowRight className="w-4 h-4 text-white" />
              </span>
            </button>

            <button
              onClick={() => navigate('/pricing')}
              className="px-6 py-3 rounded-full text-sm font-semibold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-50 border border-slate-200/90 transition-colors cursor-pointer shadow-xs"
            >
              Lihat Biaya & Paket
            </button>
          </div>

          {/* Operational Facts Bar */}
          <div className="pt-8 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left max-w-2xl mx-auto">
            <div>
              <div className="text-xs font-bold text-slate-900">0% Selisih Kas</div>
              <div className="text-[11px] text-slate-500">Buku kas terpusat otomatis</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">1 Detik Presensi</div>
              <div className="text-[11px] text-slate-500">Scan wajah kamera piket</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Anti-Banned WA</div>
              <div className="text-[11px] text-slate-500">Jeda acak pesan manusiawi</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">24 Jam Kartu SPP</div>
              <div className="text-[11px] text-slate-500">Akses mandiri wali murid</div>
            </div>
          </div>

        </div>

        {/* DOUBLE-BEZEL PRODUCT WORKFLOW PREVIEW */}
        <div id="alur-kerja" className="mt-14 max-w-5xl mx-auto">
          
          {/* Outer Shell */}
          <div className="p-2 sm:p-3 bg-slate-200/70 border border-slate-300/80 rounded-3xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)]">
            
            {/* Inner Core */}
            <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
              
              {/* Terminal Tab Bar */}
              <div className="px-5 py-3.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="text-xs font-mono font-medium text-slate-500 ml-2">
                    Panel Kerja Administrasi CATATOH
                  </span>
                </div>

                <div className="flex items-center gap-1 overflow-x-auto">
                  <button
                    onClick={() => setActiveWorkflow('spp')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      activeWorkflow === 'spp'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    1. Kas & SPP
                  </button>
                  <button
                    onClick={() => setActiveWorkflow('presensi')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      activeWorkflow === 'presensi'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    2. Presensi Wajah
                  </button>
                  <button
                    onClick={() => setActiveWorkflow('wa')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      activeWorkflow === 'wa'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    3. WhatsApp Gateway
                  </button>
                  <button
                    onClick={() => setActiveWorkflow('ocr')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      activeWorkflow === 'ocr'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    4. Pembaca Struk
                  </button>
                  <button
                    onClick={() => setActiveWorkflow('portal')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      activeWorkflow === 'portal'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    5. Kartu Wali Murid
                  </button>
                </div>
              </div>

              {/* Workflow Body Display */}
              <div className="p-6 sm:p-8">
                
                {/* 1. Kas & SPP */}
                {activeWorkflow === 'spp' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Buku Kas & Pembukuan SPP Bulanan</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Semua data siswa terkelompok per kelas dan terhitung lunas otomatis.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                          Kas Terkumpul Hari Ini: Rp 14.250.000
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <tr>
                            <th className="p-3">Nama Siswa</th>
                            <th className="p-3">Kelas</th>
                            <th className="p-3">Bulan</th>
                            <th className="p-3">Nominal</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          <tr>
                            <td className="p-3 font-semibold text-slate-900">Ahmad Fadhil Prasetya</td>
                            <td className="p-3">Kelas VII-A</td>
                            <td className="p-3">Oktober 2026</td>
                            <td className="p-3 font-mono font-medium">Rp 250.000</td>
                            <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">Lunas (BCA)</span></td>
                            <td className="p-3 text-right"><span className="text-blue-600 font-semibold hover:underline cursor-pointer">Cetak Nota PDF</span></td>
                          </tr>
                          <tr>
                            <td className="p-3 font-semibold text-slate-900">Nabila Zahra Syahrul</td>
                            <td className="p-3">Kelas VII-A</td>
                            <td className="p-3">Oktober 2026</td>
                            <td className="p-3 font-mono font-medium">Rp 250.000</td>
                            <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">Lunas (Tunai)</span></td>
                            <td className="p-3 text-right"><span className="text-blue-600 font-semibold hover:underline cursor-pointer">Cetak Nota PDF</span></td>
                          </tr>
                          <tr>
                            <td className="p-3 font-semibold text-slate-900">Rafi Arya Wijaya</td>
                            <td className="p-3">Kelas VII-A</td>
                            <td className="p-3">Oktober 2026</td>
                            <td className="p-3 font-mono font-medium">Rp 250.000</td>
                            <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">Menunggu</span></td>
                            <td className="p-3 text-right"><span className="text-slate-500 font-semibold hover:underline cursor-pointer">Kirim WA</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. Presensi Wajah */}
                {activeWorkflow === 'presensi' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-6 space-y-3">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Kiosk Mode</span>
                      <h3 className="text-lg font-bold text-slate-900">Presensi Wajah di Meja Piket Gerbang</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Perangkat tablet atau smartphone dipasang di meja piket sekolah. Siswa berdiri di depan kamera selama 1 detik, sistem langsung mencatat log kehadiran tanpa sentuh dan memverifikasi radius lokasi GPS sekolah.
                      </p>
                      <div className="space-y-1.5 text-xs text-slate-700 pt-2">
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Terikat radius GPS gerbang sekolah (anti-titip absen)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Mendukung mode terpisah untuk siswa dan dewan guru</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-6 bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center">
                      <div className="w-20 h-20 mx-auto rounded-full border-2 border-dashed border-blue-500 bg-blue-50 flex items-center justify-center mb-3">
                        <ScanFace className="w-10 h-10 text-blue-600" />
                      </div>
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold mb-1">
                        Terverifikasi 0.8 Detik
                      </div>
                      <div className="font-bold text-slate-900 text-sm">Muhammad Rizky Pratama</div>
                      <div className="text-xs text-slate-500">Kelas VII-A • Masuk: 06:47 WIB</div>
                      <div className="mt-3 text-[11px] text-slate-400 font-mono">Radius GPS: 8 meter dari gerbang ✓</div>
                    </div>
                  </div>
                )}

                {/* 3. WhatsApp Gateway */}
                {activeWorkflow === 'wa' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-6 space-y-3">
                      <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Gateway Otomatis</span>
                      <h3 className="text-lg font-bold text-slate-900">Notifikasi Tiba di Sekolah & Tagihan SPP</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Saat siswa melakukan scan presensi, orang tua menerima pesan WhatsApp real-time. Pada awal bulan, bendahara dapat mengirimkan rincian tagihan secara massal dengan jeda acak alami agar nomor sekolah tidak diblokir.
                      </p>
                      <div className="space-y-1.5 text-xs text-slate-700 pt-2">
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Delay acak dinamis (proteksi anti-banned nomor sekolah)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Tautan rincian tagihan dapat dibuka langsung oleh orang tua</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-6 bg-slate-900 rounded-2xl p-5 text-white shadow-inner font-sans">
                      <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-[10px]">WA</div>
                        <span className="font-semibold text-slate-200">Tata Usaha Sekolah</span>
                      </div>
                      <div className="mt-3 bg-slate-800/90 rounded-xl p-3 text-xs space-y-1.5 border border-slate-700/50">
                        <div className="font-bold text-emerald-400">Pemberitahuan Presensi Siswa</div>
                        <p className="text-slate-300">Yth. Bapak/Ibu Wali Murid dari <strong>Muhammad Rizky Pratama (Kelas VII-A)</strong>,</p>
                        <p className="text-slate-300">Ananda telah melakukan scan kehadiran di sekolah pada pukul <strong>06:47 WIB</strong>.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Pembaca Struk OCR */}
                {activeWorkflow === 'ocr' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-6 space-y-3">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Vision OCR</span>
                      <h3 className="text-lg font-bold text-slate-900">Ekstraksi Bukti Transfer Bank dari Chat</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Orang tua mengirim foto bukti transfer m-Banking ke WhatsApp sekolah. Sistem membaca nama bank, nominal, dan tanggal secara otomatis, lalu mencocokkannya ke tagihan siswa tanpa perlu input manual.
                      </p>
                      <div className="space-y-1.5 text-xs text-slate-700 pt-2">
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Mencegah salah input nama siswa dan nominal transfer</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Verifikasi sekali klik untuk menerbitkan nota kuitansi</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-6 bg-slate-50 rounded-2xl p-5 border border-slate-200 text-xs space-y-2.5">
                      <div className="font-bold text-slate-900 border-b border-slate-200 pb-2 flex justify-between">
                        <span>Hasil Pembacaan Struk Bank</span>
                        <span className="text-emerald-700 font-semibold">Tervalidasi</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <div className="text-slate-500">Bank Pengirim</div>
                          <div className="font-bold text-slate-900">BCA Mobile</div>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <div className="text-slate-500">Nominal</div>
                          <div className="font-bold text-emerald-700 font-mono">Rp 250.000</div>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <div className="text-slate-500">Siswa Tertuju</div>
                          <div className="font-bold text-slate-900">Aisyah Humaira (VII-B)</div>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <div className="text-slate-500">Alokasi</div>
                          <div className="font-bold text-slate-900">SPP Oktober 2026</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Kartu Wali Murid */}
                {activeWorkflow === 'portal' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-6 space-y-3">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Transparansi 24 Jam</span>
                      <h3 className="text-lg font-bold text-slate-900">Kartu SPP Online Mandiri Wali Murid</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Tiap siswa memiliki tautan kartu SPP online khusus. Orang tua dapat memeriksa riwayat pembayaran satu tahun ajaran dan mengunduh kuitansi resmi kapan pun dari smartphone tanpa perlu login akun.
                      </p>
                      <div className="space-y-1.5 text-xs text-slate-700 pt-2">
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Menghilangkan panggilan berulang wali murid menanyakan sisa tagihan</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Kuitansi PDF resmi tersimpan permanen</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-6 bg-slate-50 rounded-2xl p-5 border border-slate-200 text-xs space-y-2">
                      <div className="font-bold text-slate-900 pb-2 border-b border-slate-200 flex justify-between">
                        <span>Kartu SPP Siswa (T.A 2026/2027)</span>
                        <span className="text-slate-500 font-mono">Kelas VII-A</span>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">Juli 2026</span>
                          <span className="text-emerald-700 font-bold">Lunas (10 Juli 2026)</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">Agustus 2026</span>
                          <span className="text-emerald-700 font-bold">Lunas (8 Agustus 2026)</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">September 2026</span>
                          <span className="text-emerald-700 font-bold">Lunas (5 September 2026)</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-900 font-semibold">Oktober 2026</span>
                          <span className="text-amber-700 font-bold">Menunggu Pembayaran</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>
        </div>

      </section>

      {/* SECTION: FAKTA MASALAH VS SOLUSI ADMINISTRASI */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-slate-200/60">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-950">
            Mengapa Sekolah Membutuhkan Sistem Terpadu?
          </h2>
          <p className="text-sm text-slate-600">
            Perbandingan alur kerja tata usaha sebelum dan sesudah menggunakan sistem terpusat CATATOH.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Sebelum */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Cara Konvensional (Buku Kertas & Spreadsheet)</span>
            </div>
            <ul className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold">✕</span>
                <span><strong>Buku kas sering selisih:</strong> Pencatatan SPP terpisah di buku tulis dan lembar Excel rawan salah hitung saat rekap bulanan.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold">✕</span>
                <span><strong>Antrean piket pagi:</strong> Siswa berebut tanda tangan atau absensi fisik, rawan titip absen, dan staf harus mengetik ulang rekapan bulanan.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold">✕</span>
                <span><strong>Bukti transfer tercecer di chat:</strong> Puluhan foto struk transfer dari orang tua menumpuk di chat pribadi guru tanpa nama jelas.</span>
              </li>
            </ul>
          </div>

          {/* Sesudah */}
          <div className="p-6 rounded-2xl bg-slate-900 text-white shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Dengan Sistem Terpadu CATATOH</span>
            </div>
            <ul className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>Saldo otomatis tanpa selisih:</strong> Semua pos SPP, kas masuk, dan pengeluaran terhitung seketika dan siap cetak kuitansi PDF resmi.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>Presensi 1 detik di gerbang:</strong> Scan wajah akurat tanpa sentuh terikat radius GPS sekolah, rekapitulasi kehadiran langsung jadi.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>Verifikasi struk terpadu:</strong> Foto bukti transfer dibaca otomatis dan langsung terbit tanda lunas ke kartu online wali murid.</span>
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* CTA FOOTER BANNER */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-100 border border-slate-200 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Mulai Digitalisasi Sekolah Anda Hari Ini
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Gunakan paket Standar secara gratis tanpa batas waktu, atau nikmati presensi wajah biometrik dan WhatsApp gateway dengan biaya terjangkau.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/login?mode=register')}
              className="px-6 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Daftar Akun Standar (Gratis)
            </button>
            <button
              onClick={() => navigate('/pricing')}
              className="px-6 py-3 rounded-full bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
            >
              Lihat Perbandingan Paket
            </button>
          </div>
        </div>
      </section>

      {/* Public Footer */}
      <PublicFooter schoolName={schoolName} />

    </div>
  );
}
