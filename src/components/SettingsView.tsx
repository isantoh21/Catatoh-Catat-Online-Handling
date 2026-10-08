import { supabase } from '../lib/supabaseClient';
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Save, Building2, UploadCloud, CheckCircle2, Lock, KeyRound, MapPin, AlertCircle, UserCircle, UserCheck, Sparkles, Crop, Crown, FileSignature, Stamp, Trash2 } from 'lucide-react';
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
  const [principalName, setPrincipalName] = useState('');
  const [adminSignature, setAdminSignature] = useState('');
  const [schoolStamp, setSchoolStamp] = useState('');
  const [sigMessage, setSigMessage] = useState({ type: '', text: '' });
  const [city, setCity] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [cityChangeCount, setCityChangeCount] = useState(0);
  const [isSavingCity, setIsSavingCity] = useState(false);
  const [cityMessage, setCityMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigFileInputRef = useRef<HTMLInputElement>(null);
  const stampFileInputRef = useRef<HTMLInputElement>(null);

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
        setAdminName(session.user.user_metadata?.full_name || session.user.user_metadata?.admin_name || '');
        setPrincipalName(
          session.user.user_metadata?.principal_name ||
          localStorage.getItem('principalName_' + session.user.id) ||
          ''
        );
        setAdminSignature(
          session.user.user_metadata?.admin_signature ||
          localStorage.getItem('adminSignature_' + session.user.id) ||
          ''
        );
        setSchoolStamp(
          session.user.user_metadata?.school_stamp ||
          localStorage.getItem('schoolStamp_' + session.user.id) ||
          ''
        );
        supabase.from('user_settings').select('admin_signature, school_stamp').eq('user_id', session.user.id).maybeSingle().then(({ data }: any) => {
          if (data?.admin_signature) setAdminSignature(data.admin_signature);
          if (data?.school_stamp) setSchoolStamp(data.school_stamp);
        }, () => {});
      }
    });
  }, []);

  const saveImageSetting = async (userId: string, column: 'admin_signature' | 'school_stamp', value: string | null) => {
    try {
      await supabase.from('user_settings').update({ [column]: value } as any).eq('user_id', userId);
    } catch (_) {}
  };

  // Helper untuk optimasi gambar PNG (mempertahankan latar transparan & kualitas HD tanpa terpotong)
  const optimizePngImage = (dataUrl: string, maxDim = 1200): Promise<string> => {
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
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Ukuran file tanda tangan maksimal 10MB.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const optimized = await optimizePngImage(rawBase64);
        setAdminSignature(optimized);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            localStorage.setItem('adminSignature_' + session.user.id, optimized);
            await saveImageSetting(session.user.id, 'admin_signature', optimized);
          }
          setSigMessage({ type: 'success', text: 'Tanda tangan berhasil diunggah & tersimpan!' });
          setTimeout(() => setSigMessage({ type: '', text: '' }), 3000);
        } catch (err) {
          console.error('Error saving signature:', err);
        }
        if (sigFileInputRef.current) sigFileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Ukuran file stempel maksimal 10MB.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const optimized = await optimizePngImage(rawBase64);
        setSchoolStamp(optimized);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            localStorage.setItem('schoolStamp_' + session.user.id, optimized);
            await saveImageSetting(session.user.id, 'school_stamp', optimized);
          }
          setSigMessage({ type: 'success', text: 'Stempel sekolah berhasil diunggah & tersimpan!' });
          setTimeout(() => setSigMessage({ type: '', text: '' }), 3000);
        } catch (err) {
          console.error('Error saving stamp:', err);
        }
        if (stampFileInputRef.current) stampFileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveSignature = async () => {
    setAdminSignature('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        localStorage.removeItem('adminSignature_' + session.user.id);
        await saveImageSetting(session.user.id, 'admin_signature', null);
      }
      setSigMessage({ type: 'success', text: 'Tanda tangan berhasil dihapus!' });
      setTimeout(() => setSigMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      console.error('Error removing signature:', err);
    }
  };

  const handleRemoveStamp = async () => {
    setSchoolStamp('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        localStorage.removeItem('schoolStamp_' + session.user.id);
        await saveImageSetting(session.user.id, 'school_stamp', null);
      }
      setSigMessage({ type: 'success', text: 'Stempel sekolah berhasil dihapus!' });
      setTimeout(() => setSigMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      console.error('Error removing stamp:', err);
    }
  };

  // Helper untuk optimasi gambar dengan tetap mempertahankan rasio/proporsi asli penuh dan transparansi PNG
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
          // Bersihkan canvas agar background transparan (alpha = 0)
          ctx.clearRect(0, 0, w, h);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          
          // Jika format asal adalah PNG / SVG / WEBP, jangan ubah ke JPEG agar latar transparan tidak berubah hitam!
          const isJpeg = dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg');
          if (isJpeg) {
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            resolve(canvas.toDataURL('image/png'));
          }
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Helper untuk menghapus latar belakang hitam dari logo dan menjadikannya transparan murni
  const handleMakeLogoTransparent = async () => {
    if (!localLogo) return;
    try {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const w = canvas.width;
        const h = canvas.height;

        // Flood fill dari batas luar untuk mendeteksi warna latar hitam tanpa merusak teks/objek di tengah
        const visited = new Uint8Array(w * h);
        const queue: number[] = [];

        const isBlackColor = (idx: number) => {
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          // Toleransi warna hitam hingga abu gelap (misal kompresi jpeg)
          return r <= 45 && g <= 45 && b <= 45;
        };

        for (let x = 0; x < w; x++) {
          const topIdx = (0 * w + x) * 4;
          if (isBlackColor(topIdx) && !visited[0 * w + x]) {
            queue.push(0 * w + x);
            visited[0 * w + x] = 1;
          }
          const botIdx = ((h - 1) * w + x) * 4;
          if (isBlackColor(botIdx) && !visited[(h - 1) * w + x]) {
            queue.push((h - 1) * w + x);
            visited[(h - 1) * w + x] = 1;
          }
        }
        for (let y = 0; y < h; y++) {
          const leftIdx = (y * w + 0) * 4;
          if (isBlackColor(leftIdx) && !visited[y * w + 0]) {
            queue.push(y * w + 0);
            visited[y * w + 0] = 1;
          }
          const rightIdx = (y * w + (w - 1)) * 4;
          if (isBlackColor(rightIdx) && !visited[y * w + (w - 1)]) {
            queue.push(y * w + (w - 1));
            visited[y * w + (w - 1)] = 1;
          }
        }

        let head = 0;
        while (head < queue.length) {
          const pos = queue[head++];
          const px = pos % w;
          const py = Math.floor(pos / w);
          const idx = pos * 4;

          data[idx + 3] = 0; // Transparan penuh

          const neighbors = [
            px > 0 ? pos - 1 : -1,
            px < w - 1 ? pos + 1 : -1,
            py > 0 ? pos - w : -1,
            py < h - 1 ? pos + w : -1
          ];

          for (const n of neighbors) {
            if (n >= 0 && !visited[n] && isBlackColor(n * 4)) {
              visited[n] = 1;
              queue.push(n);
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const transparentPngUrl = canvas.toDataURL('image/png');
        await handleCroppedSave(transparentPngUrl);
        setPhotoMessage({ type: 'success', text: 'Latar belakang hitam berhasil dihapus menjadi transparan!' });
        setTimeout(() => setPhotoMessage({ type: '', text: '' }), 3000);
      };
      img.src = localLogo;
    } catch (err) {
      console.error('Gagal membuat background transparan:', err);
    }
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
        // Prioritaskan simpan sebagai PNG transparan penuh
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png') || rawBase64.startsWith('data:image/png');
        const fullOptimized = isPng ? await optimizePngImage(rawBase64) : await optimizeImage(rawBase64);
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
      localStorage.setItem('principalName_' + session.user.id, principalName);
      localStorage.setItem('adminSignature_' + session.user.id, adminSignature);
      localStorage.setItem('schoolStamp_' + session.user.id, schoolStamp);
      
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
            school_name: localName,
            principal_name: principalName
          }
        });
        await saveImageSetting(session.user.id, 'admin_signature', adminSignature || null);
        await saveImageSetting(session.user.id, 'school_stamp', schoolStamp || null);

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
                  <div className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-indigo-200 flex items-center justify-center overflow-hidden shrink-0 relative group p-1 shadow-xs bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[size:10px_10px] bg-[position:0_0,0_5px,5px_-5px,-5px_0]">
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
                        <>
                          <button 
                            type="button"
                            onClick={handleOpenAdjustCurrent}
                            className="px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="Atur ulang posisi, zoom, dan rotasi foto"
                          >
                            <Crop className="w-3.5 h-3.5" />
                            <span>Atur Posisi Foto</span>
                          </button>
                          <button 
                            type="button"
                            onClick={handleMakeLogoTransparent}
                            className="px-3 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="Hapus latar belakang hitam dan ubah menjadi transparan murni"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Hapus Background Hitam</span>
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">Format: JPG, PNG, WEBP. Transparansi file PNG dipertahankan penuh tanpa berubah menjadi hitam.</p>
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

              <hr className="border-slate-100" />

              {/* Nama Kepala Sekolah / Pimpinan Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-500" /> Nama Kepala Sekolah / Pimpinan Lembaga
                </h3>
                
                <div className="max-w-md">
                  <input 
                    type="text" 
                    value={principalName}
                    onChange={e => setPrincipalName(e.target.value)}
                    placeholder="Contoh: Drs. H. Ahmad Subarjo, M.Pd" 
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-medium text-slate-800 mb-2"
                  />
                  <p className="text-xs text-slate-500">Nama ini akan otomatis terisi pada lembar tanda tangan pengesahan saat mengekspor laporan resmi (PDF, Word, dan Excel).</p>
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

          {/* Tanda Tangan Admin & Stempel Sekolah Resmi */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <FileSignature className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-base font-bold text-slate-800">Tanda Tangan & Stempel Resmi</h3>
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Kwitansi & Laporan
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Otomatis dicetak pada berkas kwitansi pembayaran dan lembar pengesahan laporan resmi.
                  </p>
                </div>

                {sigMessage.text && (
                  <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-in fade-in duration-200 ${
                    sigMessage.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{sigMessage.text}</span>
                  </div>
                )}
              </div>

              {/* Dua Slot Upload: TTD & Stempel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Tanda Tangan Admin */}
                <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileSignature className="w-4 h-4 text-indigo-500" /> Tanda Tangan Admin
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      adminSignature ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200/70 text-slate-600'
                    }`}>
                      {adminSignature ? 'Terpasang ✓' : 'Belum Ada'}
                    </span>
                  </div>

                  {/* Preview Frame */}
                  <div className="h-32 w-full rounded-xl border-2 border-dashed border-slate-200 bg-white flex items-center justify-center p-2 relative overflow-hidden group shadow-xs">
                    {adminSignature ? (
                      <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:10px_10px]">
                        <img src={adminSignature} alt="Tanda Tangan Admin" className="max-h-28 max-w-full object-contain filter drop-shadow-xs" />
                      </div>
                    ) : (
                      <div className="text-center p-3">
                        <FileSignature className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-slate-400">Belum ada tanda tangan</p>
                        <p className="text-[11px] text-slate-400">Format PNG transparan resolusi tinggi (HD)</p>
                      </div>
                    )}
                  </div>

                  <input 
                    type="file" 
                    ref={sigFileInputRef} 
                    onChange={handleSignatureUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => sigFileInputRef.current?.click()}
                      className="flex-1 py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{adminSignature ? 'Ganti TTD' : 'Unggah TTD'}</span>
                    </button>
                    {adminSignature && (
                      <button
                        type="button"
                        onClick={handleRemoveSignature}
                        className="py-2 px-3 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                        title="Hapus tanda tangan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Stempel Sekolah */}
                <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Stamp className="w-4 h-4 text-indigo-500" /> Stempel Resmi Sekolah
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      schoolStamp ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200/70 text-slate-600'
                    }`}>
                      {schoolStamp ? 'Terpasang ✓' : 'Belum Ada'}
                    </span>
                  </div>

                  {/* Preview Frame */}
                  <div className="h-32 w-full rounded-xl border-2 border-dashed border-slate-200 bg-white flex items-center justify-center p-2 relative overflow-hidden group shadow-xs">
                    {schoolStamp ? (
                      <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:10px_10px]">
                        <img src={schoolStamp} alt="Stempel Sekolah" className="max-h-28 max-w-full object-contain filter drop-shadow-xs" />
                      </div>
                    ) : (
                      <div className="text-center p-3">
                        <Stamp className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-slate-400">Belum ada stempel sekolah</p>
                        <p className="text-[11px] text-slate-400">Format PNG transparan resolusi tinggi (HD)</p>
                      </div>
                    )}
                  </div>

                  <input 
                    type="file" 
                    ref={stampFileInputRef} 
                    onChange={handleStampUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => stampFileInputRef.current?.click()}
                      className="flex-1 py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{schoolStamp ? 'Ganti Stempel' : 'Unggah Stempel'}</span>
                    </button>
                    {schoolStamp && (
                      <button
                        type="button"
                        onClick={handleRemoveStamp}
                        className="py-2 px-3 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                        title="Hapus stempel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Pratinjau Pengesahan Resmi (Stempel Sedikit Menindih Tanda Tangan dari Sebelah Kiri) */}
              <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-indigo-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Live Pratinjau Pengesahan (Kwitansi & Laporan)
                  </span>
                  <span className="text-[11px] text-indigo-600 font-medium bg-white/80 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    Stempel menindih TTD dari sebelah kiri
                  </span>
                </div>

                <div className="max-w-md mx-auto bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
                  <p className="text-[11px] text-slate-500 font-medium">
                    {city || 'Nama Kota'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">Penerima,</p>

                  {/* Area Kombinasi Tanda Tangan + Stempel Menindih dari Kiri */}
                  <div className="relative h-24 my-2 flex items-center justify-center">
                    {/* Tanda Tangan (Berada di tengah) */}
                    {adminSignature ? (
                      <img 
                        src={adminSignature} 
                        alt="Tanda Tangan" 
                        className="max-h-20 max-w-[190px] object-contain relative z-10 select-none" 
                      />
                    ) : (
                      <div className="h-16 w-36 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400 font-medium">
                        [Tanda Tangan Admin]
                      </div>
                    )}

                    {/* Stempel Sekolah (Menindih Tanda Tangan dari Sebelah Kiri) */}
                    {schoolStamp && (
                      <img 
                        src={schoolStamp} 
                        alt="Stempel Sekolah" 
                        className={`max-h-20 max-w-[85px] object-contain absolute z-20 pointer-events-none select-none drop-shadow-sm transition-all ${
                          adminSignature 
                            ? 'left-1/2 -translate-x-[95%] top-1/2 -translate-y-1/2 rotate-[-4deg] opacity-95' 
                            : 'left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 opacity-95'
                        }`}
                      />
                    )}
                  </div>

                  <p className="text-xs font-bold text-slate-900">
                    (  {adminName || 'Nama Admin / Bendahara'}  )
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    Bagian Keuangan & Administrasi
                  </p>
                </div>

                <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                  💡 <b>Tips:</b> Gunakan file gambar berformat <b>PNG transparan</b> dengan resolusi HD agar stempel menyatu secara alami di atas tanda tangan tanpa latar kotak putih atau hitam.
                </p>
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
