import { supabase } from './supabaseClient';

/**
 * Auto-purge: Memastikan hanya 10 log aktivitas terbaru per user yang disimpan di database.
 * Log yang lebih lama dari urutan ke-10 otomatis dihapus secara permanen agar database tidak penuh.
 */
export const purgeExcessActivityLogs = async (userId?: string) => {
  try {
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      targetUserId = session?.user?.id;
    }
    if (!targetUserId) return;

    // 1. Ambil created_at dari log ke-10 (offset index 9)
    const { data: tenthLog, error: fetchErr } = await supabase
      .from('activity_logs')
      .select('created_at')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .range(9, 9);

    if (fetchErr) {
      return;
    }

    if (tenthLog && tenthLog.length > 0 && tenthLog[0]?.created_at) {
      const cutoffTime = tenthLog[0].created_at;

      // Hapus seluruh log milik user ini yang berumur lebih lama dari log ke-10
      await supabase
        .from('activity_logs')
        .delete()
        .eq('user_id', targetUserId)
        .lt('created_at', cutoffTime);
    }

    // 2. Safety check: Ambil ID log yang berada di index 10 ke atas (jika ada created_at identik)
    const { data: overflowLogs } = await supabase
      .from('activity_logs')
      .select('id')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .range(10, 50);

    if (overflowLogs && overflowLogs.length > 0) {
      const idsToDelete = overflowLogs.map(item => item.id);
      await supabase
        .from('activity_logs')
        .delete()
        .eq('user_id', targetUserId)
        .in('id', idsToDelete);
    }
  } catch (err) {
    console.warn('Auto-purge activity logs warning:', err);
  }
};

export const logActivity = async (action: string, description: string, _type?: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase.from('activity_logs').insert([
      {
        user_id: session.user.id,
        action,
        description
      }
    ]);
    
    if (error) {
      console.error('Error logging activity:', error);
    } else {
      // Jalankan auto-purge di latar belakang agar log user tetap maksimal 10 teratas
      purgeExcessActivityLogs(session.user.id).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to log activity', err);
  }
};
