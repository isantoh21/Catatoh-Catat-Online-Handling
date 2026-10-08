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
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Users, 
  FileText, 
  Zap, 
  Check, 
  XCircle, 
  ChevronRight, 
  Smartphone, 
  BarChart3, 
  Lock,
  Layers,
  ArrowUpRight,
  School,
  Building2,
  CalendarCheck2,
  CreditCard
} from 'lucide-react';

interface HomeViewProps {
  schoolName?: string;
  schoolLogo?: string;
}

export default function HomeView({ schoolName = 'CATATOH', schoolLogo = '' }: HomeViewProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'presensi' | 'wa' | 'ocr' | 'spp' | 'portal'>('presensi');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white relative overflow-x-hidden">
      
      {/* 2026 Cosmic Atmosphere Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none z-0">
        <div className="absolute top-[-100px] left-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[128px]" />
        <div className="absolute top-[100px] right-1/4 w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-[300px] left-1/3 w-[350px] h-[350px] bg-violet-600/10 rounded-full blur-[110px]" />
      </div>

      {/* Grid Overlay Texture */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.12] z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Top Navbar */}
      <PublicNavbar schoolName={schoolName} schoolLogo={schoolLogo} />

      {/* HERO SECTION 2026 */}
      <section className="relative z-10 pt-36 sm:pt-44 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          
          {/* 2026 Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 via-indigo-500/15 to-violet-500/10 border border-blue-400/25 text-blue-300 text-xs font-semibold backdrop-blur-xl shadow-lg shadow-blue-500/5 animate-in fade-in duration-700">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">Ekosistem EduOS Generasi Baru</span>
            <span className="text-blue-400 font-mono">v2.6</span>
            <span className="px-1.5 py-0.2 rounded-md bg-blue-500/20 text-[10px] font-bold text-blue-300 uppercase">Resmi</span>
          </div>

          {/* Grand Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]">
            Otomatisasi Presensi Wajah AI, SPP & WhatsApp Sekolah{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-violet-400">
              Dalam Satu Layar Cerdas.
            </span>
          </h1>

          {/* Subheadline Copywriting */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
            Selamat tinggal buku presensi robek, antrean piket pagi, rekapan Excel yang bentrok, dan tumpukan struk transfer tak bertuan. <strong>CATATOH</strong> menyatukan presensi biometrik wajah, broadcast WhatsApp anti-banned, dan pembukuan SPP digital untuk sekolah masa depan.
          </p>

          {/* Action CTAs */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={() => navigate('/login?mode=register')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all duration-300 border border-white/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2 group"
            >
              <span>Mulai Gratis Sekarang</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/pricing')}
              className="w-full sm:w-auto px-7 py-4 rounded-2xl text-sm font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 backdrop-blur-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span>Lihat Biaya & Paket</span>
            </button>
          </div>

          {/* Key Quick Metrics */}
          <div className="pt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto text-left">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
              <div className="text-xl sm:text-2xl font-black text-blue-400 font-mono">1 Detik</div>
              <div className="text-xs text-slate-400 font-medium">Validasi Scan Wajah AI</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
              <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">Anti-Banned</div>
              <div className="text-xs text-slate-400 font-medium">WhatsApp Gateway Cerdas</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
              <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">Vision OCR</div>
              <div className="text-xs text-slate-400 font-medium">Gemini AI Baca Struk Bank</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
              <div className="text-xl sm:text-2xl font-black text-violet-400 font-mono">24/7 Live</div>
              <div className="text-xs text-slate-400 font-medium">Portal Mandiri Wali Murid</div>
            </div>
          </div>

        </div>

        {/* 2026 SPATIAL INTERACTIVE PRODUCT SHOWCASE */}
        <div className="mt-16 relative max-w-5xl mx-auto">
          <div className="rounded-3xl p-1 sm:p-2 bg-gradient-to-b from-white/20 via-white/5 to-white/0 shadow-2xl shadow-indigo-950/60 border border-white/10">
            <div className="rounded-[22px] bg-slate-900/90 backdrop-blur-2xl p-4 sm:p-7 border border-white/10 overflow-hidden">
              
              {/* Top Navigation Tabs inside mockup */}
              <div className="flex items-center justify-between pb-6 border-b border-white/10 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs font-mono text-slate-400 hidden sm:inline">
                    app.catatoh.cloud / demo-interactive-preview
                  </span>
                </div>

                {/* Tab Pill Buttons */}
                <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-white/10 overflow-x-auto max-w-full">
                  <button
                    onClick={() => setActiveTab('presensi')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'presensi' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Presensi Wajah AI
                  </button>
                  <button
                    onClick={() => setActiveTab('wa')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'wa' 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    WhatsApp Gateway
                  </button>
                  <button
                    onClick={() => setActiveTab('ocr')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'ocr' 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    OCR Gemini Struk
                  </button>
                  <button
                    onClick={() => setActiveTab('spp')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'spp' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Buku Kas & SPP
                  </button>
                  <button
                    onClick={() => setActiveTab('portal')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'portal' 
                        ? 'bg-amber-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Kartu Ortu 24 Jam
                  </button>
                </div>
              </div>

              {/* Dynamic Content Pane based on Tab */}
              <div className="pt-6">
                {activeTab === 'presensi' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-5 space-y-4">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        <ScanFace className="w-3.5 h-3.5" />
                        AI Biometrik Sub-Detik
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white">
                        Presensi Kiosk Tablet di Gerbang Sekolah
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Siswa cukup berdiri di depan kamera smartphone/tablet piket. Model FaceMesh membaca 468 titik biometrik wajah dalam 1 detik, memverifikasi radius GPS sekolah, dan mencatat log kehadiran tanpa sentuh.
                      </p>
                      <ul className="space-y-2 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>100% Anti-titip absen & anti-foto cetak</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Validasi radius GPS sekolah fleksibel</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Mendukung mode Guru & Siswa terpisah</span>
                        </li>
                      </ul>
                    </div>

                    <div className="md:col-span-7 bg-slate-950/90 rounded-2xl p-5 border border-white/10 shadow-inner">
                      <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-blue-500/30 p-6 flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 rounded-full border-2 border-dashed border-blue-400 flex items-center justify-center relative mb-4 animate-pulse">
                          <ScanFace className="w-12 h-12 text-blue-400" />
                          <div className="absolute inset-0 rounded-full border border-blue-400/50 scale-125 animate-ping opacity-30" />
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold mb-2">
                          <Check className="w-3.5 h-3.5" /> Wajah Terverifikasi (99.8%)
                        </div>
                        <div className="text-sm font-bold text-white">Muhammad Rizky Pratama</div>
                        <div className="text-xs text-slate-400">Kelas VII-A • Tiba 06:48 WIB • Tepat Waktu</div>
                        <div className="mt-4 pt-3 border-t border-white/10 w-full flex justify-between items-center text-[11px] text-slate-400">
                          <span>Radius GPS: <strong>12 meter dari gerbang</strong></span>
                          <span className="text-emerald-400 font-mono font-bold">Status: Hadir</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'wa' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-5 space-y-4">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp Gateway Anti-Ban
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white">
                        Notifikasi Masuk/Pulang & Tagihan SPP Massal
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Kirimkan laporan kehadiran langsung ke ponsel orang tua detik itu juga. Di awal bulan, kirimkan tagihan SPP massal sekali klik dengan algoritma jeda acak manusiawi agar nomor sekolah tetap aman anti-banned.
                      </p>
                      <ul className="space-y-2 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Pesan otomatis saat anak scan hadir & pulang</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Reminder SPP santun dengan tautan rincian tagihan</span>
                        </li>
                      </ul>
                    </div>

                    <div className="md:col-span-7 bg-slate-950/90 rounded-2xl p-5 border border-white/10">
                      <div className="bg-[#0b141a] rounded-xl p-4 border border-emerald-500/30 text-left font-sans max-w-md mx-auto">
                        <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                            SMP
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">CATATOH Notifikasi Sekolah</div>
                            <div className="text-[10px] text-slate-400 font-mono">Pesan Resmi Terenkripsi</div>
                          </div>
                        </div>
                        <div className="mt-3 bg-[#1f2c34] p-3 rounded-xl text-xs text-slate-200 space-y-1.5 border border-white/5">
                          <p className="font-bold text-emerald-400">Pemberitahuan Presensi Siswa 🔔</p>
                          <p>Yth. Bapak/Ibu Wali Murid dari <strong>Muhammad Rizky Pratama (Kelas VII-A)</strong>,</p>
                          <p>Ananda telah tiba di sekolah dan melakukan scan presensi pada <strong>Pukul 06:48 WIB</strong> dalam kondisi Sehat.</p>
                          <p className="text-[10px] text-slate-400 pt-1">Terima kasih atas kepercayaannya menitipkan ananda di sekolah kami.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ocr' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-5 space-y-4">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        <Bot className="w-3.5 h-3.5" />
                        AI Vision Google Gemini
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white">
                        Ekstraksi Cerdas Struk Transfer Bank dari WA
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Foto struk transfer m-Banking dari orang tua (BCA, BRI, Mandiri, BSI, dll) yang masuk ke chat WhatsApp sekolah dibaca secara instan oleh AI Vision. Nominal, tanggal, dan rekening langsung terekam tanpa ketik manual.
                      </p>
                      <ul className="space-y-2 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Pencegahan struk palsu / editan</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>1-klik verifikasi untuk menerbitkan kuitansi lunas</span>
                        </li>
                      </ul>
                    </div>

                    <div className="md:col-span-7 bg-slate-950/90 rounded-2xl p-5 border border-white/10">
                      <div className="bg-slate-900 rounded-xl p-4 border border-purple-500/30 space-y-3">
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                          <span className="text-purple-300 font-bold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" /> Hasil Pembacaan AI Vision
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">Tingkat Keyakinan 99.4%</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5">
                            <div className="text-[10px] text-slate-400">Bank Pengirim</div>
                            <div className="font-bold text-white">BCA Mobile</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5">
                            <div className="text-[10px] text-slate-400">Nominal Transfer</div>
                            <div className="font-bold text-emerald-400 font-mono">Rp 350.000</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5">
                            <div className="text-[10px] text-slate-400">Tujuan Siswa</div>
                            <div className="font-bold text-white">Aisyah Humaira (VII-B)</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5">
                            <div className="text-[10px] text-slate-400">Pos Alokasi</div>
                            <div className="font-bold text-blue-300">SPP Bulan Oktober 2026</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'spp' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-5 space-y-4">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        <Wallet className="w-3.5 h-3.5" />
                        Treasury Management
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white">
                        Buku Kas, Uang Gedung & Cetak Kuitansi PDF
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Sentralisasi pembukuan SPP, infak pembangunan, tabungan, dan pengeluaran operasional. Filter per kelas dalam 1 detik, cetak nota kuitansi resmi ber-barcode, dan ekspor ke Excel tanpa ribet.
                      </p>
                      <ul className="space-y-2 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Perhitungan otomatis saldo kas tanpa selisih</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Laporan bulanan siap print / audit kepala sekolah</span>
                        </li>
                      </ul>
                    </div>

                    <div className="md:col-span-7 bg-slate-950/90 rounded-2xl p-5 border border-white/10">
                      <div className="space-y-3">
                        <div className="p-3 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 rounded-xl border border-blue-500/30 flex justify-between items-center">
                          <div>
                            <div className="text-[11px] text-slate-300">Total Kas Terkumpul Bulan Ini</div>
                            <div className="text-xl font-black text-white font-mono">Rp 48.750.000</div>
                          </div>
                          <span className="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full font-bold">Lunas 88%</span>
                        </div>
                        <div className="p-3 bg-slate-900 rounded-xl border border-white/5 space-y-1.5 text-xs">
                          <div className="flex justify-between font-semibold">
                            <span className="text-slate-300">Kelas VII-A (32 Siswa)</span>
                            <span className="text-emerald-400 font-mono">29 Lunas • 3 Belum</span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '90%' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'portal' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-5 space-y-4">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <Receipt className="w-3.5 h-3.5" />
                        Transparansi Mandiri 24 Jam
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white">
                        Kartu SPP Online Wali Murid Tanpa Password
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Tiap siswa memiliki tautan kartu SPP online khusus. Orang tua dapat melihat riwayat pembayaran 1 tahun ajaran kapan saja dari smartphone mereka tanpa perlu login atau instal aplikasi apapun.
                      </p>
                      <ul className="space-y-2 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Turunkan 90% telepon/WA wali murid nanya tagihan</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Unduh kuitansi digital sah kapan saja</span>
                        </li>
                      </ul>
                    </div>

                    <div className="md:col-span-7 bg-slate-950/90 rounded-2xl p-5 border border-white/10">
                      <div className="bg-slate-900 rounded-xl p-4 border border-amber-500/30 space-y-2 text-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-white/10">
                          <div>
                            <div className="font-bold text-white">Kartu SPP Digital Siswa</div>
                            <div className="text-[10px] text-slate-400 font-mono">Tahun Ajaran 2026/2027</div>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">Status Aktif</span>
                        </div>
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between py-1 border-b border-white/5">
                            <span className="text-slate-400">Juli 2026</span>
                            <span className="text-emerald-400 font-bold">Lunas (2 Juli 2026)</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-white/5">
                            <span className="text-slate-400">Agustus 2026</span>
                            <span className="text-emerald-400 font-bold">Lunas (5 Agustus 2026)</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-white/5">
                            <span className="text-slate-400">September 2026</span>
                            <span className="text-emerald-400 font-bold">Lunas (1 September 2026)</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-300 font-bold">Oktober 2026</span>
                            <span className="text-amber-400 font-bold">Menunggu Pembayaran</span>
                          </div>
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

      {/* SECTION: APA SIH APLIKASI CATATOH ITU? (DEEP COPYWRITING) */}
      <section id="fitur" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10 border-t border-white/10">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <School className="w-3.5 h-3.5 text-indigo-400" />
            Tentang CATATOH
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Apa Sih Sebenarnya Aplikasi CATATOH Itu?
          </h2>
          <p className="text-base text-slate-300 leading-relaxed">
            <strong>CATATOH</strong> adalah singkatan dari <em>Catat Online Handling</em>—sebuah platform manajemen operasional dan keuangan sekolah modern yang dirancang untuk mengakhiri kekacauan administrasi konvensional di sekolah, madrasah, dan pesantren di Indonesia.
          </p>
        </div>

        {/* BEFORE VS AFTER COMPARISON (2026 BENTO) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
          {/* Sisi Sebelum Pakai Catatoh */}
          <div className="p-8 rounded-3xl bg-rose-950/20 border border-rose-500/20 backdrop-blur-xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-rose-200">Cara Lama Tanpa CATATOH</h3>
                <p className="text-xs text-rose-300/70">Melelahkan, rentan selisih, dan menyita waktu staf</p>
              </div>
            </div>

            <ul className="space-y-4 text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <span className="text-rose-400 font-bold shrink-0 mt-0.5">✕</span>
                <span><strong>Antrean piket pagi mengular:</strong> Siswa berebut tanda tangan atau fingertip kotor, rawan titip absen, dan staf harus rekap ratusan lembar presensi di akhir bulan.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-rose-400 font-bold shrink-0 mt-0.5">✕</span>
                <span><strong>WhatsApp sekolah rawan diblokir:</strong> Guru menagih tunggakan manual satu-per-satu, sangat canggung, dan nomor sekolah berisiko ter-banned karena spamming pesan yang sama.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-rose-400 font-bold shrink-0 mt-0.5">✕</span>
                <span><strong>Struk transfer tercecer di chat:</strong> Puluhan foto bukti m-Banking menumpuk tanpa nama jelas, rawan salah catat nama siswa, dan rentan struk editan/palsu.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-rose-400 font-bold shrink-0 mt-0.5">✕</span>
                <span><strong>Buku kas sering selisih:</strong> Catatan di buku fisik dan Excel bentrok antar staf, kuitansi kertas basah/hilang di tas siswa, dan orang tua sering menanyakan saldo.</span>
              </li>
            </ul>
          </div>

          {/* Sisi Setelah Pakai Catatoh */}
          <div className="p-8 rounded-3xl bg-emerald-950/25 border border-emerald-500/30 backdrop-blur-xl relative overflow-hidden shadow-2xl shadow-emerald-950/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-200">Dengan Ekosistem CATATOH 2026</h3>
                <p className="text-xs text-emerald-300/70">Serba otomatis, transparan, dan dapat diakses kapan saja</p>
              </div>
            </div>

            <ul className="space-y-4 text-sm text-slate-200">
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                <span><strong>Scan Wajah AI 1 Detik di Gerbang:</strong> Siswa dan guru cukup berdiri di depan kamera tablet piket. Validasi radius GPS instan, bebas sentuh, anti-curang.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                <span><strong>WhatsApp Anti-Ban Cerdas:</strong> Notifikasi kehadiran terkirim otomatis ke orang tua, dan tagihan SPP massal dikirim teratur dengan jeda manusiawi.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                <span><strong>AI Vision Google Gemini:</strong> Pembaca otomatis nominal, tanggal, dan rekening dari foto bukti transfer bank. 1-klik setujui dan nota langsung terbit.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                <span><strong>Transparansi Kartu SPP Online:</strong> Wali murid bisa memeriksa status lunas dan unduh kuitansi resmi PDF 24 jam dari HP mereka tanpa login.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 6 PILAR UTAMA BENTO GRID 2026 */}
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              6 Fitur Unggulan Siap Pakai Hari Ini
            </h3>
            <p className="text-sm text-slate-400 mt-2">
              Setiap modul dibangun secara modular dan tersinkronisasi otomatis secara realtime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Fitur 1 */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-blue-500/40 hover:bg-white/[0.05] transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ScanFace className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Presensi Biometrik Wajah AI</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Scan wajah sub-detik untuk guru dan siswa menggunakan kamera HP/tablet yang dipasang di gerbang. Dilengkapi geofencing radius GPS sekolah.
              </p>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-blue-300 font-semibold">
                <span>Anti-Titip Absen</span>
                <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Fitur 2 */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.05] transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">WhatsApp Gateway Anti-Ban</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Integrasi WA otomatis untuk kirim notifikasi presensi anak langsung ke wali murid serta blast tagihan SPP massal dengan delay dinamis proteksi anti-blokir.
              </p>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-emerald-300 font-semibold">
                <span>Notifikasi Real-Time</span>
                <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Fitur 3 */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-purple-500/40 hover:bg-white/[0.05] transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Bot className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">AI Vision OCR Struk Transfer</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Teknologi Google Gemini membaca foto struk transfer m-Banking dari wali murid, mencocokkan nominal dan bank secara otomatis tanpa rekap manual.
              </p>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-purple-300 font-semibold">
                <span>Powered by Gemini</span>
                <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Fitur 4 */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/40 hover:bg-white/[0.05] transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Wallet className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Buku Kas & Multi-Pos SPP</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Kelola SPP bulanan, uang gedung, tabungan siswa, dan pengeluaran operasional sekolah dengan filter kelas instan dan kalkulasi saldo tanpa selisih.
              </p>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-indigo-300 font-semibold">
                <span>Kuitansi PDF Resmi</span>
                <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Fitur 5 */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-amber-500/40 hover:bg-white/[0.05] transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Receipt className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Portal Mandiri Wali Murid</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tautan kartu SPP online transparan untuk setiap anak. Orang tua memantau status pembayaran 1 tahun ajaran dan unduh kuitansi resmi tanpa harus login.
              </p>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-amber-300 font-semibold">
                <span>Akses 24 Jam Bebas Login</span>
                <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Fitur 6 */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-violet-500/40 hover:bg-white/[0.05] transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Cloud Multi-Tenant & Aman</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Data terenkripsi dan terisolasi per sekolah. Dilengkapi perisai keamanan inspect element, backup cloud otomatis, serta dukungan multi-admin.
              </p>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-violet-300 font-semibold">
                <span>Enkripsi Standar Perbankan</span>
                <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

          </div>
        </div>

      </section>

      {/* CALL TO ACTION 2026 COSMIC BANNER */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <div className="rounded-3xl p-8 sm:p-14 bg-gradient-to-r from-blue-900/60 via-indigo-900/50 to-violet-900/60 border border-white/20 backdrop-blur-2xl relative overflow-hidden text-center shadow-2xl shadow-indigo-950">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-bold border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Tingkatkan Citra Profesionalitas Sekolah Anda
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Siap Memulai Transformasi Digital Sekolah Anda?
            </h2>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              Mulai gratis dengan paket Standar tanpa batas waktu, atau nikmati presensi wajah biometrik AI dan WhatsApp otomatis dengan paket Premium hanya Rp 30.000/bulan.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/login?mode=register')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Daftar Akun Sekolah Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate('/pricing')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-slate-200 bg-white/10 hover:bg-white/15 border border-white/15 transition-all cursor-pointer"
              >
                Bandingkan Semua Paket
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Public Footer */}
      <PublicFooter schoolName={schoolName} />

    </div>
  );
}
