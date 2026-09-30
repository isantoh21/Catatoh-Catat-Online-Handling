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
  Check,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getWhatsAppGatewayConfig, saveWhatsAppGatewayConfig } from '../lib/whatsappGateway';

interface WhatsAppConnectProps {
  functionUrl?: string;
  onStatusChange?: (status: string) => void;
  className?: string;
  currentUserId?: string;
}

interface WhatsAppSessionResponse {
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

export const WhatsAppConnect: React.FC<WhatsAppConnectProps> = ({
  functionUrl = DEFAULT_FUNCTION_URL,
  onStatusChange,
  className = '',
  currentUserId: propUserId = '',
}) => {
  const [activeUserId, setActiveUserId] = useState<string>(propUserId);
  const [status, setStatus] = useState<string>('IDLE');
  const [sessionData, setSessionData] = useState<WhatsAppSessionResponse | null>(null);
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

  // Gemini AI Vision Key State
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [isSavingGeminiKey, setIsSavingGeminiKey] = useState<boolean>(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState<boolean>(false);

  // Outbound Test Message State
  const [testNumber, setTestNumber] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>('Halo, ini adalah pesan uji coba dari WhatsApp Gateway Catatoh!');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; text: string } | null>(null);
  const [showTools, setShowTools] = useState<boolean>(false);

  // References for polling interval & data URL stability
  const pollTimerRef = useRef<number | null>(null);
  const prevBlobUrlRef = useRef<string | null>(null);
  const prevBase64Ref = useRef<string | null>(null);
  const lastQrFetchTimeRef = useRef<number>(0);
  const isFetchingQrRef = useRef<boolean>(false);
  const [qrLoadError, setQrLoadError] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const hasAutoRegisteredWebhookRef = useRef<boolean>(false);

  // Ambil user ID aktif
  useEffect(() => {
    if (propUserId) {
      setActiveUserId(propUserId);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id && isMountedRef.current) {
          setActiveUserId(session.user.id);
        }
      });
    }
  }, [propUserId]);

  // Auto-register inbound webhook silently when WhatsApp is connected
  const registerWebhookSilently = useCallback(async (customUrl?: string) => {
    try {
      let uid = activeUserId;
      if (!uid && typeof window !== 'undefined') {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id || '';
      }

      let targetUrl = customUrl || webhookUrl;
      if (!targetUrl && typeof window !== 'undefined') {
        targetUrl = uid 
          ? `${window.location.origin}/api/webhook/whatsapp?userId=${uid}`
          : `${window.location.origin}/api/webhook/whatsapp`;
        if (isMountedRef.current) {
          setWebhookUrl(targetUrl);
        }
      }
      if (!targetUrl) return;

      const setUrl = uid
        ? `${functionUrl}?action=setWebhook&userId=${encodeURIComponent(uid)}`
        : `${functionUrl}?action=setWebhook`;

      const res = await fetch(setUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() }),
      });

      if (res.ok) {
        console.log('[AUTO-WEBHOOK] Inbound webhook otomatis berhasil didaftarkan:', targetUrl);
        if (isMountedRef.current) {
          setWebhookSuccess(true);
          setTimeout(() => {
            if (isMountedRef.current) setWebhookSuccess(false);
          }, 6000);
        }
      }
    } catch (err) {
      console.warn('[AUTO-WEBHOOK] Gagal silent webhook registration:', err);
    }
  }, [activeUserId, functionUrl, webhookUrl]);

  // Inisialisasi default webhook URL dari window.location
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const defaultWebhook = activeUserId
        ? `${window.location.origin}/api/webhook/whatsapp?userId=${activeUserId}`
        : `${window.location.origin}/api/webhook/whatsapp`;
      setWebhookUrl(defaultWebhook);
    }
  }, [activeUserId]);

  // Load konfigurasi gateway & gemini key dari user_settings Supabase
  useEffect(() => {
    const loadSettings = async () => {
      try {
        let uid = activeUserId;
        if (!uid) {
          const { data: { session } } = await supabase.auth.getSession();
          uid = session?.user?.id || '';
        }
        if (!uid) return;

        const { data: settings } = await supabase
          .from('user_settings')
          .select('gemini_api_key, whatsapp_inbound_url')
          .eq('user_id', uid)
          .maybeSingle();

        if (settings?.gemini_api_key && isMountedRef.current) {
          setGeminiApiKey(settings.gemini_api_key);
        }
        if (settings?.whatsapp_inbound_url && isMountedRef.current) {
          setWebhookUrl(settings.whatsapp_inbound_url);
        }
      } catch (err) {
        console.warn('Gagal memuat preferensi setting pengguna:', err);
      }
    };
    loadSettings();
  }, [activeUserId]);

  // Helper untuk membersihkan data URL & Object URL sebelumnya agar tidak memory leak
  const clearQrImage = () => {
    prevBase64Ref.current = null;
    lastQrFetchTimeRef.current = 0;
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
      prevBlobUrlRef.current = null;
    }
    if (isMountedRef.current) {
      setQrImageUrl(null);
      setQrLoadError(false);
    }
  };

  // 1. Fetch Session Status dari Proxy
  const fetchStatus = useCallback(async (): Promise<string | null> => {
    try {
      let uid = activeUserId;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id || '';
      }

      const statusUrl = uid
        ? `${functionUrl}?action=status&userId=${encodeURIComponent(uid)}`
        : `${functionUrl}?action=status`;

      const res = await fetch(statusUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const msg = errorData?.message || `HTTP ${res.status}: Gagal mengecek status session`;
        console.warn('Status response error:', msg);
        if (isMountedRef.current) {
          setErrorMessage(msg);
        }
        return null;
      }

      const data: WhatsAppSessionResponse = await res.json();
      if (!isMountedRef.current) return null;

      // Proteksi sesi: Jika mengembalikan sesi 'default' (milik website lain), jangan tampilkan
      if (data.name === 'default') {
        setStatus('STOPPED');
        setSessionData(null);
        clearQrImage();
        return 'STOPPED';
      }

      const currentStatus = data.status || 'UNKNOWN';
      setStatus(currentStatus);
      setSessionData(data);
      setLastChecked(new Date());
      setErrorMessage(null);

      if (onStatusChange) {
        onStatusChange(currentStatus);
      }

      // Jika WhatsApp sudah terhubung (WORKING), auto-set inbound webhook satu kali
      if (currentStatus === 'WORKING' && !hasAutoRegisteredWebhookRef.current) {
        hasAutoRegisteredWebhookRef.current = true;
        registerWebhookSilently();
      }

      return currentStatus;
    } catch (err: any) {
      if (isMountedRef.current) {
        console.warn('Gagal menghubungi proxy WhatsApp:', err);
        setErrorMessage(err.message || 'Tidak dapat terhubung ke server gateway');
      }
      return null;
    }
  }, [activeUserId, functionUrl, onStatusChange, registerWebhookSilently]);

  // 2. Fetch QR Code Image (Base64 / Data URL)
  const fetchQrCode = useCallback(async () => {
    if (isFetchingQrRef.current) return;
    isFetchingQrRef.current = true;

    try {
      let uid = activeUserId;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id || '';
      }

      // Gunakan query format=base64 agar menerima Data URL langsung tanpa masalah blob revocation
      const qrUrl = uid
        ? `${functionUrl}?action=qr&format=base64&userId=${encodeURIComponent(uid)}`
        : `${functionUrl}?action=qr&format=base64`;

      const res = await fetch(qrUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        if (errJson?.error === 'QR_NOT_READY') {
          console.log('[QR] Menunggu gateway siap menerbitkan QR...');
        } else {
          console.warn('[QR] Gagal fetch QR:', res.status, errJson);
        }
        return;
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const json = await res.json().catch(() => null);
        if (json?.success && json?.qrImageUrl && isMountedRef.current) {
          if (json.qrImageUrl !== prevBase64Ref.current) {
            prevBase64Ref.current = json.qrImageUrl;
            setQrImageUrl(json.qrImageUrl);
          }
          setQrLoadError(false);
          return;
        }
      }

      // Fallback: jika edge function mengembalikan raw image blob
      const blob = await res.blob();
      if (!isMountedRef.current || blob.size < 50) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        if (base64Url && isMountedRef.current) {
          if (base64Url !== prevBase64Ref.current) {
            prevBase64Ref.current = base64Url;
            setQrImageUrl(base64Url);
          }
          setQrLoadError(false);
        }
      };
      reader.readAsDataURL(blob);

    } catch (err) {
      console.warn('Gagal memuat gambar QR:', err);
    } finally {
      isFetchingQrRef.current = false;
    }
  }, [activeUserId, functionUrl]);

  // Polling loop saat status SCAN_QR_CODE atau STARTING
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    setIsPolling(true);

    const poll = async () => {
      if (!isMountedRef.current) return;
      const currentStatus = await fetchStatus();

      if (currentStatus === 'SCAN_QR_CODE') {
        const now = Date.now();
        // Ambil QR jika belum ada gambar, atau setiap 15 detik jika belum terscan
        if (!prevBase64Ref.current || (now - lastQrFetchTimeRef.current >= 15000)) {
          lastQrFetchTimeRef.current = now;
          await fetchQrCode();
        }
        if (isMountedRef.current) {
          pollTimerRef.current = window.setTimeout(poll, 2500);
        }
      } else if (currentStatus === 'STARTING') {
        if (isMountedRef.current) {
          pollTimerRef.current = window.setTimeout(poll, 2000);
        }
      } else {
        // Berhenti polling jika sudah WORKING, STOPPED, atau FAILED
        stopPolling();
        if (currentStatus === 'WORKING') {
          clearQrImage();
        }
      }
    };

    poll();
  }, [fetchStatus, fetchQrCode]);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (isMountedRef.current) {
      setIsPolling(false);
    }
  };

  // Initial load check
  useEffect(() => {
    isMountedRef.current = true;

    const init = async () => {
      const initialStatus = await fetchStatus();
      if (initialStatus === 'SCAN_QR_CODE' || initialStatus === 'STARTING') {
        startPolling();
      }
    };

    init();

    return () => {
      isMountedRef.current = false;
      stopPolling();
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
      }
    };
  }, [fetchStatus, startPolling]);

  // Handle Mulai Sesi (Start Session / Minta QR)
  const handleStart = async (forceReset = false) => {
    setIsStarting(true);
    setErrorMessage(null);
    setQrLoadError(false);
    clearQrImage();

    try {
      let uid = activeUserId;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id || '';
      }

      // Gunakan action restart jika user me-reset sesi agar credential lama dibersihkan dan sesi langsung dinyalakan
      const action = forceReset ? 'restart' : 'start';
      const startUrl = uid
        ? `${functionUrl}?action=${action}&userId=${encodeURIComponent(uid)}`
        : `${functionUrl}?action=${action}`;

      const res = await fetch(startUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok && !data.status) {
        throw new Error(data.message || data.error || 'Gagal memulai sesi WhatsApp');
      }

      setStatus(data.status || 'STARTING');
      lastQrFetchTimeRef.current = 0; // Segera fetch QR begitu status SCAN_QR_CODE
      startPolling();
    } catch (err: any) {
      if (isMountedRef.current) {
        setErrorMessage(err.message || 'Gagal memulai sesi WhatsApp');
      }
    } finally {
      if (isMountedRef.current) {
        setIsStarting(false);
      }
    }
  };

  // Handle Logout / Putuskan Sambungan
  const handleLogout = async () => {
    if (!window.confirm('Apakah Anda yakin ingin memutuskan koneksi WhatsApp sekolah?')) {
      return;
    }

    setIsStarting(true);
    setErrorMessage(null);

    try {
      let uid = activeUserId;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id || '';
      }

      const logoutUrl = uid
        ? `${functionUrl}?action=logout&userId=${encodeURIComponent(uid)}`
        : `${functionUrl}?action=logout`;

      const res = await fetch(logoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Gagal logout');
      }

      stopPolling();
      clearQrImage();
      setStatus('STOPPED');
      setSessionData(null);
      if (onStatusChange) onStatusChange('STOPPED');
    } catch (err: any) {
      if (isMountedRef.current) {
        setErrorMessage(err.message || 'Gagal memutuskan sambungan WhatsApp');
      }
    } finally {
      if (isMountedRef.current) {
        setIsStarting(false);
      }
    }
  };

  // Handle Save Inbound Webhook
  const handleSaveWebhook = async () => {
    if (!webhookUrl) return;
    setIsSavingWebhook(true);
    setWebhookSuccess(false);

    try {
      let uid = activeUserId;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id || '';
      }

      const saveUrl = uid
        ? `${functionUrl}?action=setWebhook&userId=${encodeURIComponent(uid)}`
        : `${functionUrl}?action=setWebhook`;

      const res = await fetch(saveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl.trim() }),
      });

      if (res.ok) {
        setWebhookSuccess(true);
        setTimeout(() => setWebhookSuccess(false), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Gagal menerapkan webhook');
      }
    } catch (err: any) {
      alert('Error saat menyimpan webhook: ' + err.message);
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleCopyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  // Handle Save Google Gemini API Key
  const handleSaveGeminiKey = async () => {
    setIsSavingGeminiKey(true);
    setGeminiKeySaved(false);

    try {
      let uid = activeUserId;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id || '';
      }

      if (!uid) {
        alert('Silakan login terlebih dahulu untuk menyimpan pengaturan');
        return;
      }

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: uid,
          gemini_api_key: geminiApiKey.trim(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setGeminiKeySaved(true);
      setTimeout(() => setGeminiKeySaved(false), 3000);
    } catch (err: any) {
      alert('Gagal menyimpan Google Gemini API Key: ' + err.message);
    } finally {
      setIsSavingGeminiKey(false);
    }
  };

  // Handle Send Test Message
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testNumber || !testMessage) return;

    setIsSendingTest(true);
    setTestResult(null);

    try {
      let uid = activeUserId;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id || '';
      }

      let cleanNumber = testNumber.replace(/\D/g, '');
      if (cleanNumber.startsWith('0')) cleanNumber = '62' + cleanNumber.slice(1);
      else if (cleanNumber.startsWith('8')) cleanNumber = '62' + cleanNumber;

      const sendUrl = uid
        ? `${functionUrl}?action=sendText&userId=${encodeURIComponent(uid)}`
        : `${functionUrl}?action=sendText`;

      const res = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanNumber,
          message: testMessage.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          text: 'Pesan uji coba berhasil dikirim langsung via WhatsApp Gateway! Periksa chat pada nomor tujuan.',
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
        text: 'Error koneksi: ' + (err?.message || 'Tidak dapat menghubungi server WhatsApp Gateway'),
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Format nomor WhatsApp akun yang terhubung
  const connectedNumber = sessionData?.me?.id 
    ? sessionData.me.id.replace('@c.us', '')
    : null;
  const connectedName = sessionData?.me?.pushName || 'WhatsApp Sekolah';

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Header Panel */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">
                Koneksi WhatsApp Gateway
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Inbound & Outbound Aktif
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Hubungkan nomor WhatsApp sekolah ke engine WhatsApp Gateway untuk notifikasi keluar dan terima bukti bayar otomatis
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
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-2">
              <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
              <span>Memulai Sesi...</span>
            </span>
          )}
          {status !== 'WORKING' && status !== 'SCAN_QR_CODE' && status !== 'STARTING' && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Belum Terhubung</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => fetchStatus()}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
            title="Muat Ulang Status"
          >
            <RefreshCw className={`w-4 h-4 ${isPolling ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-6 space-y-6">
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Status: WORKING (Sudah Terhubung) */}
        {status === 'WORKING' && (
          <div className="p-5 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-800">
                    {connectedName}
                  </h4>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-800">
                    Online
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 font-mono">
                  {connectedNumber ? `+${connectedNumber}` : 'Nomor WhatsApp terverifikasi'}
                </p>
                <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Siap mengirim reminder tagihan SPP & menerima bukti transfer otomatis
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isStarting}
                className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Power className="w-3.5 h-3.5 text-rose-500" />
                <span>Putuskan Sambungan</span>
              </button>
            </div>
          </div>
        )}

        {/* Status: SCAN_QR_CODE */}
        {status === 'SCAN_QR_CODE' && (
          <div className="flex flex-col items-center justify-center py-6 px-4 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-4">
            <div className="text-center max-w-md space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold mb-2">
                <QrCode className="w-4 h-4 text-amber-700" />
                <span>Pindai Kode QR WhatsApp</span>
              </div>
              <h4 className="text-base font-bold text-slate-800">
                Tautkan Akun WhatsApp Sekolah
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Buka WhatsApp di ponsel Anda &gt; menu <b>Perangkat Tertaut (Linked Devices)</b> &gt; lalu scan kode QR di bawah ini:
              </p>
            </div>

            {/* QR Image Container */}
            <div className="relative p-4 bg-white rounded-2xl shadow-md border border-slate-200">
              {qrLoadError ? (
                <div className="w-64 h-64 sm:w-72 sm:h-72 flex flex-col items-center justify-center bg-rose-50 border border-rose-200 rounded-xl p-4 text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-rose-500 animate-bounce" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-rose-800">
                      Gagal Memuat Gambar QR
                    </p>
                    <p className="text-[11px] text-rose-600 leading-tight">
                      Server gateway sedang menyiapkan kode QR baru atau koneksi terputus.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQrLoadError(false);
                      lastQrFetchTimeRef.current = 0;
                      fetchQrCode();
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Coba Lagi</span>
                  </button>
                </div>
              ) : qrImageUrl ? (
                <div className="relative group">
                  <img
                    src={qrImageUrl}
                    alt="WhatsApp QR Code"
                    onError={() => {
                      console.warn('QR image failed to load, triggering error state');
                      setQrLoadError(true);
                    }}
                    className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-xl select-none"
                  />
                  <div className="absolute top-2 right-2">
                    <span className="flex h-3 w-3 relative" title="Kode QR aktif & siap dipindai">
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

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => handleStart(true)}
                disabled={isStarting}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isStarting ? 'animate-spin' : ''}`} />
                <span>Perbarui / Terbitkan Kode QR Baru</span>
              </button>
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Status otomatis terhubung saat kode QR berhasil dipindai dari ponsel</span>
              </div>
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
                  ? 'Koneksi WhatsApp sebelumnya terputus dari ponsel atau sesi telah kadaluarsa. Klik tombol di samping untuk me-reset sesi dan menerbitkan kode QR baru.' 
                  : 'Klik tombol di samping untuk menginisiasi sesi WhatsApp di server gateway Anda dan menampilkan kode QR untuk ditautkan.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleStart(true)}
              disabled={isStarting}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer ${
                isStarting
                  ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}
            >
              {isStarting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses Sesi...</span>
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4" />
                  <span>Hubungkan WhatsApp (Scan QR)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Advance Configuration & Tools Collapsible */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTools(!showTools)}
            className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Konfigurasi Lanjutan: Inbound Webhook, Gemini OCR Vision & Tes Pesan</span>
            </div>
            {showTools ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showTools && (
            <div className="p-5 space-y-6 bg-white">
              {/* Inbound Webhook Configuration */}
              <div className="space-y-3">
                <div>
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Link className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Inbound Webhook URL (Penerima Bukti Bayar)</span>
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    URL endpoint aplikasi tempat WhatsApp gateway mengirimkan event chat dan gambar transfer masuk secara otomatis.
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
                    className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWebhook ? 'Tersalin' : 'Salin'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveWebhook}
                    disabled={isSavingWebhook}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSavingWebhook ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Terapkan Webhook</span>
                  </button>
                </div>

                {webhookSuccess && (
                  <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Webhook berhasil didaftarkan ke sesi WhatsApp gateway Anda!
                  </p>
                )}
              </div>

              {/* Google Gemini Vision Configuration */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Google Gemini AI Vision (OCR Struk Pembayaran Otomatis)</span>
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Kunci API Google Gemini untuk mengekstrak nominal, tanggal, jam transfer, bank, dan rekening secara presisi dari gambar struk WhatsApp.
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 self-start sm:self-center ${
                    geminiApiKey ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {geminiApiKey ? 'AI Vision Aktif' : 'Belum Dikonfigurasi'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Masukkan Google Gemini API Key (AIzaSy...)"
                    className="flex-1 px-3.5 py-2 text-xs font-mono border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    title="Buka Google AI Studio untuk dapatkan API Key gratis"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Dapatkan Key Gratis</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleSaveGeminiKey}
                    disabled={isSavingGeminiKey}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSavingGeminiKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Simpan Key AI</span>
                  </button>
                </div>

                {geminiKeySaved && (
                  <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Google Gemini API Key berhasil disimpan! Struk transfer WhatsApp yang masuk akan dianalisis otomatis.
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
                    Uji coba langsung pengiriman pesan dari nomor WhatsApp Anda via WhatsApp Gateway ke nomor ponsel tertentu.
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
                        className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Isi Pesan Uji Coba
                      </label>
                      <input
                        type="text"
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={isSendingTest || !testNumber.trim() || !testMessage.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                    >
                      {isSendingTest ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Mengirim Pesan...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Kirim Pesan Uji Coba</span>
                        </>
                      )}
                    </button>
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
            <span>Layanan:</span>
            <code className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono">
              WhatsApp Gateway Service
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
                className="text-emerald-600 hover:underline font-bold cursor-pointer"
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

export const WahaConnect = WhatsAppConnect;
export default WhatsAppConnect;
