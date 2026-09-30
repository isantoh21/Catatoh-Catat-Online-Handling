import React, { useState } from 'react';
import { 
  GraduationCap,
  ScanFace,
  MessageCircle,
  Wallet,
  Bot,
  Receipt,
  MapPin, 
  CheckCircle2, 
  Sparkles, 
  Crown,
  Check,
  CreditCard,
  Copy,
  ChevronRight,
  ArrowLeft,
  XCircle,
  X
} from 'lucide-react';
import { INDONESIAN_CITIES } from '../data/cities';
import { supabase } from '../lib/supabaseClient';

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
          setError(error.message || 'Login gagal. Periksa kembali email dan kata sandi Anda.');
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
              tier: 'free', // Semua pendaftaran baru selalu berstatus Akun Standar/Free terlebih dahulu
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
          // Pengguna memilih Premium: selalu arahkan untuk transfer BCA & hubungi Admin via WhatsApp
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
          setMessage('Instruksi reset kata sandi telah dikirim ke email Anda.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const FEATURES_LIST = [
    {
      icon: <ScanFace className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />,
      title: 'Presensi Biometrik Wajah AI',
      desc: 'Scan wajah siswa & guru tanpa sentuh dalam 1 detik anti-curang, terikat radius GPS sekolah, dan rekap bulanan otomatis siap cetak PDF.'
    },
    {
      icon: <MessageCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />,
      title: 'WhatsApp Gateway Otomatis & Anti-Ban',
      desc: 'Notifikasi kehadiran real-time ke nomor orang tua saat anak tiba/pulang, serta reminder tagihan SPP massal sekali klik dengan proteksi Anti-Banned.'
    },
    {
      icon: <Wallet className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />,
      title: 'Pencatatan SPP, Uang Gedung & Buku Kas',
      desc: 'Sentralisasi pembukuan SPP, infak, tabungan, dan kas masuk/keluar sekolah dengan filter kelas instan serta cetak kuitansi PDF resmi.'
    },
    {
      icon: <Bot className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />,
      title: 'AI Vision OCR (Gemini) Struk Transfer',
      desc: 'Foto struk transfer m-Banking dari wali murid langsung dibaca otomatis (nominal, tanggal & bank) tanpa perlu hitung dan cek manual.'
    },
    {
      icon: <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />,
      title: 'Moderasi Bukti Bayar via Chat WhatsApp',
      desc: 'Panel verifikasi khusus untuk mengecek bukti transfer yang dikirim orang tua melalui chat WhatsApp sebelum disetujui lunas.'
    },
    {
      icon: <Receipt className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />,
      title: 'Kartu SPP & Portal Mandiri Wali Murid',
      desc: 'Tautan mandiri transparan 24 jam bagi orang tua untuk memantau status SPP 1 tahun ajaran dan unduh kuitansi resmi tanpa perlu login.'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Kolom Kiri: Showcase & Daftar Lengkap Fitur Unggulan CATATOH */}
      <div 
        className="w-full lg:w-[52%] xl:w-[54%] p-6 sm:p-10 lg:p-14 flex flex-col justify-between relative order-2 lg:order-1 border-t lg:border-t-0 lg:border-r border-blue-100/80 overflow-y-auto"
        style={{
          backgroundColor: '#edf4fe',
          backgroundImage: `
            linear-gradient(to right, rgba(59, 130, 246, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(59, 130, 246, 0.08) 1px, transparent 1px),
            radial-gradient(circle at 82% 16%, rgba(253, 230, 138, 0.6) 0%, rgba(253, 230, 138, 0) 55%)
          `,
          backgroundSize: '28px 28px, 28px 28px, auto'
        }}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          {schoolLogo ? (
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm p-1 border border-slate-200">
              <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 relative">
              <GraduationCap className="w-5 h-5 text-white" />
              <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-1 right-1 border border-blue-600" />
            </div>
          )}
          <div>
            <span className="font-extrabold text-slate-900 text-base tracking-wider uppercase block">
              {schoolName || 'CATATOH'}
            </span>
            <span className="text-[10px] text-slate-500 font-medium tracking-tight">
              Catat Online Handling • Smart School OS
            </span>
          </div>
        </div>

        {/* Main Content Hero */}
        <div className="my-8 lg:my-8 max-w-xl">
          <h1 className="text-2xl sm:text-3xl lg:text-[38px] font-black text-slate-900 leading-[1.2] tracking-tight">
            Absensi, keuangan, dan WhatsApp sekolah dalam satu tempat.
          </h1>
          
          <p className="text-xs sm:text-sm text-slate-600 mt-3 leading-relaxed font-normal">
            Platform modern all-in-one untuk mendigitalkan seluruh operasional administrasi sekolah: absensi biometrik wajah, pembukuan kas & SPP, hingga notifikasi WhatsApp otomatis.
          </p>

          {/* Core Feature List (Semua Fitur Utama CATATOH) */}
          <div className="mt-6 space-y-3.5">
            {FEATURES_LIST.map((feat, idx) => (
              <div key={idx} className="flex items-start gap-3 p-2.5 rounded-xl bg-white/70 backdrop-blur-xs border border-blue-100 shadow-2xs hover:bg-white transition-all">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                  {feat.icon}
                </div>
                <div>
                  <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                    {feat.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 leading-snug font-normal">
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Brand Copyright */}
        <div className="text-xs font-medium text-slate-500 pt-4 border-t border-blue-200/50 flex flex-wrap items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} CATATOH</span>
          <span className="text-[11px] text-slate-400">PAUD/TK • SD • SMP • SMA/SMK • Pesantren • Bimbel</span>
        </div>
      </div>

      {/* Kolom Kanan: Card Form (Masuk, Daftar Baru & Perbandingan Paket Free vs Premium) */}
      <div 
        className="w-full lg:w-[48%] xl:w-[46%] p-4 sm:p-8 lg:p-10 flex items-center justify-center relative order-1 lg:order-2 overflow-y-auto"
        style={{
          backgroundColor: '#fbf9ef',
          backgroundImage: `radial-gradient(rgba(200, 185, 140, 0.45) 1.2px, transparent 1.2px)`,
          backgroundSize: '18px 18px'
        }}
      >
        <div className={`w-full ${mode === 'register' ? 'max-w-2xl' : 'max-w-md'} bg-[#fffdfa] rounded-3xl p-6 sm:p-8 shadow-xl shadow-amber-950/5 border border-amber-200/50 relative transition-all duration-300`}>
          
          {/* Form Header */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {mode === 'login' ? 'Masuk ke dashboard' : mode === 'register' ? 'Daftar akun baru' : 'Reset kata sandi'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 font-normal">
              {mode === 'login' 
                ? 'Gunakan akun admin sekolah Anda.' 
                : mode === 'register' 
                ? 'Pilih paket dan daftarkan sekolah Anda sekarang.' 
                : 'Masukkan email untuk menerima instruksi reset kata sandi.'}
            </p>
          </div>

          {/* Navigation Tabs (Masuk / Daftar Baru) */}
          {mode !== 'forgot' ? (
            <div className="flex border-b border-slate-200/90 mt-5 mb-5 text-sm">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className={`pb-2.5 font-bold transition-all mr-6 cursor-pointer ${
                  mode === 'login'
                    ? 'text-slate-900 border-b-2 border-blue-600 -mb-[1px]'
                    : 'text-slate-400 hover:text-slate-700 font-medium'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setMessage(''); }}
                className={`pb-2.5 font-bold transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'text-slate-900 border-b-2 border-blue-600 -mb-[1px]'
                    : 'text-slate-400 hover:text-slate-700 font-medium'
                }`}
              >
                Daftar baru
              </button>
            </div>
          ) : (
            <div className="mt-4 mb-5">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Halaman Masuk</span>
              </button>
            </div>
          )}

          {/* Error & Success Feedback */}
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-start gap-2">
              <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* TIER SELECTION ON REGISTER MODE DENGAN DETAIL KELEBIHAN & KEKURANGAN */}
            {mode === 'register' && (
              <div className="space-y-3 pb-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Pilih Paket Akun:
                  </label>
                  <span className="text-[11px] text-slate-500">Perbandingan fitur & batasan</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* PAKET STANDAR (FREE) */}
                  <div 
                    onClick={() => setSelectedTier('free')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                      selectedTier === 'free'
                        ? 'bg-blue-50/70 border-blue-600 shadow-sm ring-1 ring-blue-600/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-800">Paket Standar (Free)</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedTier === 'free' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                        }`}>
                          {selectedTier === 'free' && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                      </div>
                      <p className="text-lg font-black text-slate-900">Rp 0</p>
                      <p className="text-[11px] font-semibold text-slate-600 mt-0.5">Maksimal 100 Siswa</p>

                      {/* Kelebihan Free */}
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 space-y-1 text-[11px]">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Kelebihan:
                        </p>
                        <p className="text-slate-700 flex items-start gap-1">
                          <span className="text-emerald-600 font-bold shrink-0">•</span>
                          <span>Gratis selamanya tanpa biaya bulanan</span>
                        </p>
                        <p className="text-slate-700 flex items-start gap-1">
                          <span className="text-emerald-600 font-bold shrink-0">•</span>
                          <span>Pencatatan tagihan SPP & buku kas</span>
                        </p>
                        <p className="text-slate-700 flex items-start gap-1">
                          <span className="text-emerald-600 font-bold shrink-0">•</span>
                          <span>Cetak kuitansi nota PDF resmi</span>
                        </p>
                        <p className="text-slate-700 flex items-start gap-1">
                          <span className="text-emerald-600 font-bold shrink-0">•</span>
                          <span>Kirim tagihan via wa.me manual</span>
                        </p>
                        <p className="text-slate-700 flex items-start gap-1">
                          <span className="text-emerald-600 font-bold shrink-0">•</span>
                          <span>Portal cek status SPP mandiri siswa</span>
                        </p>
                      </div>

                      {/* Kekurangan Free */}
                      <div className="mt-2.5 pt-2 border-t border-slate-200/80 space-y-1 text-[11px]">
                        <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                          <X className="w-3 h-3 text-rose-600" />
                          Kekurangan / Batasan:
                        </p>
                        <p className="text-slate-500 flex items-start gap-1">
                          <span className="text-rose-500 font-bold shrink-0">✕</span>
                          <span>Dibatasi maksimal 100 data siswa</span>
                        </p>
                        <p className="text-slate-500 flex items-start gap-1">
                          <span className="text-rose-500 font-bold shrink-0">✕</span>
                          <span>Tanpa Presensi Biometrik Wajah AI</span>
                        </p>
                        <p className="text-slate-500 flex items-start gap-1">
                          <span className="text-rose-500 font-bold shrink-0">✕</span>
                          <span>Tanpa WhatsApp Gateway Otomatis</span>
                        </p>
                        <p className="text-slate-500 flex items-start gap-1">
                          <span className="text-rose-500 font-bold shrink-0">✕</span>
                          <span>Tanpa AI Vision OCR Struk Transfer</span>
                        </p>
                        <p className="text-slate-500 flex items-start gap-1">
                          <span className="text-rose-500 font-bold shrink-0">✕</span>
                          <span>Tanpa Moderasi Bukti Chat WhatsApp</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* PAKET PREMIUM */}
                  <div 
                    onClick={() => setSelectedTier('premium')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                      selectedTier === 'premium'
                        ? 'bg-amber-50/80 border-amber-500 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow-xs">
                      ⭐ Rekomendasi
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                          <Crown className="w-3.5 h-3.5 text-amber-600" />
                          Paket Premium
                        </span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedTier === 'premium' ? 'border-amber-600 bg-amber-500' : 'border-slate-300'
                        }`}>
                          {selectedTier === 'premium' && <Check className="w-2.5 h-2.5 text-slate-950 font-black" />}
                        </div>
                      </div>
                      <p className="text-lg font-black text-amber-950">
                        {billingCycle === 'monthly' ? 'Rp 30.000' : 'Rp 250.000'}
                        <span className="text-xs font-normal text-slate-600">/{billingCycle === 'monthly' ? 'bulan' : 'tahun'}</span>
                      </p>
                      <p className="text-[11px] font-bold text-emerald-700 mt-0.5">Unlimited Siswa Tanpa Batas</p>

                      {/* Kelebihan Premium */}
                      <div className="mt-2.5 pt-2.5 border-t border-amber-200/80 space-y-1 text-[11px]">
                        <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Kelebihan (Semua Fitur Aktif):
                        </p>
                        <p className="text-slate-800 flex items-start gap-1 font-medium">
                          <span className="text-emerald-600 font-bold shrink-0">✓</span>
                          <span>Data siswa & kelas tanpa batasan kuota</span>
                        </p>
                        <p className="text-slate-800 flex items-start gap-1 font-medium">
                          <span className="text-emerald-600 font-bold shrink-0">✓</span>
                          <span>Presensi Biometrik Wajah Siswa & Guru</span>
                        </p>
                        <p className="text-slate-800 flex items-start gap-1 font-medium">
                          <span className="text-emerald-600 font-bold shrink-0">✓</span>
                          <span>Notifikasi WA Otomatis kehadiran ke ortu</span>
                        </p>
                        <p className="text-slate-800 flex items-start gap-1 font-medium">
                          <span className="text-emerald-600 font-bold shrink-0">✓</span>
                          <span>Blast Notifikasi Tagihan SPP Massal Sekali Klik</span>
                        </p>
                        <p className="text-slate-800 flex items-start gap-1 font-medium">
                          <span className="text-emerald-600 font-bold shrink-0">✓</span>
                          <span>AI Vision OCR Baca Struk Transfer Otomatis</span>
                        </p>
                        <p className="text-slate-800 flex items-start gap-1 font-medium">
                          <span className="text-emerald-600 font-bold shrink-0">✓</span>
                          <span>Moderasi Bukti Bayar Chat WhatsApp</span>
                        </p>
                        <p className="text-slate-800 flex items-start gap-1 font-medium">
                          <span className="text-emerald-600 font-bold shrink-0">✓</span>
                          <span>Prioritas bantuan teknis langsung Tim CATATOH</span>
                        </p>
                      </div>

                      {/* Kekurangan Premium */}
                      <div className="mt-2.5 pt-2 border-t border-amber-200/80 space-y-1 text-[11px]">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <X className="w-3 h-3 text-amber-700" />
                          Kekurangan:
                        </p>
                        <p className="text-slate-600 flex items-start gap-1">
                          <span className="text-amber-600 font-bold shrink-0">•</span>
                          <span>Berlangganan berbayar (Rp 30rb/bln atau Rp 250rb/thn)</span>
                        </p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Billing Cycle Toggle for Premium */}
                {selectedTier === 'premium' && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 mt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-800 font-semibold text-xs">Pilih Durasi Paket Premium:</span>
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-amber-200">
                        <button
                          type="button"
                          onClick={() => setBillingCycle('monthly')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            billingCycle === 'monthly'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Bulanan (Rp 30.000)
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingCycle('yearly')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            billingCycle === 'yearly'
                              ? 'bg-amber-500 text-slate-950 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>Tahunan (Rp 250.000)</span>
                          <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-black">Hemat 110rb</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-950 leading-relaxed font-medium">
                      *Pendaftaran akun Premium akan terdaftar sebagai Akun Standar terlebih dahulu. Pengaktifan status Premium dilakukan setelah menyelesaikan transfer ke rekening resmi BCA <strong>7805556218</strong> a.n Muhammad Ikhsan dan konfirmasi ke WhatsApp Admin.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 block">
                Email
              </label>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nama@sekolah.sch.id" 
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all shadow-xs"
              />
            </div>

            {/* Password Field */}
            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800 block">
                    Kata sandi
                  </label>
                  {mode === 'login' && (
                    <button 
                      type="button" 
                      onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                    >
                      Lupa kata sandi?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    required={mode !== 'forgot'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full pl-3.5 pr-20 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer transition-colors"
                  >
                    {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                </div>
              </div>
            )}

            {/* City Selection on Register Mode */}
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Kota Domisili Sekolah
                </label>
                <div className="relative">
                  <select
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all cursor-pointer"
                  >
                    <option value="" disabled className="text-slate-400">Pilih Kota/Kabupaten...</option>
                    {INDONESIAN_CITIES.map(c => (
                      <option key={c} value={c} className="text-slate-900">{c}</option>
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
                className={`w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md ${
                  mode === 'register' && selectedTier === 'premium'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black shadow-amber-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-600/25'
                }`}
              >
                {loading ? (
                  <span>Memproses...</span>
                ) : mode === 'login' ? (
                  <span>Masuk</span>
                ) : mode === 'register' ? (
                  <span>{selectedTier === 'premium' ? `Daftar (Pilih Paket Premium ⭐ ${billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'})` : 'Daftar Akun Standar (Free)'}</span>
                ) : (
                  <span>Kirim Tautan Reset</span>
                )}
              </button>
            </div>
          </form>

          {/* Help & Support Footer */}
          <div className="mt-7 text-center text-xs text-slate-500 space-y-1 leading-relaxed">
            <p>Butuh bantuan paket atau integrasi WhatsApp?</p>
            <p>
              Hubungi kami lewat{' '}
              <a 
                href="https://threads.net/@isantoh" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="font-semibold text-slate-900 underline hover:text-blue-600 transition-colors"
              >
                Threads
              </a>{' '}
              atau{' '}
              <a 
                href="https://instagram.com/isantoh" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="font-semibold text-slate-900 underline hover:text-blue-600 transition-colors"
              >
                Instagram
              </a>
              {' '}atau{' '}
              <a 
                href="https://wa.me/6285347360359?text=Halo%20Admin%20CATATOH%2C%20saya%20butuh%20bantuan%20terkait%20akun%20sekolah" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="font-semibold text-emerald-600 underline hover:text-emerald-700 transition-colors"
              >
                WhatsApp (0853-4736-0359)
              </a>
              .
            </p>
          </div>

        </div>
      </div>

      {/* MODAL KONFIRMASI PEMBAYARAN & INSTRUKSI WHATSAPP SETELAH DAFTAR PREMIUN */}
      {registeredPremiumPending && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[999] animate-in fade-in duration-200">
          <div className="bg-white border border-amber-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-5 sm:p-6 bg-amber-50/80 border-b border-amber-100 flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20 shrink-0">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Pendaftaran Berhasil!
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    Menunggu Verifikasi
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Akun Anda saat ini terdaftar sebagai <strong className="text-slate-900">Akun Standar (Free)</strong>.
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Anda memilih paket <strong>PREMIUM ({registeredPremiumPending.billingCycle === 'yearly' ? 'Tahunan - Rp 250.000 / Tahun' : 'Bulanan - Rp 30.000 / Bulan'})</strong>. Untuk mengaktifkan fitur scan wajah, gateway WhatsApp, dan kapasitas siswa tanpa batas, silakan selesaikan pembayaran dan konfirmasi ke Admin via WhatsApp agar status akun diubah menjadi Premium.
                </span>
              </div>

              {/* Rekening Pembayaran */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  Rekening Resmi Pembayaran CATATOH:
                </label>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">BANK BCA</p>
                    <p className="font-mono font-bold text-slate-900 text-base tracking-wider">7805556218</p>
                    <p className="text-xs text-slate-600 font-medium">a.n Muhammad Ikhsan</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy('7805556218', 'BCA')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-600 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    title="Salin No. Rekening"
                  >
                    {copiedBank === 'BCA' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-600">Tersalin!</span>
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
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white text-transparent" />
                <span>Konfirmasi via WhatsApp (0853-4736-0359)</span>
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
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 border border-slate-200 transition-colors cursor-pointer"
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
