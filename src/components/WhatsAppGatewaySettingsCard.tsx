import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Key, Shield, Copy, Check, Send, AlertCircle, 
  CheckCircle2, Sparkles, RefreshCw, ExternalLink, Code2, ChevronDown, ChevronUp, Radio
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { 
  getWhatsAppGatewayConfig, 
  saveWhatsAppGatewayConfig, 
  sendWhatsAppMessage,
  DEFAULT_GATEWAY_CONFIG 
} from '../lib/whatsappGateway';
import { WhatsAppGatewayConfig } from '../types/whatsapp';
import WebhookStatusBar from './WebhookStatusBar';

export default function WhatsAppGatewaySettingsCard() {
  const [config, setConfig] = useState<WhatsAppGatewayConfig>(DEFAULT_GATEWAY_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Webhook URL States
  const [copiedUniversal, setCopiedUniversal] = useState(false);
  const [copiedUserUrl, setCopiedUserUrl] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  // Test Message
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Halo, ini adalah pesan uji coba integrasi WhatsApp Gateway Catatoh SPP!');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; text: string } | null>(null);

  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (uid) setCurrentUserId(uid);

    const saved = await getWhatsAppGatewayConfig(uid);
    setConfig(saved);
    setIsLoading(false);
  };

  const getUniversalWebhookUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/api/webhook/whatsapp`;
  };

  const getUserWebhookUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (currentUserId) {
      return `${origin}/api/webhook/whatsapp?user_id=${currentUserId}`;
    }
    return `${origin}/api/webhook/whatsapp`;
  };

  const handleCopyUniversal = async () => {
    try {
      await navigator.clipboard.writeText(getUniversalWebhookUrl());
      setCopiedUniversal(true);
      setTimeout(() => setCopiedUniversal(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyUserUrl = async () => {
    try {
      await navigator.clipboard.writeText(getUserWebhookUrl());
      setCopiedUserUrl(true);
      setTimeout(() => setCopiedUserUrl(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopySql = async () => {
    const sql = `-- Tabel Verifikasi Bukti Pembayaran WhatsApp
CREATE TABLE IF NOT EXISTS payment_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  sender_phone TEXT NOT NULL,
  sender_name TEXT,
  message_text TEXT,
  proof_image_url TEXT NOT NULL,
  bulan TEXT,
  tahun INT,
  nominal NUMERIC DEFAULT 0,
  tanggal_transfer DATE,
  waktu_transfer TEXT,
  bank_pengirim TEXT,
  bank_tujuan TEXT,
  nama_rekening_pengirim TEXT,
  confidence_notes TEXT,
  status TEXT DEFAULT 'pending',
  reject_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin kelola bukti pembayaran" 
ON payment_verifications FOR ALL 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Webhook publik simpan bukti pembayaran" ON payment_verifications;
CREATE POLICY "Webhook publik simpan bukti pembayaran" 
ON payment_verifications FOR INSERT 
TO public
WITH CHECK (true);`;

    try {
      await navigator.clipboard.writeText(sql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    const res = await saveWhatsAppGatewayConfig(config, currentUserId);
    setIsSaving(false);

    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setSaveError(res.error || 'Gagal menyimpan pengaturan.');
    }
  };

  const handleTestSend = async () => {
    if (!config.appkey || !config.authkey) {
      alert('Silakan isi App Key dan Auth Key terlebih dahulu.');
      return;
    }
    if (!testNumber) {
      alert('Masukkan nomor WhatsApp tujuan uji coba (contoh: 6281234567890).');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await sendWhatsAppMessage({
      apiUrl: config.apiUrl,
      appkey: config.appkey,
      authkey: config.authkey,
      to: testNumber,
      message: testMessage
    });

    setIsTesting(false);

    if (result.success) {
      setTestResult({
        success: true,
        text: 'Pesan uji coba berhasil dikirim! Periksa WhatsApp pada nomor tujuan.'
      });
    } else {
      setTestResult({
        success: false,
        text: 'Gagal mengirim pesan: ' + (result.error || 'Periksa kembali App Key, Auth Key, atau API URL.')
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden font-sans">
      <div className="p-6 md:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Integrasi WhatsApp Gateway & Inbound Webhook
              </h3>
              <p className="text-xs text-slate-500">
                Hubungkan gateway WhatsApp untuk kirim notifikasi dan terima bukti transfer otomatis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
              config.appkey && config.authkey
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${config.appkey && config.authkey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              {config.appkey && config.authkey ? 'Kunci Terkonfigurasi' : 'Belum Terhubung'}
            </span>
          </div>
        </div>

        {/* Webhook Status Bar Banner */}
        <WebhookStatusBar mode="banner" currentUserId={currentUserId} />

        {/* Form Inputs for App Key and Auth Key */}
        <form onSubmit={handleSave} className="space-y-5">
          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2 animate-in fade-in duration-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Pengaturan WhatsApp Gateway berhasil disimpan!</span>
            </div>
          )}

          {saveError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* App Key */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-500" />
                <span>App Key (`appkey`) *</span>
              </label>
              <input
                type="text"
                value={config.appkey}
                onChange={e => setConfig({ ...config, appkey: e.target.value })}
                placeholder="Contoh: ba1b3d5d-0d98-4ac8-8959-..."
                required
                className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 bg-slate-50/50"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Diambil dari dokumentasi atau menu Device / API Key di provider WhatsApp Anda.
              </p>
            </div>

            {/* Auth Key */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                <span>Auth Key (`authkey`) *</span>
              </label>
              <input
                type="text"
                value={config.authkey}
                onChange={e => setConfig({ ...config, authkey: e.target.value })}
                placeholder="Contoh: pQ2CQCAGl8YLXSLml9Pi..."
                required
                className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 bg-slate-50/50"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Kunci autentikasi rahasia untuk otorisasi pengiriman pesan.
              </p>
            </div>
          </div>

          {/* API URL Gateway (Customizable) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <span>Endpoint API Pengiriman (URL cUrl)</span>
            </label>
            <input
              type="text"
              value={config.apiUrl}
              onChange={e => setConfig({ ...config, apiUrl: e.target.value })}
              placeholder="https://app.starsender.online/api/sendText"
              className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              URL endpoint target dari dokumentasi provider Anda (sesuai perintah cUrl pada foto).
            </p>
          </div>

          {/* Inbound Webhook Universal URL Display (Box) */}
          <div className="space-y-3">
            {/* Box 1: Universal Webhook (Primary Recommendation) */}
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2 border border-emerald-500/30 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-400 text-slate-950">
                    Universal
                  </span>
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>Alamat Webhook Universal (Rekomendasi Utama)</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUniversal}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  {copiedUniversal ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUniversal ? 'Tersalin!' : 'Salin Webhook Universal'}</span>
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-black/50 border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all font-semibold">
                {getUniversalWebhookUrl()}
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">
                👉 <b>Cara Pakai:</b> Buka dashboard provider WhatsApp Anda (Starsender, Fonnte, Wablas, UltraMsg, W-API, dll.), cari menu <b>Webhook</b> / <b>Device Settings</b>, lalu tempelkan URL di atas. Setiap ada pesan / foto struk transfer dari orang tua, provider akan otomatis meneruskannya dan sistem langsung mencocokkan siswa!
              </p>
            </div>

            {/* Box 2: User-Specific Webhook URL (Alternative / Multi-Admin) */}
            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-500" />
                  <span>Alamat Webhook Spesifik Akun (Alternatif Multi-User)</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyUserUrl}
                  className="px-2.5 py-1 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  {copiedUserUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUserUrl ? 'Tersalin!' : 'Salin URL Spesifik'}</span>
                </button>
              </div>

              <div className="p-2 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-600 break-all select-all">
                {getUserWebhookUrl()}
              </div>

              <p className="text-[10px] text-slate-500">
                Gunakan URL ini jika Anda mengelola beberapa instansi/sekolah dalam satu server dan ingin mengikat webhook secara eksplisit ke akun admin ini.
              </p>
            </div>
          </div>

          {/* Auto-Reply Settings */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoReplyEnabled}
                  onChange={e => setConfig({ ...config, autoReplyEnabled: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Kirim Pesan Balasan Otomatis Saat Bukti Masuk (Auto-Reply)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">Instan</span>
            </div>

            {config.autoReplyEnabled && (
              <div>
                <textarea
                  rows={2}
                  value={config.autoReplyMessage || ''}
                  onChange={e => setConfig({ ...config, autoReplyMessage: e.target.value })}
                  placeholder="Isi pesan balasan otomatis..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Pesan ini akan dikirim otomatis ke WhatsApp orang tua seketika struk mereka masuk ke sistem.
                </p>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Kunci Gateway'}</span>
            </button>
          </div>
        </form>

        <hr className="border-slate-100" />

        {/* Test Send Section */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-indigo-500" />
            <span>Tes Kirim Pesan WhatsApp</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Nomor Tujuan (Awalan 62)
              </label>
              <input
                type="text"
                value={testNumber}
                onChange={e => setTestNumber(e.target.value)}
                placeholder="Contoh: 628123456789"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Teks Uji Coba
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={handleTestSend}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isTesting ? 'Mengirim...' : 'Tes Kirim'}</span>
                </button>
              </div>
            </div>
          </div>

          {testResult && (
            <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
              testResult.success 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{testResult.text}</span>
            </div>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* Supabase SQL Setup Accordion */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSqlGuide(!showSqlGuide)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">
                Skrip SQL Tabel `payment_verifications` Supabase (Opsional)
              </span>
            </div>
            {showSqlGuide ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showSqlGuide && (
            <div className="p-4 border-t border-slate-200 bg-white space-y-3">
              <p className="text-xs text-slate-600">
                Sistem Catatoh otomatis menyimpan bukti pembayaran di server dan cache lokal. Namun untuk menyimpan riwayat bukti transfer secara permanen di database Cloud Supabase Anda, jalankan skrip SQL ini di menu <b>SQL Editor</b> Supabase Anda:
              </p>
              
              <div className="relative">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="absolute top-2 right-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSql ? 'Tersalin!' : 'Salin SQL'}</span>
                </button>
                <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed">
{`CREATE TABLE IF NOT EXISTS payment_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  sender_phone TEXT NOT NULL,
  sender_name TEXT,
  message_text TEXT,
  proof_image_url TEXT NOT NULL,
  bulan TEXT,
  tahun INT,
  nominal NUMERIC DEFAULT 0,
  tanggal_transfer DATE,
  waktu_transfer TEXT,
  bank_pengirim TEXT,
  bank_tujuan TEXT,
  nama_rekening_pengirim TEXT,
  confidence_notes TEXT,
  status TEXT DEFAULT 'pending',
  reject_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin kelola bukti pembayaran" 
ON payment_verifications FOR ALL 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Webhook publik simpan bukti pembayaran" ON payment_verifications;
CREATE POLICY "Webhook publik simpan bukti pembayaran" 
ON payment_verifications FOR INSERT 
TO public
WITH CHECK (true);`}
                </pre>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
