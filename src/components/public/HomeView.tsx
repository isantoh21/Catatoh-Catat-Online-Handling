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
  Building,
  Sparkles,
  Users,
  Smartphone
} from 'lucide-react';

interface HomeViewProps {
  schoolName?: string;
  schoolLogo?: string;
}

export default function HomeView({ schoolName = 'CATATOH', schoolLogo = '' }: HomeViewProps) {
  const navigate = useNavigate();
  const [activeWorkflow, setActiveWorkflow] = useState<'spp' | 'presensi' | 'wa' | 'ocr' | 'portal'>('spp');

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Floating Island Navbar */}
      <PublicNavbar schoolName={schoolName} schoolLogo={schoolLogo} />

      {/* HERO SECTION WITH WARM ATMOSPHERIC WASH */}
      <section className="relative pt-32 sm:pt-40 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto overflow-hidden">
        
        {/* Soft Ambient Wash in Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-gradient-to-b from-blue-100/60 via-indigo-50/40 to-transparent -z-10 blur-2xl pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center space-y-6">
          
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>Sistem Operasional & Keuangan Sekolah Indonesia</span>
          </div>

          {/* Clean Editorial Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.14]">
            Kelola SPP, Presensi Wajah, dan WhatsApp Sekolah{' '}
            <span className="text-blue-600">Tanpa Selisih Kas.</span>
          </h1>

          {/* Grounded Subheadline */}
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Satu sistem pencatatan terpusat untuk bendahara, guru piket, dan orang tua murid. Rekapitulasi otomatis, kuitansi digital sah, dan notifikasi kehadiran langsung ke ponsel wali murid.
          </p>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => navigate('/login?mode=register')}
              className="group pl-6 pr-2 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all duration-200 active:scale-98 shadow-md shadow-blue-500/25 flex items-center gap-3 cursor-pointer"
            >
              <span>Daftar Akun Sekolah Gratis</span>
              <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <ArrowRight className="w-4 h-4 text-white" />
              </span>
            </button>

            <button
              onClick={() => navigate('/pricing')}
              className="px-6 py-3 rounded-full text-sm font-semibold text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50/50 border border-slate-200 transition-colors cursor-pointer shadow-xs"
            >
              Lihat Biaya & Paket
            </button>
          </div>

          {/* COLOR-CODED OPERATIONAL FACTS BAR */}
          <div className="pt-8 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left max-w-3xl mx-auto">
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100">
              <div className="flex items-center gap-1.5 text-blue-700 text-xs font-bold">
                <Wallet className="w-3.5 h-3.5" />
                <span>0% Selisih Kas</span>
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">Buku kas terhitung otomatis</div>
            </div>

            <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100">
              <div className="flex items-center gap-1.5 text-sky-700 text-xs font-bold">
                <ScanFace className="w-3.5 h-3.5" />
                <span>1 Detik Presensi</span>
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">Scan wajah kamera piket</div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Anti-Banned WA</span>
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">Jeda acak pesan santun</div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100">
              <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
                <Receipt className="w-3.5 h-3.5" />
                <span>24 Jam Kartu SPP</span>
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">Akses mandiri wali murid</div>
            </div>
          </div>

        </div>

        {/* WORKFLOW SIMULATION SECTION (BEZEL ARCHITECTURE) */}
        <div id="alur-kerja" className="mt-16 max-w-5xl mx-auto">
          
          <div className="p-2 sm:p-2.5 bg-gradient-to-b from-blue-100/80 to-slate-100 border border-blue-200/80 rounded-3xl shadow-[0_16px_40px_-10px_rgba(37,99,235,0.08)]">
            
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              
              {/* Colored Tab Bar */}
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-400" />
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="text-xs font-semibold text-slate-600 ml-2">
                    Simulasi Antarmuka Aplikasi CATATOH
                  </span>
                </div>

                <div className="flex items-center gap-1 overflow-x-auto">
                  <button
                    onClick={() => setActiveWorkflow('spp')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeWorkflow === 'spp'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-blue-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Kas & SPP</span>
                  </button>
                  <button
                    onClick={() => setActiveWorkflow('presensi')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeWorkflow === 'presensi'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-sky-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <ScanFace className="w-3.5 h-3.5" />
                    <span>Presensi Wajah</span>
                  </button>
                  <button
                    onClick={() => setActiveWorkflow('wa')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeWorkflow === 'wa'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-emerald-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Gateway</span>
                  </button>
                  <button
                    onClick={() => setActiveWorkflow('ocr')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeWorkflow === 'ocr'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-purple-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>Pembaca Struk</span>
                  </button>
                  <button
                    onClick={() => setActiveWorkflow('portal')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeWorkflow === 'portal'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-amber-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Kartu Wali Murid</span>
                  </button>
                </div>
              </div>

              {/* Workflow Body Display */}
              <div className="p-6 sm:p-8">
                
                {/* 1. Kas & SPP */}
                {activeWorkflow === 'spp' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blue-100">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold mb-1">
                          <Wallet className="w-3 h-3" /> Modul Keuangan & SPP
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Pembukuan SPP Bulanan & Kas Masuk/Keluar</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Filter per kelas instan, rekap saldo otomatis, dan cetak kuitansi resmi.</p>
                      </div>
                      <div>
                        <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 inline-block">
                          Total Kas Hari Ini: Rp 14.250.000
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden text-xs shadow-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                          <tr>
                            <th className="p-3">Nama Siswa</th>
                            <th className="p-3">Kelas</th>
                            <th className="p-3">Bulan</th>
                            <th className="p-3">Nominal</th>
                            <th className="p-3">Status Bayar</th>
                            <th className="p-3 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          <tr className="hover:bg-blue-50/30 transition-colors">
                            <td className="p-3 font-semibold text-slate-900">Ahmad Fadhil Prasetya</td>
                            <td className="p-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">Kelas VII-A</span></td>
                            <td className="p-3">Oktober 2026</td>
                            <td className="p-3 font-mono font-bold text-slate-900">Rp 250.000</td>
                            <td className="p-3"><span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">Lunas (BCA)</span></td>
                            <td className="p-3 text-right"><span className="text-blue-600 font-bold hover:underline cursor-pointer">Cetak Nota PDF</span></td>
                          </tr>
                          <tr className="hover:bg-blue-50/30 transition-colors">
                            <td className="p-3 font-semibold text-slate-900">Nabila Zahra Syahrul</td>
                            <td className="p-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">Kelas VII-A</span></td>
                            <td className="p-3">Oktober 2026</td>
                            <td className="p-3 font-mono font-bold text-slate-900">Rp 250.000</td>
                            <td className="p-3"><span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">Lunas (Tunai)</span></td>
                            <td className="p-3 text-right"><span className="text-blue-600 font-bold hover:underline cursor-pointer">Cetak Nota PDF</span></td>
                          </tr>
                          <tr className="hover:bg-blue-50/30 transition-colors">
                            <td className="p-3 font-semibold text-slate-900">Rafi Arya Wijaya</td>
                            <td className="p-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">Kelas VII-A</span></td>
                            <td className="p-3">Oktober 2026</td>
                            <td className="p-3 font-mono font-bold text-slate-900">Rp 250.000</td>
                            <td className="p-3"><span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">Menunggu</span></td>
                            <td className="p-3 text-right"><span className="text-emerald-700 font-bold hover:underline cursor-pointer">Kirim WA Ortu</span></td>
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
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-700 text-xs font-bold">
                        <ScanFace className="w-3 h-3" /> Kiosk Kamera Meja Piket
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">Presensi Wajah AI Sub-Detik Tanpa Sentuh</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Perangkat tablet atau smartphone dipasang di meja piket sekolah. Siswa berdiri di depan kamera selama 1 detik, sistem langsung mencatat log kehadiran tanpa sentuh dan memverifikasi radius lokasi GPS gerbang sekolah.
                      </p>
                      <div className="space-y-2 text-xs text-slate-700 pt-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Terikat radius GPS sekolah (mencegah praktik titip absen)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Mode ganda: Portal presensi siswa & presensi guru</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-6 bg-gradient-to-b from-sky-50 to-white rounded-2xl p-6 border border-sky-200 text-center shadow-xs">
                      <div className="w-20 h-20 mx-auto rounded-full border-2 border-dashed border-sky-500 bg-white flex items-center justify-center mb-3 shadow-xs">
                        <ScanFace className="w-10 h-10 text-sky-600" />
                      </div>
                      <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-1 border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-700" /> Wajah Terverifikasi (0.8 Detik)
                      </div>
                      <div className="font-extrabold text-slate-900 text-sm mt-1">Muhammad Rizky Pratama</div>
                      <div className="text-xs text-slate-600">Kelas VII-A • Masuk Pukul 06:47 WIB</div>
                      <div className="mt-3 pt-3 border-t border-sky-100 text-[11px] text-sky-800 font-mono font-medium">
                        Radius GPS: 8 meter dari gerbang piket ✓
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. WhatsApp Gateway */}
                {activeWorkflow === 'wa' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-6 space-y-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold">
                        <MessageCircle className="w-3 h-3" /> WhatsApp Gateway Otomatis
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">Notifikasi Tiba di Sekolah & Tagihan SPP Massal</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Saat anak melakukan scan presensi, orang tua menerima pesan WhatsApp saat itu juga. Di awal bulan, bendahara dapat mengirimkan rincian tagihan secara massal dengan jeda acak manusiawi agar nomor sekolah aman dari banned.
                      </p>
                      <div className="space-y-2 text-xs text-slate-700 pt-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Algoritma jeda acak dinamis (proteksi anti-blokir nomor WhatsApp)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Tautan rincian tagihan personal langsung di dalam pesan</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-6 bg-[#0b141a] rounded-2xl p-5 text-white shadow-md font-sans">
                      <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs">
                        <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white">WA</div>
                        <div>
                          <div className="font-bold text-slate-100">Tata Usaha Sekolah Resmi</div>
                          <div className="text-[10px] text-emerald-400 font-mono">Pesan Otomatis Terkirim</div>
                        </div>
                      </div>
                      <div className="mt-3 bg-[#1f2c34] rounded-xl p-3.5 text-xs space-y-1.5 border border-slate-700/60">
                        <div className="font-bold text-emerald-400">Pemberitahuan Presensi Siswa 🔔</div>
                        <p className="text-slate-200">Yth. Bapak/Ibu Wali Murid dari <strong>Muhammad Rizky Pratama (Kelas VII-A)</strong>,</p>
                        <p className="text-slate-200">Ananda telah melakukan scan kehadiran di sekolah pada pukul <strong>06:47 WIB</strong> dalam kondisi Sehat.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Pembaca Struk OCR */}
                {activeWorkflow === 'ocr' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-6 space-y-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-bold">
                        <Bot className="w-3 h-3" /> AI Vision OCR (Google Gemini)
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">Ekstraksi Bukti Transfer Bank dari Chat WhatsApp</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Orang tua mengirim foto bukti transfer m-Banking ke WhatsApp sekolah. AI Vision membaca nama bank, nominal, dan tanggal secara presisi, lalu mencocokkannya ke tagihan siswa tanpa perlu input manual.
                      </p>
                      <div className="space-y-2 text-xs text-slate-700 pt-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Mencegah salah input nama siswa dan nominal transfer</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>1-klik verifikasi untuk menerbitkan nota kuitansi sah</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-6 bg-gradient-to-b from-purple-50/60 to-white rounded-2xl p-5 border border-purple-200 text-xs space-y-3 shadow-xs">
                      <div className="font-bold text-slate-900 border-b border-purple-100 pb-2 flex justify-between items-center">
                        <span className="flex items-center gap-1.5 text-purple-900 font-bold">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          Hasil Ekstraksi Struk Transfer
                        </span>
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Akurasi 99.4%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                          <div className="text-[10px] text-slate-500">Bank Pengirim</div>
                          <div className="font-bold text-slate-900">BCA Mobile</div>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                          <div className="text-[10px] text-slate-500">Nominal Transfer</div>
                          <div className="font-bold text-emerald-700 font-mono text-sm">Rp 250.000</div>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                          <div className="text-[10px] text-slate-500">Siswa Tertuju</div>
                          <div className="font-bold text-slate-900">Aisyah Humaira (VII-B)</div>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                          <div className="text-[10px] text-slate-500">Pos Alokasi</div>
                          <div className="font-bold text-blue-700">SPP Oktober 2026</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Kartu Wali Murid */}
                {activeWorkflow === 'portal' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-6 space-y-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-xs font-bold">
                        <Receipt className="w-3 h-3" /> Transparansi Mandiri 24 Jam
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">Kartu SPP Online Wali Murid Bebas Password</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Tiap siswa memiliki tautan kartu SPP online khusus. Orang tua dapat memeriksa riwayat pembayaran satu tahun ajaran dan mengunduh kuitansi resmi kapan pun dari smartphone tanpa perlu repot login akun.
                      </p>
                      <div className="space-y-2 text-xs text-slate-700 pt-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Menghilangkan 90% panggilan wali murid menanyakan sisa tagihan</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Kuitansi digital sah dapat diunduh kapan saja</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-6 bg-gradient-to-b from-amber-50/50 to-white rounded-2xl p-5 border border-amber-200 text-xs space-y-2 shadow-xs">
                      <div className="font-bold text-slate-900 pb-2 border-b border-amber-100 flex justify-between items-center">
                        <span className="text-amber-950 font-bold">Kartu SPP Digital Siswa</span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">T.A 2026/2027</span>
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

      {/* SECTION 2: PERBANDINGAN SEBELUM VS SESUDAH (HIGH-CONTRAST DISTINCT BOXES) */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-slate-100">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
            Dampak Langsung pada Operasional
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
            Perbandingan Tata Usaha Sebelum vs Sesudah CATATOH
          </h2>
          <p className="text-sm text-slate-600">
            Lihat bagaimana perubahan nyata yang dirasakan staf tata usaha, guru piket, dan bendahara sekolah.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Kotak Sebelum (Warna Soft Rose / Merah Lembut) */}
          <div className="p-7 rounded-3xl bg-rose-50/80 border-2 border-rose-200/90 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-rose-200/60">
              <span className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs">✕</span>
              <div>
                <h3 className="font-bold text-rose-950 text-sm">Sebelum Menggunakan CATATOH</h3>
                <p className="text-[11px] text-rose-700">Rentan selisih kas, antrean panjang, dan rekap manual</p>
              </div>
            </div>
            
            <ul className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="text-rose-600 font-black mt-0.5">✕</span>
                <span><strong>Buku kas sering selisih:</strong> Pencatatan SPP tersebar di buku tulis dan Excel yang sering bentrok versi antar staf saat tutup buku.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-600 font-black mt-0.5">✕</span>
                <span><strong>Antrean piket mengular:</strong> Siswa berebut presensi kertas di meja piket, rawan titip absen, dan staf harus mengetik ulang rekapan bulanan.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-600 font-black mt-0.5">✕</span>
                <span><strong>Bukti transfer tercecer:</strong> Puluhan foto struk transfer dari orang tua menumpuk di chat pribadi guru tanpa nama siswa yang jelas.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-600 font-black mt-0.5">✕</span>
                <span><strong>Kartu SPP basah/hilang:</strong> Orang tua terus-menerus menghubungi tata usaha hanya untuk menanyakan sisa tunggakan bulan lalu.</span>
              </li>
            </ul>
          </div>

          {/* Kotak Sesudah (Warna Soft Emerald / Hijau Segar) */}
          <div className="p-7 rounded-3xl bg-emerald-50/80 border-2 border-emerald-200/90 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-emerald-200/60">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">✓</span>
              <div>
                <h3 className="font-bold text-emerald-950 text-sm">Sesudah Menggunakan CATATOH</h3>
                <p className="text-[11px] text-emerald-800">Serba otomatis, terpusat, dan dapat diakses 24 jam</p>
              </div>
            </div>
            
            <ul className="space-y-3 text-slate-700 text-xs leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-700 font-black mt-0.5">✓</span>
                <span><strong>Saldo kas akurat 100%:</strong> Arus SPP dan kas operasional terpusat, siap cetak kuitansi nota PDF resmi tanpa selisih kas.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-700 font-black mt-0.5">✓</span>
                <span><strong>Presensi wajah 1 detik:</strong> Scan kamera tablet piket terikat radius GPS sekolah, log kehadiran siswa & guru langsung terangkum.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-700 font-black mt-0.5">✓</span>
                <span><strong>Ekstraksi struk bank otomatis:</strong> Foto struk dari WA dibaca AI Vision, 1-klik verifikasi langsung terbit tanda lunas.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-700 font-black mt-0.5">✓</span>
                <span><strong>Kartu SPP online 24 jam:</strong> Wali murid dapat mengecek status lunas dan unduh kuitansi resmi kapan saja dari HP mereka.</span>
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* SECTION 3: TIGA PILAR UTAMA BERWARNA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto bg-slate-50/70 border-t border-slate-200/80 rounded-3xl mb-16">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Teknologi Terintegrasi</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Tiga Modul Utama Sekolah Modern
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Didesain khusus untuk memenuhi kebutuhan harian tata usaha, bendahara, dan piket sekolah.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Pilar 1 */}
          <div className="p-6 rounded-2xl bg-white border border-sky-200 shadow-xs hover:border-sky-300 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold mb-4">
              <ScanFace className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Presensi Biometrik Wajah AI</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Scan wajah di gerbang masuk via tablet/HP piket. Terkunci radius GPS sekolah untuk memastikan kehadiran asli tanpa celah titip absen.
            </p>
          </div>

          {/* Pilar 2 */}
          <div className="p-6 rounded-2xl bg-white border border-emerald-200 shadow-xs hover:border-emerald-300 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-4">
              <MessageCircle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">WhatsApp Gateway Anti-Banned</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Notifikasi instan ke nomor orang tua saat anak hadir, serta broadcast reminder SPP massal dengan jeda acak proteksi nomor sekolah.
            </p>
          </div>

          {/* Pilar 3 */}
          <div className="p-6 rounded-2xl bg-white border border-blue-200 shadow-xs hover:border-blue-300 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
              <Wallet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Kas & Kartu SPP Digital 24 Jam</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sentralisasi pembukuan SPP, kas masuk, dan pengeluaran. Cetak kuitansi nota PDF resmi dan portal online mandiri bagi wali murid.
            </p>
          </div>

        </div>
      </section>

      {/* CTA BANNER WITH RICH BLUE GRADIENT */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white text-center space-y-5 shadow-xl shadow-blue-600/20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-blue-100 text-xs font-bold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Siap Memulai Transformasi Sekolah Anda?
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Mulai Digitalisasi Sekolah Anda Hari Ini
          </h2>
          
          <p className="text-sm text-blue-100 max-w-xl mx-auto leading-relaxed">
            Gunakan paket Standar secara gratis tanpa batas waktu, atau nikmati presensi wajah biometrik dan WhatsApp gateway otomatis dengan paket Premium.
          </p>
          
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/login?mode=register')}
              className="px-6 py-3 rounded-full bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              Daftar Akun Standar (Gratis)
            </button>
            <button
              onClick={() => navigate('/pricing')}
              className="px-6 py-3 rounded-full bg-blue-700/60 hover:bg-blue-700 text-white font-semibold text-xs border border-white/20 transition-all cursor-pointer"
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
