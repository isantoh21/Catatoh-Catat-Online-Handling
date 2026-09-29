import React, { useState } from 'react';
import { 
  X, 
  Crown, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Calendar, 
  CreditCard, 
  Copy, 
  CheckCircle2, 
  ExternalLink,
  MessageCircle,
  Clock,
  ArrowRight
} from 'lucide-react';

interface RenewPremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userId?: string;
  currentPlan?: 'free' | 'monthly' | 'yearly';
  currentExpiresAt?: string | null;
  onRenewSuccess?: () => void;
}

export default function RenewPremiumModal({
  isOpen,
  onClose,
  userEmail = '',
  userId = '',
  currentPlan = 'monthly',
  currentExpiresAt = null,
  onRenewSuccess
}: RenewPremiumModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [copiedBank, setCopiedBank] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBank(label);
    setTimeout(() => setCopiedBank(null), 2500);
  };

  const isMonthly = selectedPlan === 'monthly';
  const priceFormatted = isMonthly ? 'Rp 30.000' : 'Rp 250.000';
  const durationLabel = isMonthly ? '1 Bulan (+30 Hari)' : '1 Tahun (+365 Hari)';

  const waConfirmText = isMonthly
    ? `Halo Admin CATATOH, saya ingin konfirmasi perpanjangan langganan akun sekolah:\n- Email Akun: ${userEmail}\n- Pilihan Paket: PAKET BULANAN (Rp 30.000 / 1 Bulan)\n- Rekening Tujuan: BCA 7805556218 a.n Muhammad Ikhsan\n- Tanggal Pengajuan: ${new Date().toLocaleDateString('id-ID')}\n\nSaya telah melakukan transfer untuk paket Bulanan sebesar Rp 30.000. Mohon dicek bukti pembayaran berikut dan diaktifkan status Premium akun saya. Terima kasih! 🙏`
    : `Halo Admin CATATOH, saya ingin konfirmasi perpanjangan langganan akun sekolah:\n- Email Akun: ${userEmail}\n- Pilihan Paket: PAKET TAHUNAN (Rp 250.000 / 1 Tahun Penuh)\n- Rekening Tujuan: BCA 7805556218 a.n Muhammad Ikhsan\n- Tanggal Pengajuan: ${new Date().toLocaleDateString('id-ID')}\n\nSaya telah melakukan transfer untuk paket Tahunan sebesar Rp 250.000. Mohon dicek bukti pembayaran berikut dan diaktifkan status Premium akun saya. Terima kasih! 🙏`;

  const waAdminUrl = `https://wa.me/6285347360359?text=${encodeURIComponent(waConfirmText)}`;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[999] animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-indigo-950/80 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border-b border-indigo-900/40 relative flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/30">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white">
                  Perpanjang Langganan Premium
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  Resmi CATATOH
                </span>
              </div>
              <p className="text-xs text-indigo-200/70 mt-0.5">
                Pastikan seluruh operasional absensi wajah & gateway WhatsApp sekolah tetap berjalan lancar.
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* Current Status Box */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-400">Status Saat Ini:</span>
              <span className="font-bold text-white font-mono">{userEmail || 'Akun Aktif'}</span>
            </div>
            {currentExpiresAt ? (
              <span className="text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 font-medium">
                Masa Aktif: s/d {new Date(currentExpiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            ) : (
              <span className="text-slate-400">Paket Reguler (Free)</span>
            )}
          </div>

          {/* Plan Options Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
              Pilih Durasi Perpanjangan:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Option 1: Bulanan */}
              <div 
                onClick={() => setSelectedPlan('monthly')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                  selectedPlan === 'monthly'
                    ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Paket Bulanan</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPlan === 'monthly' ? 'border-indigo-400 bg-indigo-600' : 'border-slate-700'
                    }`}>
                      {selectedPlan === 'monthly' && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 my-2">
                    <span className="text-2xl font-black text-white">Rp 30.000</span>
                    <span className="text-xs text-slate-400">/ bulan</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sangat fleksibel untuk kebutuhan bulanan sekolah tanpa komitmen panjang.
                  </p>
                </div>
              </div>

              {/* Option 2: Tahunan (Best Value) */}
              <div 
                onClick={() => setSelectedPlan('yearly')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                  selectedPlan === 'yearly'
                    ? 'bg-gradient-to-br from-amber-950/30 via-indigo-950/40 to-slate-950 border-amber-500/80 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-[10px] shadow-sm uppercase tracking-wider">
                  HEMAT RP 110.000!
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Paket Tahunan (1 Tahun)
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPlan === 'yearly' ? 'border-amber-400 bg-amber-500' : 'border-slate-700'
                    }`}>
                      {selectedPlan === 'yearly' && <Check className="w-3 h-3 text-slate-950 font-bold" />}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 my-2">
                    <span className="text-2xl font-black text-amber-300">Rp 250.000</span>
                    <span className="text-xs text-slate-400">/ tahun</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Hanya ~Rp 20.800/bln. Bebas repot urus perpanjangan setiap bulan selama 1 tahun penuh.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Payment Details Instructions */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Rekening Resmi Pembayaran:
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">BANK BCA</p>
                <p className="font-mono font-bold text-white text-base tracking-wider">7805556218</p>
                <p className="text-[11px] text-slate-400 font-medium">a.n Muhammad Ikhsan</p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('7805556218', 'BCA')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 border border-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                title="Salin No. Rekening"
              >
                {copiedBank === 'BCA' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              *Setelah transfer sejumlah <strong>{priceFormatted}</strong> ke rekening di atas, klik tombol konfirmasi WhatsApp di bawah untuk proses verifikasi.
            </p>
          </div>

          {/* Features Reminder Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/80">
              <span className="font-bold text-amber-300">Unlimited</span>
              <p className="text-[10px] text-slate-500">Data Siswa</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/80">
              <span className="font-bold text-purple-300">Scan Wajah</span>
              <p className="text-[10px] text-slate-500">Siswa & Guru</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/80">
              <span className="font-bold text-emerald-300">WA Gateway</span>
              <p className="text-[10px] text-slate-500">Kirim Otomatis</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/80">
              <span className="font-bold text-cyan-300">AI Vision OCR</span>
              <p className="text-[10px] text-slate-500">Verifikasi Struk</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            Total Transfer: <strong className="text-white text-sm font-bold">{priceFormatted}</strong> ({durationLabel})
          </div>

          <a
            href={waAdminUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-white text-transparent shrink-0" />
            <span>Kirim Bukti Pembayaran ({isMonthly ? 'Paket Bulanan' : 'Paket Tahunan'}) via WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80 shrink-0" />
          </a>
        </div>

      </div>
    </div>
  );
}
