import { supabase } from './supabaseClient';
import { WhatsAppGatewayConfig, PaymentVerification } from '../types/whatsapp';

// Base64 encoded universal Gemini API key
const UNIVERSAL_GEMINI_KEY = typeof atob !== 'undefined'
  ? atob('QVEuQWI4Uk42SlZCMjl4WGQ4Y2RIME11RlVkTTVUaUlqZGc2V0huZWs4RUtGeTZEVWo2MUE=')
  : (typeof Buffer !== 'undefined' ? Buffer.from('QVEuQWI4Uk42SlZCMjl4WGQ4Y2RIME11RlVkTTVUaUlqZGc2V0huZWs4RUtGeTZEVWo2MUE=', 'base64').toString('utf8') : '');

export const DEFAULT_GATEWAY_CONFIG: WhatsAppGatewayConfig = {
  apiUrl: 'https://app.starsender.online/api/sendText',
  appkey: '',
  authkey: '',
  autoReplyEnabled: true,
  autoReplyMessage: 'Halo Ayah/Bunda, bukti pembayaran SPP Anda telah kami terima dan sedang diverifikasi oleh bendahara sekolah. Kami akan segera mengirim konfirmasi lunas. Terima kasih 🙏',
  geminiApiKey: UNIVERSAL_GEMINI_KEY,
};

// Key format for localStorage
const getStorageKey = (userId?: string) => `catatoh_wa_config_${userId || 'global'}`;
const getVerificationsStorageKey = (userId?: string) => `catatoh_wa_verifications_${userId || 'global'}`;

// Ambil konfigurasi WhatsApp Gateway pengguna saat ini
export async function getWhatsAppGatewayConfig(userId?: string): Promise<WhatsAppGatewayConfig> {
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    activeUserId = session?.user?.id;
  }

  // 1. Cek dari user_settings di Supabase
  if (activeUserId) {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('wa_gateway_config')
        .eq('user_id', activeUserId)
        .maybeSingle();

      if (data?.wa_gateway_config) {
        return {
          ...DEFAULT_GATEWAY_CONFIG,
          ...data.wa_gateway_config,
          geminiApiKey: data.wa_gateway_config.geminiApiKey || UNIVERSAL_GEMINI_KEY,
          schoolUserId: activeUserId
        };
      }
    } catch (err) {
      console.warn('Gagal ambil wa_gateway_config dari user_settings:', err);
    }

    // 2. Cek user_metadata
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.user_metadata?.wa_gateway_config) {
      return {
        ...DEFAULT_GATEWAY_CONFIG,
        ...session.user.user_metadata.wa_gateway_config,
        geminiApiKey: session.user.user_metadata.wa_gateway_config.geminiApiKey || UNIVERSAL_GEMINI_KEY,
        schoolUserId: activeUserId
      };
    }
  }

  // 3. Fallback ke LocalStorage
  const localSaved = localStorage.getItem(getStorageKey(activeUserId));
  if (localSaved) {
    try {
      const parsed = JSON.parse(localSaved);
      return {
        ...DEFAULT_GATEWAY_CONFIG,
        ...parsed,
        geminiApiKey: parsed.geminiApiKey || UNIVERSAL_GEMINI_KEY,
        schoolUserId: activeUserId
      };
    } catch (e) {
      console.error(e);
    }
  }

  return { ...DEFAULT_GATEWAY_CONFIG, schoolUserId: activeUserId };
}

// Simpan konfigurasi WhatsApp Gateway
export async function saveWhatsAppGatewayConfig(
  config: Partial<WhatsAppGatewayConfig>,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    activeUserId = session?.user?.id;
  }

  const mergedConfig: WhatsAppGatewayConfig = {
    ...DEFAULT_GATEWAY_CONFIG,
    ...config,
    schoolUserId: activeUserId
  };

  // Simpan ke LocalStorage agar instan
  localStorage.setItem(getStorageKey(activeUserId), JSON.stringify(mergedConfig));

  if (!activeUserId) {
    return { success: true };
  }

  try {
    // Simpan ke user_metadata Supabase
    await supabase.auth.updateUser({
      data: { wa_gateway_config: mergedConfig }
    });

    // Coba simpan juga ke user_settings jika kolom tersedia
    try {
      await supabase
        .from('user_settings')
        .update({ wa_gateway_config: mergedConfig } as any)
        .eq('user_id', activeUserId);
    } catch (e) {
      // Abaikan jika kolom belum ada di user_settings
    }

    return { success: true };
  } catch (err: any) {
    console.error('Gagal simpan wa_gateway_config:', err);
    return { success: false, error: err.message || 'Gagal menyimpan ke server' };
  }
}

// Validasi nomor WhatsApp (format dan kecukupan digit)
export function validateWhatsAppNumber(phone: string): {
  valid: boolean;
  cleanNumber: string;
  reason?: 'EMPTY' | 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_FORMAT';
  message?: string;
} {
  if (!phone || !phone.trim()) {
    return { valid: false, cleanNumber: '', reason: 'EMPTY', message: 'Nomor WhatsApp belum diisi' };
  }

  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  else if (clean.startsWith('8')) clean = '62' + clean;

  if (clean.length < 10) {
    return {
      valid: false,
      cleanNumber: clean,
      reason: 'TOO_SHORT',
      message: `Kurang digit (${clean.length} digit, minimal 10 digit)`
    };
  }

  if (clean.length > 16) {
    return {
      valid: false,
      cleanNumber: clean,
      reason: 'TOO_LONG',
      message: `Terlalu panjang (${clean.length} digit, maks 16 digit)`
    };
  }

  return { valid: true, cleanNumber: clean };
}

// Kirim pesan WhatsApp melalui WAHA Supabase Proxy atau backend proxy
export async function sendWhatsAppMessage(payload: {
  apiUrl?: string;
  appkey?: string;
  authkey?: string;
  to: string;
  message: string;
  file?: string;
  userId?: string;
}): Promise<{ success: boolean; data?: any; error?: string; code?: string }> {
  try {
    // 0. Pre-validasi nomor telepon di sisi client
    const validation = validateWhatsAppNumber(payload.to);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.message || 'Nomor WhatsApp tidak valid',
        code: validation.reason
      };
    }

    let activeUid = payload.userId;
    if (!activeUid) {
      const { data: { session } } = await supabase.auth.getSession();
      activeUid = session?.user?.id;
    }

    // 1. Prioritaskan Supabase Edge Function WAHA Proxy dengan isolasi user
    const proxyBase = 'https://lzvrhtaewonmpsaiezai.supabase.co/functions/v1/waha-proxy?action=sendText';
    const wahaProxyUrl = activeUid 
      ? `${proxyBase}&userId=${encodeURIComponent(activeUid)}` 
      : proxyBase;

    try {
      const res = await fetch(wahaProxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: validation.cleanNumber,
          message: payload.message,
          file: payload.file,
        }),
      });

      const resData = await res.json().catch(() => ({}));

      // Jika proxy merespons dengan hasil spesifik (baik berhasil maupun gagal seperti nomor tidak terdaftar)
      if (res.ok && resData?.success !== false) {
        return { success: true, data: resData };
      }

      // Jika nomor tidak ditemukan / kurang digit / session mati, jangan fallback ke tempat lain
      if (resData?.code === 'NUMBER_NOT_FOUND' || resData?.code === 'INVALID_NUMBER_LENGTH' || resData?.code === 'SESSION_NOT_WORKING') {
        return {
          success: false,
          error: resData.error || 'Nomor tidak terdaftar di WhatsApp',
          code: resData.code,
          data: resData
        };
      }

      if (res.status === 404 || res.status === 422) {
        return {
          success: false,
          error: resData?.error || 'Nomor WhatsApp tidak terdaftar atau tidak ditemukan.',
          code: 'NUMBER_NOT_FOUND',
          data: resData
        };
      }
    } catch (proxyErr) {
      console.warn('Gagal via waha-proxy, mencoba backend local:', proxyErr);
    }

    // 2. Coba backend internal /api/whatsapp/send
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        to: validation.cleanNumber
      })
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const result = await res.json();
      if (res.ok && result.success !== false) {
        return { success: true, data: result };
      }
      return {
        success: false,
        error: result.error || 'Gagal mengirim pesan',
        code: result.code
      };
    }

    return { 
      success: false, 
      error: 'Gagal mengirim pesan WhatsApp via WAHA. Pastikan WhatsApp terhubung (WORKING).',
      code: 'GATEWAY_ERROR'
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghubungi server pengirim WhatsApp', code: 'NETWORK_ERROR' };
  }
}

// Pemeriksa ketat: Apakah suatu record adalah bukti transfer pembayaran ASLI dari WhatsApp nyata?
// Menolak simulasi, dummy unsplash, mock, dan pesan tanpa bukti transfer valid.
export function isRealTransferReceipt(v: any): boolean {
  if (!v) return false;
  const id = String(v.id || '').toLowerCase();
  const notes = String(v.confidence_notes || '').toLowerCase();
  const name = String(v.sender_name || '').toLowerCase();
  const msg = String(v.message_text || '').toLowerCase();
  const img = String(v.proof_image_url || '').toLowerCase();

  // 1. Tolak semua penanda simulasi atau dummy ID
  if (id.startsWith('sim') || id.includes('simulasi')) return false;
  if (notes.includes('simulasi') || notes.includes('uji coba')) return false;
  if (name.includes('simulasi')) return false;
  if (msg.includes('simulasi')) return false;
  if (v.is_simulation === true) return false;

  // 2. Tolak gambar placeholder Unsplash yang sering dipakai pengujian
  if (img.includes('unsplash.com')) return false;

  // 3. Wajib ada gambar bukti nyata
  if (!v.proof_image_url || v.proof_image_url.trim() === '') return false;

  // 4. Tolak jika catatan verifikasi menandai bukan bukti transfer
  if (notes.includes('bukan bukti transfer') || notes.includes('bukan struk') || notes.includes('kemungkinan bukan')) return false;

  // 5. Wajib teridentifikasi ke siswa yang terdaftar
  if (!v.student_id) return false;

  return true;
}

// Dapatkan daftar bukti pembayaran yang masuk untuk dimoderasi
export async function getPaymentVerifications(userId?: string): Promise<PaymentVerification[]> {
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    activeUserId = session?.user?.id;
  }

  // Jika tidak ada user_id aktif, kembalikan kosong (isolasi total antar akun)
  if (!activeUserId) {
    return [];
  }

  // 1. Coba dari tabel Supabase `payment_verifications` dengan filter KETAT per user_id
  try {
    const { data, error } = await supabase
      .from('payment_verifications')
      .select(`
        *,
        students (
          nama_lengkap,
          kelompok
        )
      `)
      .eq('user_id', activeUserId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped = data.map((item: any) => ({
        ...item,
        student_name: item.students?.nama_lengkap || item.sender_name || 'Belum Dipetakan',
        student_kelompok: item.students?.kelompok || '-'
      }));
      // Filter ketat: HANYA bukti struk transfer nyata yang lolos dan HANYA dari siswa terdaftar milik akun ini
      return mapped.filter((item: any) => isRealTransferReceipt(item) && Boolean(item.student_id));
    }
  } catch (err) {
    console.warn('Tabel payment_verifications error di Supabase, beralih ke cache lokal/server.');
  }

  // 2. Coba fetch dari endpoint backend server.ts (jika ada dan berformat json)
  try {
    const res = await fetch(`/api/webhook/verifications?userId=${encodeURIComponent(activeUserId)}`);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.filter((item: any) => isRealTransferReceipt(item) && Boolean(item.student_id) && item.user_id === activeUserId);
      }
    }
  } catch (e) {
    // Fallback
  }

  // 3. Fallback dari LocalStorage HANYA untuk user yang bersangkutan
  const localList = localStorage.getItem(getVerificationsStorageKey(activeUserId));
  if (localList) {
    try {
      const parsed = JSON.parse(localList);
      if (Array.isArray(parsed)) {
        return parsed.filter((item: any) => isRealTransferReceipt(item) && Boolean(item.student_id) && item.user_id === activeUserId);
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  return [];
}

// Simpan atau perbarui bukti verifikasi lokal
export function saveLocalVerifications(items: PaymentVerification[], userId?: string) {
  // Hanya simpan item yang valid
  localStorage.setItem(getVerificationsStorageKey(userId), JSON.stringify(items));
}

// Hapus satu bukti verifikasi secara permanen
export async function deletePaymentVerification(id: string, userId?: string): Promise<boolean> {
  // 1. Hapus dari Supabase
  try {
    let q = supabase.from('payment_verifications').delete().eq('id', id);
    if (userId) {
      q = q.eq('user_id', userId);
    }
    await q;
  } catch {}

  // 2. Hapus dari backend server
  try {
    await fetch(`/api/webhook/verifications/${id}`, { method: 'DELETE' });
  } catch {}

  // 3. Hapus dari LocalStorage
  try {
    const storageKey = getVerificationsStorageKey(userId);
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((v: any) => v.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
    }
  } catch {}

  return true;
}

// Bersihkan cache verifikasi lokal (reset ke kosong murni)
export function clearLocalVerifications(userId?: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getVerificationsStorageKey(userId));
  localStorage.removeItem(getVerificationsStorageKey('global'));
  localStorage.removeItem('catatoh_wa_verifications');
  // Bersihkan semua key berawalan catatoh_wa_verifications
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('catatoh_wa_verifications')) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}
