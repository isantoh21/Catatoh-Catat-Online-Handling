import React, { useState } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { INDONESIAN_CITIES } from '../data/cities';
import DefaultLogo from './DefaultLogo';
import { supabase } from '../lib/supabaseClient';

interface FeatureHighlight {
  icon: React.ReactNode;
  badge: string;
  badgeColor: string;
  title: string;
  desc: string;
}

const LATEST_FEATURES: FeatureHighlight[] = [
  { 
    icon: <Bot className="w-5 h-5 text-indigo-400" />, 
    badge: 'AI Vision OCR',
    badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    title: 'Google Gemini OCR AI', 
    desc: 'Ekstraksi otomatis nominal, tanggal, dan bank pengirim dari foto bukti transfer WhatsApp secara instan.' 
  },
  { 
    icon: <MessageCircle className="w-5 h-5 text-emerald-400" />, 
    badge: 'WhatsApp Gateway',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    title: 'Reminder SPP Otomatis', 
    desc: 'Kirim notifikasi tagihan massal langsung ke nomor orang tua siswa dengan proteksi jeda acak Anti-Ban.' 
  },
  { 
    icon: <Zap className="w-5 h-5 text-amber-400" />, 
    badge: 'Otomatisasi 1-Klik',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    title: 'Moderasi Pembayaran Real-Time', 
    desc: 'Verifikasi struk masuk dan kirim konfirmasi lunas otomatis ke WhatsApp orang tua dalam hitungan detik.' 
  },
  { 
    icon: <Receipt className="w-5 h-5 text-cyan-400" />, 
    badge: 'Portal Mandiri',
    badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    title: 'Kartu SPP Online Orang Tua', 
    desc: 'Tautan mandiri untuk wali murid melihat riwayat pembayaran & status tagihan tanpa perlu login dashboard.' 
  },
  { 
    icon: <Users className="w-5 h-5 text-purple-400" />, 
    badge: 'Face Recognition',
    badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    title: 'Presensi Kiosk Wajah & GPS', 
    desc: 'Sistem absensi guru cerdas berbasis pemindaian wajah kamera dan pembatasan radius lokasi GPS sekolah.' 
  },
  { 
    icon: <Wallet className="w-5 h-5 text-rose-400" />, 
    badge: 'Keuangan Lengkap',
    badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    title: 'Kas, Tabungan & Uang Gedung', 
    desc: 'Manajemen pos SPP, uang gedung, tabungan siswa, cetak kuitansi digital, serta laporan arus kas terintegrasi.' 
  },
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              city: city
            }
          }
        });

        if (error) {
          setError(error.message || 'Pendaftaran gagal.');
        } else if (data.session) {
          setMessage('Pendaftaran berhasil! Otomatis masuk ke dashboard...');
          setTimeout(() => {
            if (onLogin) onLogin(data.session.user);
          }, 800);
        } else {
          setMessage('Pendaftaran akun berhasil! Silakan coba login dengan email & password Anda.');
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Left Column: Feature Highlights & Showcase */}
      <div className="flex flex-col justify-between bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-8 lg:p-14 w-full md:w-1/2 lg:w-7/12 relative overflow-hidden order-2 md:order-1 border-t md:border-t-0 md:border-r border-indigo-900/40">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-0 right-0 -mt-24 -mr-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 max-w-2xl mx-auto md:mx-0">
          {/* Brand Header */}
          <div className="hidden md:flex items-center gap-3.5 mb-8">
            {schoolLogo ? (
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-950/50 p-1.5 border border-white/20">
                <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-950/50">
                <DefaultLogo />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-white">
                  {schoolName || 'CATATOH'}
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/30 rounded-full text-indigo-300 uppercase tracking-widest">
                  v2.0 Plus
                </span>
              </div>
              <p className="text-xs text-indigo-300/80 font-medium tracking-wide">
                Catat Online Handling • Smart School Operating System
              </p>
            </div>
          </div>

          {/* Badge & Headline */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-bold mb-4 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Fitur Terbaru: WhatsApp Gateway & OCR Gemini AI</span>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-4 tracking-tight text-white">
            Kelola SPP & Administrasi <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-teal-200 to-emerald-300">
              Lebih Cerdas & Otomatis.
            </span>
          </h1>

          <p className="text-indigo-200/80 text-sm md:text-base mb-8 max-w-xl leading-relaxed font-normal">
            Platform multifungsi all-in-one sekolah untuk otomatisasi pengingat SPP ke WhatsApp orang tua, verifikasi struk transfer dengan AI Vision, serta presensi wajah akurat.
          </p>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-8">
            {LATEST_FEATURES.map((feat, idx) => (
              <div 
                key={idx} 
                className="group p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300 backdrop-blur-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 group-hover:scale-105 transition-transform">
                      {feat.icon}
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${feat.badgeColor}`}>
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-sm mb-1 group-hover:text-indigo-200 transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-indigo-200/70 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Metrics / Guarantees Strip */}
          <div className="pt-6 border-t border-indigo-900/40 grid grid-cols-3 gap-4 text-center">
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-lg md:text-xl font-black text-emerald-400">100%</p>
              <p className="text-[11px] font-bold text-indigo-200/70">Otomatisasi SPP</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-lg md:text-xl font-black text-indigo-300">Gemini AI</p>
              <p className="text-[11px] font-bold text-indigo-200/70">OCR Struk Transfer</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-lg md:text-xl font-black text-amber-300">Anti-Ban</p>
              <p className="text-[11px] font-bold text-indigo-200/70">Jeda Acak WhatsApp</p>
            </div>
          </div>
        </div>

        {/* Left Footer */}
        <div className="relative z-10 pt-8 mt-6 border-t border-indigo-900/30 text-xs text-indigo-300/60 flex flex-wrap items-center justify-between gap-3">
          <span>&copy; {new Date().getFullYear()} {schoolName || 'CATATOH'} • Hak Cipta Dilindungi</span>
          <span className="flex items-center gap-1.5 text-emerald-400/90 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Multi-Tenant Database Terisolasi
          </span>
        </div>
      </div>

      {/* Right Column: Authentication Card */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 py-12 md:p-8 bg-slate-900/95 order-1 md:order-2 w-full relative">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Header (Visible only on mobile) */}
          <div className="md:hidden text-center mb-6">
            {schoolLogo ? (
              <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-lg overflow-hidden bg-white border border-slate-200 p-2">
                <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-20 h-20 mx-auto flex items-center justify-center mb-3 shadow-lg rounded-2xl overflow-hidden bg-white border border-slate-200">
                <DefaultLogo />
              </div>
            )}
            <h1 className="text-2xl font-black text-white">{schoolName || 'CATATOH'}</h1>
            <p className="text-indigo-300 text-xs mt-1">Catat Online Handling • Smart School OS</p>
          </div>

          {/* Main Card */}
          <div className="w-full rounded-3xl shadow-2xl border border-slate-800 bg-slate-950 overflow-hidden backdrop-blur-xl">
            {/* Header greeting */}
            <div className="p-6 pb-5 text-center border-b border-slate-800/80 bg-slate-900/40">
              <h2 className="text-xl font-black text-white tracking-tight">
                {mode === 'login' ? 'Selamat Datang Kembali' : mode === 'register' ? 'Buat Akun Sekolah' : 'Reset Password'}
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                {mode === 'login' 
                  ? 'Masuk untuk mengelola keuangan, absensi & gateway SPP' 
                  : mode === 'register' 
                  ? 'Mulai digitalisasi pencatatan sekolah Anda sekarang' 
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

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="p-6 md:p-7 space-y-4">
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
                  className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                      <UserPlus className="w-4 h-4" /> 
                      <span>Daftarkan Akun Sekolah</span>
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
          <div className="mt-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center animate-in fade-in duration-500">
            <p className="text-xs text-slate-400">
              Butuh bantuan integrasi WhatsApp atau kendala akun?
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
    </div>
  );
}
