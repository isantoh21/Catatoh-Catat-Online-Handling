import { supabase } from './supabaseClient';
import { WhatsAppGatewayConfig, PaymentVerification } from '../types/whatsapp';
import { getProtectedUniversalGeminiKey, secureStorage } from './securityCipher';

// Protected encrypted universal Gemini API key
const UNIVERSAL_GEMINI_KEY = getProtectedUniversalGeminiKey();

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

  // 3. Fallback ke LocalStorage (terenkripsi)
  const localSaved = secureStorage.getItem(getStorageKey(activeUserId))
    || (localStorage.getItem(getStorageKey(activeUserId)) ? JSON.parse(localStorage.getItem(getStorageKey(activeUserId)) || '{}') : null);
  if (localSaved) {
    return {
      ...DEFAULT_GATEWAY_CONFIG,
      ...localSaved,
      geminiApiKey: localSaved.geminiApiKey || UNIVERSAL_GEMINI_KEY,
      schoolUserId: activeUserId
    };
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

  // Simpan ke LocalStorage dalam format terenkripsi agar aman dari inspect element
  secureStorage.setItem(getStorageKey(activeUserId), mergedConfig);
  try { localStorage.removeItem(getStorageKey(activeUserId)); } catch (_) {}

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

// Kirim pesan WhatsApp melalui Supabase Edge Function Proxy atau backend proxy
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

    // 1. Prioritaskan Supabase Edge Function Proxy dengan isolasi user
    const proxyBase = 'https://lzvrhtaewonmpsaiezai.supabase.co/functions/v1/waha-proxy?action=sendText';
    const gatewayProxyUrl = activeUid 
      ? `${proxyBase}&userId=${encodeURIComponent(activeUid)}` 
      : proxyBase;

    try {
      const res = await fetch(gatewayProxyUrl, {
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
      console.warn('Gagal via gateway proxy, mencoba backend local:', proxyErr);
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
      error: 'Gagal mengirim pesan WhatsApp. Pastikan WhatsApp terhubung (WORKING).',
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

  // Bersihkan cache localStorage yang over-quota jika terisi data base64 raksasa (>100KB)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storageKey = getVerificationsStorageKey(activeUserId);
      const raw = localStorage.getItem(storageKey);
      if (raw && raw.length > 100000) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          saveLocalVerifications(parsed, activeUserId);
        }
      }
    } catch (_) {}
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
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const expiredApprovedIds: string[] = [];

      const mapped = data.map((item: any) => ({
        ...item,
        student_name: item.students?.nama_lengkap || item.sender_name || 'Belum Dipetakan',
        student_kelompok: item.students?.kelompok || '-'
      })).filter((item: any) => {
        // Auto-purge bukti bayar yang telah disetujui (approved) dan berumur lebih dari 30 hari
        if (item.status === 'approved') {
          const itemTime = new Date(item.updated_at || item.created_at).getTime();
          if (now - itemTime > thirtyDaysInMs) {
            expiredApprovedIds.push(item.id);
            return false;
          }
        }
        return true;
      });

      // Bersihkan dari database Supabase di latar belakang
      if (expiredApprovedIds.length > 0) {
        supabase
          .from('payment_verifications')
          .delete()
          .in('id', expiredApprovedIds)
          .eq('user_id', activeUserId)
          .then(() => {})
          .catch(() => {});
      }

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
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        return json.data.filter((item: any) => {
          if (item.status === 'approved') {
            const itemTime = new Date(item.updated_at || item.created_at).getTime();
            if (now - itemTime > thirtyDaysInMs) return false;
          }
          return isRealTransferReceipt(item) && Boolean(item.student_id) && item.user_id === activeUserId;
        });
      }
    }
  } catch (e) {
    // Fallback
  }

  // 3. Fallback dari LocalStorage HANYA untuk user yang bersangkutan
  const storageKey = getVerificationsStorageKey(activeUserId);
  const localList = localStorage.getItem(storageKey);
  if (localList) {
    try {
      const parsed = JSON.parse(localList);
      if (Array.isArray(parsed)) {
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const validList = parsed.filter((item: any) => {
          if (item.status === 'approved') {
            const itemTime = new Date(item.updated_at || item.created_at).getTime();
            if (now - itemTime > thirtyDaysInMs) return false;
          }
          return isRealTransferReceipt(item) && Boolean(item.student_id) && item.user_id === activeUserId;
        });
        // Auto-sanitize jika isi cache sebelumnya berukuran besar (>100KB) atau ada item yang difilter
        if (localList.length > 100000 || validList.length !== parsed.length) {
          saveLocalVerifications(validList, activeUserId);
        }
        return validList;
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  return [];
}

// Simpan atau perbarui bukti verifikasi lokal (Aman dari QuotaExceededError)
export function saveLocalVerifications(items: PaymentVerification[], userId?: string) {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const storageKey = getVerificationsStorageKey(userId);
  try {
    // 1. Sanitize items untuk hemat storage:
    // Pangkas base64 raksasa (>500 karakter) menjadi placeholder transparan ringan 1x1
    // agar tidak menghabiskan kuota 5MB browser localStorage
    const sanitized = (items || []).slice(0, 50).map(item => {
      let safeImg = item.proof_image_url;
      if (safeImg && (safeImg.startsWith('data:') || safeImg.length > 500)) {
        safeImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=';
      }
      return {
        ...item,
        proof_image_url: safeImg,
      };
    });

    const serialized = JSON.stringify(sanitized);

    // Hapus key lama sebelum setItem untuk mencegah QuotaExceededError browser
    localStorage.removeItem(storageKey);
    localStorage.setItem(storageKey, serialized);
  } catch (err: any) {
    console.warn('Gagal menyimpan cache verifikasi ke localStorage (kuota penuh / dibatasi):', err?.message || err);
    // Penanganan darurat jika localStorage benar-benar penuh oleh data lain
    try {
      localStorage.removeItem(storageKey);

      // Bersihkan key cache lama yang berawalan catatoh_wa_verifications
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('catatoh_wa_verifications') && k !== storageKey) {
          localStorage.removeItem(k);
        }
      }

      // Simpan hanya pending dengan data paling minimal
      const minimal = (items || [])
        .filter(v => v.status === 'pending')
        .slice(0, 15)
        .map(v => ({
          ...v,
          proof_image_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII='
        }));

      localStorage.setItem(storageKey, JSON.stringify(minimal));
    } catch (_) {
      // Abaikan sepenuhnya, jangan pernah melempar exception ke proses bisnis transaksi pembayaran
    }
  }
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
        localStorage.removeItem(storageKey);
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
