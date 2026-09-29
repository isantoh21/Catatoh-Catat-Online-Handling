import { supabase, superAdminSupabase } from './supabaseClient';
import { useState, useEffect } from 'react';

// Daftar email yang secara default langsung berstatus Premium
export const DEFAULT_PREMIUM_EMAILS: string[] = [
  'beti1508@gmail.com',
];

export interface PremiumInfo {
  isPremium: boolean;
  plan: 'free' | 'premium';
  email?: string;
  source?: string;
}

/**
 * Cek apakah email atau user ID tertentu tergolong pengguna Premium.
 * Prioritas pemeriksaan:
 * 1. Email masuk ke daftar default hardcoded (beti1508@gmail.com)
 * 2. user_settings.is_premium di database Supabase
 * 3. global_settings.premium_emails di database Supabase
 * 4. Cache tersimpan di localStorage
 */
export async function checkIsUserPremium(email?: string | null, userId?: string | null): Promise<boolean> {
  const cleanEmail = (email || '').trim().toLowerCase();

  // 1. Cek default hardcoded
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
        .select('is_premium')
        .eq('user_id', userId)
        .maybeSingle();

      if (userSet && typeof userSet.is_premium === 'boolean') {
        localStorage.setItem(`catatoh_is_premium_${userId}`, String(userSet.is_premium));
        return userSet.is_premium;
      }
    } catch (_) {
      // Jika kolom belum ada atau error jaringan, lanjutkan fallback
    }
  }

  // 3. Cek database global_settings
  try {
    const { data: globalSet } = await supabase
      .from('global_settings')
      .select('premium_emails, premium_user_ids')
      .eq('id', 'default')
      .maybeSingle();

    if (globalSet) {
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

      const status = await checkIsUserPremium(email, uid);
      if (isMounted) {
        setIsPremium(status);
        setLoading(false);
      }
    };

    verify();

    return () => {
      isMounted = false;
    };
  }, [userEmail, userId]);

  return { isPremium, loading };
}

/**
 * Super Admin function: Mengubah status premium seorang user
 */
export async function setTargetUserPremium(
  targetUserId: string,
  targetEmail: string,
  newPremiumStatus: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanEmail = (targetEmail || '').trim().toLowerCase();

    // 1. Simpan ke user_settings jika bisa
    try {
      await superAdminSupabase
        .from('user_settings')
        .upsert({
          user_id: targetUserId,
          is_premium: newPremiumStatus,
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

      if (newPremiumStatus) {
        if (cleanEmail && !currentEmails.includes(cleanEmail)) currentEmails.push(cleanEmail);
        if (targetUserId && !currentIds.includes(targetUserId)) currentIds.push(targetUserId);
      } else {
        currentEmails = currentEmails.filter(e => e.toLowerCase() !== cleanEmail);
        currentIds = currentIds.filter(id => id !== targetUserId);
      }

      await superAdminSupabase
        .from('global_settings')
        .upsert({
          id: 'default',
          premium_emails: currentEmails,
          premium_user_ids: currentIds,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
    } catch (e) {
      console.warn('Note global_settings update premium:', e);
    }

    // Update local cache
    localStorage.setItem(`catatoh_is_premium_${targetUserId}`, String(newPremiumStatus));

    return { 
      success: true, 
      message: `Status premium untuk ${targetEmail || targetUserId} berhasil diubah menjadi: ${newPremiumStatus ? 'PREMIUM ⭐' : 'GRATIS / REGULER'}.` 
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal memperbarui status premium' };
  }
}
