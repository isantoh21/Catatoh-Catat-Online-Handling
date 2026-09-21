import SuperAdminView from './components/superadmin/SuperAdminView';
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import SetupGuide from './components/SetupGuide';
import StudentsView from './components/StudentsView';
import GroupsView from './components/GroupsView';
import DashboardView from './components/DashboardView';
import ReportsView from './components/ReportsView';
import ActivityLogsView from './components/ActivityLogsView';
import LoginView from './components/LoginView';
import DefaultLogo from './components/DefaultLogo';
import WelcomeAnimation from './components/WelcomeAnimation';
import MandatoryProfileModal from './components/MandatoryProfileModal';
import { BookOpen, Users, LayoutDashboard, FileText, MessageCircle, Settings, LogOut, Database, Wifi, WifiOff, Receipt, FolderPlus, Menu, X, MapPin, CheckCircle2, History, KeyRound, Lock, Sparkles } from 'lucide-react';
import { INDONESIAN_CITIES } from './data/cities';
import SettingsView from './components/SettingsView';
import GuideView from './components/GuideView';
import ExpensesView from './components/ExpensesView';
import OtherIncomeView from './components/OtherIncomeView';
import TeachersView from './components/TeachersView';
import AttendancePortal from './components/AttendancePortal';
import StudentAttendancePortal from './components/students/StudentAttendancePortal';

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

  // Welcome login animation states
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false);
  const [welcomeAdminName, setWelcomeAdminName] = useState('');
  const [welcomeSchoolName, setWelcomeSchoolName] = useState('');

  const fetchUserSettings = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('user_settings').select('school_name, school_logo').eq('user_id', userId).single();
      if (!error && data) {
        if (data.school_name) {
          setSchoolName(data.school_name);
          localStorage.setItem('schoolName_' + userId, data.school_name);
        }
        if (data.school_logo) {
          setSchoolLogo(data.school_logo);
          localStorage.setItem('schoolLogo_' + userId, data.school_logo);
        }
        return data.school_name || '';
      } else {
        const cached = localStorage.getItem('schoolName_' + userId) || '';
        setSchoolName(cached);
        setSchoolLogo(localStorage.getItem('schoolLogo_' + userId) || '');
        return cached;
      }
    } catch (err) {
      const cached = localStorage.getItem('schoolName_' + userId) || '';
      setSchoolName(cached);
      setSchoolLogo(localStorage.getItem('schoolLogo_' + userId) || '');
      return cached;
    }
  };

  const checkProfileRequirements = (user: any, loadedSchool?: string) => {
    if (!user) {
      setShowMandatoryProfileModal(false);
      return false;
    }

    const rawAdmin = (user.user_metadata?.full_name || user.user_metadata?.admin_name || '').trim();
    const isAdminValid = rawAdmin.length >= 2 && rawAdmin !== 'Belum Diatur';

    const sName = (loadedSchool || localStorage.getItem('schoolName_' + user.id) || user.user_metadata?.school_name || schoolName || '').trim();
    const isSchoolValid = sName.length >= 2 && sName !== 'Aplikasi Pencatatan SPP Gratis' && sName !== 'CATATOH';

    const rawCity = (user.user_metadata?.city || '').trim();
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

  const triggerWelcome = (user: any, loadedSchool?: string) => {
    if (!user) return;
    const rawEmail = user.email || '';
    const rawName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.admin_name || rawEmail.split('@')[0] || 'Admin';
    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    
    let sName = loadedSchool || localStorage.getItem('schoolName_' + user.id) || schoolName;
    if (!sName || sName === 'Aplikasi Pencatatan SPP Gratis' || sName === 'CATATOH') {
      sName = user.user_metadata?.school_name || 'Portal CATATOH Sekolah';
    }

    setWelcomeAdminName(formattedName);
    setWelcomeSchoolName(sName);
    setShowWelcomeAnimation(true);
  };

  useEffect(() => {
    // Detect URL hash for password recovery or email verification
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setShowResetPasswordModal(true);
    } else if (hash.includes('type=signup') || hash.includes('type=email_verification')) {
      setShowEmailConfirmedModal(true);
    }

    // Check active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setUserEmail(session?.user?.email || '');
      setCurrentUser(session?.user || null);
      setIsInitializing(false);
      if (session?.user) {
        const loadedSchool = await fetchUserSettings(session.user.id);
        checkProfileRequirements(session.user, loadedSchool);
      }
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
          const isComplete = checkProfileRequirements(session.user, loadedSchool);
          if (_event === 'SIGNED_IN') {
            const token = session.access_token;
            if (sessionStorage.getItem('last_welcomed_token') !== token) {
              sessionStorage.setItem('last_welcomed_token', token);
              if (isComplete) {
                triggerWelcome(session.user, loadedSchool);
              }
            }
          }
        });
      } else {
        setSchoolName('CATATOH');
        setSchoolLogo('');
        setShowMandatoryProfileModal(false);
      }
    });
    
    // Initial session is handled by the first getSession block


    // Removed global local storage

    const checkDb = async () => {
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
          setDbStatus('error');
        } else {
          setDbStatus('connected');
        }
      } catch (err) {
        setDbStatus('error');
      }
    };
    
    checkDb();
    
    const handleOnline = () => {
      setDbStatus('checking');
      checkDb();
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
  }, []);

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
      triggerWelcome(session.user, updated.schoolName);
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
    navigate('/');

    let activeUser = user;
    if (!activeUser) {
      const { data } = await supabase.auth.getSession();
      activeUser = data.session?.user;
    }

    if (activeUser) {
      setCurrentUser(activeUser);
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        sessionStorage.setItem('last_welcomed_token', data.session.access_token);
      }
      fetchUserSettings(activeUser.id).then((loadedSchool) => {
        const isComplete = checkProfileRequirements(activeUser, loadedSchool);
        if (isComplete) {
          triggerWelcome(activeUser, loadedSchool);
        }
      });
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('last_welcomed_token');
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

  if (location.pathname === '/superadmin-secret') {
    return <SuperAdminView />;
  }

  if (!isLoggedIn || showResetPasswordModal) {
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
    <div className="flex flex-col md:flex-row h-screen w-screen bg-slate-50 font-sans overflow-hidden text-slate-800">
      <WelcomeAnimation
        isOpen={showWelcomeAnimation}
        onClose={() => setShowWelcomeAnimation(false)}
        adminName={welcomeAdminName}
        schoolName={welcomeSchoolName}
        duration={4500}
      />

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
                    <img src={schoolLogo} alt="Logo" className="w-full h-full object-cover" />
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
                <div className="mb-3 px-3 py-2 bg-indigo-950/50 rounded-xl border border-indigo-800/50 flex items-center justify-between gap-2">
                  <div className="overflow-hidden">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-indigo-300">Akun Aktif</p>
                    <p className="text-xs font-bold text-white truncate" title={userEmail}>{userEmail}</p>
                  </div>
                  <button
                    onClick={() => {
                      supabase.auth.getSession().then(({ data: { session } }) => {
                        if (session?.user) {
                          triggerWelcome(session.user, schoolName);
                        }
                      });
                    }}
                    title="Lihat Animasi Sambutan"
                    className="p-1.5 bg-indigo-900/60 hover:bg-amber-400 hover:text-indigo-950 text-amber-300 rounded-lg transition-colors shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
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
        <div className="bg-white border-b border-slate-200 px-4 py-3 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
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
              className="md:hidden p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors border border-slate-200"
              title="Menu Admin"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h2 className="font-bold text-slate-800 text-lg hidden sm:block">
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
          
          <div className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-2 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-100 text-emerald-700' : dbStatus === 'checking' ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-700'}`}>
            {dbStatus === 'connected' ? <Wifi className="w-3.5 h-3.5" /> : dbStatus === 'checking' ? <Database className="w-3.5 h-3.5 animate-pulse" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {dbStatus === 'connected' ? 'Database Terhubung' : dbStatus === 'checking' ? 'Mengecek...' : 'Offline (Cek Koneksi)'}
            </span>
            <span className="sm:hidden">
              {dbStatus === 'connected' ? 'Online' : dbStatus === 'checking' ? 'Wait...' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardView />} />
            <Route path="/siswa" element={<StudentsView />} />
            <Route path="/kelompok" element={<GroupsView />} />
            <Route path="/pengeluaran" element={<ExpensesView />} />
            <Route path="/pemasukan-lain" element={<OtherIncomeView />} />
            <Route path="/laporan" element={<ReportsView />} />
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
                  onTestWelcome={() => {
                    supabase.auth.getSession().then(({ data: { session } }) => {
                      if (session?.user) {
                        triggerWelcome(session.user, schoolName);
                      } else {
                        setWelcomeAdminName('Admin');
                        setWelcomeSchoolName(schoolName || 'Sekolah');
                        setShowWelcomeAnimation(true);
                      }
                    });
                  }}
                />
              } 
            />
            <Route path="/guru" element={<TeachersView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
