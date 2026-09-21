import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { INDONESIAN_CITIES } from '../data/cities';
import { Building2, User, MapPin, CheckCircle2, ShieldAlert, LogOut, Loader2, Sparkles } from 'lucide-react';

interface MandatoryProfileModalProps {
  isOpen: boolean;
  user: any;
  initialAdminName?: string;
  initialSchoolName?: string;
  initialCity?: string;
  onSuccess: (updated: { adminName: string; schoolName: string; city: string }) => void;
  onLogout: () => void;
}

export default function MandatoryProfileModal({
  isOpen,
  user,
  initialAdminName = '',
  initialSchoolName = '',
  initialCity = '',
  onSuccess,
  onLogout
}: MandatoryProfileModalProps) {
  const [adminName, setAdminName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [city, setCity] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync initial values when opened or props update
  useEffect(() => {
    if (isOpen) {
      const existingAdmin = (
        initialAdminName && initialAdminName !== 'Belum Diatur' && initialAdminName !== 'Admin'
          ? initialAdminName
          : user?.user_metadata?.full_name || user?.user_metadata?.admin_name || ''
      );
      setAdminName(existingAdmin);

      const existingSchool = (
        initialSchoolName && initialSchoolName !== 'Aplikasi Pencatatan SPP Gratis' && initialSchoolName !== 'CATATOH'
          ? initialSchoolName
          : user?.user_metadata?.school_name || ''
      );
      setSchoolName(existingSchool);

      const existingCity = initialCity || user?.user_metadata?.city || '';
      setCity(existingCity);
      setErrorMessage('');
    }
  }, [isOpen, initialAdminName, initialSchoolName, initialCity, user]);

  if (!isOpen) return null;

  const filteredCities = INDONESIAN_CITIES.filter(c =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  );

  const isAdminValid = adminName.trim().length >= 2;
  const isSchoolValid = schoolName.trim().length >= 2 && schoolName.trim() !== 'Aplikasi Pencatatan SPP Gratis' && schoolName.trim() !== 'CATATOH';
  const isCityValid = city.trim().length > 0;
  const isAllValid = isAdminValid && isSchoolValid && isCityValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllValid || isSaving) return;

    setIsSaving(true);
    setErrorMessage('');

    try {
      const trimmedAdmin = adminName.trim();
      const trimmedSchool = schoolName.trim();
      const trimmedCity = city.trim();

      // 1. Update user metadata in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedAdmin,
          admin_name: trimmedAdmin,
          school_name: trimmedSchool,
          city: trimmedCity,
        }
      });

      if (authError) {
        throw authError;
      }

      // 2. Update user_settings table
      if (user?.id) {
        localStorage.setItem('schoolName_' + user.id, trimmedSchool);
        
        const { error: settingsError } = await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            school_name: trimmedSchool,
          }, { onConflict: 'user_id' });

        if (settingsError && settingsError.code !== '42P01') {
          console.warn('user_settings upsert note:', settingsError.message);
        }
      }

      // 3. Callback to parent App
      onSuccess({
        adminName: trimmedAdmin,
        schoolName: trimmedSchool,
        city: trimmedCity
      });
    } catch (err: any) {
      console.error('Error updating mandatory profile:', err);
      setErrorMessage(err.message || 'Gagal menyimpan profil. Periksa koneksi internet Anda.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[9999] overflow-y-auto"
      style={{ touchAction: 'pan-y' }}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden my-auto animate-in zoom-in-95 fade-in duration-300 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner */}
        <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-800 px-6 py-6 sm:px-8 sm:py-7 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-40 h-40 bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-400/20 border border-amber-300/40 rounded-full text-amber-200 text-xs font-bold w-fit mb-3">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
              <span>PERATURAN BARU PENGGUNAAN APLIKASI</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-snug">
              Wajib Melengkapi Profil Lembaga
            </h2>
            <p className="text-indigo-100 text-xs sm:text-sm mt-1.5 leading-relaxed">
              Demi keamanan, legalitas data laporan, serta penulisan kwitansi pembayaran SPP yang sah, Anda wajib mengisi data di bawah ini sebelum melanjutkan ke aplikasi.
            </p>
          </div>
        </div>

        {/* Completion Status Pill */}
        <div className="px-6 sm:px-8 pt-4 pb-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kelengkapan Data</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isAdminValid ? 'bg-emerald-500' : 'bg-slate-300'}`} title="Nama Admin" />
            <span className={`w-2.5 h-2.5 rounded-full ${isSchoolValid ? 'bg-emerald-500' : 'bg-slate-300'}`} title="Nama Sekolah" />
            <span className={`w-2.5 h-2.5 rounded-full ${isCityValid ? 'bg-emerald-500' : 'bg-slate-300'}`} title="Kota Domisili" />
            <span className="text-xs font-bold text-slate-700 ml-1.5">
              {[isAdminValid, isSchoolValid, isCityValid].filter(Boolean).length} / 3 Terisi
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Nama Admin */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>1. Nama Lengkap Admin / Petugas</span>
              </label>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">Wajib</span>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Contoh: Budi Santoso, S.Pd / Admin Keuangan"
                className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 shadow-xs text-slate-800 transition-colors ${
                  isAdminValid 
                    ? 'border-emerald-300 bg-emerald-50/20 focus:ring-emerald-500' 
                    : 'border-slate-200 bg-white focus:ring-indigo-500'
                }`}
              />
              {isAdminValid && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Nama ini akan tertera sebagai petugas penerima di kwitansi dan bukti pembayaran.
            </p>
          </div>

          {/* 2. Nama Sekolah */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. Nama Sekolah / Yayasan / Lembaga</span>
              </label>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">Wajib</span>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Contoh: SMA Negeri 1 Harapan / PKBM Cendekia"
                className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 shadow-xs text-slate-800 transition-colors ${
                  isSchoolValid 
                    ? 'border-emerald-300 bg-emerald-50/20 focus:ring-emerald-500' 
                    : 'border-slate-200 bg-white focus:ring-indigo-500'
                }`}
              />
              {isSchoolValid && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Nama resmi lembaga pendidikan untuk kop surat, judul kwitansi, dan laporan.
            </p>
          </div>

          {/* 3. Kota Domisili */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <span>3. Kota / Kabupaten Domisili</span>
              </label>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">Wajib</span>
            </div>
            <div className="relative">
              <select
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 shadow-xs text-slate-800 appearance-none bg-white transition-colors pr-10 ${
                  isCityValid 
                    ? 'border-emerald-300 bg-emerald-50/20 focus:ring-emerald-500 font-medium' 
                    : 'border-slate-200 focus:ring-indigo-500'
                }`}
              >
                <option value="" disabled>-- Pilih Kota / Kabupaten Domisili --</option>
                {INDONESIAN_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                {isCityValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <MapPin className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Digunakan pada titimangsa lokasi pada laporan dan kwitansi cetak.
            </p>
          </div>

          {/* Submission Action */}
          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={!isAllValid || isSaving}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan & Memvalidasi...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>Simpan Data & Buka Akses Aplikasi</span>
                </>
              )}
            </button>

            {!isAllValid && (
              <p className="text-center text-[11px] font-semibold text-amber-600">
                ⚠️ Anda harus melengkapi ketiga data di atas untuk dapat menggunakan aplikasi.
              </p>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Bukan akun Anda?</span>
              <button
                type="button"
                onClick={onLogout}
                className="text-rose-600 hover:text-rose-700 font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-rose-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar dari Akun</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
