import React, { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, KeyRound, ArrowLeft, MapPin, CheckCircle2, Wallet, Users, LayoutDashboard, ShieldCheck, Smartphone } from 'lucide-react';
import { INDONESIAN_CITIES } from '../data/cities';
import DefaultLogo from './DefaultLogo';
import { supabase } from '../lib/supabaseClient';


const APP_FEATURES = [
  { icon: <Wallet className="w-6 h-6" />, title: 'Manajemen Keuangan', desc: 'Pencatatan SPP, uang gedung, tabungan, dan pengeluaran harian.' },
  { icon: <Users className="w-6 h-6" />, title: 'Sistem Absensi Kiosk', desc: 'Presensi guru otomatis dengan pemindaian wajah (Face Recognition) dan proteksi lokasi GPS.' },
  { icon: <LayoutDashboard className="w-6 h-6" />, title: 'Laporan Otomatis', desc: 'Ringkasan laba rugi, rekap penunggakan, dan grafik keuangan real-time.' },
  { icon: <Smartphone className="w-6 h-6" />, title: 'Akses Multi-Platform', desc: 'Dapat diakses lancar dari PC, Laptop, maupun Browser HP.' },
  { icon: <ShieldCheck className="w-6 h-6" />, title: 'Keamanan Data', desc: 'Data tersimpan aman di cloud dengan proteksi enkripsi modern.' },
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
          setError(error.message || 'Login gagal.');
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
          setMessage('Pendaftaran berhasil! Otomatis masuk...');
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
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      {/* Left Column: Feature Highlights */}
      <div className="flex flex-col justify-center bg-indigo-900 text-white p-8 lg:p-16 w-full md:w-1/2 lg:w-7/12 relative overflow-hidden order-2 md:order-1">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-800 rounded-full opacity-50 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-indigo-500 rounded-full opacity-20 blur-3xl"></div>
        
        <div className="relative z-10 max-w-2xl">
          <div className="hidden md:flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <DefaultLogo />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">
                {schoolName || 'CATATOH'}
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-white/10 rounded-full text-indigo-200 uppercase tracking-wider">
                Catat Online Handling
              </span>
            </div>
          </div>
          
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-4 md:mb-6 mt-4 md:mt-0">
            Kelola Administrasi &<br/>Keuangan Lebih Cerdas.
          </h1>
          <p className="text-indigo-200 text-lg mb-10 max-w-xl leading-relaxed">
            CATATOH (Catat Online Handling) — Aplikasi pencatatan multifungsi sekolah all-in-one yang dirancang untuk mempercepat pencatatan, absensi wajah, pelacakan SPP & tabungan, serta laporan real-time.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {APP_FEATURES.map((feat, idx) => (
              <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex-shrink-0 text-indigo-300">
                  {feat.icon}
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">{feat.title}</h3>
                  <p className="text-sm text-indigo-200 leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Login Box */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 py-12 md:p-8 bg-slate-50 order-1 md:order-2 w-full">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Header (Only visible on mobile) */}
          <div className="md:hidden text-center mb-8">
             {schoolLogo ? (
                <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-sm overflow-hidden bg-white border border-slate-200">
                  <img src={schoolLogo} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 mx-auto flex items-center justify-center mb-4 shadow-sm rounded-2xl overflow-hidden bg-white border border-slate-200">
                  <DefaultLogo />
                </div>
              )}
             <h1 className="text-2xl font-black text-slate-800">{schoolName || 'CATATOH'}</h1>
             <p className="text-slate-500 text-sm mt-1">Catat Online Handling • Multifungsi Sekolah</p>
          </div>

          <div className="w-full rounded-2xl shadow-xl border border-slate-200 overflow-hidden bg-white">
            {/* Remove inner header on desktop since left side covers it */}
            <div className="hidden md:block bg-slate-50 p-6 text-center border-b border-slate-100">
              <h2 className="text-xl font-black text-slate-800">Selamat Datang</h2>
              <p className="text-slate-500 text-sm mt-1">Silakan masuk ke akun Anda</p>
            </div>


        {/* Tab switch */}
        {mode !== 'forgot' && (
          <div className="flex border-b border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
              className={`flex-1 py-3 text-xs font-bold transition-colors ${
                mode === 'login' ? 'text-indigo-600 bg-white border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Masuk ke Akun
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); setMessage(''); }}
              className={`flex-1 py-3 text-xs font-bold transition-colors ${
                mode === 'register' ? 'text-indigo-600 bg-white border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Daftar Akun Baru
            </button>
          </div>
        )}
        
        {mode === 'forgot' && (
          <div className="px-8 pt-6">
            <button 
              type="button"
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Login
            </button>
            <div className="mt-4">
              <h2 className="text-lg font-bold text-slate-800">Lupa Password?</h2>
              <p className="text-xs text-slate-500 mt-1">Masukkan email Anda untuk menerima tautan reset password.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-8 space-y-6 pt-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
              {message}
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {mode === 'forgot' ? 'Email Terdaftar' : 'Email Admin / User'}
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nama@sekolahanda.com" 
                className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm bg-white text-slate-800"
              />
            </div>
          </div>
          
          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Password</label>
                {mode === 'login' && (
                  <button 
                    type="button" 
                    onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Lupa Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="password" 
                  required={mode !== 'forgot'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm bg-white text-slate-800"
                />
              </div>
            </div>
          )}
          
          {mode === 'register' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Kota Domisili Sekolah
              </label>
              <div className="relative">
                <MapPin className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  required
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm bg-white text-slate-800 appearance-none"
                >
                  <option value="" disabled>Pilih Kota/Kabupaten...</option>
                  {INDONESIAN_CITIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-70"
          >
            {loading ? 'Memproses...' : mode === 'login' ? (
              <>
                <LogIn className="w-5 h-5" /> Masuk ke Dashboard
              </>
            ) : mode === 'register' ? (
              <>
                <UserPlus className="w-5 h-5" /> Buat Akun Baru
              </>
            ) : (
              <>
                <KeyRound className="w-5 h-5" /> Kirim Tautan Reset
              </>
            )}
          </button>
        </form>
      </div>
      
      <div className="mt-6 text-center animate-in fade-in duration-500">
        <p className="text-sm text-slate-500">
          Ada kendala saat login atau registrasi?
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Hubungi bantuan via{' '}
          <a href="https://threads.net/@isantoh" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold hover:underline">
            Threads
          </a>
          {' '}atau{' '}
          <a href="https://instagram.com/isantoh" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold hover:underline">
            Instagram
          </a>
        </p>
      </div>
      </div>
    </div>
    </div>
  );
}
