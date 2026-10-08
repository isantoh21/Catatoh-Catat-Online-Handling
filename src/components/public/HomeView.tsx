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
  Smartphone,
  Search,
  Phone,
  GraduationCap,
  Calendar,
  CalendarRange,
  TrendingUp,
  RefreshCw,
  CheckSquare,
  Square,
  DollarSign,
  Filter,
  CheckCircle,
  FolderPlus,
  AlertCircle
} from 'lucide-react';

interface HomeViewProps {
  schoolName?: string;
  schoolLogo?: string;
}

export default function HomeView({ schoolName = 'CATATOH', schoolLogo = '' }: HomeViewProps) {
  const navigate = useNavigate();
  const [activeWorkflow, setActiveWorkflow] = useState<'spp' | 'presensi' | 'wa' | 'ocr' | 'portal'>('spp');

  return (
    <div 
      className="min-h-screen text-slate-900 font-sans selection:bg-blue-600 selection:text-white relative"
      style={{
        backgroundColor: '#edf4fe',
        backgroundImage: `
          linear-gradient(to right, rgba(59, 130, 246, 0.08) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(59, 130, 246, 0.08) 1px, transparent 1px),
          radial-gradient(circle at 82% 16%, rgba(253, 230, 138, 0.6) 0%, rgba(253, 230, 138, 0) 55%),
          radial-gradient(circle at 18% 45%, rgba(191, 219, 254, 0.5) 0%, rgba(191, 219, 254, 0) 50%)
        `,
        backgroundSize: '28px 28px, 28px 28px, auto, auto'
      }}
    >
      
      {/* Floating Island Navbar */}
      <PublicNavbar schoolName={schoolName} schoolLogo={schoolLogo} />

      {/* HERO SECTION */}
      <section className="relative pt-32 sm:pt-40 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">

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
                          <Wallet className="w-3 h-3" /> Modul Pembukuan SPP & Kas Sekolah Terpadu
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Pusat Kendali SPP Bulanan, Cetak Kuitansi & Buku Kas Lengkap</h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          1-Klik Lunas, Lunas Massal setoran kelas, cetak kuitansi resmi PDF, serta otomatis membukukan kas operasional tanpa selisih.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 inline-flex items-center gap-1.5 shadow-2xs">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Saldo Kas Real-time: Rp 13.550.000</span>
                        </span>
                      </div>
                    </div>

                    {/* Filter & Action Toolbar (Mirip Dashboard Asli) */}
                    <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Oktober 2026 (Semester Ganjil)</span>
                        </div>
                        <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 shadow-2xs">
                          <span>Kelas: <b>VII-A</b></span>
                        </div>
                        <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 shadow-2xs">
                          <span>Status: <b>Semua</b></span>
                        </div>
                        <div className="relative flex-1 min-w-[140px]">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            readOnly 
                            value="Ahmad Fadhil..." 
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs" 
                          />
                        </div>
                      </div>

                      {/* Tombol Aksi Nyata Dashboard */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-2xs">
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Tandai Lunas Massal (2 Siswa)</span>
                        </button>
                        <button className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 shadow-2xs" title="Sync Database">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button className="px-2.5 py-1.5 bg-indigo-900 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-2xs relative">
                          <MessageCircle className="w-3.5 h-3.5 text-amber-300" />
                          <span className="hidden sm:inline text-[11px]">Moderasi WA</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-indigo-950 text-[10px] font-black">2 Baru</span>
                        </button>
                      </div>
                    </div>

                    {/* Tabel SPP Nyata */}
                    <div className="rounded-2xl border border-slate-200 overflow-hidden text-xs shadow-2xs bg-white">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                          <tr>
                            <th className="p-3 w-8 text-center">
                              <CheckSquare className="w-4 h-4 text-indigo-600 mx-auto" />
                            </th>
                            <th className="p-3">Siswa & Kelas</th>
                            <th className="p-3">Bulan Tagihan</th>
                            <th className="p-3">Status Pembayaran</th>
                            <th className="p-3 text-right">Tindakan Admin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          <tr className="hover:bg-blue-50/30 transition-colors bg-blue-50/10">
                            <td className="p-3 text-center">
                              <CheckSquare className="w-4 h-4 text-indigo-600 mx-auto" />
                            </td>
                            <td className="p-3 font-semibold text-slate-900">
                              <div>Ahmad Fadhil Prasetya</div>
                              <span className="text-[10px] text-slate-500 font-normal">Kelas VII-A • Reguler</span>
                            </td>
                            <td className="p-3 font-medium">Oktober 2026</td>
                            <td className="p-3">
                              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>LUNAS (08 Okt 2026, 09:14 WIB)</span>
                              </div>
                            </td>
                            <td className="p-3 text-right space-x-1.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200 hover:bg-blue-100 cursor-pointer shadow-2xs">
                                <Printer className="w-3 h-3" /> Cetak Kuitansi PDF
                              </span>
                            </td>
                          </tr>
                          <tr className="hover:bg-blue-50/30 transition-colors">
                            <td className="p-3 text-center">
                              <CheckSquare className="w-4 h-4 text-indigo-600 mx-auto" />
                            </td>
                            <td className="p-3 font-semibold text-slate-900">
                              <div>Nabila Zahra Syahrul</div>
                              <span className="text-[10px] text-slate-500 font-normal">Kelas VII-A • Reguler</span>
                            </td>
                            <td className="p-3 font-medium">Oktober 2026</td>
                            <td className="p-3">
                              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                                <Clock className="w-3 h-3 text-rose-600" />
                                <span>BELUM LUNAS</span>
                              </div>
                            </td>
                            <td className="p-3 text-right space-x-1.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 cursor-pointer shadow-2xs">
                                <Check className="w-3 h-3" /> 1-Klik Lunas
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 hover:bg-emerald-100 cursor-pointer shadow-2xs">
                                <MessageCircle className="w-3 h-3" /> Tagih WA
                              </span>
                            </td>
                          </tr>
                          <tr className="hover:bg-blue-50/30 transition-colors">
                            <td className="p-3 text-center">
                              <Square className="w-4 h-4 text-slate-300 mx-auto" />
                            </td>
                            <td className="p-3 font-semibold text-slate-900">
                              <div>Rafi Arya Wijaya</div>
                              <span className="text-[10px] text-slate-500 font-normal">Kelas VII-A • Reguler</span>
                            </td>
                            <td className="p-3 font-medium">Oktober 2026</td>
                            <td className="p-3">
                              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>LUNAS (07 Okt 2026, 11:20 WIB)</span>
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200 hover:bg-blue-100 cursor-pointer shadow-2xs">
                                <Printer className="w-3 h-3" /> Cetak Kuitansi PDF
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Ringkasan 3 Pilar Buku Kas Terintegrasi */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                      <div className="p-3.5 rounded-xl bg-gradient-to-b from-blue-50/80 to-white border border-blue-200 space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center justify-between">
                          <span>Pemasukan Kas & SPP</span>
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                        </div>
                        <div className="text-base font-black text-slate-950 font-mono">Rp 18.750.000</div>
                        <p className="text-[10px] text-slate-500">SPP siswa otomatis sinkron + Uang Pendaftaran/Seragam</p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-gradient-to-b from-rose-50/80 to-white border border-rose-200 space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800 flex items-center justify-between">
                          <span>Pengeluaran Operasional</span>
                          <span className="w-2 h-2 rounded-full bg-rose-600" />
                        </div>
                        <div className="text-base font-black text-slate-950 font-mono">Rp 5.200.000</div>
                        <p className="text-[10px] text-slate-500">Honor staf, listrik, ATK & pemeliharaan (arsip foto nota)</p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-gradient-to-b from-emerald-50/80 to-white border border-emerald-200 space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center justify-between">
                          <span>Saldo Kas Bersih Buku</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        </div>
                        <div className="text-base font-black text-emerald-700 font-mono">Rp 13.550.000</div>
                        <p className="text-[10px] text-slate-500">Net cashflow seimbang 100%, siap unduh laporan bulanan</p>
                      </div>
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

                {/* 5. Kartu Wali Murid (Mencerminkan Fungsi Asli ParentSppCardView) */}
                {activeWorkflow === 'portal' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-amber-100">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 text-xs font-bold mb-1">
                          <Receipt className="w-3 h-3 text-amber-700" /> Portal Kartu SPP Digital Mandiri 24 Jam
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Pemeriksaan Progres SPP Siswa Bebas Password & Multi-Anak</h3>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                          Wali murid cukup memasukkan nomor WhatsApp terdaftar. Langsung melihat kelunasan 1 tahun ajaran (Juli ke Juni), semester ganjil/genap, biaya daftar ulang/kelulusan, serta tombol cetak kartu mandiri.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 font-bold border border-amber-200 inline-flex items-center gap-1.5 shadow-2xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-800" />
                          <span>Privasi Terjaga: Nominal Rupiah Disembunyikan</span>
                        </span>
                      </div>
                    </div>

                    {/* Step 1: Form Akses Cepat via Nomor WA (Tanpa Password) */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex flex-col sm:flex-row items-center gap-2.5">
                        <div className="relative flex-1 w-full">
                          <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            readOnly 
                            value="0812-3456-7890 (Nomor WhatsApp Wali Murid)" 
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs sm:text-sm font-medium"
                          />
                        </div>
                        <button className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shrink-0 shadow-2xs">
                          <Search className="w-3.5 h-3.5" />
                          <span>Cek Kartu SPP</span>
                        </button>
                      </div>

                      {/* Multi-Anak Switcher (Fitur Nyata jika 1 Ortu punya 2 anak) */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-indigo-600" /> Ditemukan 2 Siswa untuk Nomor Ini:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer">
                            <span>Muhammad Rizky Pratama</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-medium">Kelas VII-A</span>
                          </span>
                          <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 flex items-center gap-1.5 cursor-pointer hover:bg-slate-200">
                            <span>Siti Aisyah Humaira</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 font-medium">Kelas IX-B</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Kartu Status Siswa & Progress Bar Kelunasan 1 Tahun Ajaran */}
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 font-black text-base flex items-center justify-center border border-indigo-200 shadow-inner">
                            M
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">Muhammad Rizky Pratama</h4>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                Aktif
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              Kelas: <b>VII-A</b> • Tahun Ajaran <b>TA 2026/2027 (Juli 2026 – Juni 2027)</b>
                            </p>
                          </div>
                        </div>
                        <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-200 self-start sm:self-auto cursor-pointer shadow-2xs">
                          <Printer className="w-3.5 h-3.5 text-slate-600" />
                          <span>Cetak Kartu SPP</span>
                        </button>
                      </div>

                      {/* Progress Bar 1 Tahun Ajaran (Juli ke Juni) */}
                      <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50/50 border border-indigo-100 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Progres Kelunasan SPP TA 2026/2027
                          </span>
                          <span className="font-black text-indigo-700">8 dari 12 Bulan Lunas (67%)</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden p-0.5">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: '67%' }} />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                          <span>Semester Ganjil: <b className="text-emerald-700">6/6 Lunas</b></span>
                          <span>Semester Genap: <b className="text-indigo-700">2/6 Lunas</b></span>
                        </div>
                      </div>

                      {/* 12 Kotak Status Bulan Tahun Ajaran (Juli - Juni) */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                          <CalendarRange className="w-3.5 h-3.5 text-indigo-600" /> Riwayat Status 12 Bulan (Juli 2026 – Juni 2027):
                        </div>
                        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
                          {/* Juli - Des (Ganjil) */}
                          <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-center">
                            <div className="font-bold text-slate-800 text-[11px]">Juli 2026</div>
                            <span className="text-[10px] font-extrabold text-emerald-700">LUNAS</span>
                            <div className="text-[9px] text-slate-500 mt-0.5">10 Jul 2026</div>
                          </div>
                          <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-center">
                            <div className="font-bold text-slate-800 text-[11px]">Agustus 2026</div>
                            <span className="text-[10px] font-extrabold text-emerald-700">LUNAS</span>
                            <div className="text-[9px] text-slate-500 mt-0.5">08 Agu 2026</div>
                          </div>
                          <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-center">
                            <div className="font-bold text-slate-800 text-[11px]">September 2026</div>
                            <span className="text-[10px] font-extrabold text-emerald-700">LUNAS</span>
                            <div className="text-[9px] text-slate-500 mt-0.5">05 Sep 2026</div>
                          </div>
                          <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-center">
                            <div className="font-bold text-slate-800 text-[11px]">Oktober 2026</div>
                            <span className="text-[10px] font-extrabold text-emerald-700">LUNAS</span>
                            <div className="text-[9px] text-slate-500 mt-0.5">08 Okt 2026</div>
                          </div>
                          <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-center">
                            <div className="font-bold text-slate-800 text-[11px]">November 2026</div>
                            <span className="text-[10px] font-extrabold text-emerald-700">LUNAS</span>
                            <div className="text-[9px] text-slate-500 mt-0.5">06 Nov 2026</div>
                          </div>
                          <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-center">
                            <div className="font-bold text-slate-800 text-[11px]">Desember 2026</div>
                            <span className="text-[10px] font-extrabold text-emerald-700">LUNAS</span>
                            <div className="text-[9px] text-slate-500 mt-0.5">10 Des 2026</div>
                          </div>

                          {/* Jan - Jun (Genap) */}
                          <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-center">
                            <div className="font-bold text-slate-800 text-[11px]">Januari 2027</div>
                            <span className="text-[10px] font-extrabold text-emerald-700">LUNAS</span>
                            <div className="text-[9px] text-slate-500 mt-0.5">08 Jan 2027</div>
                          </div>
                          <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-center">
                            <div className="font-bold text-slate-800 text-[11px]">Februari 2027</div>
                            <span className="text-[10px] font-extrabold text-emerald-700">LUNAS</span>
                            <div className="text-[9px] text-slate-500 mt-0.5">07 Feb 2027</div>
                          </div>
                          <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200 text-center">
                            <div className="font-bold text-slate-800 text-[11px]">Maret 2027</div>
                            <span className="text-[10px] font-extrabold text-rose-700">BELUM</span>
                            <div className="text-[9px] text-slate-400 mt-0.5">-</div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center opacity-70">
                            <div className="font-bold text-slate-700 text-[11px]">April 2027</div>
                            <span className="text-[10px] font-bold text-slate-500">BELUM</span>
                            <div className="text-[9px] text-slate-400 mt-0.5">-</div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center opacity-70">
                            <div className="font-bold text-slate-700 text-[11px]">Mei 2027</div>
                            <span className="text-[10px] font-bold text-slate-500">BELUM</span>
                            <div className="text-[9px] text-slate-400 mt-0.5">-</div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center opacity-70">
                            <div className="font-bold text-slate-700 text-[11px]">Juni 2027</div>
                            <span className="text-[10px] font-bold text-slate-500">BELUM</span>
                            <div className="text-[9px] text-slate-400 mt-0.5">-</div>
                          </div>
                        </div>
                      </div>

                      {/* Tagihan Khusus Program Daftar Ulang & Wisuda */}
                      <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded uppercase">📋 Daftar Ulang</span>
                            <div className="font-bold text-slate-800 mt-1">Uang Pangkal / Daftar Ulang TA 26/27</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            LUNAS
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded uppercase">🎓 Kelulusan</span>
                            <div className="font-bold text-slate-800 mt-1">Biaya Wisuda & Ijazah 2027</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                            BELUM BAYAR
                          </span>
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

      {/* SECTION: KEAMANAN FINANSIAL & BEBAS SETTLEMENT PIHAK KETIGA */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-emerald-50/90 via-white to-blue-50/60 border-2 border-emerald-200/90 shadow-xs space-y-8">
          
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Jaminan Kedaulatan & Keamanan Kas Sekolah</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              Sekolah Jauh Lebih Tenang: Uang SPP 100% Langsung Masuk ke Rekening Anda Tanpa Ditahan Pihak Ketiga
            </h2>
            
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Banyak yayasan dan sekolah skala kecil hingga menengah ragu memakai aplikasi digital karena khawatir dananya harus mengendap (<em>settlement</em>) berhari-hari di pihak ketiga, terkena potongan transaksi, atau ada risiko uang tertahan/hilang. Bersama <strong>CATATOH</strong>, Anda memegang kendali penuh.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Kartu 1 */}
            <div className="p-5 rounded-2xl bg-white border border-emerald-100 shadow-2xs space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Rekening Bank Sekolah Sendiri</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Orang tua murid mentransfer uang langsung ke rekening bank yang sekolah tentukan (BCA, BRI, Mandiri, BSI, dll) atau bayar tunai di tata usaha. <strong>Tidak ada perantara rekening penampung.</strong>
              </p>
            </div>

            {/* Kartu 2 */}
            <div className="p-5 rounded-2xl bg-white border border-emerald-100 shadow-2xs space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">0 Hari Settlement & 0% Potongan</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Uang masuk detik itu juga ke saldo rekening kas sekolah Anda. <strong>CATATOH tidak pernah menahan dana sekolah sepeser pun</strong> dan tidak memotong komisi per transaksi siswa.
              </p>
            </div>

            {/* Kartu 3 */}
            <div className="p-5 rounded-2xl bg-white border border-emerald-100 shadow-2xs space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Moderasi & Pengamanan Pencatatan</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Peran CATATOH murni sebagai <strong>asisten moderasi cerdas</strong>: membaca struk transfer otomatis via AI Vision, memverifikasi kuitansi lunas, dan mengamankan pembukuan kas agar tidak ada uang terselip.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 text-xs text-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-semibold text-slate-800">
                Uang 100% aman di bank Anda sendiri. Pencatatan rapi otomatis, orang tua senang, bendahara tenang.
              </span>
            </div>
            <button
              onClick={() => navigate('/pricing')}
              className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 transition-colors cursor-pointer shadow-xs"
            >
              Lihat Biaya & Paket
            </button>
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
            <h3 className="text-base font-bold text-slate-900 mb-2">Kas Terpadu & Kartu SPP Wali Murid</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              1-Klik Lunas & Lunas Massal, cetak kuitansi PDF resmi, otomatis sinkron ke buku kas operasional sekolah, serta portal cek mandiri wali murid berbasis nomor WA tanpa ribet login.
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
