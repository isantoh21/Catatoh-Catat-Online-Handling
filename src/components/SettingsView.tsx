import { supabase } from '../lib/supabaseClient';
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Save, Building2, UploadCloud, CheckCircle2, Lock, KeyRound, MapPin, AlertCircle, UserCircle, Sparkles, Crop, Crown } from 'lucide-react';
import { INDONESIAN_CITIES } from '../data/cities';
import WhatsAppConnect from './WhatsAppConnect';
import ImageCropModal from './ImageCropModal';
import { usePremiumStatus, DEFAULT_PREMIUM_EMAILS } from '../lib/premiumService';
import RenewPremiumModal from './RenewPremiumModal';

export default function SettingsView({ 
  schoolName, 
  setSchoolName, 
  schoolLogo, 
  setSchoolLogo
}: { 
  schoolName: string; 
  setSchoolName: (v: string) => void;
  schoolLogo: string;
  setSchoolLogo: (v: string) => void;
}) {
  const { isPremium, details: subDetails } = usePremiumStatus();
  const [userEmail, setUserEmail] = useState('');
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [localName, setLocalName] = useState(schoolName);
  const [localLogo, setLocalLogo] = useState(schoolLogo);
  const [isSaved, setIsSaved] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [city, setCity] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [cityChangeCount, setCityChangeCount] = useState(0);
  const [isSavingCity, setIsSavingCity] = useState(false);
  const [cityMessage, setCityMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  const [showSetup, setShowSetup] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');
  const [photoMessage, setPhotoMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    setLocalName(schoolName);
    setLocalLogo(schoolLogo);
  }, [schoolName, schoolLogo]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
        setCity(session.user.user_metadata?.city || '');
        setCityChangeCount(session.user.user_metadata?.city_change_count || 0);
        setAdminName(session.user.user_metadata?.full_name || '');
      }
    });
  }, []);

  // Helper untuk optimasi gambar dengan tetap mempertahankan rasio/proporsi asli penuh (tanpa terpotong)
  const optimizeImage = (dataUrl: string, maxDim = 800, quality = 0.9): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Ukuran file foto maksimal adalah 10MB.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        // Simpan langsung gambar penuh dengan proporsi asli agar di kwitansi tampil FULL
        const fullOptimized = await optimizeImage(rawBase64);
        await handleCroppedSave(fullOptimized);

        setImageToCrop(rawBase64);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenAdjustCurrent = () => {
    if (localLogo) {
      setImageToCrop(localLogo);
      setIsCropModalOpen(true);
    }
  };

  const handleCroppedSave = async (croppedDataUrl: string) => {
    setLocalLogo(croppedDataUrl);
    setSchoolLogo(croppedDataUrl); // Instantly update admin panel header & sidebar
    
    // Automatically persist to localStorage and Supabase
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        localStorage.setItem('schoolLogo_' + session.user.id, croppedDataUrl);
        localStorage.setItem('cached_logo_' + session.user.id, croppedDataUrl);
        
        await supabase.from('user_settings').upsert({
          user_id: session.user.id,
          school_name: localName,
          school_logo: croppedDataUrl
        }, { onConflict: 'user_id' });
      }
      setPhotoMessage({ type: 'success', text: 'Foto logo berhasil diperbarui dan disimpan!' });
      setTimeout(() => setPhotoMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      console.error('Error auto-saving cropped photo:', err);
    }
  };

  const handleRemoveLogo = async () => {
    setLocalLogo('');
    setSchoolLogo('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        localStorage.removeItem('schoolLogo_' + session.user.id);
        localStorage.removeItem('cached_logo_' + session.user.id);
        
        await supabase.from('user_settings').upsert({
          user_id: session.user.id,
          school_name: localName,
          school_logo: ''
        }, { onConflict: 'user_id' });
      }
      setPhotoMessage({ type: 'success', text: 'Foto logo berhasil dihapus!' });
      setTimeout(() => setPhotoMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      console.error('Error removing logo:', err);
    }
  };

  const confirmSave = () => {
    setShowSaveConfirm(true);
  };

  const handleSave = async () => {
    setShowSaveConfirm(false);
    setIsSavingProfile(true);
    setSchoolName(localName);
    setSchoolLogo(localLogo);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      localStorage.setItem('schoolName_' + session.user.id, localName);
      localStorage.setItem('schoolLogo_' + session.user.id, localLogo);
      
      try {
        const { error } = await supabase.from('user_settings').upsert({
          user_id: session.user.id,
          school_name: localName,
          school_logo: localLogo
        }, { onConflict: 'user_id' });
        
        await supabase.auth.updateUser({
          data: { 
            full_name: adminName,
            admin_name: adminName,
            school_name: localName
          }
        });

        if (error && (error.code === '42P01' || error.message.includes('does not exist'))) {
          setShowSetup(true);
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    setIsSavingProfile(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleSaveCity = async () => {
    if (!city) return;
    if (cityChangeCount >= 3) {
      setCityMessage({ type: 'error', text: 'Anda telah mencapai batas maksimal perubahan kota (3 kali).' });
      return;
    }

    setIsSavingCity(true);
    setCityMessage({ type: '', text: '' });

    const newCount = cityChangeCount + 1;
    const { error } = await supabase.auth.updateUser({
      data: { 
        city: city,
        city_change_count: newCount
      }
    });

    setIsSavingCity(false);

    if (error) {
      setCityMessage({ type: 'error', text: 'Gagal mengubah kota: ' + error.message });
    } else {
      setCityChangeCount(newCount);
      setCityMessage({ type: 'success', text: 'Kota domisili berhasil diperbarui!' });
      setTimeout(() => setCityMessage({ type: '', text: '' }), 3000);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password minimal 6 karakter.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Konfirmasi password tidak cocok.' });
      return;
    }

    setIsChangingPassword(true);
    setPasswordMessage({ type: '', text: '' });

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    setIsChangingPassword(false);

    if (error) {
      setPasswordMessage({ type: 'error', text: 'Gagal mengganti password: ' + error.message });
    } else {
      setPasswordMessage({ type: 'success', text: 'Password berhasil diperbarui!' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMessage({ type: '', text: '' }), 3000);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 font-sans">
      <div className="p-6 md:px-10 md:py-8 border-b border-slate-200 bg-white">
        <h2 className="text-xl font-bold text-slate-800">Pengaturan Profil Sekolah</h2>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">Sesuaikan identitas sekolah Anda</p>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto space-y-6">
          {showSetup && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
              <h3 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> Cloud Storage Belum Tersedia
              </h3>
              <p className="text-sm text-blue-700 mb-4">
                Nama dan foto profil Anda saat ini hanya tersimpan di perangkat ini (Local Storage). Untuk menyimpannya secara permanen di Cloud (Supabase), jalankan SQL berikut di menu SQL Editor Supabase Anda:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto shadow-md">
                <pre className="text-emerald-400 text-sm font-mono whitespace-pre-wrap">
{`CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_name TEXT,
  school_logo TEXT
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);`}
                </pre>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={() => setShowSetup(false)} className="text-sm font-bold text-blue-600 hover:text-blue-800">Tutup</button>
              </div>
            </div>
          )}
          
          {/* Subscription & Renewal Status Card */}
          <div className={`p-6 rounded-3xl border shadow-sm transition-all mb-8 ${
            isPremium
              ? 'bg-gradient-to-r from-amber-500/10 via-indigo-500/5 to-slate-50 border-amber-400/40 text-slate-800'
              : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black shadow-md shrink-0 ${
                  isPremium 
                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-amber-500/30'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  <Crown className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      {isPremium 
                        ? (DEFAULT_PREMIUM_EMAILS.includes((userEmail || '').toLowerCase().trim())
                            ? 'Status Akun: VIP LIFETIME 👑'
                            : `Status Akun: PREMIUM ⭐ (${subDetails?.plan === 'yearly' ? 'Tahunan' : 'Bulanan'})`)
                        : 'Status Akun: FREE / REGULER'}
                    </h3>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      isPremium ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {isPremium 
                        ? (DEFAULT_PREMIUM_EMAILS.includes((userEmail || '').toLowerCase().trim())
                            ? 'Permanen (VIP)'
                            : (subDetails?.plan === 'yearly' ? 'Tahunan (Rp 250rb/thn)' : 'Bulanan (Rp 30rb/bln)')) 
                        : 'Maksimal 100 Siswa'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {isPremium ? (
                      subDetails?.expiresAt ? (
                        <>
                          Masa aktif berlaku hingga: <strong className="text-slate-800 font-bold">{new Date(subDetails.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong> 
                          {subDetails.daysRemaining !== null && (
                            <span className={`ml-1.5 font-bold ${subDetails.isExpiringSoon ? 'text-rose-600' : 'text-emerald-700'}`}>
                              ({subDetails.daysRemaining > 0 ? `Sisa ${subDetails.daysRemaining} hari` : 'Masa aktif berakhir'})
                            </span>
                          )}
                        </>
                      ) : DEFAULT_PREMIUM_EMAILS.includes((userEmail || '').toLowerCase().trim()) ? (
                        'Akun VIP Lifetime Aktif (Bebas Biaya Perpanjangan)'
                      ) : (
                        'Akun Premium Aktif'
                      )
                    ) : (
                      'Tingkatkan ke Premium untuk presensi wajah siswa & guru, broadcast reminder WhatsApp otomatis, dan kapasitas siswa tanpa batas.'
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRenewModalOpen(true)}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0 ${
                  isPremium
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                }`}
              >
                <Crown className="w-4 h-4" />
                <span>{isPremium ? 'Perpanjang Langganan (+1 Bln / +1 Thn)' : 'Upgrade ke Premium ⭐ (Mulai 30rb)'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Kolom Kiri: Identitas Sekolah, Domisili Kota & Keamanan */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 space-y-8">
              
              {/* Logo Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-500" /> Logo / Profile Picture
                </h3>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-indigo-200 flex items-center justify-center overflow-hidden shrink-0 relative group p-1 shadow-xs">
                    {localLogo ? (
                      <img src={localLogo} alt="School Logo" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-indigo-300 font-bold text-3xl">
                        {localName ? localName.charAt(0).toUpperCase() : 'C'}
                      </div>
                    )}
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <UploadCloud className="w-6 h-6 text-white" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold transition-colors shadow-sm cursor-pointer"
                      >
                        Pilih Gambar
                      </button>
                      {localLogo && (
                        <button 
                          type="button"
                          onClick={handleOpenAdjustCurrent}
                          className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                          title="Atur ulang posisi, zoom, dan rotasi foto"
                        >
                          <Crop className="w-4 h-4" />
                          <span>Atur Posisi Foto</span>
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">Format: JPG, PNG, WEBP. Foto tampil pas di panel admin dan tampil utuh/penuh di kwitansi.</p>
                    {photoMessage.text && (
                      <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
                        photoMessage.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{photoMessage.text}</span>
                      </div>
                    )}
                    {localLogo && (
                      <button 
                        type="button"
                        onClick={handleRemoveLogo}
                        className="text-xs text-rose-500 font-semibold hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        Hapus Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Nama Admin Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-indigo-500" /> Nama Anda (Admin / Bendahara)
                </h3>
                
                <div className="max-w-md">
                  <input 
                    type="text" 
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    placeholder="Contoh: Muhammad Ikhsan" 
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-medium text-slate-800 mb-2"
                  />
                  <p className="text-xs text-slate-500">Nama ini digunakan untuk sambutan selamat datang saat login dan dicetak sebagai "Penerima" pada file kwitansi.</p>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Nama Sekolah Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-500" /> Nama Sekolah
                </h3>
                
                <div className="max-w-md">
                  <input 
                    type="text" 
                    value={localName}
                    onChange={e => setLocalName(e.target.value)}
                    placeholder="Contoh: TK Harapan Bangsa, SD Maju Jaya" 
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Save & Preview Buttons */}
              <div className="pt-4 flex flex-wrap items-center gap-3">
                <button 
                  onClick={confirmSave}
                  disabled={isSavingProfile}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> {isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>


                
                {isSaved && (
                  <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 animate-in fade-in duration-300">
                    <CheckCircle2 className="w-4 h-4" /> Tersimpan!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Profil Lokasi */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 space-y-6">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-500" /> Kota Domisili Sekolah
              </h3>
              
              <div className="max-w-md space-y-4">
                {cityMessage.text && (
                  <div className={`p-3 rounded-lg text-xs font-bold ${
                    cityMessage.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  }`}>
                    {cityMessage.text}
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Pilih Kota / Kabupaten
                  </label>
                  <div className="relative">
                    <MapPin className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      disabled={cityChangeCount >= 3 || isSavingCity}
                      className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm bg-white text-slate-800 appearance-none disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="" disabled>Pilih Kota/Kabupaten...</option>
                      {INDONESIAN_CITIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="mt-2 flex items-start gap-2">
                    <AlertCircle className={`w-4 h-4 shrink-0 ${cityChangeCount >= 3 ? 'text-rose-500' : 'text-amber-500'}`} />
                    <p className={`text-xs ${cityChangeCount >= 3 ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                      {cityChangeCount >= 3 
                        ? 'Anda telah mencapai batas maksimal perubahan kota.' 
                        : `Perhatian: Kota domisili hanya dapat diubah maksimal 3 kali. (Sisa: ${3 - cityChangeCount} kali)`}
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    type="button"
                    onClick={handleSaveCity}
                    disabled={isSavingCity || cityChangeCount >= 3}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> 
                    {isSavingCity ? 'Menyimpan...' : 'Simpan Kota'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-500" /> Keamanan Akun
              </h3>
              
              <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
                {passwordMessage.text && (
                  <div className={`p-3 rounded-lg text-xs font-bold ${
                    passwordMessage.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  }`}>
                    {passwordMessage.text}
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Password Baru</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    required
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-medium text-slate-800"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Konfirmasi Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Masukkan ulang password baru"
                    required
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-medium text-slate-800"
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={isChangingPassword}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-70 text-white rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" /> 
                    {isChangingPassword ? 'Memproses...' : 'Ganti Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Integrasi & Koneksi WhatsApp Gateway */}
        <div className="space-y-6">
          {isPremium ? (
            <WhatsAppConnect currentUserId={currentUserId} />
          ) : (
            <div className="bg-gradient-to-br from-slate-900 via-zinc-900 to-slate-950 border border-amber-500/30 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>Fitur Khusus Akun Premium ⭐</span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400">Terkunci</span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                    <span>WhatsApp Gateway & Bot Otomatis</span>
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Koneksi gateway WhatsApp, pengiriman bukti bayar instan, bot pesan otomatis, dan reminder jatuh tempo tagihan SPP ke nomor wali murid merupakan fasilitas eksklusif untuk pengguna akun <b>Premium</b>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 text-xs text-slate-300">
                  <div className="font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Keunggulan WhatsApp Gateway Premium:
                  </div>
                  <ul className="space-y-1.5 list-disc list-inside text-slate-300">
                    <li>Koneksi Multi-Device QR Code tanpa biaya server tambahan</li>
                    <li>Kirim otomatis slip pembayaran berformat resmi ke nomor wali murid</li>
                    <li>Broadcast reminder SPP massal dengan tombol 1-klik</li>
                    <li>Inbound Webhook respons otomatis saat wali murid bertanya</li>
                  </ul>
                </div>

                <div className="pt-2">
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs text-center font-medium leading-relaxed">
                    Ingin mengaktifkan WhatsApp Gateway untuk sekolah Anda? Silakan hubungi <b>Superadmin</b> untuk meng-upgrade status akun Anda menjadi Premium.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>

      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                <Save className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Simpan Perubahan?</h3>
              <p className="text-sm text-slate-600 mb-6">
                Apakah Anda yakin ingin menyimpan perubahan pada profil sekolah dan nama Anda?
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                >
                  Ya, Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Photo Crop & Position Adjuster Modal */}
      <ImageCropModal 
        isOpen={isCropModalOpen}
        imageSrc={imageToCrop}
        onClose={() => setIsCropModalOpen(false)}
        onSave={handleCroppedSave}
        title="Atur & Pangkas Foto Profil / Logo"
      />

      {/* Subscription & Renewal Modal */}
      <RenewPremiumModal
        isOpen={isRenewModalOpen}
        onClose={() => setIsRenewModalOpen(false)}
        userEmail={userEmail}
        userId={currentUserId}
        currentPlan={subDetails?.plan}
        currentExpiresAt={subDetails?.expiresAt}
        onRenewSuccess={() => {
          setTimeout(() => window.location.reload(), 1500);
        }}
      />
    </div>
  );
}
