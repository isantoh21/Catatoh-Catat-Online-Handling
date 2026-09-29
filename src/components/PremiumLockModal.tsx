import React from 'react';
import { Crown, Sparkles, X, ShieldCheck, ArrowRight, MessageCircle } from 'lucide-react';

interface PremiumLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  featureDesc?: string;
}

export default function PremiumLockModal({
  isOpen,
  onClose,
  featureName = 'Fitur Eksklusif',
  featureDesc = 'Fitur ini dirancang khusus untuk meningkatkan otomatisasi dan efisiensi sekolah pada paket Premium.'
}: PremiumLockModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 text-white relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-amber-500/20 via-indigo-600/10 to-transparent pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-full transition-colors z-10 cursor-pointer"
          aria-label="Tutup Modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-7 relative z-10 text-center">
          {/* Crown Icon with Badge */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-xl shadow-amber-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
              <Crown className="w-8 h-8 text-amber-400 animate-bounce" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fitur Khusus Akun Premium</span>
          </div>

          <h3 className="text-xl font-black text-white mt-1 mb-2 tracking-tight">
            {featureName}
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            {featureDesc}
          </p>

          {/* Benefits Box */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-left space-y-2.5 mb-6 text-xs">
            <p className="font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Akses Penuh Tanpa Batasan:</span>
            </p>
            <div className="space-y-1.5 text-slate-300 pl-6">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Kapasitas Siswa Tanpa Batas (Standar maks. 100 siswa)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Absensi Wajah AI Kamera Kiosk Siswa & Guru</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Koneksi WhatsApp Gateway & Bot Notifikasi</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Moderasi Bukti Bayar WhatsApp (Verifikasi Struk Otomatis)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Kirim Reminder SPP Massal 1-Klik</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <a
              href="https://threads.net/@isantoh"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Hubungi Superadmin untuk Aktivasi</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup / Kembali
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
