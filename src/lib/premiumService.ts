import { supabase, superAdminSupabase } from './supabaseClient';
import { useState, useEffect } from 'react';

// Daftar email yang secara default langsung berstatus Premium Lifetime (Bebas Kadaluarsa)
export const DEFAULT_PREMIUM_EMAILS: string[] = [
  'beti1508@gmail.com',
  'isantoh21@gmail.com',
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

/**
 * Cek apakah email atau user ID tertentu tergolong pengguna Premium aktif.
 * Pengecekan mencakup validasi masa aktif (expiry date).
 */
export async function checkIsUserPremium(email?: string | null, userId?: string | null): Promise<boolean> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanId = (userId || '').trim();

  // 1. Cek pembatalan (revocation) di global_settings terlebih dahulu!
  // Jika pernah dicabut oleh SuperAdmin, akun ini harus berstatus NON-PREMIUM.
  try {
    const { data: globalSet } = await supabase
      .from('global_settings')
      .select('premium_emails, premium_user_ids, premium_subscriptions, revoked_user_ids, revoked_emails')
      .eq('id', 'default')
      .maybeSingle();

    if (globalSet) {
      const revokedIds: string[] = Array.isArray(globalSet.revoked_user_ids)
        ? globalSet.revoked_user_ids.map((id: string) => String(id).trim())
        : [];
      const revokedEmails: string[] = Array.isArray(globalSet.revoked_emails)
        ? globalSet.revoked_emails.map((e: string) => String(e).toLowerCase().trim())
        : [];

      // JIKA DICABUT OLEH ADMIN: Langsung return false!
      if ((cleanId && revokedIds.includes(cleanId)) || (cleanEmail && revokedEmails.includes(cleanEmail))) {
        if (cleanId) localStorage.setItem(`catatoh_is_premium_${cleanId}`, 'false');
        return false;
      }

      // Cek expiry dari record global_settings.premium_subscriptions jika ada
      if (globalSet.premium_subscriptions && typeof globalSet.premium_subscriptions === 'object') {
        const sub = (cleanId && globalSet.premium_subscriptions[cleanId]) || (cleanEmail && globalSet.premium_subscriptions[cleanEmail]);
        if (sub && sub.expires_at) {
          const exp = new Date(sub.expires_at);
          if (!isNaN(exp.getTime()) && exp.getTime() <= Date.now()) {
            if (cleanId) localStorage.setItem(`catatoh_is_premium_${cleanId}`, 'false');
            return false;
          }
        }
      }

      const pEmails: string[] = Array.isArray(globalSet.premium_emails) 
        ? globalSet.premium_emails.map((e: string) => String(e).toLowerCase().trim()) 
        : [];
      const pIds: string[] = Array.isArray(globalSet.premium_user_ids) 
        ? globalSet.premium_user_ids.map((id: string) => String(id).trim()) 
        : [];

      if ((cleanEmail && pEmails.includes(cleanEmail)) || (cleanId && pIds.includes(cleanId))) {
        if (cleanId) localStorage.setItem(`catatoh_is_premium_${cleanId}`, 'true');
        return true;
      }
    }
  } catch (_) {
    // Fallback jika global_settings belum ada
  }

  // 2. Cek default hardcoded (Lifetime VIP)
  if (cleanEmail && DEFAULT_PREMIUM_EMAILS.includes(cleanEmail)) {
    if (cleanId) {
      localStorage.setItem(`catatoh_is_premium_${cleanId}`, 'true');
    }
    return true;
  }

  // 3. Cek database user_settings jika userId tersedia
  if (cleanId) {
    try {
      const { data: userSet } = await supabase
        .from('user_settings')
        .select('is_premium, subscription_plan, subscription_expires_at, subscription_status')
        .eq('user_id', cleanId)
        .maybeSingle();

      if (userSet) {
        if (userSet.subscription_expires_at) {
          const expDate = new Date(userSet.subscription_expires_at);
          if (!isNaN(expDate.getTime())) {
            const isStillValid = expDate.getTime() > Date.now();
            if (!isStillValid) {
              localStorage.setItem(`catatoh_is_premium_${cleanId}`, 'false');
              return false;
            }
          }
        }

        if (typeof userSet.is_premium === 'boolean') {
          localStorage.setItem(`catatoh_is_premium_${cleanId}`, String(userSet.is_premium));
          return userSet.is_premium;
        }
      }
    } catch (_) {}
  }

  // 4. Fallback ke cached status di localStorage
  if (cleanId) {
    const cached = localStorage.getItem(`catatoh_is_premium_${cleanId}`);
    if (cached !== null) {
      return cached === 'true';
    }
  }

  return false;
}

/**
 * Dapatkan rincian paket langganan lengkap dari seorang pengguna
 */
export async function getUserSubscriptionDetails(userId?: string, userEmail?: string): Promise<PremiumInfo> {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  const cleanId = (userId || '').trim();

  // 1. Cek apakah ada revocation di global_settings
  let isRevoked = false;
  try {
    const { data: globalSet } = await supabase
      .from('global_settings')
      .select('revoked_user_ids, revoked_emails')
      .eq('id', 'default')
      .maybeSingle();

    if (globalSet) {
      const rIds: string[] = Array.isArray(globalSet.revoked_user_ids) ? globalSet.revoked_user_ids : [];
      const rEmails: string[] = Array.isArray(globalSet.revoked_emails) ? globalSet.revoked_emails : [];
      if ((cleanId && rIds.includes(cleanId)) || (cleanEmail && rEmails.includes(cleanEmail))) {
        isRevoked = true;
      }
    }
  } catch (_) {}

  if (isRevoked) {
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

  // Cek jika akun lifetime
  if (cleanEmail && DEFAULT_PREMIUM_EMAILS.includes(cleanEmail)) {
    return {
      isPremium: true,
      plan: 'yearly',
      status: 'active',
      expiresAt: null, // Lifetime
      daysRemaining: 9999,
      isExpiringSoon: false,
      email: cleanEmail
    };
  }

  if (userId) {
    try {
      const { data: userSet } = await supabase
        .from('user_settings')
        .select('is_premium, subscription_plan, subscription_expires_at, subscription_status')
        .eq('user_id', userId)
        .maybeSingle();

      if (userSet) {
        let isPrem = userSet.is_premium === true;
        let expiresAt = userSet.subscription_expires_at || null;
        let daysRemaining: number | null = null;
        let isExpired = false;

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

        const plan = (userSet.subscription_plan as 'monthly' | 'yearly') || (isPrem ? 'monthly' : 'free');
        const status: 'active' | 'expired' | 'trial' | 'free' = !isPrem 
          ? (isExpired ? 'expired' : 'free') 
          : 'active';

        return {
          isPremium: isPrem,
          plan: isPrem ? plan : 'free',
          status,
          expiresAt,
          daysRemaining,
          isExpiringSoon: isPrem && daysRemaining !== null && daysRemaining <= 5 && daysRemaining > 0,
          email: cleanEmail
        };
      }
    } catch (_) {}
  }

  const isPrem = await checkIsUserPremium(cleanEmail, userId);
  return {
    isPremium: isPrem,
    plan: isPrem ? 'monthly' : 'free',
    status: isPrem ? 'active' : 'free',
    expiresAt: null,
    daysRemaining: isPrem ? 30 : null,
    isExpiringSoon: false,
    email: cleanEmail
  };
}

/**
 * Hook React untuk memeriksa status premium pengguna saat ini secara reaktif
 */
export function usePremiumStatus(userEmail?: string | null, userId?: string | null) {
  const [isPremium, setIsPremium] = useState<boolean>(() => {
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    if (cleanEmail && DEFAULT_PREMIUM_EMAILS.includes(cleanEmail)) return true;
    if (userId) {
      return localStorage.getItem(`catatoh_is_premium_${userId}`) === 'true';
    }
    return false;
  });
  const [details, setDetails] = useState<PremiumInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const verify = async () => {
      let email = userEmail;
      let uid = userId;

      if (!email || !uid) {
        const { data: { session } } = await supabase.auth.getSession();
        email = email || session?.user?.email;
        uid = uid || session?.user?.id;
      }

      const info = await getUserSubscriptionDetails(uid || undefined, email || undefined);
      if (isMounted) {
        setIsPremium(info.isPremium);
        setDetails(info);
        setLoading(false);
      }
    };

    verify();

    return () => {
      isMounted = false;
    };
  }, [userEmail, userId]);

  return { isPremium, details, loading };
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

    // Hitung tanggal kadaluarsa baru jika dijadikan premium
    let expiresAt: string | null = null;
    if (newPremiumStatus) {
      if (customExpiryIso) {
        expiresAt = customExpiryIso;
      } else {
        const durationDays = plan === 'yearly' ? 365 : 30;
        expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    // 1. Coba panggil RPC keamanan tinggi (SECURITY DEFINER) jika tersedia
    try {
      await superAdminSupabase.rpc('set_user_premium_by_admin', {
        target_user_id: cleanId,
        new_is_premium: newPremiumStatus,
        new_plan: newPremiumStatus ? plan : 'free',
        new_expires_at: expiresAt
      });
    } catch (rpcErr) {
      console.warn('RPC set_user_premium_by_admin note:', rpcErr);
    }

    // 2. Simpan ke user_settings jika bisa
    try {
      await superAdminSupabase
        .from('user_settings')
        .upsert({
          user_id: cleanId,
          is_premium: newPremiumStatus,
          subscription_plan: newPremiumStatus ? plan : 'free',
          subscription_expires_at: expiresAt,
          subscription_status: newPremiumStatus ? 'active' : 'free',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (e) {
      console.warn('Note user_settings update premium:', e);
    }

    // 3. Sinkronkan ke global_settings (tabel sentral yang selalu dipegang superadmin)
    try {
      const { data: currentGlobal } = await superAdminSupabase
        .from('global_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      let currentEmails: string[] = Array.isArray(currentGlobal?.premium_emails)
        ? [...currentGlobal.premium_emails]
        : [...DEFAULT_PREMIUM_EMAILS];

      let currentIds: string[] = Array.isArray(currentGlobal?.premium_user_ids)
        ? [...currentGlobal.premium_user_ids]
        : [];

      let revokedIds: string[] = Array.isArray(currentGlobal?.revoked_user_ids)
        ? [...currentGlobal.revoked_user_ids]
        : [];

      let revokedEmails: string[] = Array.isArray(currentGlobal?.revoked_emails)
        ? [...currentGlobal.revoked_emails]
        : [];

      let currentSubs = (currentGlobal?.premium_subscriptions && typeof currentGlobal.premium_subscriptions === 'object')
        ? { ...currentGlobal.premium_subscriptions }
        : {};

      if (newPremiumStatus) {
        // Hapus dari daftar pencabutan (revoked)
        if (cleanId) revokedIds = revokedIds.filter(id => id !== cleanId);
        if (cleanEmail) revokedEmails = revokedEmails.filter(e => e.toLowerCase() !== cleanEmail);

        // Tambah ke daftar aktif
        if (cleanEmail && !currentEmails.includes(cleanEmail)) currentEmails.push(cleanEmail);
        if (cleanId && !currentIds.includes(cleanId)) currentIds.push(cleanId);
        
        if (cleanId) {
          currentSubs[cleanId] = {
            plan,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          };
        }
        if (cleanEmail) {
          currentSubs[cleanEmail] = {
            plan,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          };
        }
      } else {
        // Cabut dari daftar aktif
        currentEmails = currentEmails.filter(e => e.toLowerCase() !== cleanEmail);
        currentIds = currentIds.filter(id => id !== cleanId);
        if (cleanId) delete currentSubs[cleanId];
        if (cleanEmail) delete currentSubs[cleanEmail];

        // Masukkan ke daftar revoked agar tidak bisa auto-revert!
        if (cleanId && !revokedIds.includes(cleanId)) revokedIds.push(cleanId);
        if (cleanEmail && !revokedEmails.includes(cleanEmail)) revokedEmails.push(cleanEmail);
      }

      await superAdminSupabase
        .from('global_settings')
        .upsert({
          id: 'default',
          premium_emails: currentEmails,
          premium_user_ids: currentIds,
          revoked_user_ids: revokedIds,
          revoked_emails: revokedEmails,
          premium_subscriptions: currentSubs,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
    } catch (e) {
      console.warn('Note global_settings update premium:', e);
    }

    // 4. Update local cache
    if (cleanId) {
      localStorage.setItem(`catatoh_is_premium_${cleanId}`, String(newPremiumStatus));
    }

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
 * Jika langganan masih aktif, perpanjangan diakumulasikan ke masa aktif sebelumnya.
 */
export async function renewUserSubscription(
  userId: string,
  userEmail: string,
  plan: 'monthly' | 'yearly' = 'monthly'
): Promise<{ success: boolean; message: string; newExpiresAt?: string }> {
  try {
    const durationDays = plan === 'yearly' ? 365 : 30;
    const addMs = durationDays * 24 * 60 * 60 * 1000;

    // Ambil info masa aktif saat ini
    const currentInfo = await getUserSubscriptionDetails(userId, userEmail);
    let baseTime = Date.now();

    if (currentInfo.isPremium && currentInfo.expiresAt) {
      const exp = new Date(currentInfo.expiresAt);
      if (!isNaN(exp.getTime()) && exp.getTime() > Date.now()) {
        baseTime = exp.getTime(); // Akumulasikan jika masih aktif!
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
