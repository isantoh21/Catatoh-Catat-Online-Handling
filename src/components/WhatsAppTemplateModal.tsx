import React, { useState, useEffect } from 'react';
import { 
  X, Check, RotateCcw, MessageSquare, Send, CheckCircle2, 
  XCircle, Clock, Sparkles, Copy, HelpCircle 
} from 'lucide-react';
import { 
  WhatsAppTemplates, 
  DEFAULT_TEMPLATES, 
  getWhatsAppTemplates, 
  saveWhatsAppTemplates,
  formatReceiptReceivedMessage,
  formatReceiptApprovedMessage,
  formatReceiptRejectedMessage
} from '../lib/whatsappTemplates';

interface WhatsAppTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'broadcast' | 'receiptReceived' | 'receiptApproved' | 'receiptRejected';
  onSaved?: (templates: WhatsAppTemplates) => void;
}

export default function WhatsAppTemplateModal({
  isOpen,
  onClose,
  initialTab = 'broadcast',
  onSaved
}: WhatsAppTemplateModalProps) {
  const [activeTab, setActiveTab] = useState<'broadcast' | 'receiptReceived' | 'receiptApproved' | 'receiptRejected'>(initialTab);
  const [templates, setTemplates] = useState<WhatsAppTemplates>({ ...DEFAULT_TEMPLATES });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadTemplates();
    }
  }, [isOpen, initialTab]);

  const loadTemplates = async () => {
    setLoading(true);
    const loaded = await getWhatsAppTemplates();
    setTemplates(loaded);
    setLoading(false);
  };

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setTemplates(prev => ({
      ...prev,
      [activeTab]: text
    }));
  };

  const handleResetCurrentTab = () => {
    if (confirm(`Kembalikan template "${getTabTitle(activeTab)}" ke susunan teks bawaan (default)?`)) {
      setTemplates(prev => ({
        ...prev,
        [activeTab]: DEFAULT_TEMPLATES[activeTab]
      }));
    }
  };

  const handleInsertVariable = (varName: string) => {
    const current = templates[activeTab] || '';
    setTemplates(prev => ({
      ...prev,
      [activeTab]: current + varName
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const res = await saveWhatsAppTemplates(templates);
    setIsSaving(false);

    if (res.success) {
      setSaveSuccess(true);
      if (onSaved) onSaved(templates);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } else {
      alert('Gagal menyimpan template: ' + (res.error || 'Terjadi kesalahan'));
    }
  };

  function getTabTitle(tab: typeof activeTab) {
    switch (tab) {
      case 'broadcast': return 'Tagihan SPP (Reminder)';
      case 'receiptReceived': return 'Resi Masuk (Auto-Reply)';
      case 'receiptApproved': return 'Resi Divalidasi (Lunas)';
      case 'receiptRejected': return 'Resi Ditolak';
    }
  }

  // Get Variables for the active tab
  const getTabVariables = () => {
    switch (activeTab) {
      case 'broadcast':
        return [
          { tag: '[NAMA_SISWA]', desc: 'Nama lengkap siswa' },
          { tag: '[BULAN]', desc: 'Bulan tagihan SPP' },
          { tag: '[TAHUN]', desc: 'Tahun tagihan SPP' },
          { tag: '[NOMINAL]', desc: 'Nominal tagihan (format Rp)' },
          { tag: '[LINK_SPP]', desc: 'Link portal kartu SPP online siswa' },
        ];
      case 'receiptReceived':
        return [
          { tag: '[NAMA_SISWA]', desc: 'Nama ananda / pengirim' },
          { tag: '[BULAN]', desc: 'Bulan yang terdeteksi di struk' },
          { tag: '[TAHUN]', desc: 'Tahun transaksi' },
          { tag: '[NOMINAL]', desc: 'Nominal murni (contoh: Rp 150.000)' },
          { tag: '[NOMINAL_TEKS]', desc: 'Frasa pelengkap ("sebesar *Rp 150.000*")' },
          { tag: '[TANGGAL]', desc: 'Tanggal transaksi dari struk' },
          { tag: '[BANK]', desc: 'Bank/E-Wallet pengirim' },
          { tag: '[LINK_SPP]', desc: 'Link portal kartu SPP online siswa' },
        ];
      case 'receiptApproved':
        return [
          { tag: '[NAMA_SISWA]', desc: 'Nama lengkap siswa' },
          { tag: '[BULAN]', desc: 'Bulan pembayaran SPP' },
          { tag: '[TAHUN]', desc: 'Tahun pembayaran' },
          { tag: '[NOMINAL]', desc: 'Nominal yang diverifikasi (format Rp)' },
          { tag: '[TANGGAL]', desc: 'Tanggal transfer di struk' },
          { tag: '[BANK]', desc: 'Bank pengirim' },
          { tag: '[LINK_SPP]', desc: 'Link portal kartu SPP online siswa' },
        ];
      case 'receiptRejected':
        return [
          { tag: '[NAMA_SISWA]', desc: 'Nama lengkap siswa' },
          { tag: '[ALASAN_PENOLAKAN]', desc: 'Penyebab penolakan yang dipilih bendahara' },
          { tag: '[BULAN]', desc: 'Bulan yang bersangkutan' },
          { tag: '[TAHUN]', desc: 'Tahun yang bersangkutan' },
          { tag: '[NOMINAL]', desc: 'Nominal pada struk' },
          { tag: '[LINK_SPP]', desc: 'Link portal kartu SPP online siswa' },
        ];
    }
  };

  // Generate live preview text
  const getPreviewText = () => {
    const raw = templates[activeTab] || '';
    switch (activeTab) {
      case 'broadcast':
        return raw
          .replace(/\[NAMA_SISWA\]/g, 'Ahmad Fauzi')
          .replace(/\[BULAN\]/g, 'Maret')
          .replace(/\[TAHUN\]/g, '2026')
          .replace(/\[NOMINAL\]/g, 'Rp 150.000')
          .replace(/\[LINK_SPP\]/g, 'https://catatoh.my.id/kartu-spp-ortu/demo');
      case 'receiptReceived':
        return formatReceiptReceivedMessage(raw, {
          studentName: 'Ahmad Fauzi',
          bulan: 'Maret',
          tahun: 2026,
          nominal: 150000,
          tanggal: '2026-03-25',
          bank: 'BCA',
          linkSpp: 'https://catatoh.my.id/kartu-spp-ortu/demo'
        });
      case 'receiptApproved':
        return formatReceiptApprovedMessage(raw, {
          studentName: 'Ahmad Fauzi',
          bulan: 'Maret',
          tahun: 2026,
          nominal: 150000,
          tanggal: '2026-03-25',
          bank: 'BCA',
          linkSpp: 'https://catatoh.my.id/kartu-spp-ortu/demo'
        });
      case 'receiptRejected':
        return formatReceiptRejectedMessage(raw, {
          studentName: 'Ahmad Fauzi',
          reason: 'Nominal transfer tidak sesuai dengan tagihan SPP',
          bulan: 'Maret',
          tahun: 2026,
          nominal: 100000,
          linkSpp: 'https://catatoh.my.id/kartu-spp-ortu/demo'
        });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[70] animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Pengaturan Template Pesan WhatsApp</h3>
              <p className="text-xs text-slate-500">Sesuaikan draf pesan tagihan, auto-reply resi masuk, approved, dan rejected</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'broadcast'
                ? 'bg-white text-indigo-700 shadow-sm font-bold border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-indigo-500" />
            Tagihan SPP (Reminder)
          </button>

          <button
            onClick={() => setActiveTab('receiptReceived')}
            className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'receiptReceived'
                ? 'bg-white text-blue-700 shadow-sm font-bold border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            Resi Masuk (Auto-Reply)
          </button>

          <button
            onClick={() => setActiveTab('receiptApproved')}
            className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'receiptApproved'
                ? 'bg-white text-emerald-700 shadow-sm font-bold border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Resi Divalidasi (Lunas)
          </button>

          <button
            onClick={() => setActiveTab('receiptRejected')}
            className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'receiptRejected'
                ? 'bg-white text-rose-700 shadow-sm font-bold border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Resi Ditolak
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Quick Variable Badges */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Klik Variabel untuk Menyisipkan ke Template:
              </span>
              <button
                type="button"
                onClick={handleResetCurrentTab}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
                title="Reset template tab ini ke teks default"
              >
                <RotateCcw className="w-3 h-3" />
                Reset ke Default
              </button>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              {getTabVariables().map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => handleInsertVariable(` ${v.tag} `)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-mono transition-all group"
                  title={v.desc}
                >
                  <span className="font-bold">{v.tag}</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-emerald-600 font-sans">({v.desc})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Editor Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Teks Draf Template ({getTabTitle(activeTab)}):
            </label>
            <textarea
              rows={6}
              value={templates[activeTab] || ''}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-sans transition-all leading-relaxed"
              placeholder="Ketik susunan template pesan di sini..."
            />
          </div>

          {/* WhatsApp Chat Simulation Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                Simulasi Tampilan di WhatsApp Orang Tua:
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Preview Dinamis</span>
            </div>

            <div className="bg-[#e5ddd5] dark:bg-slate-800 p-3 sm:p-4 rounded-xl border border-[#d1c7bc] dark:border-slate-700">
              <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg rounded-tl-none p-3 shadow-sm max-w-[90%] text-xs whitespace-pre-wrap leading-relaxed font-sans relative">
                {getPreviewText()}
                <div className="text-[9px] text-slate-400 text-right mt-1 font-mono">
                  09:41 ✓✓
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {saveSuccess && (
              <span className="text-emerald-600 font-semibold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                Semua template berhasil disimpan!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>Menyimpan...</>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Simpan Semua Template
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
