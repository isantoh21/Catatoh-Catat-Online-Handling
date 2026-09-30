import { supabase, superAdminSupabase } from './supabaseClient';
import { useState, useEffect } from 'react';

// Nomor kontak resmi WhatsApp Admin CATATOH
export const ADMIN_WHATSAPP_NUMBER: string = '6285347360359';

// Daftar email yang secara default berstatus Premium Lifetime jika belum pernah dicabut
export const DEFAULT_PREMIUM_EMAILS: string[] = [
  'beti1508@gmail.com',
];

export interface PremiumInfo {
  isPremium: boolean;
  plan: 'free' | 'monthly' | 'yearly';
  status: 'active' | 'expired' | 'trial' | 'free';
  expiresAt: string | null;
  daysRemaining: number | null;
  isExpiringSoon: boolean;
  email?: string;
}

export interface GlobalAnnouncementConfig {
  announcement_text?: string;
  premium_emails?: string[];
  premium_user_ids?: string[];
  revoked_user_ids?: string[];
  revoked_emails?: string[];
  premium_subscriptions?: Record<string, any>;
  updated_at?: string;
}

/**
 * Parsing konfigurasi kontrol sentral dari kolom announcement global_settings
 */
export function parseGlobalConfig(rawAnnouncement?: string | null): GlobalAnnouncementConfig {
  if (!rawAnnouncement) return {};
  try {
    const trimmed = String(rawAnnouncement).trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    }
  } catch (_) {}
  return { announcement_text: rawAnnouncement || '' };
}

/**
 * Mengambil konfigurasi sentral dari global_settings dengan fallback ke localStorage
 */
export async function getCentralPremiumConfig(): Promise<GlobalAnnouncementConfig> {
  let config: GlobalAnnouncementConfig = {};
  let dbSuccess = false;

  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('announcement')
      .eq('id', 'default')
      .maybeSingle();

    if (!error && data && data.announcement) {
      config = parseGlobalConfig(data.announcement);
      dbSuccess = true;
      // Database adalah otoritas tunggal: simpan ke cache localStorage cadangan
      try {
        localStorage.setItem('catatoh_system_premium_registry', JSON.stringify(config));
      } catch (_) {}
    }
  } catch (_) {}

  // Hanya jika gagal membaca dari database (offline), gunakan cache di localStorage
  if (!dbSuccess) {
    try {
      const local = localStorage.getItem('catatoh_system_premium_registry');
      if (local) {
        config = parseGlobalConfig(local);
      }
    } catch (_) {}
  }

  return config;
}

/**
 * Cek apakah email atau user ID tertentu tergolong pengguna Premium aktif.
 */
export async function checkIsUserPremium(email?: string | null, userId?: string | null): Promise<boolean> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanId = (userId || '').trim();

  // 1. Cek dari konfigurasi sentral (memiliki otoritas tertinggi)
  const config = await getCentralPremiumConfig();
  const revokedIds = (config.revoked_user_ids || []).map(id => String(id).trim());
  const revokedEmails = (config.revoked_emails || []).map(e => String(e).toLowerCase().trim());

  // JIKA DICABUT OLEH ADMIN: Langsung return false!
  if ((cleanId && revokedIds.includes(cleanId)) || (cleanEmail && revokedEmails.includes(cleanEmail))) {
    if (cleanId) localStorage.setItem(`catatoh_is_premium_${cleanId}`, 'false');
    return false;
  }

  // Cek subscription expiry jika tercatat di sentral
  const subs = config.premium_subscriptions || {};
  const sub = (cleanId && subs[cleanId]) || (cleanEmail && subs[cleanEmail]);
  if (sub && sub.expires_at) {
    const exp = new Date(sub.expires_at);
    if (!isNaN(exp.getTime())) {
      if (exp.getTime() <= Date.now()) {
        if (cleanId) localStorage.setItem(`catatoh_is_premium_${cleanId}`, 'false');
        return false;
      } else {
        if (cleanId) localStorage.setItem(`catatoh_is_premium_${cleanId}`, 'true');
        return true;
      }
    }
  }

  // Cek jika ada di daftar aktif sentral
  const pEmails = (config.premium_emails || []).map(e => String(e).toLowerCase().trim());
  const pIds = (config.premium_user_ids || []).map(id => String(id).trim());
  if ((cleanEmail && pEmails.includes(cleanEmail)) || (cleanId && pIds.includes(cleanId))) {
    if (cleanId) localStorage.setItem(`catatoh_is_premium_${cleanId}`, 'true');
    return true;
  }

  // 2. Cek default hardcoded (Lifetime VIP) jika tidak dicabut dan belum memiliki expiry khusus
  if (cleanEmail && DEFAULT_PREMIUM_EMAILS.includes(cleanEmail)) {
    if (cleanId) localStorage.setItem(`catatoh_is_premium_${cleanId}`, 'true');
    return true;
  }

  return false;
}

/**
 * Dapatkan rincian paket langganan lengkap dari seorang pengguna
 */
export async function getUserSubscriptionDetails(userId?: string, userEmail?: string): Promise<PremiumInfo> {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  const cleanId = (userId || '').trim();

  const config = await getCentralPremiumConfig();
  const revokedIds = (config.revoked_user_ids || []).map(id => String(id).trim());
  const revokedEmails = (config.revoked_emails || []).map(e => String(e).toLowerCase().trim());

  // Cek pencabutan
  if ((cleanId && revokedIds.includes(cleanId)) || (cleanEmail && revokedEmails.includes(cleanEmail))) {
    if (cleanId) localStorage.setItem(`catatoh_is_premium_${cleanId}`, 'false');
    return {
      isPremium: false,
      plan: 'free',
      status: 'free',
      expiresAt: null,
      daysRemaining: null,
      isExpiringSoon: false,
      email: cleanEmail
    };
  }

  // 1. Cek subscription info dari central config TERLEBIH DAHULU (prioritas jika diberi 1 bulan/1 tahun)
  const subs = config.premium_subscriptions || {};
  const sub = (cleanId && subs[cleanId]) || (cleanEmail && subs[cleanEmail]);
  if (sub) {
    let isPrem = true;
    let daysRemaining: number | null = null;
    let isExpired = false;
    let expiresAt = sub.expires_at || null;

    if (expiresAt) {
      const exp = new Date(expiresAt);
      if (!isNaN(exp.getTime())) {
        const diffMs = exp.getTime() - Date.now();
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (daysRemaining <= 0) {
          isExpired = true;
          isPrem = false;
        }
      }
    }

    const plan = (sub.plan as 'monthly' | 'yearly') || 'monthly';
    return {
      isPremium: isPrem,
      plan: isPrem ? plan : 'free',
      status: !isPrem ? (isExpired ? 'expired' : 'free') : 'active',
      expiresAt,
      daysRemaining,
      isExpiringSoon: isPrem && daysRemaining !== null && daysRemaining <= 5 && daysRemaining > 0,
      email: cleanEmail
    };
  }

  // 2. Cek jika akun lifetime default (hanya jika TIDAK ada konfigurasi langganan berjangka)
  if (cleanEmail && DEFAULT_PREMIUM_EMAILS.includes(cleanEmail)) {
    return {
      isPremium: true,
      plan: 'yearly',
      status: 'active',
      expiresAt: null,
      daysRemaining: 9999,
      isExpiringSoon: false,
      email: cleanEmail
    };
  }

  const isPrem = await checkIsUserPremium(cleanEmail, cleanId);
  if (isPrem) {
    const fallbackDays = 30;
    const fallbackExpiry = new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000).toISOString();
    return {
      isPremium: true,
      plan: 'monthly',
      status: 'active',
      expiresAt: fallbackExpiry,
      daysRemaining: fallbackDays,
      isExpiringSoon: false,
      email: cleanEmail
    };
  }

  return {
    isPremium: false,
    plan: 'free',
    status: 'free',
    expiresAt: null,
    daysRemaining: null,
    isExpiringSoon: false,
    email: cleanEmail
  };
}

/**
 * React Hook untuk mendengarkan status premium seorang user
 */
export function useUserPremium(userEmail?: string | null, userId?: string | null) {
  const [isPremium, setIsPremium] = useState<boolean>(() => {
    if (userId) {
      const cached = localStorage.getItem(`catatoh_is_premium_${userId}`);
      if (cached !== null) return cached === 'true';
    }
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    return DEFAULT_PREMIUM_EMAILS.includes(cleanEmail);
  });

  const [details, setDetails] = useState<PremiumInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const prem = await checkIsUserPremium(userEmail, userId);
        const det = await getUserSubscriptionDetails(userId || undefined, userEmail || undefined);
        if (isMounted) {
          setIsPremium(prem);
          setDetails(det);
        }
      } catch (_) {
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [userEmail, userId]);

  return { isPremium, details, loading };
}

/**
 * Global React Hook untuk status premium pengguna saat ini
 */
export function usePremiumStatus(explicitEmail?: string | null, explicitUserId?: string | null) {
  const [currentUser, setCurrentUser] = useState<{ id?: string; email?: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (explicitUserId || explicitEmail) return;

    supabase.auth.getUser().then(({ data }) => {
      if (isMounted && data?.user) {
        setCurrentUser({ id: data.user.id, email: data.user.email });
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setCurrentUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [explicitEmail, explicitUserId]);

  const emailToUse = explicitEmail !== undefined ? explicitEmail : currentUser?.email;
  const idToUse = explicitUserId !== undefined ? explicitUserId : currentUser?.id;

  return useUserPremium(emailToUse, idToUse);
}

/**
 * Super Admin function: Mengubah status premium seorang user & memperbarui tanggal masa aktif
 */
export async function setTargetUserPremium(
  targetUserId: string,
  targetEmail: string,
  newPremiumStatus: boolean,
  plan: 'monthly' | 'yearly' = 'monthly',
  customExpiryIso?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanEmail = (targetEmail || '').trim().toLowerCase();
    const cleanId = (targetUserId || '').trim();

    let expiresAt: string | null = null;
    if (newPremiumStatus) {
      if (customExpiryIso) {
        expiresAt = customExpiryIso;
      } else {
        const durationDays = plan === 'yearly' ? 365 : 30;
        expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    // 1. Ambil data announcement yang sudah ada
    let currentConfig = await getCentralPremiumConfig();

    let currentEmails = (currentConfig.premium_emails || []).map(e => String(e).toLowerCase().trim());
    let currentIds = (currentConfig.premium_user_ids || []).map(id => String(id).trim());
    let revokedIds = (currentConfig.revoked_user_ids || []).map(id => String(id).trim());
    let revokedEmails = (currentConfig.revoked_emails || []).map(e => String(e).toLowerCase().trim());
    let currentSubs = { ...(currentConfig.premium_subscriptions || {}) };

    if (newPremiumStatus) {
      // Hapus dari daftar pencabutan (revoked)
      if (cleanId) revokedIds = revokedIds.filter(id => id !== cleanId);
      if (cleanEmail) revokedEmails = revokedEmails.filter(e => e.toLowerCase() !== cleanEmail);

      // Tambah ke daftar aktif
      if (cleanEmail && !currentEmails.includes(cleanEmail)) currentEmails.push(cleanEmail);
      if (cleanId && !currentIds.includes(cleanId)) currentIds.push(cleanId);
      
      const subRecord = {
        plan,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      };
      if (cleanId) currentSubs[cleanId] = subRecord;
      if (cleanEmail) currentSubs[cleanEmail] = subRecord;
    } else {
      // Cabut dari daftar aktif
      if (cleanEmail) currentEmails = currentEmails.filter(e => e.toLowerCase() !== cleanEmail);
      if (cleanId) currentIds = currentIds.filter(id => id !== cleanId);
      if (cleanId) delete currentSubs[cleanId];
      if (cleanEmail) delete currentSubs[cleanEmail];

      // Masukkan ke daftar revoked agar tidak bisa auto-revert!
      if (cleanId && !revokedIds.includes(cleanId)) revokedIds.push(cleanId);
      if (cleanEmail && !revokedEmails.includes(cleanEmail)) revokedEmails.push(cleanEmail);
    }

    const updatedConfig: GlobalAnnouncementConfig = {
      ...currentConfig,
      premium_emails: currentEmails,
      premium_user_ids: currentIds,
      revoked_user_ids: revokedIds,
      revoked_emails: revokedEmails,
      premium_subscriptions: currentSubs,
      updated_at: new Date().toISOString()
    };

    const serialized = JSON.stringify(updatedConfig);

    // Simpan ke database Supabase (kolom announcement yang selalu ada dan bisa ditulis)
    try {
      const { error: upsertErr } = await superAdminSupabase
        .from('global_settings')
        .upsert({
          id: 'default',
          announcement: serialized,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (upsertErr) {
        console.warn('global_settings upsert error, trying update fallback:', upsertErr);
        await superAdminSupabase
          .from('global_settings')
          .update({
            announcement: serialized,
            updated_at: new Date().toISOString()
          })
          .eq('id', 'default');
      }
    } catch (e) {
      console.warn('global_settings announcement update note:', e);
    }

    // Update persistent cache di localStorage
    try {
      localStorage.setItem('catatoh_system_premium_registry', serialized);
      if (cleanId) {
        localStorage.setItem(`catatoh_is_premium_${cleanId}`, String(newPremiumStatus));
      }
    } catch (_) {}

    return { 
      success: true, 
      message: `Status akun ${targetEmail || targetUserId} berhasil diubah menjadi: ${newPremiumStatus ? `PREMIUM ⭐ (${plan === 'yearly' ? 'Tahunan' : 'Bulanan'})` : 'STANDAR / GRATIS'}.` 
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal memperbarui status premium' };
  }
}

/**
 * Memperpanjang (Renew) langganan pengguna
 */
export async function renewUserSubscription(
  userId: string,
  userEmail: string,
  plan: 'monthly' | 'yearly' = 'monthly'
): Promise<{ success: boolean; message: string; newExpiresAt?: string }> {
  try {
    const durationDays = plan === 'yearly' ? 365 : 30;
    const addMs = durationDays * 24 * 60 * 60 * 1000;

    const currentInfo = await getUserSubscriptionDetails(userId, userEmail);
    let baseTime = Date.now();

    if (currentInfo.isPremium && currentInfo.expiresAt) {
      const exp = new Date(currentInfo.expiresAt);
      if (!isNaN(exp.getTime()) && exp.getTime() > Date.now()) {
        baseTime = exp.getTime();
      }
    }

    const newExpiresAt = new Date(baseTime + addMs).toISOString();

    const res = await setTargetUserPremium(userId, userEmail, true, plan, newExpiresAt);
    if (res.success) {
      return {
        success: true,
        message: `Langganan ${plan === 'yearly' ? 'Tahunan (1 Tahun)' : 'Bulanan (1 Bulan)'} berhasil diperpanjang hingga ${new Date(newExpiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}!`,
        newExpiresAt
      };
    }
    return { success: false, message: res.message };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal memperpanjang langganan' };
  }
}
