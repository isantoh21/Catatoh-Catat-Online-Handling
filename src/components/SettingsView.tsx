import { supabase } from '../lib/supabaseClient';
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Save, Building2, UploadCloud, CheckCircle2, Lock, KeyRound, MapPin, AlertCircle, UserCircle, Sparkles } from 'lucide-react';
import { INDONESIAN_CITIES } from '../data/cities';

export default function SettingsView({ 
  schoolName, 
  setSchoolName, 
  schoolLogo, 
  setSchoolLogo,
  onTestWelcome
}: { 
  schoolName: string; 
  setSchoolName: (v: string) => void;
  schoolLogo: string;
  setSchoolLogo: (v: string) => void;
  onTestWelcome?: () => void;
}) {
  const [localName, setLocalName] = useState(schoolName);
  const [localLogo, setLocalLogo] = useState(schoolLogo);
  const [isSaved, setIsSaved] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [city, setCity] = useState('');
  const [cityChangeCount, setCityChangeCount] = useState(0);
  const [isSavingCity, setIsSavingCity] = useState(false);
  const [cityMessage, setCityMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    setLocalName(schoolName);
    setLocalLogo(schoolLogo);
  }, [schoolName, schoolLogo]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCity(session.user.user_metadata?.city || '');
        setCityChangeCount(session.user.user_metadata?.city_change_count || 0);
        setAdminName(session.user.user_metadata?.full_name || '');
      }
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 102400) {
        alert('Maaf, ukuran logo maksimal adalah 100KB. Silakan pilih gambar yang lebih kecil.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
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

      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="max-w-2xl mx-auto space-y-6">
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
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 space-y-8">
              
              {/* Logo Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-500" /> Logo / Profile Picture
                </h3>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="w-24 h-24 rounded-2xl bg-indigo-50 border-2 border-dashed border-indigo-200 flex items-center justify-center overflow-hidden shrink-0 relative group">
                    {localLogo ? (
                      <img src={localLogo} alt="School Logo" className="w-full h-full object-cover" />
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
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold transition-colors shadow-sm"
                    >
                      Pilih Gambar
                    </button>
                    <p className="text-xs text-slate-500">Format: JPG, PNG, GIF. Maksimal 100KB.</p>
                    {localLogo && (
                      <button 
                        onClick={() => setLocalLogo('')}
                        className="text-xs text-rose-500 font-semibold hover:text-rose-600 transition-colors"
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

                {onTestWelcome && (
                  <button 
                    type="button"
                    onClick={onTestWelcome}
                    className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-sm font-bold transition-colors shadow-xs flex items-center gap-2"
                    title="Lihat contoh animasi sambutan login"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>Tes Animasi Sambutan</span>
                  </button>
                )}
                
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
    </div>
  );
}
