import { supabase } from './supabaseClient';
import { format, subDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { logActivity } from './activityLogger';
import { purgeDuplicateStudentAttendanceLogs } from './studentAttendancePurge';

const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000; // Check/run every 6 hours minimum
const STORAGE_KEY = 'last_snapshot_purge_timestamp';

export interface PurgeResult {
  success: boolean;
  cutoffDate: string;
  studentPurged: number;
  teacherPurged: number;
  message?: string;
  error?: string;
}

/**
 * Mendapatkan batas tanggal snapshot yang akan dibersihkan (2 hari yang lalu).
 * Snapshot dari sebelum tanggal ini akan di-purge (dihapus string fotonya untuk menghemat storage database),
 * namun data riwayat kehadiran (nama, tanggal, jam, status) tetap utuh selamanya.
 */
export function getSnapshotCutoffDate(days: number = 2): { cutoffDateStr: string; cutoffDateFormatted: string } {
  const cutoff = subDays(new Date(), days);
  return {
    cutoffDateStr: format(cutoff, 'yyyy-MM-dd'),
    cutoffDateFormatted: format(cutoff, 'dd MMMM yyyy', { locale: id })
  };
}

/**
 * Menghapus data foto snapshot absensi (base64) yang berumur lebih dari 2 hari.
 * Menjaga database tetap ringan, cepat, dan hemat kapasitas.
 */
export async function purgeOldAttendanceSnapshots(userId?: string, force: boolean = false): Promise<PurgeResult> {
  const { cutoffDateStr, cutoffDateFormatted } = getSnapshotCutoffDate(2);
  let studentPurgedCount = 0;
  let teacherPurgedCount = 0;

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

    // 1. Purge Student Attendance Snapshots older than 2 days
    let studentQuery = supabase
      .from('student_attendance_logs')
      .update({ snapshot: null, photo: null })
      .lt('tanggal', cutoffDateStr)
      .or('snapshot.is.not.null,photo.is.not.null');

    if (uid) {
      studentQuery = studentQuery.eq('user_id', uid);
    }

    const { error: studentError, count: studentCount } = await studentQuery;
    if (studentError) {
      console.warn('Student snapshot purge notice:', studentError.message);
    } else if (studentCount != null) {
      studentPurgedCount = studentCount;
    }

    // 2. Purge Teacher/Staff Attendance Snapshots older than 2 days
    let teacherQuery = supabase
      .from('attendance_logs')
      .update({ photo: null })
      .lt('tanggal', cutoffDateStr)
      .not('photo', 'is', null);

    if (uid) {
      teacherQuery = teacherQuery.eq('user_id', uid);
    }

    const { error: teacherError, count: teacherCount } = await teacherQuery;
    if (teacherError) {
      console.warn('Teacher snapshot purge notice:', teacherError.message);
    } else if (teacherCount != null) {
      teacherPurgedCount = teacherCount;
    }

    // Update timestamp
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch (e) {}

    if (studentPurgedCount > 0 || teacherPurgedCount > 0) {
      await logActivity(
        'Auto Purge Snapshot',
        `Pembersihan foto snapshot absensi > 2 hari (sebelum ${cutoffDateFormatted}) selesai. Data teks kehadiran tetap tersimpan rapi.`
      );
    }

    return {
      success: true,
      cutoffDate: cutoffDateStr,
      studentPurged: studentPurgedCount,
      teacherPurged: teacherPurgedCount,
      message: `Pembersihan snapshot > 2 hari berhasil (Batas: ${cutoffDateFormatted}).`
    };
  } catch (err: any) {
    console.error('Error during snapshot purge:', err);
    return {
      success: false,
      cutoffDate: cutoffDateStr,
      studentPurged: 0,
      teacherPurged: 0,
      error: err.message || 'Gagal membersihkan snapshot'
    };
  }
}

/**
 * Otomatis menjalankan auto-purge jika belum dijalankan dalam rentang interval (misal 6-24 jam).
 * Dipanggil di background saat user membuka Kiosk atau Halaman Rekap Laporan.
 */
export function autoPurgeSnapshotsIfNeeded(userId?: string): void {
  try {
    const lastRunStr = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();
    if (!lastRunStr || now - parseInt(lastRunStr, 10) > PURGE_INTERVAL_MS) {
      // Run asynchronously in background without blocking UI
      setTimeout(() => {
        purgeOldAttendanceSnapshots(userId).catch(() => {});
        purgeDuplicateStudentAttendanceLogs(userId).catch(() => {});
      }, 3000);
    }
  } catch (e) {}
}
