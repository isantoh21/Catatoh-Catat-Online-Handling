import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  QrCode, 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle, 
  Power, 
  Wifi, 
  ShieldCheck, 
  Smartphone,
  Send,
  Link,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react';

interface WahaConnectProps {
  functionUrl?: string;
  onStatusChange?: (status: string) => void;
  className?: string;
}

interface WahaSessionResponse {
  name?: string;
  status?: string;
  me?: {
    id?: string;
    pushName?: string;
  } | null;
  config?: any;
  engine?: any;
  error?: string;
  message?: string;
}

const DEFAULT_FUNCTION_URL = 'https://lzvrhtaewonmpsaiezai.supabase.co/functions/v1/waha-proxy';

export const WahaConnect: React.FC<WahaConnectProps> = ({
  functionUrl = DEFAULT_FUNCTION_URL,
  onStatusChange,
  className = '',
}) => {
  const [status, setStatus] = useState<string>('IDLE');
  const [sessionData, setSessionData] = useState<WahaSessionResponse | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Inbound Webhook State
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isSavingWebhook, setIsSavingWebhook] = useState<boolean>(false);
  const [webhookSuccess, setWebhookSuccess] = useState<boolean>(false);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);

  // Outbound Test Message State
  const [testNumber, setTestNumber] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>('Halo, ini adalah pesan uji coba dari WAHA WhatsApp VPS Catatoh!');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; text: string } | null>(null);
  const [showTools, setShowTools] = useState<boolean>(false);

  // References for polling interval & blob URL cleanup
  const pollTimerRef = useRef<number | null>(null);
  const prevBlobUrlRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Auto set default webhook url based on current domain
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const defaultUrl = `${window.location.origin}/api/webhook/whatsapp`;
      setWebhookUrl(defaultUrl);
    }
  }, []);

  // Helper to cleanup QR blob object URLs
  const updateQrImage = (blob: Blob) => {
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(blob);
    prevBlobUrlRef.current = objectUrl;
    setQrImageUrl(objectUrl);
  };

  const clearQrImage = () => {
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
      prevBlobUrlRef.current = null;
    }
    setQrImageUrl(null);
  };

  // Fetch status and QR code if needed
  const checkStatus = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${functionUrl}?action=status`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const msg = errorData?.message || `HTTP ${res.status}: Gagal mengecek status session`;
        console.warn('Waha status response error:', msg);
        if (isMountedRef.current) {
          setErrorMessage(msg);
        }
        return null;
      }

      const data: WahaSessionResponse = await res.json();
      if (!isMountedRef.current) return null;

      const currentStatus = data.status || 'UNKNOWN';
      setStatus(currentStatus);
      setSessionData(data);
      setLastChecked(new Date());
      setErrorMessage(null);
      onStatusChange?.(currentStatus);

      // If status is SCAN_QR_CODE, fetch latest QR image
      if (currentStatus === 'SCAN_QR_CODE') {
        try {
          const qrRes = await fetch(`${functionUrl}?action=qr&_t=${Date.now()}`);
          if (qrRes.ok) {
            const blob = await qrRes.blob();
            if (isMountedRef.current) {
              updateQrImage(blob);
            }
          } else {
            console.warn('Gagal memuat QR image, HTTP', qrRes.status);
          }
        } catch (qrErr: any) {
          console.warn('Error fetching QR image:', qrErr);
        }
      } else {
        clearQrImage();
      }

      // If already connected (WORKING), stop polling
      if (currentStatus === 'WORKING') {
        setIsPolling(false);
      }

      return currentStatus;
    } catch (err: any) {
      if (isMountedRef.current) {
        setErrorMessage(err?.message || 'Gagal tersambung ke Edge Function');
      }
      return null;
    }
  }, [functionUrl, onStatusChange]);

  // Handle Start / Restart Connection
  const handleStart = async (forceRestart = false) => {
    setIsStarting(true);
    setErrorMessage(null);
    clearQrImage();
    setStatus('STARTING');

    try {
      const actionName = (forceRestart || status === 'FAILED') ? 'restart' : 'start';
      const res = await fetch(`${functionUrl}?action=${actionName}`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || `Gagal memulai session (HTTP ${res.status})`);
      }

      setIsPolling(true);
      await checkStatus();
    } catch (err: any) {
      if (isMountedRef.current) {
        setErrorMessage(err?.message || 'Terjadi kesalahan saat memulai koneksi WhatsApp');
        setStatus('FAILED');
      }
    } finally {
      if (isMountedRef.current) {
        setIsStarting(false);
      }
    }
  };

  // Handle Save Inbound Webhook to WAHA
  const handleSaveWebhook = async () => {
    if (!webhookUrl) return;
    setIsSavingWebhook(true);
    setWebhookSuccess(false);

    try {
      const res = await fetch(`${functionUrl}?action=setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl.trim() }),
      });

      if (res.ok) {
        setWebhookSuccess(true);
        setTimeout(() => setWebhookSuccess(false), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Gagal menerapkan webhook ke WAHA');
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Gagal menyimpan webhook'));
    } finally {
      setIsSavingWebhook(false);
    }
  };

  // Handle Outbound Test Send
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testNumber) {
      alert('Silakan masukkan nomor WhatsApp tujuan uji coba.');
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch(`${functionUrl}?action=sendText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testNumber.trim(),
          message: testMessage.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          text: 'Pesan uji coba berhasil dikirim langsung via WAHA VPS! Periksa chat pada nomor tujuan.',
        });
      } else {
        setTestResult({
          success: false,
          text: 'Gagal mengirim pesan: ' + (data?.error || data?.data?.message || 'Pastikan WhatsApp sudah terhubung (status WORKING).'),
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        text: 'Error koneksi: ' + (err?.message || 'Tidak dapat menghubungi server WAHA'),
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch (_) {}
  };

  // Manage polling interval (2.5 seconds)
  useEffect(() => {
    if (isPolling) {
      pollTimerRef.current = window.setInterval(() => {
        checkStatus();
      }, 2500);
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isPolling, checkStatus]);

  // Initial check on mount
  useEffect(() => {
    isMountedRef.current = true;
    checkStatus();

    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
      }
    };
  }, [checkStatus]);

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden font-sans ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">
                Koneksi WhatsApp (WAHA)
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Inbound & Outbound Aktif
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Hubungkan nomor WhatsApp sekolah ke engine WAHA VPS untuk notifikasi keluar dan terima bukti bayar otomatis
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {status === 'WORKING' && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>WhatsApp Terhubung</span>
            </span>
          )}
          {status === 'SCAN_QR_CODE' && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Menunggu Scan QR</span>
            </span>
          )}
          {status === 'STARTING' && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Memulai Sesi...</span>
            </span>
          )}
          {(status === 'STOPPED' || status === 'IDLE' || status === 'FAILED' || status === 'UNKNOWN') && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Belum Terhubung ({status === 'FAILED' ? 'Expired' : status})</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="p-6 md:p-8 space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Koneksi Bermasalah</p>
              <p className="mt-0.5 text-rose-600">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Working Connected View */}
        {status === 'WORKING' && (
          <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-200/80 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-emerald-950">
                  WhatsApp sudah terhubung
                </h4>
                <p className="text-xs text-emerald-800/80">
                  Sesi WhatsApp (default) aktif di VPS. Notifikasi keluar dan penerima bukti transfer siap beroperasi.
                </p>
              </div>
            </div>

            {sessionData?.me && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-emerald-200/60 text-xs">
                <div className="bg-white/70 p-3 rounded-xl border border-emerald-100">
                  <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                    Nomor WhatsApp Terhubung
                  </span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {sessionData.me.id?.replace('@c.us', '') || '-'}
                  </span>
                </div>
                <div className="bg-white/70 p-3 rounded-xl border border-emerald-100">
                  <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                    Nama Akun WhatsApp
                  </span>
                  <span className="font-bold text-slate-800 text-sm">
                    {sessionData.me.pushName || 'WhatsApp User'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Proxy aman via Supabase Edge Function
              </span>
              <button
                type="button"
                onClick={checkStatus}
                className="px-3.5 py-1.5 text-xs font-bold text-emerald-700 bg-white hover:bg-emerald-100/60 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Cek Ulang Status</span>
              </button>
            </div>
          </div>
        )}

        {/* Scan QR View */}
        {status === 'SCAN_QR_CODE' && (
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50/70 border border-dashed border-slate-300 rounded-2xl space-y-4 text-center">
            <div className="max-w-md space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 mb-2">
                <QrCode className="w-3.5 h-3.5 text-amber-600" />
                Pindai Kode QR WhatsApp
              </span>
              <h4 className="text-sm font-bold text-slate-800">
                Buka WhatsApp di Ponsel Anda
              </h4>
              <p className="text-xs text-slate-500">
                Masuk ke <b>Menu ⋮ &gt; Perangkat Tertaut (Linked Devices) &gt; Tautkan Perangkat</b>, lalu arahkan kamera ke kode QR berikut.
              </p>
            </div>

            {/* QR Image Container */}
            <div className="relative p-4 bg-white rounded-2xl shadow-md border border-slate-200">
              {qrImageUrl ? (
                <div className="relative group">
                  <img
                    src={qrImageUrl}
                    alt="WAHA WhatsApp QR Code"
                    className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-xl"
                  />
                  <div className="absolute top-2 right-2">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-64 h-64 sm:w-72 sm:h-72 flex flex-col items-center justify-center bg-slate-100 rounded-xl space-y-2 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
                  <span className="text-xs font-medium">Memuat kode QR...</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
              <span>Kode QR dan status diperbarui otomatis setiap 2.5 detik</span>
            </div>
          </div>
        )}

        {/* Not Connected / Idle / Stopped / Failed View */}
        {status !== 'WORKING' && status !== 'SCAN_QR_CODE' && (
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Wifi className="w-4 h-4 text-slate-500" />
                Status Sesi: {status === 'IDLE' ? 'Siap Dihubungkan' : status === 'FAILED' ? 'Sesi Terhenti / Expired' : status}
              </h4>
              <p className="text-xs text-slate-500 max-w-lg">
                {status === 'FAILED' 
                  ? 'Sesi sebelumnya terhenti atau batas waktu scan QR telah habis. Klik tombol di samping untuk me-restart sesi dan memunculkan kode QR baru.' 
                  : 'Klik tombol di samping untuk menginisiasi sesi WAHA di server VPS Anda dan menampilkan kode QR untuk ditautkan.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleStart(status === 'FAILED')}
              disabled={isStarting}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all shrink-0 ${
                isStarting
                  ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                  : status === 'FAILED'
                    ? 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white shadow-amber-500/25'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-emerald-500/25'
              }`}
            >
              {isStarting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memulai...</span>
                </>
              ) : status === 'FAILED' ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Mulai Ulang (Restart) Sesi</span>
                </>
              ) : (
                <>
                  <Power className="w-4 h-4" />
                  <span>Mulai Koneksi</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Collapsible Tooling: Webhook Inbound & Tes Outbound */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTools(!showTools)}
            className="w-full px-5 py-3.5 bg-slate-50/70 hover:bg-slate-100/70 transition-colors flex items-center justify-between text-left text-xs font-bold text-slate-700"
          >
            <div className="flex items-center gap-2">
              <Link className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan Inbound Webhook & Uji Coba Kirim Pesan (Outbound)</span>
            </div>
            {showTools ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showTools && (
            <div className="p-6 space-y-6 bg-white border-t border-slate-100">
              {/* Inbound Webhook Configuration */}
              <div className="space-y-3">
                <div>
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Link className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Inbound Webhook URL (Penerima Bukti Bayar)</span>
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    URL endpoint aplikasi tempat WAHA mengirimkan event chat dan gambar transfer masuk secara otomatis.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://domain-anda.com/api/webhook/whatsapp"
                    className="flex-1 px-3.5 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWebhook ? 'Tersalin' : 'Salin'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveWebhook}
                    disabled={isSavingWebhook}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isSavingWebhook ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Terapkan ke WAHA</span>
                  </button>
                </div>

                {webhookSuccess && (
                  <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Webhook berhasil didaftarkan ke sesi WAHA VPS Anda!
                  </p>
                )}
              </div>

              {/* Outbound Test Message */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div>
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tes Kirim Pesan WhatsApp (Outbound)</span>
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Uji coba langsung pengiriman pesan dari nomor WhatsApp Anda via WAHA VPS ke nomor ponsel tertentu.
                  </p>
                </div>

                <form onSubmit={handleSendTest} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Nomor HP Tujuan (Contoh: 08123456789)
                      </label>
                      <input
                        type="text"
                        value={testNumber}
                        onChange={(e) => setTestNumber(e.target.value)}
                        placeholder="08123456789"
                        required
                        className="w-full px-3.5 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Isi Pesan
                      </label>
                      <input
                        type="text"
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="submit"
                      disabled={isSendingTest || status !== 'WORKING'}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                        status === 'WORKING' && !isSendingTest
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isSendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>{isSendingTest ? 'Mengirim...' : 'Kirim Pesan Uji Coba'}</span>
                    </button>
                    {status !== 'WORKING' && (
                      <span className="text-[11px] text-amber-600 font-medium">
                        * Hubungkan WhatsApp terlebih dahulu untuk uji coba kirim
                      </span>
                    )}
                  </div>

                  {testResult && (
                    <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold'
                        : 'bg-rose-50 border border-rose-200 text-rose-700 font-bold'
                    }`}>
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                      <span>{testResult.text}</span>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info & Diagnostics */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>Target Proxy:</span>
            <code className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono">
              /functions/v1/waha-proxy
            </code>
          </div>

          <div className="flex items-center gap-3">
            {lastChecked && (
              <span>Diperiksa: {lastChecked.toLocaleTimeString('id-ID')}</span>
            )}
            {status === 'SCAN_QR_CODE' && (
              <button
                type="button"
                onClick={() => handleStart(true)}
                className="text-emerald-600 hover:underline font-bold"
              >
                Muat Ulang Sesi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WahaConnect;
