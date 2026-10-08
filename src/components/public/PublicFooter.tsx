import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  ArrowUpRight
} from 'lucide-react';

export default function PublicFooter({ schoolName = 'CATATOH' }: { schoolName?: string }) {
  const navigate = useNavigate();

  return (
    <footer className="bg-slate-50 text-slate-600 border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-slate-200">
          
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span className="text-base font-bold text-slate-900 tracking-tight">
                {schoolName}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              Sistem pencatatan SPP online, presensi biometrik wajah siswa & dewan guru, serta WhatsApp gateway otomatis untuk sekolah dan madrasah di Indonesia.
            </p>

            <div className="text-[11px] text-slate-400 font-mono pt-1">
              BCA Resmi: <span className="text-slate-700 font-bold">7805556218</span> a.n Muhammad Ikhsan
            </div>
          </div>

          {/* Navigation Column */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Navigasi</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button 
                  onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-slate-900 transition-colors cursor-pointer text-left"
                >
                  Beranda
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { navigate('/pricing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-slate-900 transition-colors cursor-pointer text-left"
                >
                  Biaya & Paket
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { navigate('/login'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-slate-900 transition-colors cursor-pointer text-left"
                >
                  Masuk Akun
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { navigate('/login?mode=register'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-blue-600 font-semibold transition-colors cursor-pointer text-left"
                >
                  Daftar Baru
                </button>
              </li>
            </ul>
          </div>

          {/* Modul Column */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Modul Utama</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li>Pencatatan SPP & Kas Sekolah</li>
              <li>Presensi Wajah AI Kamera Piket</li>
              <li>WhatsApp Gateway Hadir/Pulang</li>
              <li>Tagihan SPP Massal Anti-Banned</li>
              <li>Pembaca Struk Transfer Bank (OCR)</li>
              <li>Kartu SPP Online Wali Murid</li>
            </ul>
          </div>

          {/* Support Column */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Bantuan & Kontak</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Konsultasi implementasi sekolah atau pendampingan pendaftaran:
            </p>
            <div className="space-y-1.5 pt-1 text-xs">
              <a 
                href="https://threads.net/@isantoh" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 transition-colors"
              >
                <span>Threads @isantoh</span>
                <ArrowUpRight className="w-3 h-3 opacity-60" />
              </a>
              <a 
                href="https://instagram.com/isantoh" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 transition-colors"
              >
                <span>Instagram @isantoh</span>
                <ArrowUpRight className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} {schoolName}. Hak cipta dilindungi undang-undang.
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-600 font-medium">Sistem Cloud Aktif</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
