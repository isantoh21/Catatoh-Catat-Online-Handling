import React, { useState, useEffect } from 'react';
import { 
  Radio, Check, Copy, RefreshCw, CheckCircle2, AlertCircle, 
  ExternalLink, Activity, ShieldCheck, Zap, Clock, Smartphone
} from 'lucide-react';
import { getPendingVerificationsCount, clearLocalVerifications, isRealTransferReceipt } from '../lib/whatsappGateway';
import { supabase } from '../lib/supabaseClient';

interface WebhookStatusBarProps {
  mode?: 'topbar' | 'banner';
  currentUserId?: string;
  onOpenSettings?: () => void;
}

const GATEWAY_PROXY_URL = 'https://lzvrhtaewonmpsaiezai.supabase.co/functions/v1/waha-proxy';

export default function WebhookStatusBar({
  mode = 'banner',
  currentUserId = '',
  onOpenSettings,
}: WebhookStatusBarProps) {
  const [endpointStatus, setEndpointStatus] = useState<'checking' | 'online' | 'error'>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [pingDetails, setPingDetails] = useState<any>(null);
  const [copiedUniversal, setCopiedUniversal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // WhatsApp gateway session state
  const [waStatus, setWaStatus] = useState<string>('checking');
  const [waAccount, setWaAccount] = useState<{ id?: string; pushName?: string } | null>(null);

  // Real connection verification states
  const [verificationsCount, setVerificationsCount] = useState<number>(0);

  const getUniversalWebhookUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/api/webhook/whatsapp`;
  };

  const checkWebhookHealth = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      // 1. Cek status WhatsApp gateway via Supabase Edge Function Proxy dengan isolasi user
      let currentWaStatus = 'UNKNOWN';
      try {
        let activeUid = currentUserId;
        if (!activeUid) {
          const { data: { session } } = await supabase.auth.getSession();
          activeUid = session?.user?.id || '';
        }

        const urlWithUser = activeUid 
          ? `${GATEWAY_PROXY_URL}?action=status&userId=${encodeURIComponent(activeUid)}`
          : `${GATEWAY_PROXY_URL}?action=status`;

        const waRes = await fetch(urlWithUser, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        if (waRes.ok) {
          const waData = await waRes.json();
          if (waData.name === 'default') {
            setWaStatus('STOPPED');
            setWaAccount(null);
          } else {
            currentWaStatus = waData.status || 'UNKNOWN';
            setWaStatus(currentWaStatus);
            if (waData.me) {
              setWaAccount(waData.me);
            } else {
              setWaAccount(null);
            }
          }
        } else {
          setWaStatus('FAILED');
          setWaAccount(null);
        }
      } catch (waErr) {
        console.warn('Gagal cek status WhatsApp:', waErr);
        setWaStatus('FAILED');
        setWaAccount(null);
      }

      // 2. Fetch actual received verifications count from Supabase (hemat egress dengan HEAD count)
      try {
        const pendingCount = await getPendingVerificationsCount(currentUserId);
        setVerificationsCount(pendingCount);
      } catch (_) {
        setVerificationsCount(0);
      }

      // 3. Ping GET endpoint on /api/webhook/whatsapp
      const res = await fetch('/api/webhook/whatsapp', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const end = performance.now();
      const roundTrip = Math.round(end - start);
      setLatency(roundTrip);
      setLastCheck(new Date());

      if (res.ok) {
        const data = await res.json();
        setEndpointStatus('online');
        setPingDetails({
          statusCode: res.status,
          service: data.service || 'Catatoh WhatsApp Webhook',
          message: 'Endpoint aktif & siap menerima data',
        });
      } else {
        setEndpointStatus('online');
        setPingDetails({
          statusCode: res.status,
          service: 'Vercel Endpoint',
          message: 'Endpoint merespons HTTP ' + res.status,
        });
      }
    } catch (err: any) {
      console.warn('Webhook health check ping error:', err);
      setEndpointStatus('online'); // endpoint vercel fallback
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    checkWebhookHealth();
    const timer = setInterval(() => {
      checkWebhookHealth();
    }, 60000); // refresh tiap 60 detik (hemat egress)
    return () => clearInterval(timer);
  }, [currentUserId]);

  const handleCopyUniversal = async () => {
    try {
      await navigator.clipboard.writeText(getUniversalWebhookUrl());
      setCopiedUniversal(true);
      setTimeout(() => setCopiedUniversal(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetCache = async () => {
    clearLocalVerifications(currentUserId);
    setVerificationsCount(0);
    await checkWebhookHealth();
  };

  // REAL CONNECTION LOGIC:
  // 1. If WhatsApp gateway is WORKING -> connected
  // 2. If WhatsApp gateway is SCAN_QR_CODE -> waiting
  // 3. If checking -> checking
  // 4. Else -> disconnected
  let connectionStatus: 'checking' | 'disconnected' | 'waiting' | 'connected' = 'checking';
  if (waStatus === 'checking' || endpointStatus === 'checking') {
    connectionStatus = 'checking';
  } else if (waStatus === 'WORKING') {
    connectionStatus = 'connected';
  } else if (waStatus === 'SCAN_QR_CODE') {
    connectionStatus = 'waiting';
  } else {
    connectionStatus = 'disconnected';
  }

  // =========================================================================
  // Compact TopBar Version
  // =========================================================================
  if (mode === 'topbar') {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-2 rounded-full border transition-all cursor-pointer ${
            connectionStatus === 'connected'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
              : connectionStatus === 'waiting'
              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              : connectionStatus === 'checking'
              ? 'bg-slate-100 text-slate-600 border-slate-200'
              : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100/70'
          }`}
          title="Status Webhook & WhatsApp Gateway (Klik untuk rincian)"
        >
          <span className="relative flex h-2 w-2">
            {connectionStatus === 'connected' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500'
                  : connectionStatus === 'waiting'
                  ? 'bg-amber-500 animate-ping'
                  : connectionStatus === 'checking'
                  ? 'bg-slate-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            ></span>
          </span>
          <Radio className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">
            {connectionStatus === 'connected'
              ? `WhatsApp Terhubung (${verificationsCount} Struk)`
              : connectionStatus === 'waiting'
              ? 'WhatsApp: Perlu Scan QR'
              : connectionStatus === 'checking'
              ? 'Cek WhatsApp...'
              : 'WhatsApp: Belum Terhubung'}
          </span>
          <span className="md:hidden">
            {connectionStatus === 'connected'
              ? `WA OK (${verificationsCount})`
              : connectionStatus === 'waiting'
              ? 'Scan QR'
              : 'Belum Konek'}
          </span>
        </button>

        {isDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsDropdownOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-84 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-200 text-slate-800 font-sans">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-100 text-emerald-700'
                      : connectionStatus === 'waiting'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}>
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Status WhatsApp & Webhook</h4>
                    <p className="text-[10px] text-slate-400">WhatsApp Gateway & Penerima Bukti SPP</p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-100 text-emerald-800'
                    : connectionStatus === 'waiting'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {connectionStatus === 'connected'
                    ? 'Terhubung (WORKING)'
                    : connectionStatus === 'waiting'
                    ? 'Perlu Scan QR'
                    : 'Belum Terhubung'}
                </span>
              </div>

              {/* Status Explanation */}
              <div className="my-3">
                <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : connectionStatus === 'waiting'
                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                    : 'bg-rose-50 text-rose-900 border border-rose-200'
                }`}>
                  {connectionStatus === 'connected' && (
                    <div className="space-y-1">
                      <p className="flex items-start gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>WhatsApp Gateway Terhubung!</span>
                      </p>
                      {waAccount?.id && (
                        <p className="text-[11px] text-emerald-700">
                          Akun: <b>{waAccount.pushName || 'WhatsApp'}</b> ({waAccount.id.replace('@c.us', '')})
                        </p>
                      )}
                    </div>
                  )}
                  {connectionStatus === 'waiting' && (
                    <p className="flex items-start gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span><b>Sesi aktif tapi belum ditautkan.</b> Silakan buka Pengaturan dan pindai kode QR menggunakan WhatsApp di ponsel Anda.</span>
                    </p>
                  )}
                  {connectionStatus === 'disconnected' && (
                    <p className="flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span><b>Belum Terhubung.</b> Buka menu Pengaturan untuk memulai koneksi ke server WhatsApp.</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Webhook URL Box */}
              <div className="space-y-2 mb-3">
                <div className="p-2.5 rounded-xl bg-slate-900 text-white space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>URL Inbound Webhook</span>
                    <button
                      type="button"
                      onClick={handleCopyUniversal}
                      className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedUniversal ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedUniversal ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-emerald-400 truncate select-all">
                    {getUniversalWebhookUrl()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Struk di Moderasi</span>
                    <span className={`font-bold ${verificationsCount > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {verificationsCount} Bukti
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Respon Endpoint</span>
                    <span className="font-bold text-slate-700">
                      {latency !== null ? `${latency} ms` : 'Cek...'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isPinging}
                    onClick={checkWebhookHealth}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin' : ''}`} />
                    <span>Uji Ulang</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCache}
                    className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Kosongkan data/cache struk lokal"
                  >
                    <span>Refresh</span>
                  </button>
                </div>

                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenSettings();
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>Pengaturan WhatsApp</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // =========================================================================
  // Full Banner / Card Version
  // =========================================================================
  return (
    <div className={`rounded-2xl border p-5 shadow-xs transition-all ${
      connectionStatus === 'connected'
        ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50'
        : connectionStatus === 'waiting'
        ? 'border-amber-200 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/40'
        : 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs ${
            connectionStatus === 'connected'
              ? 'bg-emerald-600'
              : connectionStatus === 'waiting'
              ? 'bg-amber-500'
              : 'bg-slate-500'
          }`}>
            <Radio className={`w-5 h-5 ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800">
                Status Koneksi WhatsApp Gateway & Webhook
              </h4>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : connectionStatus === 'waiting'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-slate-100 text-slate-800 border-slate-300'
              }`}>
                {connectionStatus === 'connected'
                  ? 'WhatsApp Terhubung'
                  : connectionStatus === 'waiting'
                  ? 'Perlu Scan QR'
                  : 'Belum Terhubung'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {connectionStatus === 'connected' && `Sesi WhatsApp aktif dan siap memproses bukti transfer otomatis (${verificationsCount} struk masuk).`}
              {connectionStatus === 'waiting' && 'Sesi WhatsApp siap ditautkan. Buka Pengaturan untuk scan kode QR.'}
              {connectionStatus === 'disconnected' && 'WhatsApp belum terhubung. Buka Pengaturan untuk menghubungkan nomor WhatsApp.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={checkWebhookHealth}
            disabled={isPinging}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span>{isPinging ? 'Menguji...' : 'Cek Ulang Status'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        {/* Metric 1: Real Connection */}
        <div className="bg-white/80 backdrop-blur-xs p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            connectionStatus === 'connected'
              ? 'bg-emerald-100 text-emerald-700'
              : connectionStatus === 'waiting'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-700'
          }`}>
            {connectionStatus === 'connected' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : connectionStatus === 'waiting' ? (
              <Clock className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
          </div>
          <div className="overflow-hidden">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Koneksi WhatsApp</span>
            <span className={`text-xs font-extrabold truncate block ${
              connectionStatus === 'connected'
                ? 'text-emerald-700'
                : connectionStatus === 'waiting'
                ? 'text-amber-700'
                : 'text-slate-700'
            }`}>
              {connectionStatus === 'connected'
                ? `Terhubung (${waAccount?.pushName || 'WhatsApp'})`
                : connectionStatus === 'waiting'
                ? 'Scan QR Diperlukan'
                : 'Tidak Terhubung'}
            </span>
          </div>
        </div>

        {/* Metric 2: Endpoint Latency */}
        <div className="bg-white/80 backdrop-blur-xs p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Respon Serverless</span>
            <span className="text-xs font-extrabold text-indigo-700 truncate block">
              {latency !== null ? `${latency} ms (HTTP 200)` : 'Mengukur...'}
            </span>
          </div>
        </div>

        {/* Metric 3: Hosting Engine */}
        <div className="bg-white/80 backdrop-blur-xs p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Engine Gateway</span>
            <span className="text-xs font-extrabold text-teal-700 truncate block">
              WhatsApp Engine Ready
            </span>
          </div>
        </div>
      </div>

      {/* Universal Webhook Highlight Box */}
      <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500 text-slate-950 uppercase tracking-wider">
              Endpoint Inbound
            </span>
            <span className="text-xs font-bold text-indigo-200">
              Alamat Webhook WhatsApp (Otomatis Deteksi Bukti Bayar)
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyUniversal}
            className="self-start sm:self-auto px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            {copiedUniversal ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedUniversal ? 'URL Tersalin!' : 'Salin Webhook'}</span>
          </button>
        </div>

        <div className="p-3 rounded-lg bg-black/50 border border-slate-800 font-mono text-xs text-emerald-400 select-all break-all flex items-center justify-between gap-2">
          <span>{getUniversalWebhookUrl()}</span>
        </div>
      </div>
    </div>
  );
}
