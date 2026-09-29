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

  // 1. Cek default hardcoded (Lifetime VIP)
  if (cleanEmail && DEFAULT_PREMIUM_EMAILS.includes(cleanEmail)) {
    if (userId) {
      localStorage.setItem(`catatoh_is_premium_${userId}`, 'true');
    }
    return true;
  }

  // 2. Cek database user_settings jika userId tersedia
  if (userId) {
    try {
      const { data: userSet } = await supabase
        .from('user_settings')
        .select('is_premium, subscription_plan, subscription_expires_at, subscription_status')
        .eq('user_id', userId)
        .maybeSingle();

      if (userSet) {
        // Cek jika ada tanggal kadaluarsa
        if (userSet.subscription_expires_at) {
          const expDate = new Date(userSet.subscription_expires_at);
          if (!isNaN(expDate.getTime())) {
            const isStillValid = expDate.getTime() > Date.now();
            if (!isStillValid) {
              // Sudah kadaluarsa
              localStorage.setItem(`catatoh_is_premium_${userId}`, 'false');
              return false;
            }
          }
        }

        if (typeof userSet.is_premium === 'boolean') {
          localStorage.setItem(`catatoh_is_premium_${userId}`, String(userSet.is_premium));
          return userSet.is_premium;
        }
      }
    } catch (_) {
      // Fallback ke langkah berikutnya jika terjadi error jaringan
    }
  }

  // 3. Cek database global_settings
  try {
    const { data: globalSet } = await supabase
      .from('global_settings')
      .select('premium_emails, premium_user_ids, premium_subscriptions')
      .eq('id', 'default')
      .maybeSingle();

    if (globalSet) {
      // Cek expiry dari record global_settings.premium_subscriptions jika ada
      if (globalSet.premium_subscriptions && typeof globalSet.premium_subscriptions === 'object') {
        const sub = (userId && globalSet.premium_subscriptions[userId]) || (cleanEmail && globalSet.premium_subscriptions[cleanEmail]);
        if (sub && sub.expires_at) {
          const exp = new Date(sub.expires_at);
          if (!isNaN(exp.getTime()) && exp.getTime() <= Date.now()) {
            if (userId) localStorage.setItem(`catatoh_is_premium_${userId}`, 'false');
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

      if ((cleanEmail && pEmails.includes(cleanEmail)) || (userId && pIds.includes(userId))) {
        if (userId) localStorage.setItem(`catatoh_is_premium_${userId}`, 'true');
        return true;
      }
    }
  } catch (_) {
    // Fallback jika global_settings belum ada
  }

  // 4. Fallback ke cached status di localStorage
  if (userId) {
    const cached = localStorage.getItem(`catatoh_is_premium_${userId}`);
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

    // 1. Simpan ke user_settings jika bisa
    try {
      await superAdminSupabase
        .from('user_settings')
        .upsert({
          user_id: targetUserId,
          is_premium: newPremiumStatus,
          subscription_plan: newPremiumStatus ? plan : 'free',
          subscription_expires_at: expiresAt,
          subscription_status: newPremiumStatus ? 'active' : 'free',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (e) {
      console.warn('Note user_settings update premium:', e);
    }

    // 2. Sinkronkan ke global_settings (tabel sentral yang selalu bisa diakses)
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

      let currentSubs = (currentGlobal?.premium_subscriptions && typeof currentGlobal.premium_subscriptions === 'object')
        ? { ...currentGlobal.premium_subscriptions }
        : {};

      if (newPremiumStatus) {
        if (cleanEmail && !currentEmails.includes(cleanEmail)) currentEmails.push(cleanEmail);
        if (targetUserId && !currentIds.includes(targetUserId)) currentIds.push(targetUserId);
        
        currentSubs[targetUserId] = {
          plan,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        };
      } else {
        currentEmails = currentEmails.filter(e => e.toLowerCase() !== cleanEmail);
        currentIds = currentIds.filter(id => id !== targetUserId);
        delete currentSubs[targetUserId];
      }

      await superAdminSupabase
        .from('global_settings')
        .upsert({
          id: 'default',
          premium_emails: currentEmails,
          premium_user_ids: currentIds,
          premium_subscriptions: currentSubs,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
    } catch (e) {
      console.warn('Note global_settings update premium:', e);
    }

    // Update local cache
    localStorage.setItem(`catatoh_is_premium_${targetUserId}`, String(newPremiumStatus));

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
