import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  GraduationCap, 
  Sparkles, 
  ArrowRight, 
  Menu, 
  X, 
  Layers, 
  CreditCard, 
  LogIn, 
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

interface PublicNavbarProps {
  schoolName?: string;
  schoolLogo?: string;
}

export default function PublicNavbar({ 
  schoolName = 'CATATOH', 
  schoolLogo = '' 
}: PublicNavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const currentPath = location.pathname.toLowerCase();
  const isHome = currentPath === '/' || currentPath === '/home' || currentPath === '/beranda';
  const isPricing = currentPath === '/pricing' || currentPath === '/harga';
  const isLogin = currentPath.startsWith('/login') || currentPath.startsWith('/masuk');

  const navLinks = [
    { label: 'Beranda', path: '/', active: isHome },
    { label: 'Fitur', path: '/#fitur', active: false, isAnchor: true },
    { label: 'Biaya & Paket', path: '/pricing', active: isPricing },
  ];

  const handleNavClick = (path: string, isAnchor?: boolean) => {
    setMobileMenuOpen(false);
    if (isAnchor) {
      if (!isHome) {
        navigate('/');
        setTimeout(() => {
          const el = document.getElementById('fitur');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      } else {
        const el = document.getElementById('fitur');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-slate-900/85 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20 py-3' 
          : 'bg-slate-950/70 backdrop-blur-md border-b border-white/5 py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* Logo & Brand 2026 */}
          <div 
            onClick={() => handleNavClick('/')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="relative">
              {schoolLogo ? (
                <div className="w-10 h-10 rounded-2xl bg-white p-1 border border-white/20 shadow-md overflow-hidden">
                  <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 border border-white/20 group-hover:scale-105 transition-transform duration-300">
                  <GraduationCap className="w-5 h-5 text-white" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 absolute -top-1 -right-1 ring-2 ring-slate-950 animate-pulse" />
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white group-hover:text-blue-300 transition-colors">
                  {schoolName}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 border border-blue-400/30">
                  <Sparkles className="w-2.5 h-2.5 text-blue-400" />
                  EduOS 2026
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium tracking-tight">
                Catat Online Handling
              </span>
            </div>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1.5 p-1.5 rounded-full bg-slate-900/70 border border-white/10 backdrop-blur-xl shadow-inner">
            {navLinks.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.path, item.isAnchor)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  item.active 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30 font-bold' 
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => {
                navigate('/login');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                isLogin
                  ? 'bg-white/15 text-white border border-white/30'
                  : 'text-slate-200 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <LogIn className="w-3.5 h-3.5 text-blue-400" />
              <span>Masuk</span>
            </button>

            <button
              onClick={() => {
                navigate('/login?mode=register');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="relative group overflow-hidden px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all duration-300 border border-white/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span className="relative z-10 flex items-center gap-1.5">
                <span>Coba Gratis</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-in-out" />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-white border border-white/15 hover:bg-white/15"
            >
              Masuk
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Slide-down Drawer 2026 */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-slate-950/95 backdrop-blur-2xl px-4 pt-4 pb-6 space-y-3 animate-in slide-in-from-top-4 duration-200">
          <div className="space-y-1">
            {navLinks.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.path, item.isAnchor)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold text-left transition-colors ${
                  item.active 
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' 
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{item.label}</span>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/login');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4 text-blue-400" />
              <span>Masuk Akun</span>
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/login?mode=register');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Daftar Gratis Sekarang</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
