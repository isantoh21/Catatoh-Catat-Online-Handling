import { supabase } from './supabaseClient';
import { WhatsAppGatewayConfig, PaymentVerification } from '../types/whatsapp';

export const DEFAULT_GATEWAY_CONFIG: WhatsAppGatewayConfig = {
  apiUrl: 'https://app.starsender.online/api/sendText',
  appkey: '',
  authkey: '',
  autoReplyEnabled: true,
  autoReplyMessage: 'Halo Ayah/Bunda, bukti pembayaran SPP Anda telah kami terima dan sedang diverifikasi oleh bendahara sekolah. Kami akan segera mengirim konfirmasi lunas. Terima kasih 🙏',
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
        schoolUserId: activeUserId
      };
    }
  }

  // 3. Fallback ke LocalStorage
  const localSaved = localStorage.getItem(getStorageKey(activeUserId));
  if (localSaved) {
    try {
      return {
        ...DEFAULT_GATEWAY_CONFIG,
        ...JSON.parse(localSaved),
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

// Kirim pesan WhatsApp melalui backend proxy (menghindari CORS)
export async function sendWhatsAppMessage(payload: {
  apiUrl?: string;
  appkey: string;
  authkey: string;
  to: string;
  message: string;
  file?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    return result;
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghubungi server pengirim WhatsApp' };
  }
}

// Dapatkan daftar bukti pembayaran yang masuk untuk dimoderasi
export async function getPaymentVerifications(userId?: string): Promise<PaymentVerification[]> {
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    activeUserId = session?.user?.id;
  }

  // 1. Coba dari tabel Supabase `payment_verifications`
  if (activeUserId) {
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
        return data.map((item: any) => ({
          ...item,
          student_name: item.students?.nama_lengkap || item.sender_name || 'Siswa',
          student_kelompok: item.students?.kelompok || '-'
        }));
      }
    } catch (err) {
      console.warn('Tabel payment_verifications belum dibuat di Supabase, beralih ke cache lokal/server.');
    }
  }

  // 2. Coba fetch dari endpoint backend server.ts
  try {
    const res = await fetch(`/api/webhook/verifications?userId=${activeUserId || ''}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch (e) {
    // Fallback
  }

  // 3. Fallback dari LocalStorage
  const localList = localStorage.getItem(getVerificationsStorageKey(activeUserId));
  if (localList) {
    try {
      return JSON.parse(localList);
    } catch (e) {
      return [];
    }
  }

  return [];
}

// Simpan atau perbarui bukti verifikasi lokal
export function saveLocalVerifications(items: PaymentVerification[], userId?: string) {
  localStorage.setItem(getVerificationsStorageKey(userId), JSON.stringify(items));
}
