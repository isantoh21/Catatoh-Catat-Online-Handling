import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  GraduationCap, 
  ArrowRight, 
  Menu, 
  X, 
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentPath = location.pathname.toLowerCase();
  const isHome = currentPath === '/' || currentPath === '/home' || currentPath === '/beranda';
  const isPricing = currentPath === '/pricing' || currentPath === '/harga';

  const navLinks = [
    { label: 'Beranda', path: '/', active: isHome },
    { label: 'Alur Kerja', path: '/#alur-kerja', active: false, isAnchor: true },
    { label: 'Biaya & Paket', path: '/pricing', active: isPricing },
  ];

  const handleNavClick = (path: string, isAnchor?: boolean) => {
    setMobileMenuOpen(false);
    if (isAnchor) {
      if (!isHome) {
        navigate('/');
        setTimeout(() => {
          const el = document.getElementById('alur-kerja');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      } else {
        const el = document.getElementById('alur-kerja');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 pointer-events-none">
      <header className="max-w-5xl mx-auto mt-4 sm:mt-5 pointer-events-auto transition-all duration-300">
        
        {/* Floating Island Shell */}
        <div className="bg-white/95 backdrop-blur-md rounded-full px-4 sm:px-6 py-2.5 sm:py-3 border border-slate-200/90 shadow-[0_8px_30px_rgb(15,23,42,0.08)] flex items-center justify-between">
          
          {/* Logo & Brand Identity */}
          <div 
            onClick={() => handleNavClick('/')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            {schoolLogo ? (
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-50 border border-slate-200 p-0.5 shrink-0">
                <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/25 shrink-0 group-hover:bg-blue-700 transition-colors">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-sm tracking-tight group-hover:text-blue-600 transition-colors">
                {schoolName}
              </span>
              <span className="hidden sm:inline-block text-[11px] font-semibold text-slate-500 border-l border-slate-200 pl-2">
                Pencatatan SPP & Presensi
              </span>
            </div>
          </div>

          {/* Desktop Center Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.path, item.isAnchor)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  item.active
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right Action: Button-in-Button Architecture */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => {
                navigate('/login');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Masuk
            </button>

            {/* Nested Island CTA Button with vibrant Blue */}
            <button
              onClick={() => {
                navigate('/login?mode=register');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="group pl-4 pr-1.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all duration-200 active:scale-98 shadow-md shadow-blue-600/20 flex items-center gap-2.5 cursor-pointer"
            >
              <span>Daftar Akun</span>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <ArrowRight className="w-3 h-3 text-white" />
              </span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200"
            >
              Masuk
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 rounded-2xl bg-white border border-slate-200/90 shadow-xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1">
              {navLinks.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item.path, item.isAnchor)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors ${
                    item.active 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200/60' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>{item.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/login?mode=register');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Daftar Akun Baru</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </header>
    </div>
  );
}
