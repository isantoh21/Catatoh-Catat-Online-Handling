import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Lock, 
  LogIn, 
  UserPlus, 
  KeyRound, 
  ArrowLeft, 
  MapPin, 
  CheckCircle2, 
  Wallet, 
  Users, 
  ShieldCheck, 
  MessageCircle, 
  Sparkles, 
  Bot, 
  Receipt, 
  Eye, 
  EyeOff, 
  Zap, 
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Crown,
  Check,
  XCircle,
  ScanFace,
  CreditCard,
  School,
  FileSpreadsheet,
  Copy
} from 'lucide-react';
import { INDONESIAN_CITIES } from '../data/cities';
import DefaultLogo from './DefaultLogo';
import { supabase } from '../lib/supabaseClient';

interface UseCaseSlide {
  id: string;
  badge: string;
  title: string;
  icon: React.ReactNode;
  useCase: string;
  problem: string;
  solution: string;
  impactMetric: string;
  impactDesc: string;
}

const USE_CASE_SLIDES: UseCaseSlide[] = [
  {
    id: 'overview',
    badge: 'Overview • Apa Itu CATATOH?',
    title: 'Platform All-in-One Digitalisasi Administrasi Sekolah',
    icon: <Sparkles className="w-5 h-5 text-indigo-400" />,
    useCase: 'CATATOH (Catat Online Handling) adalah sistem manajemen sekolah modern yang mengintegrasikan pencatatan SPP, absensi biometrik wajah siswa & guru, hingga notifikasi WhatsApp otomatis dalam satu ekosistem cloud yang mudah digunakan oleh seluruh staf sekolah.',
    problem: 'Sebelum CATATOH: Pembukuan SPP tersebar di banyak lembar Excel yang sering selisih, antrean absensi manual berisiko titip absen, dan bendahara harus menagih wali murid satu per satu via chat pribadi yang memalukan & menyita waktu.',
    solution: 'Dengan CATATOH: Otomatisasi 90% pekerjaan rutin sekolah! Menghubungkan tata usaha, guru, dan orang tua secara real-time, akurat, dan transparan untuk semua jenjang (PAUD/TK, SD, SMP, SMA/SMK, Pesantren & Bimbel).',
    impactMetric: 'All-in-One',
    impactDesc: 'Ekosistem sekolah terpadu'
  },
  {
    id: 'face-attendance',
    badge: 'Presensi Biometrik Wajah',
    title: 'Absensi Siswa & Guru Berbasis AI Tanpa Sentuh',
    icon: <ScanFace className="w-5 h-5 text-indigo-400" />,
    useCase: 'Tablet ditempatkan di gerbang / meja piket sekolah. Siswa & guru cukup berdiri 1 detik di depan kamera untuk verifikasi kehadiran otomatis.',
    problem: 'Sebelum CATATOH: Antrean panjang setiap pagi, marak titip absen antar staf/teman, buku absensi kertas rentan hilang/rusak, dan rekap manual menyita puluhan jam kerja setiap akhir bulan.',
    solution: 'Dengan CATATOH: AI Face Recognition memvalidasi biometrik wajah dalam 1 detik anti-curang, terikat radius GPS sekolah, dan rekap kehadiran bulanan otomatis siap cetak PDF.',
    impactMetric: '1 Detik',
    impactDesc: 'Kecepatan scan wajah akurat'
  },
  {
    id: 'wa-gateway',
    badge: 'WhatsApp Gateway Otomatis',
    title: 'Reminder SPP Massal Sekali Klik dengan Anti-Ban',
    icon: <MessageCircle className="w-5 h-5 text-emerald-400" />,
    useCase: 'Tiap tanggal 5, bendahara menekan 1 tombol. Ratusan wali murid menerima pesan tagihan personal lengkap dengan nama anak, nominal, dan tautan kartu SPP.',
    problem: 'Sebelum CATATOH: Guru canggung/malu menagih SPP manual, mengetik ratusan chat satu per satu sangat melelahkan, dan nomor sekolah berisiko diblokir WhatsApp karena copy-paste massal.',
    solution: 'Dengan CATATOH: Server mengirimkan pesan resmi otomatis dengan jeda acak dinamis (Anti-Banned Protection) menyerupai ketikan manusia asli, melipatgandakan kepatuhan bayar wali murid.',
    impactMetric: '85%+',
    impactDesc: 'Kenaikan pelunasan tepat waktu'
  },
  {
    id: 'ai-ocr',
    badge: 'AI Vision OCR (Gemini)',
    title: 'Verifikasi Struk Transfer Bank Tanpa Pusing',
    icon: <Bot className="w-5 h-5 text-indigo-400" />,
    useCase: 'Orang tua mengirim foto struk transfer m-Banking ke WhatsApp sekolah. AI langsung membaca nominal, tanggal, dan nama bank, lalu mencocokkannya ke siswa.',
    problem: 'Sebelum CATATOH: Chat WhatsApp sekolah penuh ratusan foto bukti transfer yang tercecer, rawan lolos struk editan/palsu, dan bendahara sering salah catat nama siswa yang mirip.',
    solution: 'Dengan CATATOH: Ekstraksi AI Vision otomatis mengenali angka transfer dengan presisi tinggi. Bendahara cukup klik "Verifikasi", status siswa langsung lunas & konfirmasi WA otomatis terkirim.',
    impactMetric: '100%',
    impactDesc: 'Bebas salah catat bukti transfer'
  },
  {
    id: 'parent-portal',
    badge: 'Kartu SPP Online Mandiri',
    title: 'Transparansi Keuangan Real-Time untuk Wali Murid',
    icon: <Receipt className="w-5 h-5 text-indigo-400" />,
    useCase: 'Wali murid dapat membuka tautan kartu SPP digital dari smartphone kapan saja untuk memantau status pembayaran 1 tahun ajaran tanpa perlu login akun.',
    problem: 'Sebelum CATATOH: Kartu SPP fisik kertas sering robek, hilang di tas anak, atau terselip di rumah. Orang tua terus-menerus menelepon tata usaha menanyakan apakah sudah lunas.',
    solution: 'Dengan CATATOH: Tautan mandiri transparan 24 jam memudahkan orang tua mengecek status bayar secara mandiri, sekaligus mencetak kuitansi resmi PDF standar sekolah.',
    impactMetric: '90%',
    impactDesc: 'Penurunan panggilan tanya SPP'
  },
  {
    id: 'finance-multi',
    badge: 'Keuangan & Multi-Kelompok',
    title: 'Sentralisasi Arus Kas & Data Siswa Tanpa Batas',
    icon: <Wallet className="w-5 h-5 text-indigo-400" />,
    useCase: 'Kepala sekolah dan bendahara mengontrol pos SPP, uang gedung, tabungan siswa, dan kas operasional dalam satu dashboard yang tersinkronisasi.',
    problem: 'Sebelum CATATOH: Pencatatan tersebar di puluhan lembar file Excel terpisah yang sering korup, versinya berbeda-beda antar guru, dan laporan audit tahunan memakan waktu berminggu-minggu.',
    solution: 'Dengan CATATOH: Database terpusat multi-tenant dengan filter kelas instan, rekap saldo otomatis, dan pencatatan yang siap diaudit yayasan/dinas kapan saja.',
    impactMetric: 'Unlimited',
    impactDesc: 'Kapasitas data di paket Premium'
  }
];

export default function LoginView({ 
    onLogin, 
    schoolName = 'CATATOH', 
    schoolLogo = '' 
  }: { 
    onLogin?: (user?: any) => void; 
    schoolName?: string; 
    schoolLogo?: string; 
  }) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Register Tier & Subscription Selection
  const [selectedTier, setSelectedTier] = useState<'free' | 'premium'>('free');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Modal konfirmasi pembayaran & instruksi WhatsApp setelah registrasi Premium
  const [registeredPremiumPending, setRegisteredPremiumPending] = useState<{
    email: string;
    user?: any;
    billingCycle: 'monthly' | 'yearly';
    city?: string;
  } | null>(null);
  const [copiedBank, setCopiedBank] = useState<string | null>(null);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBank(type);
    setTimeout(() => setCopiedBank(null), 2500);
  };

  // Slider State
  const [activeSlide, setActiveSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-play Slider every 6 seconds
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % USE_CASE_SLIDES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isHovered]);

  const handlePrevSlide = () => {
    setActiveSlide(prev => (prev - 1 + USE_CASE_SLIDES.length) % USE_CASE_SLIDES.length);
  };

  const handleNextSlide = () => {
    setActiveSlide(prev => (prev + 1) % USE_CASE_SLIDES.length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          setError(error.message || 'Login gagal. Periksa kembali email dan password Anda.');
        } else if (data.session) {
          if (onLogin) onLogin(data.session.user);
        }
      } else if (mode === 'register') {
        const isPrem = selectedTier === 'premium';

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              city: city,
              tier: 'free', // Semua pendaftaran baru selalu berstatus Akun Biasa/Free terlebih dahulu
              subscription_plan: 'free',
              subscription_expires_at: null,
              subscription_status: 'free',
              requested_tier: selectedTier,
              requested_premium_plan: isPrem ? billingCycle : null
            }
          }
        });

        if (error) {
          setError(error.message || 'Pendaftaran gagal: ' + error.message);
        } else if (isPrem) {
          // Pengguna memilih Premium: selalu arahkan untuk bayar & hubungi Admin terlebih dahulu
          setRegisteredPremiumPending({
            email,
            user: data.session?.user,
            billingCycle,
            city
          });
        } else if (data.session) {
          setMessage('Pendaftaran akun Standar berhasil! Otomatis masuk ke dashboard...');
          setTimeout(() => {
            if (onLogin) onLogin(data.session.user);
          }, 900);
        } else {
          setMessage('Pendaftaran akun Standar berhasil! Silakan masuk dengan email & kata sandi Anda.');
          setMode('login');
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) {
          setError(error.message);
        } else {
          setMessage('Instruksi reset password telah dikirim ke email Anda.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const currentSlide = USE_CASE_SLIDES[activeSlide];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-950 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Left Column: Interactive Real-World Use Case Slider & Showcase */}
      <div 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex flex-col justify-between bg-slate-950 text-white p-6 sm:p-10 lg:p-12 w-full lg:w-7/12 relative overflow-hidden order-2 lg:order-1 border-t lg:border-t-0 lg:border-r border-slate-800"
      >
        {/* Subtle Ambient Glow matching main theme */}
        <div className="absolute top-0 right-0 -mt-24 -mr-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-96 h-96 bg-slate-800/40 rounded-full blur-3xl pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 max-w-2xl mx-auto lg:mx-0 w-full flex flex-col justify-between h-full space-y-6">
          
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              {schoolLogo ? (
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/40 p-1.5 border border-white/20">
                  <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/40">
                  <DefaultLogo />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black tracking-tight text-white">
                    {schoolName || 'CATATOH'}
                  </h2>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 uppercase tracking-widest">
                    v2.0 Plus
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium tracking-wide">
                  Catat Online Handling • Smart School OS
                </p>
              </div>
            </div>

            {/* Slider Navigation Arrows */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-xs">
              <button
                type="button"
                onClick={handlePrevSlide}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Slide sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono font-bold px-2 text-indigo-400">
                {activeSlide + 1} / {USE_CASE_SLIDES.length}
              </span>
              <button
                type="button"
                onClick={handleNextSlide}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Slide selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Slide Category Quick Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs">
            {USE_CASE_SLIDES.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActiveSlide(idx)}
                className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  idx === activeSlide
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-500'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{slide.badge}</span>
              </button>
            ))}
          </div>

          {/* Active Slide Card Showcase */}
          <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl relative overflow-hidden transition-all duration-300 backdrop-blur-md">
            
            {/* Top Badge & Metric */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
                  {currentSlide.icon}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-indigo-500/15 text-indigo-300 border-indigo-500/30 inline-block">
                    {currentSlide.badge}
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white mt-1 leading-snug">
                    {currentSlide.title}
                  </h3>
                </div>
              </div>

              <div className="px-4 py-2 rounded-2xl bg-slate-950/80 border border-slate-800 text-center flex flex-col items-center justify-center shrink-0">
                <span className="text-xl font-black text-emerald-400 block leading-tight">
                  {currentSlide.impactMetric}
                </span>
                <span className="text-[10px] font-bold text-slate-400 text-center mt-0.5">
                  {currentSlide.impactDesc}
                </span>
              </div>
            </div>

            {/* Real Use Case in Action */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 mb-4 text-xs">
              <span className="font-black text-indigo-400 uppercase tracking-wider block text-[10px] mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Praktek Nyata di Sekolah:
              </span>
              <p className="text-slate-200 leading-relaxed font-normal">
                {currentSlide.useCase}
              </p>
            </div>

            {/* Problem vs Solution Comparison Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              
              {/* Problem Column */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-rose-900/30 text-xs">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold mb-1.5">
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Sebelum Menggunakan CATATOH:</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {currentSlide.problem}
                </p>
              </div>

              {/* Solution Column */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-900/30 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Solusi CATATOH:</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {currentSlide.solution}
                </p>
              </div>

            </div>

            {/* Slide Progress Dots */}
            <div className="flex items-center justify-center gap-2 mt-5 pt-4 border-t border-slate-800">
              {USE_CASE_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveSlide(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === activeSlide ? 'w-8 bg-indigo-500' : 'w-2 bg-slate-800 hover:bg-slate-700'
                  }`}
                  aria-label={`Ke slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Bottom Security Assurance */}
          <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3">
            <span>&copy; {new Date().getFullYear()} {schoolName || 'CATATOH'} • Smart School Management System</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Terenkripsi & Multi-Tenant Terisolasi
            </span>
          </div>

        </div>
      </div>

      {/* Right Column: Authentication & Tier Selection Card */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 py-8 sm:p-8 bg-slate-900/95 order-1 lg:order-2 w-full relative">
        <div className="w-full max-w-lg mx-auto">
          
          {/* Mobile Header (Visible only on small devices) */}
          <div className="lg:hidden text-center mb-6">
            {schoolLogo ? (
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-lg overflow-hidden bg-white border border-slate-200 p-2">
                <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-16 h-16 mx-auto flex items-center justify-center mb-3 shadow-lg rounded-2xl overflow-hidden bg-white border border-slate-200">
                <DefaultLogo />
              </div>
            )}
            <h1 className="text-xl font-black text-white">{schoolName || 'CATATOH'}</h1>
            <p className="text-indigo-300 text-xs mt-0.5">Catat Online Handling • Smart School OS</p>
          </div>

          {/* Main Auth Card */}
          <div className="w-full rounded-3xl shadow-2xl border border-slate-800 bg-slate-950 overflow-hidden backdrop-blur-xl">
            
            {/* Header greeting */}
            <div className="p-6 pb-4 text-center border-b border-slate-800/80 bg-slate-900/40">
              <h2 className="text-xl font-black text-white tracking-tight">
                {mode === 'login' ? 'Masuk ke Dashboard' : mode === 'register' ? 'Pilih Paket & Buat Akun Sekolah' : 'Reset Kata Sandi'}
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                {mode === 'login' 
                  ? 'Kelola presensi biometrik, keuangan & WhatsApp gateway' 
                  : mode === 'register' 
                  ? 'Pilih tier Free atau Premium sesuai kebutuhan sekolah Anda' 
                  : 'Kirim tautan pemulihan kata sandi ke email Anda'}
              </p>
            </div>

            {/* Mode Tab Switch */}
            {mode !== 'forgot' && (
              <div className="grid grid-cols-2 p-1.5 bg-slate-900/70 border-b border-slate-800 text-xs font-bold gap-1">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                  className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === 'login' 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Masuk Akun</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); setMessage(''); }}
                  className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === 'register' 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Daftar Baru</span>
                </button>
              </div>
            )}

            {mode === 'forgot' && (
              <div className="px-6 pt-5">
                <button 
                  type="button" 
                  onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Halaman Login
                </button>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
              
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-medium flex items-start gap-2 animate-in fade-in duration-200">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {message && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs font-medium flex items-start gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{message}</span>
                </div>
              )}

              {/* TIER SELECTION ON REGISTER MODE */}
              {mode === 'register' && (
                <div className="space-y-3 pb-2 border-b border-slate-800 animate-in fade-in duration-300">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Pilih Paket Akun:
                  </label>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    
                    {/* Free Tier Card */}
                    <div 
                      onClick={() => setSelectedTier('free')}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                        selectedTier === 'free'
                          ? 'bg-slate-900 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 opacity-80'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-300">Paket Free</span>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selectedTier === 'free' ? 'border-indigo-400 bg-indigo-600' : 'border-slate-700'
                          }`}>
                            {selectedTier === 'free' && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                        </div>
                        <p className="text-base font-black text-white">Rp 0</p>
                        <p className="text-[10px] text-slate-400 mt-1">Maks. 100 Siswa</p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 space-y-0.5">
                        <p className="text-emerald-400">✓ Catat SPP & Kas</p>
                        <p className="text-emerald-400">✓ Reminder wa.me manual</p>
                        <p className="text-slate-500">✕ Tanpa Scan Wajah</p>
                        <p className="text-slate-500">✕ Tanpa WA Otomatis</p>
                      </div>
                    </div>

                    {/* Premium Tier Card */}
                    <div 
                      onClick={() => setSelectedTier('premium')}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                        selectedTier === 'premium'
                          ? 'bg-gradient-to-br from-amber-950/30 via-indigo-950/40 to-slate-900 border-amber-500 shadow-lg shadow-amber-500/15 ring-1 ring-amber-500/50'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 opacity-80'
                      }`}
                    >
                      <div className="absolute -top-2.5 right-2 px-2 py-0.2 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow-xs">
                        ⭐ Rekomendasi
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                            Premium
                          </span>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selectedTier === 'premium' ? 'border-amber-400 bg-amber-500' : 'border-slate-700'
                          }`}>
                            {selectedTier === 'premium' && <Check className="w-2.5 h-2.5 text-slate-950 font-black" />}
                          </div>
                        </div>
                        <p className="text-base font-black text-amber-300">
                          {billingCycle === 'monthly' ? 'Rp 30.000' : 'Rp 250.000'}
                          <span className="text-[10px] font-normal text-slate-400">/{billingCycle === 'monthly' ? 'bln' : 'thn'}</span>
                        </p>
                        <p className="text-[10px] text-emerald-400 font-bold mt-1">Siswa Tanpa Batas</p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-300 space-y-0.5">
                        <p className="text-amber-300 font-semibold">✓ Scan Wajah Siswa/Guru</p>
                        <p className="text-amber-300 font-semibold">✓ WA Gateway Otomatis</p>
                        <p className="text-amber-300 font-semibold">✓ AI Vision OCR Struk</p>
                        <p className="text-amber-300 font-semibold">✓ Moderasi Pembayaran</p>
                      </div>
                    </div>

                  </div>

                  {/* Billing Cycle Toggle for Premium */}
                  {selectedTier === 'premium' && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Periode Pembayaran:</span>
                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setBillingCycle('monthly')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                              billingCycle === 'monthly'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Bulanan (30rb)
                          </button>
                          <button
                            type="button"
                            onClick={() => setBillingCycle('yearly')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              billingCycle === 'yearly'
                                ? 'bg-amber-500 text-slate-950 shadow-xs'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <span>Tahunan (250rb)</span>
                            <span className="text-[9px] bg-rose-600 text-white px-1 rounded-full font-black">Hemat 110rb</span>
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-amber-400/90 leading-relaxed">
                        *Akun akan terdaftar sebagai akun Standar terlebih dahulu. Setelah mendaftar, silakan lakukan pembayaran dan hubungi Admin via WhatsApp untuk pengaktifan status Premium.
                      </p>
                    </div>
                  )}

                </div>
              )}

              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  {mode === 'forgot' ? 'Email Terdaftar' : 'Email Admin Sekolah'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nama@sekolahanda.com" 
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
                  />
                </div>
              </div>
              
              {/* Password Input */}
              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Kata Sandi
                    </label>
                    {mode === 'login' && (
                      <button 
                        type="button" 
                        onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                      >
                        Lupa Kata Sandi?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      required={mode !== 'forgot'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      title={showPassword ? "Sembunyikan password" : "Lihat password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
              
              {/* City Selection for Registration */}
              {mode === 'register' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Kota Domisili Sekolah
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <select
                      required
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                    >
                      <option value="" disabled className="bg-slate-900 text-slate-400">Pilih Kota/Kabupaten...</option>
                      {INDONESIAN_CITIES.map(c => (
                        <option key={c} value={c} className="bg-slate-900 text-white">{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                    mode === 'register' && selectedTier === 'premium'
                      ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-slate-950 font-black shadow-amber-500/20'
                      : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-indigo-600/30'
                  }`}
                >
                  {loading ? (
                    <span>Memproses...</span>
                  ) : mode === 'login' ? (
                    <>
                      <LogIn className="w-4 h-4" /> 
                      <span>Masuk ke Dashboard</span>
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </>
                  ) : mode === 'register' ? (
                    <>
                      {selectedTier === 'premium' ? <Crown className="w-4 h-4 text-slate-950" /> : <UserPlus className="w-4 h-4" />}
                      <span>{selectedTier === 'premium' ? `Daftar (Pilih Premium ⭐ ${billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'})` : 'Daftarkan Akun Standar (Free)'}</span>
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" /> 
                      <span>Kirim Tautan Reset</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          
          {/* Help & Support Card */}
          <div className="mt-5 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center animate-in fade-in duration-500">
            <p className="text-xs text-slate-400">
              Butuh konsultasi paket atau integrasi WhatsApp sekolah?
            </p>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs">
              <a 
                href="https://threads.net/@isantoh" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
              >
                <span>Threads</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-slate-700">•</span>
              <a 
                href="https://instagram.com/isantoh" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
              >
                <span>Instagram</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL KONFIRMASI PEMBAYARAN & INSTRUKSI WHATSAPP SETELAH DAFTAR PREMIUN */}
      {registeredPremiumPending && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[999] animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl shadow-amber-950/50 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-950 via-amber-950/40 to-slate-900 border-b border-amber-900/40 relative">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/30 shrink-0">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white">
                      Pendaftaran Berhasil!
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                      Menunggu Pembayaran
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Akun Anda saat ini terdaftar sebagai <strong className="text-white">Akun Standar (Free)</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs leading-relaxed flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Anda memilih paket <strong>PREMIUM ({registeredPremiumPending.billingCycle === 'yearly' ? 'Tahunan - Rp 250.000 / Tahun' : 'Bulanan - Rp 30.000 / Bulan'})</strong>. Untuk mengaktifkan fitur scan wajah, gateway WhatsApp, dan kapasitas siswa tanpa batas, silakan selesaikan pembayaran dan konfirmasi ke Admin via WhatsApp agar status akun diubah menjadi Premium.
                </span>
              </div>

              {/* Rekening Pembayaran */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  Rekening Resmi Pembayaran CATATOH:
                </label>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">BANK BCA</p>
                    <p className="font-mono font-bold text-white text-base tracking-wider">7805556218</p>
                    <p className="text-[11px] text-slate-400 font-medium">a.n Muhammad Ikhsan</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy('7805556218', 'BCA')}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 border border-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Salin No. Rekening"
                  >
                    {copiedBank === 'BCA' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tombol Hubungi Admin via WhatsApp */}
              <a
                href={`https://wa.me/6285347360359?text=${encodeURIComponent(`Halo Admin CATATOH, saya baru saja mendaftar akun sekolah di CATATOH:\n- Email Akun: ${registeredPremiumPending.email}\n- Kota: ${registeredPremiumPending.city || '-'}\n- Paket Dipilih: PREMIUM (${registeredPremiumPending.billingCycle === 'yearly' ? 'Tahunan - Rp 250.000' : 'Bulanan - Rp 30.000'})\n- Rekening Tujuan: BCA 7805556218 a.n Muhammad Ikhsan\n- Tanggal Pendaftaran: ${new Date().toLocaleDateString('id-ID')}\n\nSaya ingin konfirmasi pembayaran agar status akun saya dapat diubah menjadi PREMIUM oleh Admin. Terima kasih! 🙏`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white text-transparent" />
                <span>Hubungi Admin via WhatsApp (0853-4736-0359)</span>
              </a>

              {/* Tombol Lanjut ke Dashboard */}
              <button
                type="button"
                onClick={() => {
                  if (registeredPremiumPending.user && onLogin) {
                    onLogin(registeredPremiumPending.user);
                  } else {
                    setRegisteredPremiumPending(null);
                    setMode('login');
                    setMessage('Akun Anda telah terdaftar sebagai Akun Standar. Silakan masuk dengan email & kata sandi Anda.');
                  }
                }}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
              >
                <span>{registeredPremiumPending.user ? 'Lanjut Masuk Dashboard (Akun Standar)' : 'Tutup & Masuk Halaman Login'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
