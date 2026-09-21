import { supabase } from './supabaseClient';
import { logActivity } from './activityLogger';

export interface DuplicatePurgeResult {
  success: boolean;
  purgedCount: number;
  duplicateGroupCount: number;
  message: string;
}

/**
 * Mendeteksi dan membersihkan (purge) otomatis log absen siswa yang dobel/duplikat
 * pada hari/tanggal yang sama.
 * Menyimpan log absensi pertama (paling awal) dan menghapus log absensi kelebihan berikutnya.
 */
export async function purgeDuplicateStudentAttendanceLogs(
  userId?: string,
  targetDate?: string
): Promise<DuplicatePurgeResult> {
  try {
    let uid = userId;
    if (!uid) {
      const session = (await supabase.auth.getSession()).data.session;
      uid = session?.user?.id;
    }
    if (!uid) {
      try {
        uid = localStorage.getItem('cached_kiosk_user_id') || undefined;
      } catch (e) {}
    }

    // Build query to fetch logs to inspect for duplicates
    let query = supabase
      .from('student_attendance_logs')
      .select('id, student_id, user_id, tanggal, waktu, created_at, status')
      .order('created_at', { ascending: true });

    if (uid) {
      query = query.eq('user_id', uid);
    }
    if (targetDate) {
      query = query.eq('tanggal', targetDate);
    }

    const { data: logs, error } = await query;
    if (error || !logs || logs.length === 0) {
      return {
        success: !error,
        purgedCount: 0,
        duplicateGroupCount: 0,
        message: error ? error.message : 'Tidak ada log untuk diperiksa'
      };
    }

    // Group logs by student_id + tanggal
    const groupMap = new Map<string, typeof logs>();
    logs.forEach(log => {
      const dateKey = log.tanggal || (log.created_at ? log.created_at.split('T')[0] : '');
      const key = `${log.student_id}_${dateKey}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(log);
    });

    const idsToDelete: string[] = [];
    let duplicateGroupCount = 0;

    groupMap.forEach((groupLogs) => {
      if (groupLogs.length > 1) {
        duplicateGroupCount++;
        // Sort chronologically by created_at or waktu to keep the FIRST attendance
        groupLogs.sort((a, b) => {
          const timeA = new Date(a.waktu || a.created_at).getTime();
          const timeB = new Date(b.waktu || b.created_at).getTime();
          return timeA - timeB;
        });

        // Keep the first log (index 0), mark the rest for deletion
        const extras = groupLogs.slice(1);
        extras.forEach(extra => {
          if (extra.id) idsToDelete.push(extra.id);
        });
      }
    });

    if (idsToDelete.length === 0) {
      return {
        success: true,
        purgedCount: 0,
        duplicateGroupCount: 0,
        message: 'Tidak ditemukan data absensi siswa yang ganda.'
      };
    }

    // Execute deletion of extra duplicate records in chunks
    const CHUNK_SIZE = 50;
    for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
      const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
      let deleteQuery = supabase
        .from('student_attendance_logs')
        .delete()
        .in('id', chunk);

      if (uid) {
        deleteQuery = deleteQuery.eq('user_id', uid);
      }
      await deleteQuery;
    }

    await logActivity(
      'Auto Purge Log Siswa Ganda',
      `Berhasil membersihkan ${idsToDelete.length} data absensi siswa ganda (${duplicateGroupCount} kejadian). Hanya 1 data kehadiran per hari yang dipertahankan.`
    );

    return {
      success: true,
      purgedCount: idsToDelete.length,
      duplicateGroupCount,
      message: `Berhasil membersihkan ${idsToDelete.length} log absensi berlebih.`
    };
  } catch (err: any) {
    console.error('Error during purgeDuplicateStudentAttendanceLogs:', err);
    return {
      success: false,
      purgedCount: 0,
      duplicateGroupCount: 0,
      message: err.message || 'Gagal menjalankan pembersihan log ganda'
    };
  }
}
