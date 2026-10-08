import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import { 
  Check, 
  X, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Crown, 
  ChevronDown, 
  HelpCircle, 
  Calculator, 
  Clock, 
  FileSpreadsheet, 
  CheckCircle2, 
  Copy, 
  CreditCard,
  Building2,
  ScanFace,
  MessageCircle,
  Bot
} from 'lucide-react';

interface PricingViewProps {
  schoolName?: string;
  schoolLogo?: string;
}

export default function PricingView({ schoolName = 'CATATOH', schoolLogo = '' }: PricingViewProps) {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [studentCount, setStudentCount] = useState(250);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copiedBank, setCopiedBank] = useState(false);

  const handleCopyBca = () => {
    navigator.clipboard.writeText('7805556218');
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2500);
  };

  // Kalkulator Efisiensi
  const hoursSavedPerMonth = Math.round((studentCount / 100) * 16);
  const paperReamsSaved = Math.max(1, Math.round((studentCount / 100) * 2.5));
  const estimatedCostSaved = studentCount * 12000;

  const faqs = [
    {
      q: 'Apakah Paket Standar (Free) benar-benar gratis tanpa batas waktu?',
      a: 'Ya, 100% gratis selamanya! Anda dapat mencatat pembayaran SPP, mengelola siswa, mencetak kuitansi PDF resmi, dan membagikan tautan kartu SPP online ke wali murid tanpa dikenakan biaya sepeser pun.'
    },
    {
      q: 'Bagaimana prosedur aktivasi dan pembayaran untuk Paket Premium?',
      a: 'Pilih Paket Premium saat mendaftar akun atau di menu Pengaturan. Pembayaran dilakukan via transfer bank resmi BCA No. Rekening 7805556218 a.n Muhammad Ikhsan. Setelah transfer, kirimkan bukti bayar ke WhatsApp Admin dan status Premium Anda akan langsung diaktifkan seketika.'
    },
    {
      q: 'Apakah sekolah harus membeli mesin fingerprint atau kamera scanner khusus?',
      a: 'Sama sekali tidak perlu! Fitur Presensi Wajah AI CATATOH berjalan mulus di browser perangkat smartphone atau tablet Android/iPad apa pun yang memiliki kamera depan. Cukup letakkan tablet di meja piket atau gerbang masuk sekolah.'
    },
    {
      q: 'Apakah nomor WhatsApp sekolah aman dari risiko pemblokiran (banned)?',
      a: 'Sangat aman. Sistem gateway CATATOH dilengkapi algoritma Anti-Banned cerdas dengan variasi pesan unik dan jeda pengiriman acak (random dynamic delay) yang meniru pola ketikan manusia alami, sehingga terhindar dari deteksi spam broadcast WhatsApp.'
    },
    {
      q: 'Bisakah sekolah beralih dari Paket Standar ke Premium sewaktu-waktu?',
      a: 'Tentu saja! Semua data siswa, kelas, dan riwayat SPP yang telah Anda catat di paket Standar akan tetap utuh tersimpan saat Anda memutuskan untuk upgrade ke paket Premium.'
    },
    {
      q: 'Apakah wali murid perlu mengunduh aplikasi atau membuat akun baru?',
      a: 'Tidak perlu. Wali murid cukup membuka tautan Kartu SPP Online khusus anak mereka melalui browser WhatsApp di smartphone masing-masing tanpa harus login atau instal aplikasi tambahan.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white relative overflow-x-hidden">
      
      {/* 2026 Cosmic Atmosphere Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none z-0">
        <div className="absolute top-[-80px] right-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[130px]" />
        <div className="absolute top-[120px] left-1/4 w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[140px]" />
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

      {/* PRICING HERO */}
      <section className="relative z-10 pt-36 sm:pt-44 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="max-w-3xl mx-auto space-y-5">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 via-indigo-500/15 to-violet-500/10 border border-blue-400/25 text-blue-300 text-xs font-semibold backdrop-blur-xl">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Investasi Terbaik Pendidikan</span>
            <span className="text-slate-400">•</span>
            <span className="text-emerald-400 font-bold">Transparan & Tanpa Biaya Tersembunyi</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Pilihan Paket Terjangkau untuk{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-violet-400">
              Transformasi Sekolah Anda
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Mulai gratis dengan paket Standar tanpa kartu kredit, atau nikmati kecanggihan Presensi Wajah AI & WhatsApp Gateway otomatis dengan paket Premium.
          </p>

          {/* Billing Switcher (Bulanan vs Tahunan) */}
          <div className="pt-6 flex items-center justify-center">
            <div className="bg-slate-900/90 border border-white/10 p-1.5 rounded-2xl flex items-center gap-1 backdrop-blur-xl shadow-lg">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Bayar Bulanan
              </button>
              
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  billingCycle === 'yearly'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Bayar Tahunan</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black animate-pulse">
                  Hemat 110rb
                </span>
              </button>
            </div>
          </div>

        </div>

        {/* PRICING CARDS (2026 BENTO) */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto text-left">
          
          {/* Card 1: Standar / Free */}
          <div className="rounded-3xl p-7 bg-white/[0.03] border border-white/10 hover:border-white/20 backdrop-blur-xl flex flex-col justify-between transition-all duration-300 shadow-xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Paket Standar</h3>
                  <p className="text-xs text-slate-400 mt-1">Digitalisasi SPP & Keuangan Dasar</p>
                </div>
                <div className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 text-slate-300 border border-white/10">
                  Gratis Selamanya
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white font-mono">Rp 0</span>
                  <span className="text-xs text-slate-400 font-semibold">/ selamanya</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Cocok untuk sekolah atau madrasah yang baru beralih dari buku tulis fisik ke sistem online.
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Fitur yang Termasuk:</div>
                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Unlimited Data Siswa & Kelompok Kelas</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pencatatan Pembayaran SPP Bulanan</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Cetak Nota Kuitansi PDF Standar Resmi</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Kartu SPP Online Wali Murid (24 Jam)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Buku Kas Masuk, Keluar & Pos Lain</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Ekspor Data ke File Excel/CSV</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-slate-500">
                    <X className="w-4 h-4 text-slate-600 shrink-0" />
                    <span className="line-through">Presensi Biometrik Wajah AI</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-slate-500">
                    <X className="w-4 h-4 text-slate-600 shrink-0" />
                    <span className="line-through">WhatsApp Gateway Otomatis</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-slate-500">
                    <X className="w-4 h-4 text-slate-600 shrink-0" />
                    <span className="line-through">Gemini Vision OCR Struk Transfer</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8">
              <button
                onClick={() => navigate('/login?mode=register&tier=free')}
                className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Mulai Gratis Sekarang</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: PRO / PREMIUM (REKOMENDASI 2026) */}
          <div className="rounded-3xl p-7 bg-gradient-to-b from-blue-900/40 via-indigo-950/60 to-slate-900/90 border-2 border-indigo-500/60 hover:border-indigo-400/80 backdrop-blur-2xl flex flex-col justify-between transition-all duration-300 shadow-2xl shadow-indigo-950 relative scale-102 lg:-translate-y-2">
            
            {/* Glowing Crown Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 flex items-center gap-1.5 whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5" />
              Rekomendasi 2026 • Terlaris
            </div>

            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <span>Paket Premium</span>
                    <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                  </h3>
                  <p className="text-xs text-blue-200 mt-1">Lengkap AI Vision & WhatsApp Gateway</p>
                </div>
                <div className="px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Full Fitur AI
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-black text-white font-mono">
                    {billingCycle === 'yearly' ? 'Rp 250.000' : 'Rp 30.000'}
                  </span>
                  <span className="text-xs text-slate-300 font-semibold">
                    {billingCycle === 'yearly' ? '/ tahun' : '/ bulan'}
                  </span>
                </div>
                {billingCycle === 'yearly' ? (
                  <p className="text-xs text-amber-300 font-semibold mt-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Hemat Rp 110.000 dibandingkan bayar bulanan! (Setara ~20rb/bulan)
                  </p>
                ) : (
                  <p className="text-xs text-slate-300 mt-2">
                    Fleksibel bayar per bulan tanpa komitmen jangka panjang.
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Semua Fitur Standar, Ditambah:
                </div>
                <ul className="space-y-2.5 text-xs text-slate-200">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Presensi Wajah AI Sub-Detik</strong> (Siswa & Guru Kiosk)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Geofence GPS Sekolah</strong> Anti-Titip Absen</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>WhatsApp Gateway Otomatis</strong> Notifikasi Hadir/Pulang</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Broadcast Tagihan SPP Massal</strong> dengan Delay Anti-Banned</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>AI Vision Google Gemini</strong> Baca Otomatis Struk Transfer WA</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Panel Moderasi Bukti Bayar</strong> Terpadu</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Prioritas Support WhatsApp</strong> & Pendampingan Setup</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8">
              <button
                onClick={() => navigate(`/login?mode=register&tier=premium&cycle=${billingCycle}`)}
                className="w-full py-4 rounded-xl font-black text-sm text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-xl shadow-amber-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <span>Pilih Paket Premium ({billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'})</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </button>
            </div>
          </div>

          {/* Card 3: Yayasan / Multi-Unit */}
          <div className="rounded-3xl p-7 bg-white/[0.03] border border-white/10 hover:border-white/20 backdrop-blur-xl flex flex-col justify-between transition-all duration-300 shadow-xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Paket Yayasan</h3>
                  <p className="text-xs text-slate-400 mt-1">Multi-Sekolah & Ekosistem Terpusat</p>
                </div>
                <div className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 text-slate-300 border border-white/10">
                  Custom Unit
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white font-mono">Hubungi Kami</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Solusi khusus yayasan yang mengelola banyak jenjang pendidikan (TK, SD, SMP, SMA/SMK) dalam satu payung.
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Kapasitas Khusus:</div>
                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Multi-Tenant Akun Yayasan Pusat</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Konsolidasi Kas Semua Jenjang Sekolah</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Custom Subdomain & Server Mandiri</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pendampingan Onboarding Staf Tata Usaha</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>SLA Uptime & Server Dedikasi 99.9%</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8">
              <a
                href="https://threads.net/@isantoh"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Konsultasi Kebutuhan Yayasan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

        </div>

        {/* BANK ACCOUNT ACTIVATION INFO BOX */}
        <div className="mt-14 max-w-3xl mx-auto p-6 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Metode Pembayaran Resmi Aktivasi Premium:</div>
              <div className="text-xs text-slate-300 mt-0.5">
                Transfer BCA: <span className="font-mono font-bold text-amber-300">7805556218</span> a.n <strong>Muhammad Ikhsan</strong>
              </div>
            </div>
          </div>

          <button
            onClick={handleCopyBca}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedBank ? 'Tersalin!' : 'Salin No. Rekening'}</span>
          </button>
        </div>

      </section>

      {/* INTERACTIVE ROI / EFISIENSI KALKULATOR SECTION */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10 border-t border-white/10">
        <div className="rounded-3xl p-8 sm:p-12 bg-white/[0.02] border border-white/10 backdrop-blur-2xl max-w-4xl mx-auto">
          
          <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <Calculator className="w-3.5 h-3.5" />
              Kalkulator Efisiensi Biaya
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Berapa Jam & Biaya yang Dihemat Sekolah Anda?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Geser jumlah siswa sekolah Anda untuk melihat dampak efisiensi nyata operasional.
            </p>
          </div>

          {/* Slider */}
          <div className="space-y-4 max-w-xl mx-auto mb-10">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-300 font-semibold">Jumlah Total Siswa:</span>
              <span className="text-xl font-black text-blue-400 font-mono">{studentCount} Siswa</span>
            </div>
            <input
              type="range"
              min="30"
              max="1500"
              step="10"
              value={studentCount}
              onChange={(e) => setStudentCount(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>30 Siswa</span>
              <span>500 Siswa</span>
              <span>1000 Siswa</span>
              <span>1500 Siswa</span>
            </div>
          </div>

          {/* Result Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">~{hoursSavedPerMonth} Jam</div>
              <div className="text-xs text-slate-400 font-medium mt-1">Waktu Staf Dihemat per Bulan</div>
              <div className="text-[10px] text-slate-500 mt-2">Bebas dari ketik ulang presensi & rekap kas</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10">
              <div className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">~{paperReamsSaved} Rim</div>
              <div className="text-xs text-slate-400 font-medium mt-1">Kertas & Nota Terpangkas</div>
              <div className="text-[10px] text-slate-500 mt-2">Penghematan biaya cetak & buku kartu SPP</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10">
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">92%</div>
              <div className="text-xs text-slate-400 font-medium mt-1">Kepatuhan SPP Tepat Waktu</div>
              <div className="text-[10px] text-slate-500 mt-2">Didorong reminder WhatsApp otomatis</div>
            </div>
          </div>

        </div>
      </section>

      {/* FEATURE COMPARISON MATRIX TABLE */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10 border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Perbandingan Detail Fitur
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Pilih paket yang paling sesuai dengan kebutuhan operasional sekolah Anda saat ini.
          </p>
        </div>

        <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden border border-white/10 bg-slate-900/70 backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/80">
                  <th className="p-4 sm:p-5 font-bold text-slate-300">Fitur & Kemampuan</th>
                  <th className="p-4 sm:p-5 font-bold text-center text-slate-300 w-36">Standar (Free)</th>
                  <th className="p-4 sm:p-5 font-bold text-center text-indigo-300 w-44 bg-indigo-950/40">Premium (⭐)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="p-4 text-slate-300">Pencatatan SPP & Kas Sekolah</td>
                  <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="p-4 text-center bg-indigo-950/20"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-300">Kartu SPP Online Wali Murid 24/7</td>
                  <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="p-4 text-center bg-indigo-950/20"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-300">Cetak Kuitansi Nota PDF Resmi</td>
                  <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="p-4 text-center bg-indigo-950/20"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-300">Ekspor Rekapitulasi Excel / CSV</td>
                  <td className="p-4 text-center"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  <td className="p-4 text-center bg-indigo-950/20"><Check className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-300">Presensi Biometrik Wajah AI (Sub-Detik)</td>
                  <td className="p-4 text-center"><X className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="p-4 text-center bg-indigo-950/20 font-bold text-amber-300"><Check className="w-4 h-4 text-amber-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-300">Kiosk Scanner Tablet di Gerbang Sekolah</td>
                  <td className="p-4 text-center"><X className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="p-4 text-center bg-indigo-950/20"><Check className="w-4 h-4 text-amber-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-300">Geofencing Radius GPS Sekolah</td>
                  <td className="p-4 text-center"><X className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="p-4 text-center bg-indigo-950/20"><Check className="w-4 h-4 text-amber-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-300">WhatsApp Gateway Otomatis Hadir/Pulang</td>
                  <td className="p-4 text-center"><X className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="p-4 text-center bg-indigo-950/20"><Check className="w-4 h-4 text-amber-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-300">Blast Tagihan SPP Massal Anti-Banned</td>
                  <td className="p-4 text-center"><X className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="p-4 text-center bg-indigo-950/20"><Check className="w-4 h-4 text-amber-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-300">AI Vision Gemini Baca Struk Transfer Bank</td>
                  <td className="p-4 text-center"><X className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="p-4 text-center bg-indigo-950/20"><Check className="w-4 h-4 text-amber-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-300">Panel Moderasi Bukti Bayar Terpadu</td>
                  <td className="p-4 text-center"><X className="w-4 h-4 text-slate-600 mx-auto" /></td>
                  <td className="p-4 text-center bg-indigo-950/20"><Check className="w-4 h-4 text-amber-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-300">Prioritas Dukungan Teknis & Setup WhatsApp</td>
                  <td className="p-4 text-center text-slate-500 text-xs">Komunitas</td>
                  <td className="p-4 text-center bg-indigo-950/20 font-bold text-emerald-300 text-xs">WhatsApp VIP</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FREQUENTLY ASKED QUESTIONS (FAQ) */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto relative z-10 border-t border-white/10">
        <div className="text-center mb-12 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-slate-300 border border-white/10">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            Tanya Jawab
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Pertanyaan yang Sering Diajukan
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div 
                key={faq.q}
                className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-white hover:text-blue-300 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-400' : 'text-slate-400'}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-white/5 animate-in fade-in duration-200">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Public Footer */}
      <PublicFooter schoolName={schoolName} />

    </div>
  );
}
