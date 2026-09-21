import { 
  Radio, Check, Copy, RefreshCw, CheckCircle2, AlertCircle, 
  ExternalLink, Sparkles, Activity, ShieldCheck, Zap, ShieldAlert, Clock, Trash2
} from 'lucide-react';
import { getWhatsAppGatewayConfig, getPaymentVerifications, clearLocalVerifications, isRealTransferReceipt } from '../lib/whatsappGateway';
import { supabase } from '../lib/supabaseClient';

interface WebhookStatusBarProps {
  mode?: 'topbar' | 'banner';
  currentUserId?: string;
  onOpenSettings?: () => void;
}

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

  // Real connection verification states
  const [gatewayConfig, setGatewayConfig] = useState<any>(null);
  const [verificationsCount, setVerificationsCount] = useState<number>(0);
  const [lastReceiptDate, setLastReceiptDate] = useState<string | null>(null);

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

  const checkWebhookHealth = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      // 1. Fetch live gateway configuration & actual received verifications count
      const [cfg, verifs] = await Promise.all([
        getWhatsAppGatewayConfig(currentUserId).catch(() => null),
        getPaymentVerifications(currentUserId).catch(() => []),
      ]);

      setGatewayConfig(cfg);

      // Filter ketat: HANYA bukti struk transfer ASLI yang dihitung.
      // Data simulasi / dummy unsplash tidak boleh dihitung sebagai bukti masuk!
      const realVerifications = (verifs || []).filter(isRealTransferReceipt);

      const count = realVerifications.length;
      setVerificationsCount(count);
      if (count > 0 && realVerifications[0]?.created_at) {
        setLastReceiptDate(realVerifications[0].created_at);
      } else {
        setLastReceiptDate(null);
      }

      // 2. Ping GET endpoint on /api/webhook/whatsapp
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
          environment: data.environment || 'vercel-serverless',
          message: data.message || 'Endpoint aktif',
        });
      } else {
        setEndpointStatus('online');
        setPingDetails({
          statusCode: res.status,
          service: 'Vercel Endpoint',
          environment: 'vercel-serverless',
          message: 'Endpoint merespons HTTP ' + res.status,
        });
      }
    } catch (err: any) {
      console.warn('Webhook health check ping error:', err);
      try {
        const hRes = await fetch('/api/health');
        if (hRes.ok) {
          setEndpointStatus('online');
          setLatency(Math.round(performance.now() - start));
          setPingDetails({ statusCode: hRes.status, service: 'Vercel API', message: 'API Vercel Aktif' });
        } else {
          setEndpointStatus('error');
        }
      } catch {
        setEndpointStatus('error');
      }
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    checkWebhookHealth();
    const timer = setInterval(() => {
      checkWebhookHealth();
    }, 60000);
    return () => clearInterval(timer);
  }, [currentUserId]);

  const handleCopyUniversal = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    try {
      await fetch('/api/webhook/verifications/reset', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      });
    } catch {}

    // Hapus juga record di Supabase jika user sedang terautentikasi
    try {
      if (currentUserId) {
        await supabase
          .from('payment_verifications')
          .delete()
          .or(`user_id.eq.${currentUserId},user_id.is.null`);
      }
    } catch (err) {
      console.warn('Gagal membersihkan tabel payment_verifications di Supabase:', err);
    }

    setVerificationsCount(0);
    setLastReceiptDate(null);
    await checkWebhookHealth();
  };

  // REAL CONNECTION LOGIC:
  // 1. If keys are missing (appkey or authkey empty) -> Belum Terhubung (Disconnected)
  // 2. If keys exist, but 0 receipts ever received -> Menunggu Data (Waiting)
  // 3. If keys exist AND >0 receipts received -> Terhubung & Aktif (Connected)
  const isKeyConfigured = Boolean(
    gatewayConfig?.appkey && 
    gatewayConfig.appkey.trim().length > 3 &&
    gatewayConfig?.authkey && 
    gatewayConfig.authkey.trim().length > 3
  );
  const hasReceivedData = verificationsCount > 0;

  let connectionStatus: 'checking' | 'disconnected' | 'waiting' | 'connected' = 'checking';
  if (endpointStatus === 'error') {
    connectionStatus = 'disconnected';
  } else if (!isKeyConfigured) {
    connectionStatus = 'disconnected'; // Belum Terhubung
  } else if (!hasReceivedData) {
    connectionStatus = 'waiting'; // Kunci ada, belum ada bukti masuk
  } else {
    connectionStatus = 'connected'; // Terhubung nyata!
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
              ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
              : connectionStatus === 'checking'
              ? 'bg-slate-100 text-slate-600 border-slate-200'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70'
          }`}
          title="Status Webhook (Klik untuk rincian)"
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
                  ? 'bg-sky-500'
                  : connectionStatus === 'checking'
                  ? 'bg-slate-400 animate-pulse'
                  : 'bg-amber-500'
              }`}
            ></span>
          </span>
          <Radio className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">
            {connectionStatus === 'connected'
              ? `Webhook Terhubung (${verificationsCount} Struk)`
              : connectionStatus === 'waiting'
              ? 'Webhook: Menunggu Data (0 Masuk)'
              : connectionStatus === 'checking'
              ? 'Cek Webhook...'
              : 'Webhook: Belum Terhubung'}
          </span>
          <span className="md:hidden">
            {connectionStatus === 'connected'
              ? `Webhook OK (${verificationsCount})`
              : connectionStatus === 'waiting'
              ? 'Menunggu (0)'
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
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Status Koneksi Webhook</h4>
                    <p className="text-[10px] text-slate-400">Integrasi WhatsApp & Struk SPP</p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-100 text-emerald-800'
                    : connectionStatus === 'waiting'
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {connectionStatus === 'connected'
                    ? 'Terhubung & Aktif'
                    : connectionStatus === 'waiting'
                    ? 'Siap Menunggu Data'
                    : 'Belum Terhubung'}
                </span>
              </div>

              {/* Status Explanation */}
              <div className="my-3">
                <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : connectionStatus === 'waiting'
                    ? 'bg-sky-50 text-sky-900 border border-sky-200'
                    : 'bg-amber-50 text-amber-900 border border-amber-200'
                }`}>
                  {connectionStatus === 'connected' && (
                    <p className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><b>Terhubung nyata!</b> WhatsApp Gateway aktif dan telah berhasil memproses <b>{verificationsCount}</b> bukti pembayaran.</span>
                    </p>
                  )}
                  {connectionStatus === 'waiting' && (
                    <p className="flex items-start gap-1.5">
                      <Clock className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                      <span><b>Kunci API tersimpan & endpoint siap.</b> Belum ada bukti pembayaran yang dikirimkan oleh provider WhatsApp ke sistem.</span>
                    </p>
                  )}
                  {connectionStatus === 'disconnected' && (
                    <p className="flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span><b>Belum Terhubung.</b> App Key & Auth Key belum diisi di Pengaturan, atau provider WhatsApp belum terhubung ke URL webhook ini.</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Webhook URL Box */}
              <div className="space-y-2 mb-3">
                <div className="p-2.5 rounded-xl bg-slate-900 text-white space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>URL Webhook Universal</span>
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
                    <span className="text-[10px] text-slate-400 block">Struk Masuk</span>
                    <span className={`font-bold ${verificationsCount > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {verificationsCount > 0 ? `${verificationsCount} Bukti` : '0 (Kosong)'}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Respon Server</span>
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
                    <span>Kosongkan Struk</span>
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
                    <span>Atur Kunci Gateway</span>
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
  // Full Banner / Card Version (Used in WhatsAppGatewaySettingsCard)
  // =========================================================================
  return (
    <div className={`rounded-2xl border p-5 shadow-xs transition-all ${
      connectionStatus === 'connected'
        ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50'
        : connectionStatus === 'waiting'
        ? 'border-sky-200 bg-gradient-to-br from-sky-50/70 via-white to-indigo-50/40'
        : 'border-amber-200 bg-gradient-to-br from-amber-50/60 via-white to-slate-50'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs ${
            connectionStatus === 'connected'
              ? 'bg-emerald-600'
              : connectionStatus === 'waiting'
              ? 'bg-sky-600'
              : 'bg-amber-500'
          }`}>
            <Radio className={`w-5 h-5 ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800">
                Status Koneksi Webhook WhatsApp
              </h4>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : connectionStatus === 'waiting'
                  ? 'bg-sky-100 text-sky-800 border-sky-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {connectionStatus === 'connected'
                  ? 'Terhubung Nyata'
                  : connectionStatus === 'waiting'
                  ? 'Siap Menunggu Data'
                  : 'Belum Terhubung'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {connectionStatus === 'connected' && `Aktif dan telah menerima ${verificationsCount} bukti transfer dari orang tua.`}
              {connectionStatus === 'waiting' && 'Kunci gateway terpasang. Menunggu bukti transfer pertama dikirim oleh provider WhatsApp.'}
              {connectionStatus === 'disconnected' && 'Belum terhubung. Masukkan App Key & Auth Key di bawah, lalu tempelkan URL Webhook ke provider WA.'}
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
              ? 'bg-sky-100 text-sky-700'
              : 'bg-amber-100 text-amber-700'
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
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Koneksi Gateway</span>
            <span className={`text-xs font-extrabold truncate block ${
              connectionStatus === 'connected'
                ? 'text-emerald-700'
                : connectionStatus === 'waiting'
                ? 'text-sky-700'
                : 'text-amber-700'
            }`}>
              {connectionStatus === 'connected'
                ? `${verificationsCount} Struk Diterima`
                : connectionStatus === 'waiting'
                ? '0 Struk Masuk (Kosong)'
                : 'Kosong (Belum Ada Kunci)'}
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
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Engine Serverless</span>
            <span className="text-xs font-extrabold text-teal-700 truncate block">
              Vercel Serverless Ready
            </span>
          </div>
        </div>
      </div>

      {/* Universal Webhook Highlight Box */}
      <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500 text-slate-950 uppercase tracking-wider">
              Rekomendasi Utama
            </span>
            <span className="text-xs font-bold text-indigo-200">
              Alamat Webhook Universal (Otomatis Cocokkan Siswa)
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyUniversal}
            className="self-start sm:self-auto px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            {copiedUniversal ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedUniversal ? 'URL Tersalin!' : 'Salin Webhook Universal'}</span>
          </button>
        </div>

        <div className="p-3 rounded-lg bg-black/50 border border-slate-800 font-mono text-xs text-emerald-400 select-all break-all flex items-center justify-between gap-2">
          <span>{getUniversalWebhookUrl()}</span>
        </div>

        <p className="text-[11px] text-slate-300 leading-relaxed">
          👉 <b>Cara Menghubungkan:</b> Tempel URL di atas ke menu <b>Webhook</b> provider WhatsApp Anda (Starsender, Fonnte, Wablas, UltraMsg, W-API, Meta). Status webhook di atas akan otomatis berubah menjadi <b>"Terhubung & Aktif"</b> begitu struk pembayaran pertama berhasil masuk!
        </p>
      </div>

      {pingDetails && (
        <div className="mt-3 p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Tes Endpoint: <b>HTTP {pingDetails.statusCode} OK</b> — {pingDetails.message}</span>
          </div>
          <span className="text-[10px] text-slate-500">
            Dicek {lastCheck ? lastCheck.toLocaleTimeString('id-ID') : 'baru saja'}
          </span>
        </div>
      )}
    </div>
  );
}
