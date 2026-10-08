import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  Sparkles, 
  ShieldCheck, 
  Heart, 
  MessageCircle, 
  ExternalLink,
  ArrowUpRight,
  Zap,
  Cpu,
  Lock
} from 'lucide-react';

export default function PublicFooter({ schoolName = 'CATATOH' }: { schoolName?: string }) {
  const navigate = useNavigate();

  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-white/10 relative overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-b from-blue-600/10 via-indigo-600/5 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10">
          
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 border border-white/20">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-black text-white tracking-tight block">
                  {schoolName}
                </span>
                <span className="text-xs text-blue-400 font-mono tracking-wide">
                  Catat Online Handling • EduOS 2026
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              Ekosistem tata kelola keuangan sekolah, SPP terpadu, presensi biometrik wajah AI, dan WhatsApp Gateway otomatis tercerdas untuk sekolah, madrasah, dan yayasan di Indonesia.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10 text-slate-300">
                <Cpu className="w-3 h-3 text-cyan-400" />
                Gemini Vision OCR
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10 text-slate-300">
                <Zap className="w-3 h-3 text-amber-400" />
                Face Biometrics 1s
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10 text-slate-300">
                <Lock className="w-3 h-3 text-emerald-400" />
                Anti-Ban WA Engine
              </span>
            </div>
          </div>

          {/* Navigation Column */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">Navigasi Utama</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button 
                  onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Beranda (Home)
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { navigate('/pricing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Harga & Paket
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { navigate('/login'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Portal Masuk (Login)
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { navigate('/login?mode=register'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-white transition-colors cursor-pointer text-left text-blue-400 font-semibold"
                >
                  Daftar Akun Baru
                </button>
              </li>
            </ul>
          </div>

          {/* Features Column */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">Fitur Unggulan</h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>Presensi Wajah AI & Geofence GPS</li>
              <li>WhatsApp Gateway Tagihan SPP Massal</li>
              <li>AI Vision OCR Pembaca Struk Bank</li>
              <li>Kartu SPP Online Wali Murid 24/7</li>
              <li>Kuitansi Pembayaran PDF Otomatis</li>
              <li>Buku Kas & Pelaporan Bulanan</li>
            </ul>
          </div>

          {/* Support Column */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">Bantuan & Komunitas</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Punya pertanyaan seputar implementasi atau ingin konsultasi paket sekolah? Hubungi kami langsung:
            </p>
            <div className="space-y-2 pt-1 text-sm">
              <a 
                href="https://threads.net/@isantoh" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
              >
                <span>Threads @isantoh</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </a>
              <a 
                href="https://instagram.com/isantoh" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
              >
                <span>Instagram @isantoh</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </a>
              <div className="text-xs text-slate-500 pt-1">
                BCA Rekening Resmi: <br />
                <span className="font-mono text-slate-300 font-bold">7805556218</span> (Muhammad Ikhsan)
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>© 2026 {schoolName}. All rights reserved.</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Cloud Aktif
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-400">Dirancang dengan presisi untuk memajukan pendidikan Indonesia.</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
