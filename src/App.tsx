import SuperAdminView from './components/superadmin/SuperAdminView';
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import SetupGuide from './components/SetupGuide';
import StudentsView from './components/StudentsView';
import GroupsView from './components/GroupsView';
import DashboardView from './components/DashboardView';
import ReportsView from './components/ReportsView';
import ActivityLogsView from './components/ActivityLogsView';
import LoginView from './components/LoginView';
import HomeView from './components/public/HomeView';
import PricingView from './components/public/PricingView';
import DefaultLogo from './components/DefaultLogo';
import MandatoryProfileModal from './components/MandatoryProfileModal';
import { BookOpen, Users, LayoutDashboard, FileText, MessageCircle, Settings, LogOut, Database, Wifi, WifiOff, Receipt, FolderPlus, Menu, X, MapPin, CheckCircle2, History, KeyRound, Lock, Sparkles, Crown, Clock } from 'lucide-react';
import { INDONESIAN_CITIES } from './data/cities';
import SettingsView from './components/SettingsView';
import GuideView from './components/GuideView';
import ExpensesView from './components/ExpensesView';
import OtherIncomeView from './components/OtherIncomeView';
import TeachersView from './components/TeachersView';
import AttendancePortal from './components/AttendancePortal';
import StudentAttendancePortal from './components/students/StudentAttendancePortal';
import ParentSppCardView from './components/ParentSppCardView';
import WebhookStatusBar from './components/WebhookStatusBar';
import { usePremiumStatus, DEFAULT_PREMIUM_EMAILS } from './lib/premiumService';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [schoolName, setSchoolName] = useState('CATATOH');
  const [schoolLogo, setSchoolLogo] = useState('');

  
  const [userEmail, setUserEmail] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { isPremium, details: premiumDetails } = usePremiumStatus(userEmail, currentUser?.id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Mandatory profile completion states (admin name, school name, city)
  const [showMandatoryProfileModal, setShowMandatoryProfileModal] = useState(false);
  const [mandatoryAdminName, setMandatoryAdminName] = useState('');
  const [mandatorySchoolName, setMandatorySchoolName] = useState('');
  const [mandatoryCity, setMandatoryCity] = useState('');

  // Auth recovery & confirmation states
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState('');
  const [showEmailConfirmedModal, setShowEmailConfirmedModal] = useState(false);

  const fetchUserSettings = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('user_settings').select('school_name, school_logo, admin_name, city_name').eq('user_id', userId).maybeSingle();
      if (!error && data) {
        if (data.school_name) {
          setSchoolName(data.school_name);
          localStorage.setItem('schoolName_' + userId, data.school_name);
        }
        if (data.school_logo) {
          setSchoolLogo(data.school_logo);
          localStorage.setItem('schoolLogo_' + userId, data.school_logo);
        }
        return data;
      } else {
        const cached = localStorage.getItem('schoolName_' + userId) || '';
        setSchoolName(cached);
        setSchoolLogo(localStorage.getItem('schoolLogo_' + userId) || '');
        return { school_name: cached };
      }
    } catch (err) {
      const cached = localStorage.getItem('schoolName_' + userId) || '';
      setSchoolName(cached);
      setSchoolLogo(localStorage.getItem('schoolLogo_' + userId) || '');
      return { school_name: cached };
    }
  };

  const checkProfileRequirements = (user: any, loadedSettings?: any) => {
    if (!user) {
      setShowMandatoryProfileModal(false);
      return false;
    }

    const rawAdmin = (
      user.user_metadata?.full_name || 
      user.user_metadata?.admin_name || 
      (typeof loadedSettings === 'object' ? loadedSettings?.admin_name : '') ||
      (user.email ? user.email.split('@')[0] : '') ||
      'Admin'
    ).trim();
    const isAdminValid = rawAdmin.length >= 2 && rawAdmin !== 'Belum Diatur';

    const loadedSchool = typeof loadedSettings === 'string' ? loadedSettings : loadedSettings?.school_name;
    const sName = (loadedSchool || localStorage.getItem('schoolName_' + user.id) || user.user_metadata?.school_name || schoolName || '').trim();
    const isSchoolValid = sName.length >= 2 && sName !== 'Aplikasi Pencatatan SPP Gratis' && sName !== 'CATATOH';

    const rawCity = (
      user.user_metadata?.city || 
      (typeof loadedSettings === 'object' ? loadedSettings?.city_name : '') ||
      ''
    ).trim();
    const isCityValid = rawCity.length > 0;

    setMandatoryAdminName(rawAdmin);
    setMandatorySchoolName(sName && sName !== 'Aplikasi Pencatatan SPP Gratis' && sName !== 'CATATOH' ? sName : '');
    setMandatoryCity(rawCity);

    if (!isAdminValid || !isSchoolValid || !isCityValid) {
      setShowMandatoryProfileModal(true);
      return false;
    } else {
      setShowMandatoryProfileModal(false);
      return true;
    }
  };

  const checkDb = useCallback(async (retries = 2) => {
    if (!navigator.onLine) {
      setDbStatus('error');
      return;
    }
    
    const url = 'https://lzvrhtaewonmpsaiezai.supabase.co';
    if (!url || url.includes('placeholder')) {
      setDbStatus('error');
      return;
    }
    try {
      const { error } = await supabase.from('students').select('id', { count: 'exact', head: true });
      if (error && error.message && error.message.includes('Failed to fetch')) {
        if (retries > 0) {
          setTimeout(() => checkDb(retries - 1), 1500);
          return;
        }
        setDbStatus('error');
      } else {
        setDbStatus('connected');
      }
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => checkDb(retries - 1), 1500);
        return;
      }
      setDbStatus('error');
    }
  }, []);

  useEffect(() => {
    // Detect URL hash for password recovery or email verification
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setShowResetPasswordModal(true);
    } else if (hash.includes('type=signup') || hash.includes('type=email_verification')) {
      setShowEmailConfirmedModal(true);
    }

    // Check active session with safety timer so the app never hangs indefinitely
    const initTimer = setTimeout(() => {
      setIsInitializing(false);
    }, 1500);

    supabase.auth.getSession().then(async ({ data }) => {
      clearTimeout(initTimer);
      const session = data?.session;


      setIsLoggedIn(!!session);
      setUserEmail(session?.user?.email || '');
      setCurrentUser(session?.user || null);
      setIsInitializing(false);
      if (session?.user) {
        const loadedSchool = await fetchUserSettings(session.user.id).catch(() => '');
        checkProfileRequirements(session.user, loadedSchool);
        if (loadedSchool && typeof loadedSchool === 'object' && !(loadedSchool as any).admin_name) {
          const autoAdmin = (
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.admin_name ||
            (session.user.email ? session.user.email.split('@')[0] : 'Admin')
          );
          supabase.from('user_settings').update({ admin_name: autoAdmin }).eq('user_id', session.user.id).then(() => {});
        }
      }
    }).catch((err) => {
      console.warn('Session initialization fallback:', err);
      clearTimeout(initTimer);
      setIsInitializing(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {

      setIsLoggedIn(!!session);
      setUserEmail(session?.user?.email || '');
      setCurrentUser(session?.user || null);
      
      if (_event === 'PASSWORD_RECOVERY') {
        setShowResetPasswordModal(true);
      }

      if (session?.user) {
        fetchUserSettings(session.user.id).then((loadedSchool) => {
          checkProfileRequirements(session.user, loadedSchool);
          if (loadedSchool && typeof loadedSchool === 'object' && !(loadedSchool as any).admin_name) {
            const autoAdmin = (
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.admin_name ||
              (session.user.email ? session.user.email.split('@')[0] : 'Admin')
            );
            supabase.from('user_settings').update({ admin_name: autoAdmin }).eq('user_id', session.user.id).then(() => {});
          }
        });
      } else {
        setSchoolName('CATATOH');
        setSchoolLogo('');
        setShowMandatoryProfileModal(false);
      }
    });
    
    // Initial DB check with retry
    checkDb();
    
    const handleOnline = () => {
      setDbStatus('checking');
      setTimeout(() => {
        checkDb();
      }, 1000);
    };
    
    const handleOffline = () => {
      setDbStatus('error');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set up an interval to periodically check DB connection as a fallback
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        checkDb();
      }
    }, 30000); // Check every 30 seconds
    
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [checkDb]);

  const handleMandatoryProfileSuccess = async (updated: { adminName: string; schoolName: string; city: string }) => {
    setSchoolName(updated.schoolName);
    setMandatoryAdminName(updated.adminName);
    setMandatorySchoolName(updated.schoolName);
    setMandatoryCity(updated.city);
    setShowMandatoryProfileModal(false);

    // Refresh user session so that all child components receive latest auth user metadata
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setCurrentUser(session.user);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setResetPasswordError('Password minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetPasswordError('Konfirmasi password tidak cocok');
      return;
    }
    setIsResettingPassword(true);
    setResetPasswordError('');
    setResetPasswordSuccess('');

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsResettingPassword(false);
    if (error) {
      setResetPasswordError(error.message || 'Gagal memperbarui password.');
    } else {
      setResetPasswordSuccess('Password baru berhasil disimpan! Silakan login ulang.');
      setTimeout(async () => {
        await supabase.auth.signOut();
        setIsLoggedIn(false);
        setShowResetPasswordModal(false);
        setNewPassword('');
        setConfirmNewPassword('');
        setResetPasswordSuccess('');
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }, 1500);
    }
  };

  const handleLogin = async (user?: any) => {
    setIsLoggedIn(true);

    let activeUser = user;
    if (!activeUser) {
      const { data } = await supabase.auth.getSession();
      activeUser = data.session?.user;
    }

    if (activeUser) {
      setCurrentUser(activeUser);
      setUserEmail(activeUser.email || '');
      setDbStatus('connected');
      checkDb(1);
      fetchUserSettings(activeUser.id).then((loadedSchool) => {
        checkProfileRequirements(activeUser, loadedSchool);
      });
    }
    navigate('/');
  };

  const handleLogout = async () => {
    setShowMandatoryProfileModal(false);
    setCurrentUser(null);
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    navigate('/');
  };

  const renderAuthModals = () => (
    <>
      {/* Reset Password Modal */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-indigo-600 p-6 text-center text-white">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold">Buat Password Baru</h3>
              <p className="text-indigo-100 text-xs mt-1">Masukkan password baru untuk akun Anda</p>
            </div>

            <form onSubmit={handleUpdatePassword} className="p-6 space-y-4">
              {resetPasswordError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold">
                  {resetPasswordError}
                </div>
              )}
              {resetPasswordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold">
                  {resetPasswordSuccess}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Password Baru</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Konfirmasi Password Baru</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
                  }}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                >
                  {isResettingPassword ? 'Menyimpan...' : 'Simpan Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Confirmed Modal */}
      {showEmailConfirmedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden text-center p-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Email Berhasil Dikonfirmasi!</h3>
            <p className="text-xs text-slate-600 mt-2 mb-6 leading-relaxed">
              Terima kasih telah mengonfirmasi email Anda. Akun Anda kini telah aktif dan siap digunakan.
            </p>
            <button
              onClick={() => {
                setShowEmailConfirmedModal(false);
                if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              Mengerti / Lanjutkan
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (isInitializing) {
    return (
      <div className="flex flex-col h-screen w-screen bg-slate-50 font-sans">
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  // Standalone Student Kiosk Portal (Attendance & Face Registration)
  const isStudentAbsenRoute = location.pathname.startsWith('/absen-siswa') || location.pathname.startsWith('/daftar-wajah-siswa');
  if (isStudentAbsenRoute) {
    return (
      <Routes>
        <Route path="/absen-siswa/:userId" element={<StudentAttendancePortal initialMode="attendance" />} />
        <Route path="/absen-siswa" element={<StudentAttendancePortal initialMode="attendance" />} />
        <Route path="/daftar-wajah-siswa/:userId" element={<StudentAttendancePortal initialMode="register" />} />
        <Route path="/daftar-wajah-siswa" element={<StudentAttendancePortal initialMode="register" />} />
      </Routes>
    );
  }

  // Standalone Teacher Kiosk Portal
  const isTeacherAbsenRoute = location.pathname.startsWith('/absen') || location.pathname.startsWith('/absen-guru');
  if (isTeacherAbsenRoute) {
    return (
      <Routes>
        <Route path="/absen/:userId" element={<AttendancePortal />} />
        <Route path="/absen" element={<AttendancePortal />} />
        <Route path="/absen-guru/:userId" element={<AttendancePortal />} />
        <Route path="/absen-guru" element={<AttendancePortal />} />
      </Routes>
    );
  }

  // Standalone Parent SPP Card Portal
  const isParentSppRoute = location.pathname.startsWith('/kartu-spp-ortu');
  if (isParentSppRoute) {
    return (
      <Routes>
        <Route path="/kartu-spp-ortu/:userId" element={<ParentSppCardView />} />
        <Route path="/kartu-spp-ortu" element={<ParentSppCardView />} />
        <Route path="*" element={<ParentSppCardView />} />
      </Routes>
    );
  }

  const normalizedPath = location.pathname.toLowerCase().replace(/\/+$/, '');
  if (normalizedPath === '/superadmin-secret' || normalizedPath === '/superadmin') {
    return <SuperAdminView />;
  }

  if (!isLoggedIn) {
    if (showResetPasswordModal) {
      return (
        <Routes>
          <Route path="*" element={
            <>
              <LoginView onLogin={handleLogin} schoolName={schoolName} schoolLogo={schoolLogo} />
              {renderAuthModals()}
            </>
          } />
        </Routes>
      );
    }

    return (
      <Routes>
        <Route path="/" element={<HomeView schoolName={schoolName} schoolLogo={schoolLogo} />} />
        <Route path="/home" element={<HomeView schoolName={schoolName} schoolLogo={schoolLogo} />} />
        <Route path="/beranda" element={<HomeView schoolName={schoolName} schoolLogo={schoolLogo} />} />
        <Route path="/pricing" element={<PricingView schoolName={schoolName} schoolLogo={schoolLogo} />} />
        <Route path="/harga" element={<PricingView schoolName={schoolName} schoolLogo={schoolLogo} />} />
        <Route path="/login" element={
          <>
            <LoginView onLogin={handleLogin} schoolName={schoolName} schoolLogo={schoolLogo} />
            {renderAuthModals()}
          </>
        } />
        <Route path="/masuk" element={
          <>
            <LoginView onLogin={handleLogin} schoolName={schoolName} schoolLogo={schoolLogo} />
            {renderAuthModals()}
          </>
        } />
        <Route path="/register" element={
          <>
            <LoginView onLogin={handleLogin} schoolName={schoolName} schoolLogo={schoolLogo} />
            {renderAuthModals()}
          </>
        } />
        <Route path="/daftar" element={
          <>
            <LoginView onLogin={handleLogin} schoolName={schoolName} schoolLogo={schoolLogo} />
            {renderAuthModals()}
          </>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }


  return (
    <div 
      className="flex flex-col md:flex-row h-screen w-screen font-sans overflow-hidden text-slate-800"
      style={{
        backgroundColor: '#edf4fe',
        backgroundImage: `
          linear-gradient(to right, rgba(59, 130, 246, 0.08) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(59, 130, 246, 0.08) 1px, transparent 1px),
          radial-gradient(circle at 82% 16%, rgba(253, 230, 138, 0.55) 0%, rgba(253, 230, 138, 0) 55%),
          radial-gradient(circle at 18% 45%, rgba(191, 219, 254, 0.45) 0%, rgba(191, 219, 254, 0) 50%)
        `,
        backgroundSize: '28px 28px, 28px 28px, auto, auto'
      }}
    >

      {renderAuthModals()}

      {/* Mandatory Profile Completion Modal (Rule: Admin Name, School Name, City) */}
      <MandatoryProfileModal
        isOpen={showMandatoryProfileModal && isLoggedIn}
        user={currentUser}
        initialAdminName={mandatoryAdminName}
        initialSchoolName={mandatorySchoolName}
        initialCity={mandatoryCity}
        onSuccess={handleMandatoryProfileSuccess}
        onLogout={handleLogout}
      />
      {/* Sidebar (Desktop) / Slide-out (Mobile) */}
      {(isSidebarOpen || isMobileMenuOpen) && (
        <>
          {/* Overlay for mobile */}
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/50 z-40 md:hidden" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}
          
          <aside className={`w-72 bg-indigo-900 text-indigo-100 flex flex-col shrink-0 transition-all z-50 ${isMobileMenuOpen ? 'fixed inset-y-0 left-0' : 'hidden md:flex'}`}>
            <div className="p-6 flex items-center justify-between border-b border-indigo-800">
              <div className="flex items-center gap-3">
                {schoolLogo ? (
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white">
                    <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white">
                    <DefaultLogo />
                  </div>
                )}
                <div className="overflow-hidden">
                  <h1 className="font-bold text-sm leading-tight text-white truncate" title={schoolName}>{schoolName}</h1>
                  <p className="text-[10px] opacity-70 uppercase tracking-wider font-semibold">Admin Panel</p>
                </div>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)} 
                className="md:hidden p-2 text-indigo-200 hover:bg-indigo-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
              <button 
                  onClick={() => { navigate('/'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname === '/' ? 'bg-indigo-800 text-white' : 'hover:bg-indigo-800/50 text-indigo-200'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                Pembayaran SPP
              </button>
              
              <button 
                  onClick={() => { navigate('/siswa'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/siswa') ? 'bg-indigo-800 text-white' : 'hover:bg-indigo-800/50 text-indigo-200'
                }`}
              >
                <Users className="w-5 h-5" />
                Data Siswa
              </button>
                  
              <button 
                onClick={() => { navigate('/kelompok'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/kelompok') ? 'bg-indigo-800 text-white' : 'hover:bg-indigo-800/50 text-indigo-200'
                }`}
              >
                <FolderPlus className="w-5 h-5" />
                Kelompok Siswa
              </button>

              <button 
                onClick={() => { navigate('/pengeluaran'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/pengeluaran') ? 'bg-indigo-800 text-white' : 'hover:bg-indigo-800/50 text-indigo-200'
                }`}
              >
                <Receipt className="w-5 h-5" />
                Pengeluaran
              </button>

              <button 
                onClick={() => { navigate('/pemasukan-lain'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/pemasukan-lain') ? 'bg-indigo-800 text-white' : 'hover:bg-indigo-800/50 text-indigo-200'
                }`}
              >
                <FolderPlus className="w-5 h-5" />
                Pemasukan Lain
              </button>
              
              <button 
                  onClick={() => { navigate('/laporan'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/laporan') ? 'bg-indigo-800 text-white' : 'hover:bg-indigo-800/50 text-indigo-200'
                }`}
              >
                <FileText className="w-5 h-5" />
                Laporan Bulanan
              </button>
              <button 
                  onClick={() => { navigate('/log'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/log') ? 'bg-indigo-800 text-white' : 'hover:bg-indigo-800/50 text-indigo-200'
                }`}
              >
                <History className="w-5 h-5" />
                Log Aktivitas
              </button>

              <div className="pt-4 mt-4 border-t border-indigo-800/50 space-y-1">
                <button 
                    onClick={() => { navigate('/guru'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                    location.pathname.startsWith('/guru') ? 'bg-indigo-800 text-white shadow-md' : 'bg-indigo-800/50 text-indigo-100 hover:bg-indigo-800 hover:text-white'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  Manajemen Guru
                </button>
                <button 
                    onClick={() => { navigate('/panduan'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                    location.pathname.startsWith('/panduan') ? 'bg-amber-400 text-indigo-900 shadow-md' : 'bg-indigo-800/50 text-indigo-100 hover:bg-amber-400/90 hover:text-indigo-900'
                  }`}
                >
                  <BookOpen className="w-5 h-5" />
                  Panduan Penggunaan
                </button>
                <button 
                    onClick={() => { navigate('/pengaturan'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                    location.pathname.startsWith('/pengaturan') ? 'bg-amber-400 text-indigo-900 shadow-md' : 'bg-indigo-800/50 text-indigo-100 hover:bg-amber-400/90 hover:text-indigo-900'
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  Pengaturan Profil
                </button>
              </div>
            </nav>
            
            <div className="p-6 mt-auto">
              {userEmail && (
                <div className="mb-3 p-3 bg-indigo-950/70 rounded-2xl border border-indigo-800/60 flex flex-col gap-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-300">Akun Sekolah</p>
                    {isPremium ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-black uppercase">
                        <Crown className="w-2.5 h-2.5" />
                        {DEFAULT_PREMIUM_EMAILS.includes((userEmail || '').toLowerCase().trim())
                          ? 'VIP LIFETIME'
                          : `PREMIUM (${premiumDetails?.plan === 'yearly' ? 'TAHUNAN' : 'BULANAN'})`}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-800/80 text-indigo-200 text-[9px] font-semibold border border-indigo-700/50">
                        Standar (Free)
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-white truncate font-mono" title={userEmail}>{userEmail}</p>
                  <div className="text-[10px] text-indigo-200/80 pt-1.5 border-t border-indigo-900/60 flex items-center justify-between">
                    <span>Masa Aktif:</span>
                    <span className="font-bold text-amber-300 font-mono">
                      {isPremium ? (
                        DEFAULT_PREMIUM_EMAILS.includes((userEmail || '').toLowerCase().trim()) ? (
                          'Permanen'
                        ) : premiumDetails?.expiresAt ? (
                          `s/d ${new Date(premiumDetails.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        ) : (
                          `${premiumDetails?.plan === 'yearly' ? '1 Tahun' : '1 Bulan'}`
                        )
                      ) : (
                        'Maks. 100 Siswa'
                      )}
                    </span>
                  </div>
                </div>
              )}
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-rose-300 hover:bg-rose-900/30 transition-colors mb-4 border border-rose-900/30 hover:border-rose-900/50"
              >
                <LogOut className="w-4 h-4" /> Keluar Aplikasi
              </button>
              
              <div className="bg-indigo-800 rounded-2xl p-4 text-center">
                <p className="text-[11px] font-semibold text-indigo-300 uppercase tracking-widest mb-1">Kritik dan Saran</p>
                <p className="text-xs text-white mb-3">Punya kritik atau saran?</p>
                <a href="https://threads.net/@isantoh" target="_blank" rel="noopener noreferrer" className="w-full py-2 bg-indigo-700 hover:bg-indigo-600 text-white transition-colors rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                  <MessageCircle className="w-4 h-4" /> Kirim Masukan
                </a>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Navigation Bar */}
        <div className="bg-white/85 backdrop-blur-md border-b border-blue-100/90 px-3 py-2.5 sm:px-6 sm:py-3 flex items-center justify-between shrink-0 z-30 shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Desktop Menu Toggle */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors border border-slate-200"
              title={isSidebarOpen ? "Sembunyikan Panel" : "Tampilkan Panel"}
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors border border-slate-200 shrink-0"
              title="Menu Admin"
              aria-label="Menu Admin"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h2 className="font-bold text-slate-800 text-base sm:text-lg truncate">
                {location.pathname === '/' ? 'Pembayaran SPP' :
                 location.pathname.startsWith('/siswa') ? 'Data Siswa' :
                 location.pathname.startsWith('/kelompok') ? 'Kelompok Siswa' :
                 location.pathname.startsWith('/pengeluaran') ? 'Pengeluaran' :
                 location.pathname.startsWith('/pemasukan-lain') ? 'Pemasukan Lain' :
                 location.pathname.startsWith('/laporan') ? 'Laporan Bulanan' : 
                 location.pathname.startsWith('/log') ? 'Log Aktivitas' :
                 location.pathname.startsWith('/panduan') ? 'Panduan Penggunaan' : 'Pengaturan Profil'}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Indicator Status Paket & Masa Aktif User */}
            <button
              onClick={() => navigate('/pengaturan')}
              title={
                isPremium
                  ? DEFAULT_PREMIUM_EMAILS.includes((userEmail || '').toLowerCase().trim())
                    ? 'Paket VIP Lifetime Aktif (Permanen). Klik untuk kelola.'
                    : premiumDetails?.expiresAt
                      ? `Paket Premium ${premiumDetails?.plan === 'yearly' ? 'Tahunan' : 'Bulanan'} Aktif s/d ${new Date(premiumDetails.expiresAt).toLocaleDateString('id-ID')} (${premiumDetails.daysRemaining} hari lagi). Klik untuk kelola.`
                      : `Paket Premium ${premiumDetails?.plan === 'yearly' ? 'Tahunan' : 'Bulanan'} Aktif. Klik untuk kelola.`
                  : 'Paket Standar / Free (Maksimal 100 Siswa). Klik untuk upgrade ke Premium.'
              }
              className={`px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer border ${
                isPremium
                  ? 'bg-gradient-to-r from-amber-500/15 via-amber-500/20 to-amber-500/30 border-amber-500/40 text-amber-900 hover:border-amber-500/70 shadow-xs'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <Crown className={`w-3.5 h-3.5 ${isPremium ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
              {isPremium ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-amber-950 text-[11px] sm:text-xs">
                    {DEFAULT_PREMIUM_EMAILS.includes((userEmail || '').toLowerCase().trim())
                      ? 'VIP'
                      : 'PRO'}
                  </span>
                  <span className="hidden md:inline text-[11px] font-semibold text-amber-800 font-mono">
                    {DEFAULT_PREMIUM_EMAILS.includes((userEmail || '').toLowerCase().trim()) ? (
                      '(Permanen)'
                    ) : premiumDetails?.expiresAt ? (
                      `s/d ${new Date(premiumDetails.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
                    ) : (
                      `(${premiumDetails?.plan === 'yearly' ? '1 Thn' : '1 Bln'})`
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-slate-700 text-[11px] sm:text-xs">Free</span>
                  <span className="hidden sm:inline text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                    Upgrade
                  </span>
                </div>
              )}
            </button>

            <WebhookStatusBar 
              mode="topbar" 
              currentUserId={currentUser?.id} 
              onOpenSettings={() => navigate('/pengaturan')} 
            />

            <button
              type="button"
              onClick={() => {
                setDbStatus('checking');
                checkDb(1);
              }}
              title={
                dbStatus === 'connected' 
                  ? 'Database Terhubung (Online)' 
                  : dbStatus === 'checking' 
                  ? 'Sedang memeriksa koneksi...' 
                  : 'Koneksi terputus. Klik untuk coba hubungkan kembali.'
              }
              className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-1.5 rounded-full transition-all cursor-pointer ${
                dbStatus === 'connected' 
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200/70' 
                  : dbStatus === 'checking' 
                  ? 'bg-slate-100 text-slate-600' 
                  : 'bg-rose-100 text-rose-700 hover:bg-rose-200/70'
              }`}
            >
              {dbStatus === 'connected' ? (
                <Wifi className="w-3.5 h-3.5 shrink-0" />
              ) : dbStatus === 'checking' ? (
                <Database className="w-3.5 h-3.5 animate-pulse shrink-0" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="hidden sm:inline">
                {dbStatus === 'connected' ? 'Online' : dbStatus === 'checking' ? 'Mengecek...' : 'Offline (Coba Lagi)'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Routes>
            <Route path="/" element={<DashboardView currentUser={currentUser} />} />
            <Route path="/siswa" element={<StudentsView currentUser={currentUser} />} />
            <Route path="/kelompok" element={<GroupsView currentUser={currentUser} />} />
            <Route path="/pengeluaran" element={<ExpensesView currentUser={currentUser} />} />
            <Route path="/pemasukan-lain" element={<OtherIncomeView currentUser={currentUser} />} />
            <Route path="/laporan" element={<ReportsView currentUser={currentUser} />} />
            <Route path="/log" element={<ActivityLogsView />} />
            <Route path="/panduan" element={<GuideView />} />
            <Route 
              path="/pengaturan" 
              element={
                <SettingsView 
                  schoolName={schoolName} 
                  setSchoolName={setSchoolName} 
                  schoolLogo={schoolLogo} 
                  setSchoolLogo={setSchoolLogo}
                />
              } 
            />
            <Route path="/guru" element={<TeachersView />} />
            <Route path="/home" element={<HomeView schoolName={schoolName} schoolLogo={schoolLogo} />} />
            <Route path="/pricing" element={<PricingView schoolName={schoolName} schoolLogo={schoolLogo} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        {/* Mobile Bottom Navigation Bar (Dock) */}
        <nav 
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1 pb-safe flex items-center justify-around"
        >
          <button
            onClick={() => navigate('/')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] min-h-[48px] ${
              location.pathname === '/'
                ? 'text-indigo-600 font-bold bg-indigo-50/80'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 ${location.pathname === '/' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">SPP</span>
          </button>

          <button
            onClick={() => navigate('/siswa')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] min-h-[48px] ${
              location.pathname.startsWith('/siswa')
                ? 'text-indigo-600 font-bold bg-indigo-50/80'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <Users className={`w-5 h-5 ${location.pathname.startsWith('/siswa') ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Siswa</span>
          </button>

          <button
            onClick={() => navigate('/pengeluaran')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] min-h-[48px] ${
              location.pathname.startsWith('/pengeluaran') || location.pathname.startsWith('/pemasukan-lain')
                ? 'text-indigo-600 font-bold bg-indigo-50/80'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <Receipt className={`w-5 h-5 ${location.pathname.startsWith('/pengeluaran') || location.pathname.startsWith('/pemasukan-lain') ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Kas</span>
          </button>

          <button
            onClick={() => navigate('/laporan')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] min-h-[48px] ${
              location.pathname.startsWith('/laporan')
                ? 'text-indigo-600 font-bold bg-indigo-50/80'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <FileText className={`w-5 h-5 ${location.pathname.startsWith('/laporan') ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Laporan</span>
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 hover:text-slate-800 font-medium transition-all cursor-pointer min-w-[56px] min-h-[48px]"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
          </button>
        </nav>
      </main>
    </div>
  );
}
