import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, Copy, Users, Settings, Database, Activity, Search, Edit2, Trash2, Power, AlertCircle, Save, CheckCircle2, RefreshCw, Mail, Link as LinkIcon, Clock, HelpCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function SuperAdminView() {
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'logs' | 'database'>('users');
  
  // Pagination & Filter States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchAdmin, setSearchAdmin] = useState('');
  const [searchSchool, setSearchSchool] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [searchStatus, setSearchStatus] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
  const [pendingAction, setPendingAction] = useState<{
    type: 'resend_confirmation' | 'send_magic_link' | 'start_edit' | 'save_edit';
    user: any;
  } | null>(null);
  const [showSqlFix, setShowSqlFix] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Settings state
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [globalMessage, setGlobalMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  
  
  // User Actions state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editCityName, setEditCityName] = useState('');
  const [editAdminName, setEditAdminName] = useState('');
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionCooldowns, setActionCooldowns] = useState<Record<string, number>>({});

  useEffect(() => {
    const hasCooldown = Object.values(actionCooldowns).some((v: number) => v > 0);
    if (!hasCooldown) return;

    const timer = setInterval(() => {
      setActionCooldowns(prev => {
        const next: Record<string, number> = {};
        let changed = false;
        for (const [key, val] of Object.entries(prev)) {
          const numVal = Number(val);
          if (numVal > 1) {
            next[key] = numVal - 1;
            changed = true;
          } else if (numVal === 1) {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [actionCooldowns]);

  // Confirm Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleResetCache = () => {
    if (window.confirm("Apakah Anda yakin ingin mereset cache sistem? Anda mungkin akan keluar (logout) secara otomatis dari sesi saat ini.")) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setAuthChecking(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email === 'isantoh21@gmail.com') {
      setIsAuthorized(true);
    } else if (session?.user) {
      setAuthError('Akun ini tidak memiliki akses Super Admin.');
    }
    setAuthChecking(false);
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
    }
  }, [activeTab, isAuthorized]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const { data, error } = await supabase.rpc('get_all_users');
        if (error) console.error('RPC Error:', error);
        if (data) setUsers(data);
      } else if (activeTab === 'logs') {
        const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
        if (data) setLogs(data);
      } else if (activeTab === 'settings') {
        const { data } = await supabase.from('global_settings').select('*').eq('id', 'default').single();
        if (data) {
          setMaintenanceMode(data.maintenance_mode);
          setAllowRegistration(data.allow_registration);
          setGlobalMessage(data.announcement || '');
        }
      }
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError('');
    setAuthSuccess('');
    
    if (loginEmail !== 'isantoh21@gmail.com') {
      setAuthError('Akses ditolak. Hanya email utama (isantoh21@gmail.com) yang diizinkan.');
      setIsLoggingIn(false);
      return;
    }

    if (isRegistering) {
      const { data, error } = await supabase.auth.signUp({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        setAuthError(error.message);
      } else {
        setAuthSuccess('Akun berhasil dibuat! Silakan klik tombol Login untuk masuk.');
        setIsRegistering(false);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        setAuthError(error.message);
      } else if (data.user?.email === 'isantoh21@gmail.com') {
        setIsAuthorized(true);
      } else {
        setAuthError('Akses ditolak.');
      }
    }
    setIsLoggingIn(false);
  };

  
  
  const handleSendMagicLink = async (email: string) => {
    if (!email) return;
    const currentWait = actionCooldowns[`magic_${email}`];
    if (currentWait && currentWait > 0) {
      alert(`Mohon tunggu ${currentWait} detik lagi sebelum mengirim link login kembali ke ${email}.`);
      return;
    }
    setIsProcessingAction(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setActionCooldowns(prev => ({ ...prev, [`magic_${email}`]: 60 }));
      alert(`Link login (Magic Link) telah berhasil dikirim ke ${email}`);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('security purposes') || msg.includes('rate limit') || err?.status === 429) {
        const match = msg.match(/(\d+)\s*seconds?/i);
        const waitSec = match ? parseInt(match[1], 10) : 60;
        setActionCooldowns(prev => ({ ...prev, [`magic_${email}`]: waitSec }));
        alert(`Keamanan Supabase: Mohon tunggu ${waitSec} detik sebelum meminta link login kembali ke email ini.`);
      } else {
        console.error('Error sending magic link:', err);
        alert(`Gagal mengirim link login: ${msg || 'Pastikan format email valid.'}`);
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleResendConfirmation = async (email: string) => {
    if (!email) return;
    const currentWait = actionCooldowns[`confirm_${email}`];
    if (currentWait && currentWait > 0) {
      alert(`Mohon tunggu ${currentWait} detik lagi sebelum mengirim ulang email konfirmasi ke ${email}.`);
      return;
    }
    setIsProcessingAction(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      setActionCooldowns(prev => ({ ...prev, [`confirm_${email}`]: 60 }));
      alert(`Email konfirmasi telah dikirim ulang ke ${email}`);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('security purposes') || msg.includes('rate limit') || err?.status === 429) {
        const match = msg.match(/(\d+)\s*seconds?/i);
        const waitSec = match ? parseInt(match[1], 10) : 60;
        setActionCooldowns(prev => ({ ...prev, [`confirm_${email}`]: waitSec }));
        alert(`Keamanan Supabase: Mohon tunggu ${waitSec} detik sebelum mengirim ulang konfirmasi ke email ini.`);
      } else {
        console.error('Error resending confirmation:', err);
        alert(`Gagal mengirim ulang konfirmasi: ${msg || 'Pastikan user belum terkonfirmasi.'}`);
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUserId(user.id);
    setEditSchoolName(user.school_name || '');
    setEditCityName(user.city_name || '');
    setEditAdminName(user.admin_name || '');
  };

  const handleSaveUserEdit = async (userId: string) => {
    setIsProcessingAction(true);
    try {
      const { error } = await supabase.rpc('update_user_profile_by_admin', { 
        target_user_id: userId, 
        new_school_name: editSchoolName,
        new_city_name: editCityName,
        new_admin_name: editAdminName
      });
      if (error) throw error;
      setEditingUserId(null);
      fetchData();
    } catch (err) {
      console.error('Error updating user:', err);
      alert('Gagal mengupdate pengguna. Pastikan Anda sudah menjalankan SQL RPC untuk update_user_profile_by_admin.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsProcessingAction(true);
    try {
      const { error } = await supabase.rpc('delete_user_by_admin', { 
        target_user_id: userToDelete.id 
      });
      if (error) throw error;
      setUserToDelete(null);
      fetchData();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Gagal menghapus pengguna. Pastikan Anda sudah menjalankan SQL RPC untuk delete_user_by_admin.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSaveSettings = () => {
    setShowConfirmModal(true);
  };

  const confirmSave = async () => {
    setShowConfirmModal(false);
    setSaveStatus('saving');
    try {
      const { error } = await supabase.from('global_settings').upsert({
        id: 'default',
        maintenance_mode: maintenanceMode,
        allow_registration: allowRegistration,
        announcement: globalMessage,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (error) throw error;
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };


  // Derived state for Users Pagination & Filtering
  const filteredUsers = users.filter(u => {
    const sEmail = searchEmail ? searchEmail.toLowerCase() : '';
    const sAdmin = searchAdmin ? searchAdmin.toLowerCase() : '';
    const sSchool = searchSchool ? searchSchool.toLowerCase() : '';
    const sCity = searchCity ? searchCity.toLowerCase() : '';

    const emailMatch = ((u?.email || u?.id) || '').toLowerCase().includes(sEmail);
    const adminMatch = ((u?.admin_name) || 'Belum Diatur').toLowerCase().includes(sAdmin);
    const schoolMatch = ((u?.school_name) || 'Belum Diatur').toLowerCase().includes(sSchool);
    const cityMatch = ((u?.city_name) || 'Belum Diatur').toLowerCase().includes(sCity);
    
    let statusMatch = true;
    if (searchStatus === 'confirmed') {
      statusMatch = !!u?.email_confirmed_at;
    } else if (searchStatus === 'unconfirmed') {
      statusMatch = !u?.email_confirmed_at;
    }

    return emailMatch && adminMatch && schoolMatch && cityMatch && statusMatch;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  if (authChecking) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
  }

  if (!isAuthorized) {
  
  return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-mono">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-rose-900/20 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-black border border-indigo-900/50 rounded-3xl p-8 shadow-2xl relative z-10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center border border-indigo-900/50 shadow-inner">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
            </div>
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-indigo-50 tracking-tight">{isRegistering ? 'Admin Initialization' : 'System Override'}</h1>
            <p className="text-sm text-indigo-500 mt-2">AUTHORIZED PERSONNEL ONLY</p>
          </div>

          {authError && (
            <div className="mb-6 p-4 bg-rose-950/50 border border-rose-900/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-200 font-sans">{authError}</p>
            </div>
          )}

          {authSuccess && (
            <div className="mb-6 p-4 bg-emerald-950/50 border border-emerald-900/50 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-200 font-sans">{authSuccess}</p>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Admin Identity</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-slate-900/50 border border-indigo-900/50 rounded-xl px-4 py-3 text-indigo-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
                placeholder="admin@system.local"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Security Key</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-indigo-900/50 rounded-xl px-4 py-3 text-indigo-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-indigo-900/50 hover:bg-indigo-800 text-indigo-300 font-bold py-3 px-4 rounded-xl transition-colors mt-4 flex justify-center items-center gap-2 border border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.15)]"
            >
              {isLoggingIn ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Power className="w-5 h-5" />}
              {isLoggingIn ? 'PROCESSING...' : (isRegistering ? 'REGISTER CORE ACCOUNT' : 'INITIALIZE ACCESS')}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3">
            {isRegistering ? (
              <button 
                type="button"
                onClick={() => { setIsRegistering(false); setAuthError(''); setAuthSuccess(''); }}
                className="w-full bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold py-3 px-4 rounded-xl transition-colors mt-2 flex justify-center items-center gap-2"
              >
                ← Kembali ke Login
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => { setIsRegistering(true); setAuthError(''); setAuthSuccess(''); }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors mt-2"
              >
                Belum punya akun Admin? Daftar
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="text-xs text-slate-500 hover:text-slate-400 font-medium transition-colors mt-2"
            >
              ← Return to Standard Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-mono text-slate-300">
      
      
      {/* Action Confirmation Modal for User Management */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] font-sans">
          <div className="bg-slate-900 border border-indigo-900/60 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2.5">
              {pendingAction.type === 'resend_confirmation' && <Mail className="w-6 h-6 text-amber-400" />}
              {pendingAction.type === 'send_magic_link' && <LinkIcon className="w-6 h-6 text-blue-400" />}
              {pendingAction.type === 'start_edit' && <Edit2 className="w-6 h-6 text-indigo-400" />}
              {pendingAction.type === 'save_edit' && <Save className="w-6 h-6 text-emerald-400" />}
              {pendingAction.type === 'resend_confirmation' && 'Kirim Ulang Email Konfirmasi'}
              {pendingAction.type === 'send_magic_link' && 'Kirim Magic Link Login'}
              {pendingAction.type === 'start_edit' && 'Edit Profil Pengguna'}
              {pendingAction.type === 'save_edit' && 'Konfirmasi Simpan Profil'}
            </h3>

            <p className="text-slate-400 mb-3 text-sm leading-relaxed">
              {pendingAction.type === 'resend_confirmation' && 'Apakah Anda yakin ingin mengirim ulang email verifikasi pendaftaran ke pengguna ini?'}
              {pendingAction.type === 'send_magic_link' && 'Apakah Anda yakin ingin membuat dan mengirimkan tautan login langsung (Magic Link) ke email pengguna ini?'}
              {pendingAction.type === 'start_edit' && 'Apakah Anda ingin mulai mengedit data profil untuk pengguna ini?'}
              {pendingAction.type === 'save_edit' && 'Apakah Anda yakin ingin menyimpan perubahan data profil pengguna ini ke database?'}
            </p>

            <div className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl mb-6 space-y-1.5">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Target Pengguna</p>
              <p className="text-indigo-300 font-mono text-sm font-semibold">{pendingAction.user.email || pendingAction.user.id}</p>
              {pendingAction.type === 'save_edit' && (
                <div className="pt-2 mt-2 border-t border-slate-800 text-xs space-y-1 text-slate-300">
                  <p><span className="text-slate-500">Nama Admin:</span> <span className="text-emerald-300 font-semibold">{editAdminName || 'Belum Diatur'}</span></p>
                  <p><span className="text-slate-500">Nama Sekolah:</span> <span className="text-indigo-200 font-semibold">{editSchoolName || 'Belum Diatur'}</span></p>
                  <p><span className="text-slate-500">Asal Kota:</span> <span className="text-slate-300 font-semibold">{editCityName || 'Belum Diatur'}</span></p>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setPendingAction(null)}
                disabled={isProcessingAction}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={async () => {
                  const targetUser = pendingAction.user;
                  const targetType = pendingAction.type;
                  setPendingAction(null);

                  if (targetType === 'resend_confirmation') {
                    await handleResendConfirmation(targetUser.email);
                  } else if (targetType === 'send_magic_link') {
                    await handleSendMagicLink(targetUser.email);
                  } else if (targetType === 'start_edit') {
                    handleEditUser(targetUser);
                  } else if (targetType === 'save_edit') {
                    await handleSaveUserEdit(targetUser.id);
                  }
                }}
                disabled={isProcessingAction}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-lg flex items-center gap-2 disabled:opacity-50 ${
                  pendingAction.type === 'resend_confirmation' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' :
                  pendingAction.type === 'send_magic_link' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' :
                  pendingAction.type === 'start_edit' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20' :
                  'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                {isProcessingAction ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                {pendingAction.type === 'resend_confirmation' && 'Ya, Kirim Email'}
                {pendingAction.type === 'send_magic_link' && 'Ya, Kirim Magic Link'}
                {pendingAction.type === 'start_edit' && 'Lanjutkan Edit'}
                {pendingAction.type === 'save_edit' && 'Ya, Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] font-sans">
          <div className="bg-slate-900 border border-rose-900/50 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-rose-500" />
              Hapus Pengguna Permanen
            </h3>
            <p className="text-slate-400 mb-2 text-sm">
              Apakah Anda yakin ingin menghapus akun ini secara permanen?
            </p>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg mb-6">
              <p className="text-slate-300 font-mono text-sm">{userToDelete.email || userToDelete.id}</p>
              <p className="text-slate-500 text-xs mt-1">Semua data (guru, siswa, absensi) milik akun ini akan ikut terhapus.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setUserToDelete(null)}
                disabled={isProcessingAction}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={confirmDeleteUser}
                disabled={isProcessingAction}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-rose-600/20 flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessingAction ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] font-sans">
          <div className="bg-slate-900 border border-indigo-900/50 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-amber-500" />
              Konfirmasi Perubahan
            </h3>
            <p className="text-slate-400 mb-6 text-sm">
              Apakah Anda yakin ingin menyimpan perubahan sistem global ini? Kesalahan pengaturan dapat berdampak pada seluruh pengguna aplikasi.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={confirmSave}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-600/20"
              >
                Ya, Simpan Pengaturan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin Header */}
      <div className="bg-black border-b border-indigo-900/50 text-indigo-400 px-6 py-4 flex items-center justify-between shadow-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-rose-500/20 p-2 rounded-lg">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-widest uppercase text-indigo-50">Super Admin Panel</h1>
            <p className="text-xs text-indigo-600 font-mono">Restricted Access // Level 9</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-indigo-950/30 hover:bg-rose-950/50 text-rose-500 rounded-lg text-xs font-bold transition-colors border border-rose-900/50 uppercase tracking-widest"
        >
          Logout & Exit
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-black border-b md:border-b-0 md:border-r border-indigo-900/30 flex flex-row md:flex-col font-sans overflow-x-auto shrink-0 z-20 custom-scrollbar">
          <nav className="flex flex-row md:flex-col p-3 md:p-4 gap-2 md:gap-0 md:space-y-1 min-w-max md:min-w-0">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm whitespace-nowrap font-medium transition-colors ${
                activeTab === 'users' ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.15)]' : 'text-slate-500 hover:bg-indigo-950/30 hover:text-indigo-400'
              }`}
            >
              <Users className="w-5 h-5" />
              Manajemen Pengguna
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm whitespace-nowrap font-medium transition-colors ${
                activeTab === 'settings' ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.15)]' : 'text-slate-500 hover:bg-indigo-950/30 hover:text-indigo-400'
              }`}
            >
              <Settings className="w-5 h-5" />
              Pengaturan Sistem
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm whitespace-nowrap font-medium transition-colors ${
                activeTab === 'logs' ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.15)]' : 'text-slate-500 hover:bg-indigo-950/30 hover:text-indigo-400'
              }`}
            >
              <Activity className="w-5 h-5" />
              Sistem Logs
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`flex-1 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm whitespace-nowrap font-medium transition-colors ${
                activeTab === 'database' ? 'bg-rose-900/50 text-rose-300 border border-rose-500/30 shadow-[0_0_15px_rgba(225,29,72,0.15)]' : 'text-slate-500 hover:bg-indigo-950/30 hover:text-indigo-400'
              }`}
            >
              <Database className="w-5 h-5" />
              Database Status
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950 relative font-sans">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none"></div>
          
          {/* Users Management */}
          {activeTab === 'users' && (
            <div className="space-y-6 relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-indigo-50">Manajemen Pengguna</h2>
                  <p className="text-sm text-slate-400">Kelola semua akun tenant/pengguna aplikasi.</p>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari user ID..."
                    className="pl-9 pr-4 py-2 bg-slate-900/50 border border-indigo-900/50 rounded-lg text-sm text-indigo-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full md:w-64 font-sans placeholder-slate-600"
                  />
                </div>
              </div>

              <div className="bg-slate-900/40 border border-indigo-900/30 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden">
                
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 border-b border-indigo-900/30">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <span className="text-sm text-slate-400">Tampilkan</span>
                  <select 
                    value={itemsPerPage} 
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="bg-slate-900 border border-indigo-900/50 rounded-lg px-3 py-1.5 text-sm text-indigo-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-slate-400">Data</span>
                </div>
                
                
              </div>
              <div className="overflow-x-auto w-full custom-scrollbar">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase bg-black/40 border-b border-indigo-900/50 text-indigo-300">
                      <tr>
                        <th className="px-4 py-4 w-12 whitespace-nowrap">No</th>
                        <th className="px-4 py-4 whitespace-nowrap min-w-[180px]">
                          <div className="mb-2">User ID / Profil</div>
                          <input type="text" placeholder="Cari Email..." value={searchEmail} onChange={(e) => {setSearchEmail(e.target.value); setCurrentPage(1);}} className="w-full bg-slate-900 border border-indigo-900/50 rounded px-2 py-1 text-xs normal-case" />
                        </th>
                        <th className="px-4 py-4 whitespace-nowrap min-w-[180px]">
                          <div className="mb-2">Nama Admin</div>
                          <input type="text" placeholder="Cari Nama..." value={searchAdmin} onChange={(e) => {setSearchAdmin(e.target.value); setCurrentPage(1);}} className="w-full bg-slate-900 border border-indigo-900/50 rounded px-2 py-1 text-xs normal-case" />
                        </th>
                        <th className="px-4 py-4 whitespace-nowrap min-w-[180px]">
                          <div className="mb-2">Nama Sekolah</div>
                          <input type="text" placeholder="Cari Sekolah..." value={searchSchool} onChange={(e) => {setSearchSchool(e.target.value); setCurrentPage(1);}} className="w-full bg-slate-900 border border-indigo-900/50 rounded px-2 py-1 text-xs normal-case" />
                        </th>
                        <th className="px-4 py-4 whitespace-nowrap min-w-[150px]">
                          <div className="mb-2">Asal Kota</div>
                          <input type="text" placeholder="Cari Kota..." value={searchCity} onChange={(e) => {setSearchCity(e.target.value); setCurrentPage(1);}} className="w-full bg-slate-900 border border-indigo-900/50 rounded px-2 py-1 text-xs normal-case" />
                        </th>
                        <th className="px-4 py-4 whitespace-nowrap min-w-[160px]">
                          <div className="mb-2">Status Email</div>
                          <select
                            value={searchStatus}
                            onChange={(e) => { setSearchStatus(e.target.value as any); setCurrentPage(1); }}
                            className="w-full bg-slate-900 border border-indigo-900/50 rounded px-2 py-1 text-xs normal-case text-slate-300 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="all">Semua Status</option>
                            <option value="confirmed">Terkonfirmasi</option>
                            <option value="unconfirmed">Belum Konfirmasi</option>
                          </select>
                        </th>
                        <th className="px-4 py-4 whitespace-nowrap">Tgl Daftar</th>
                        <th className="px-4 py-4 whitespace-nowrap">Terakhir Login</th>
                        <th className="px-4 py-4 text-right whitespace-nowrap min-w-[150px]">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={9} className="text-center py-8 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                      ) : users.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-8 text-slate-400">Tidak ada data pengguna.</td></tr>
                      ) : (
                        currentUsers.map((user, index) => {
                          const rowNumber = startIndex + index + 1;
                          return (
                          <tr key={index} className="border-b border-indigo-900/30 hover:bg-indigo-950/20">
                            <td className="px-4 py-4 text-slate-500 font-medium">
                              {rowNumber}
                            </td>
                            <td className="px-4 py-4 font-mono text-xs text-slate-400">
                              {user.email || user.id}
                            </td>
                            <td className="px-4 py-4 font-semibold text-emerald-100">
                              {editingUserId === user.id ? (
                                <input
                                  type="text"
                                  value={editAdminName}
                                  onChange={(e) => setEditAdminName(e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-indigo-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  placeholder="Nama Admin"
                                />
                              ) : (
                                user.admin_name || 'Belum Diatur'
                              )}
                            </td>
                            <td className="px-4 py-4 font-semibold text-indigo-50">
                              {editingUserId === user.id ? (
                                <input
                                  type="text"
                                  value={editSchoolName}
                                  onChange={(e) => setEditSchoolName(e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-indigo-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  placeholder="Nama Sekolah"
                                  autoFocus
                                />
                              ) : (
                                user.school_name || 'Belum Diatur'
                              )}
                            </td>
                            <td className="px-4 py-4 text-indigo-200">
                              {editingUserId === user.id ? (
                                <input
                                  type="text"
                                  value={editCityName}
                                  onChange={(e) => setEditCityName(e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-indigo-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  placeholder="Asal Kota"
                                />
                              ) : (
                                user.city_name || 'Belum Diatur'
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {user.email_confirmed_at ? (
                                <span 
                                  title={`Dikonfirmasi pada: ${new Date(user.email_confirmed_at).toLocaleString('id-ID')}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-xs font-semibold rounded-full shadow-sm"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  Terkonfirmasi
                                </span>
                              ) : user.email_confirmed_at === null ? (
                                <span 
                                  title="Pengguna belum klik link konfirmasi email"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 text-amber-400 border border-amber-800/60 text-xs font-semibold rounded-full shadow-sm"
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  Belum Konfirmasi
                                </span>
                              ) : (
                                <button
                                  onClick={() => setShowSqlFix(true)}
                                  title="Klik untuk melihat panduan SQL agar status email dapat terbaca dari Supabase"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-indigo-300 border border-slate-700 text-xs font-medium rounded-full transition-colors"
                                >
                                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                                  Update SQL
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-4 text-slate-400 whitespace-nowrap">
                              {new Date(user.created_at || Date.now()).toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-4 text-slate-400 whitespace-nowrap">
                              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="px-4 py-4 text-right">
                              {editingUserId === user.id ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => setEditingUserId(null)} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors text-xs">
                                    Batal
                                  </button>
                                  <button 
                                    onClick={() => setPendingAction({ type: 'save_edit', user })} 
                                    disabled={isProcessingAction} 
                                    className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 rounded-lg transition-colors flex items-center gap-1 font-semibold text-xs"
                                  >
                                    <Save className="w-4 h-4" /> Simpan
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  {(() => {
                                    const confirmWait = actionCooldowns[`confirm_${user.email}`] || 0;
                                    const magicWait = actionCooldowns[`magic_${user.email}`] || 0;
                                    return (
                                      <>
                                        <button 
                                          onClick={() => setPendingAction({ type: 'resend_confirmation', user })} 
                                          disabled={isProcessingAction || confirmWait > 0}
                                          title={confirmWait > 0 ? `Tunggu ${confirmWait}s` : "Kirim Ulang Email Konfirmasi"} 
                                          className={`p-1.5 rounded-lg transition-colors relative ${confirmWait > 0 ? 'text-slate-600 cursor-not-allowed opacity-60' : 'text-slate-500 hover:text-amber-400 hover:bg-amber-900/30'}`}
                                        >
                                          <Mail className="w-4 h-4" />
                                          {confirmWait > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-amber-950 border border-amber-700/60 text-amber-400 text-[9px] px-1 rounded-full font-mono font-bold leading-none">
                                              {confirmWait}s
                                            </span>
                                          )}
                                        </button>
                                        <button 
                                          onClick={() => setPendingAction({ type: 'send_magic_link', user })} 
                                          disabled={isProcessingAction || magicWait > 0}
                                          title={magicWait > 0 ? `Tunggu ${magicWait}s` : "Kirim Magic Link Login"} 
                                          className={`p-1.5 rounded-lg transition-colors relative ${magicWait > 0 ? 'text-slate-600 cursor-not-allowed opacity-60' : 'text-slate-500 hover:text-blue-400 hover:bg-blue-900/30'}`}
                                        >
                                          <LinkIcon className="w-4 h-4" />
                                          {magicWait > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-blue-950 border border-blue-700/60 text-blue-400 text-[9px] px-1 rounded-full font-mono font-bold leading-none">
                                              {magicWait}s
                                            </span>
                                          )}
                                        </button>
                                      </>
                                    );
                                  })()}
                                  <button onClick={() => setPendingAction({ type: 'start_edit', user })} title="Edit Profil" className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-lg transition-colors">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setUserToDelete(user)} title="Hapus Permanen" className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-900/30 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination Controls */}
                {filteredUsers.length > 0 && (
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-t border-indigo-900/30 bg-slate-900/20">
                    <div className="text-sm text-slate-400">
                      Menampilkan <span className="font-semibold text-indigo-300">{startIndex + 1}</span> hingga <span className="font-semibold text-indigo-300">{Math.min(startIndex + itemsPerPage, filteredUsers.length)}</span> dari <span className="font-semibold text-indigo-300">{filteredUsers.length}</span> data
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 bg-slate-800 border border-indigo-900/50 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-700 transition-colors"
                      >
                        Sebelumnya
                      </button>
                      <div className="px-3 py-1.5 bg-indigo-900/30 border border-indigo-500/30 rounded-lg text-sm text-indigo-300 font-bold">
                        {currentPage} / {totalPages}
                      </div>
                      <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 bg-slate-800 border border-indigo-900/50 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-700 transition-colors"
                      >
                        Selanjutnya
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Settings */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl space-y-6 relative z-10">
              <div>
                <h2 className="text-2xl font-bold text-indigo-50">Pengaturan Sistem Global</h2>
                <p className="text-sm text-slate-400">Konfigurasi utama aplikasi yang berlaku untuk semua pengguna.</p>
              </div>

              <div className="bg-slate-900/40 p-6 border border-indigo-900/30 backdrop-blur-sm rounded-2xl shadow-sm space-y-8">
                <div className="flex items-start justify-between pb-6 border-b border-indigo-900/30">
                  <div>
                    <h3 className="font-semibold text-indigo-50">Maintenance Mode (Mode Perbaikan)</h3>
                    <p className="text-sm text-slate-400 mt-1">Jika aktif, semua pengguna (kecuali Super Admin) tidak bisa mengakses aplikasi.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={maintenanceMode} onChange={() => setMaintenanceMode(!maintenanceMode)} />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                  </label>
                </div>

                <div className="flex items-start justify-between pb-6 border-b border-indigo-900/30">
                  <div>
                    <h3 className="font-semibold text-indigo-50">Izinkan Pendaftaran Baru</h3>
                    <p className="text-sm text-slate-400 mt-1">Buka atau tutup akses untuk pengguna baru yang ingin mendaftar ke aplikasi.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={allowRegistration} onChange={() => setAllowRegistration(!allowRegistration)} />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-indigo-50">Notifikasi Pengumuman Global</h3>
                  <textarea 
                    rows={3} 
                    value={globalMessage}
                    onChange={(e) => setGlobalMessage(e.target.value)}
                    placeholder="Ketik pengumuman yang akan muncul di dashboard semua pengguna..."
                    className="w-full p-3 bg-slate-900/50 border border-indigo-900/50 rounded-xl text-sm text-indigo-100 focus:ring-1 focus:ring-indigo-500 font-sans placeholder-slate-600"
                  ></textarea>
                </div>

                {saveStatus === 'error' && (
                  <div className="p-3 bg-rose-950/50 border border-rose-900/50 text-rose-300 rounded-lg text-sm">
                    Gagal menyimpan pengaturan. Pastikan tabel global_settings sudah dibuat di database.
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={handleSaveSettings}
                    disabled={saveStatus === 'saving'}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                  >
                    {saveStatus === 'saving' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                     saveStatus === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saveStatus === 'saving' ? 'Menyimpan...' : saveStatus === 'success' ? 'Tersimpan!' : 'Simpan Pengaturan'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* System Logs */}
          {activeTab === 'logs' && (
            <div className="space-y-6 relative z-10">
              <div>
                <h2 className="text-2xl font-bold text-indigo-50">Sistem Log (Aktivitas)</h2>
                <p className="text-sm text-slate-400">Pantau semua aktivitas yang terjadi di dalam aplikasi dari semua pengguna.</p>
              </div>

              <div className="bg-slate-900/40 border border-indigo-900/30 backdrop-blur-sm rounded-2xl shadow-sm p-4">
                {loading ? (
                   <div className="py-12 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-slate-400" /></div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">Tidak ada log aktivitas.</div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log, index) => (
                      <div key={index} className="flex gap-4 p-3 hover:bg-indigo-950/20 rounded-xl border border-indigo-900/30 transition-colors text-sm">
                        <div className="w-1 rounded-full bg-indigo-500/50 shrink-0 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-slate-300">{log.action}</span>
                            <span className="text-xs text-slate-400 whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <p className="text-slate-400">{log.description}</p>
                          <p className="text-xs text-slate-400 font-mono mt-1">User ID: {log.user_id}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Database Info */}
          {activeTab === 'database' && (
            <div className="max-w-3xl space-y-6 relative z-10">
              <div>
                <h2 className="text-2xl font-bold text-rose-400">Database & Sistem</h2>
                <p className="text-sm text-slate-400">Informasi teknis dan status layanan backend Supabase.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/40 p-6 border border-indigo-900/30 backdrop-blur-sm rounded-2xl shadow-sm flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-950/50 border border-emerald-900/50 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)] mb-2">
                    <Database className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-indigo-50">Status Koneksi</h3>
                  <p className="text-sm text-slate-400">Supabase API terhubung dan beroperasi normal.</p>
                </div>
                <div className="bg-slate-900/40 p-6 border border-indigo-900/30 backdrop-blur-sm rounded-2xl shadow-sm flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-950/50 border border-indigo-900/50 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)] mb-2">
                    <Power className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-indigo-50">Versi Aplikasi</h3>
                  <p className="text-sm text-slate-400">v1.2.0 (Stable Build)</p>
                </div>
              </div>

              <div className="bg-rose-950/20 border border-rose-900/30 p-6 rounded-2xl">
                <h3 className="font-bold text-rose-400 flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5" /> Danger Zone
                </h3>
                <p className="text-sm text-rose-600 mb-4">Tindakan di bawah ini bersifat destruktif dan tidak bisa dikembalikan.</p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <button className="w-full sm:w-auto px-4 py-2 bg-transparent border border-rose-900/50 hover:border-rose-500 hover:bg-rose-950/30 text-rose-600 rounded-lg text-sm font-bold transition-colors text-center">
                    Bersihkan Semua Log
                  </button>
                  <button onClick={handleResetCache} className="w-full sm:w-auto px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 transition-colors text-center">
                    Reset Cache Sistem
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SQL Fix Modal */}
      {showSqlFix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-indigo-900/50 flex justify-between items-center bg-indigo-950/30">
              <h3 className="font-bold text-indigo-200 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" /> Sinkronisasi Status Email & Profil Database
              </h3>
              <button onClick={() => setShowSqlFix(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              <p className="text-sm text-slate-300">
                Agar sistem dapat membaca <strong>Status Verifikasi Email</strong> (Terkonfirmasi / Belum Konfirmasi) serta profil pengguna secara lengkap langsung dari tabel autentikasi Supabase, jalankan kode SQL di bawah ini di menu <strong>SQL Editor</strong> pada Dashboard Supabase Anda:
              </p>
              <div className="relative group">
                <pre className="bg-black p-4 rounded-xl text-xs text-emerald-400 overflow-x-auto border border-slate-800 leading-relaxed font-mono">{`DROP FUNCTION IF EXISTS get_all_users();

CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  id UUID,
  email VARCHAR,
  created_at TIMESTAMPTZ,
  school_name TEXT,
  city_name TEXT,
  admin_name TEXT,
  last_sign_in_at TIMESTAMPTZ,
  email_confirmed_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id, 
    au.email::VARCHAR, 
    au.created_at, 
    COALESCE(us.school_name, 'Belum Diatur') as school_name,
    COALESCE(au.raw_user_meta_data->>'city', 'Belum Diatur') as city_name,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Belum Diatur') as admin_name,
    au.last_sign_in_at,
    COALESCE(au.email_confirmed_at, au.confirmed_at) as email_confirmed_at
  FROM auth.users au
  LEFT JOIN public.user_settings us ON au.id = us.user_id;
END;
$$ LANGUAGE plpgsql;`}
                </pre>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`DROP FUNCTION IF EXISTS get_all_users();

CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  id UUID,
  email VARCHAR,
  created_at TIMESTAMPTZ,
  school_name TEXT,
  city_name TEXT,
  admin_name TEXT,
  last_sign_in_at TIMESTAMPTZ,
  email_confirmed_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id, 
    au.email::VARCHAR, 
    au.created_at, 
    COALESCE(us.school_name, 'Belum Diatur') as school_name,
    COALESCE(au.raw_user_meta_data->>'city', 'Belum Diatur') as city_name,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Belum Diatur') as admin_name,
    au.last_sign_in_at,
    COALESCE(au.email_confirmed_at, au.confirmed_at) as email_confirmed_at
  FROM auth.users au
  LEFT JOIN public.user_settings us ON au.id = us.user_id;
END;
$$ LANGUAGE plpgsql;`);
                    alert('Kode SQL berhasil disalin ke clipboard!');
                  }}
                  className="absolute top-2 right-2 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-sans font-medium"
                  title="Salin Kode SQL"
                >
                  <Copy className="w-3.5 h-3.5" /> Salin
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Setelah kode di atas berhasil dijalankan di Supabase SQL Editor, klik tombol refresh/muat ulang tabel pengguna untuk melihat status email terkini.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}