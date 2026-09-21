import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { 
  CalendarDays, Loader2, Download, Search, CheckCircle2, XCircle, 
  Clock, Users, Filter, Sparkles, ShieldCheck, Printer, RefreshCw,
  UserCheck, AlertCircle, Eye, ChevronRight, X, ScanFace, FileSpreadsheet, Trash2
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isToday } from 'date-fns';
import { id } from 'date-fns/locale';
import { autoPurgeSnapshotsIfNeeded } from '../../lib/snapshotPurge';
import { purgeDuplicateStudentAttendanceLogs } from '../../lib/studentAttendancePurge';

interface StudentAttendanceReportsProps {
  onNavigateToKiosk?: () => void;
}

export default function StudentAttendanceReports({ onNavigateToKiosk }: StudentAttendanceReportsProps) {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<any>(null);
  
  // Date & View Filters
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'daily' | 'monthly_summary' | 'all_logs'>('daily');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('Semua');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('Semua');
  
  // Detail Modal
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<any | null>(null);
  const [studentDetailLogs, setStudentDetailLogs] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Manual Status Edit Modal
  const [editingStudentStatus, setEditingStudentStatus] = useState<any | null>(null);
  const [manualStatusInput, setManualStatusInput] = useState<'Hadir' | 'Izin' | 'Sakit' | 'Alpa'>('Hadir');
  const [savingManualStatus, setSavingManualStatus] = useState(false);

  // Auto Purge Duplicate State
  const [purgingDuplicates, setPurgingDuplicates] = useState(false);
  const [purgeFeedback, setPurgeFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
    autoPurgeSnapshotsIfNeeded();
  }, [selectedDate, selectedMonth, selectedYear, viewMode]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      // Automatically purge duplicate student attendance logs in background
      purgeDuplicateStudentAttendanceLogs(currentUser.id).catch(() => {});

      // Fetch School Settings
      const { data: sSettings } = await supabase
        .from('user_settings')
        .select('school_name, school_logo')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (sSettings) setSchoolSettings(sSettings);

      // Fetch all students for this user
      const { data: studentsData, error: stErr } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('nama_lengkap', { ascending: true });

      if (studentsData) {
        setStudents(studentsData);
      }

      // Determine date query bounds
      let query = supabase.from('student_attendance_logs').select('*').eq('user_id', currentUser.id);

      if (viewMode === 'daily') {
        query = query.eq('tanggal', selectedDate);
      } else if (viewMode === 'monthly_summary') {
        const startDate = format(new Date(selectedYear, selectedMonth, 1), 'yyyy-MM-dd');
        const endDate = format(new Date(selectedYear, selectedMonth + 1, 0), 'yyyy-MM-dd');
        query = query.gte('tanggal', startDate).lte('tanggal', endDate);
      } else {
        // all logs: last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte('tanggal', format(thirtyDaysAgo, 'yyyy-MM-dd')).order('created_at', { ascending: false }).limit(200);
      }

      const { data: logsData, error: lErr } = await query;
      if (logsData) {
        // Deduplicate logs in memory to strictly show max 1 log per student per day (keeping earliest)
        const seenKeys = new Set<string>();
        const deduped: any[] = [];
        const sortedAsc = [...logsData].sort(
          (a, b) => new Date(a.waktu || a.created_at || '').getTime() - new Date(b.waktu || b.created_at || '').getTime()
        );
        sortedAsc.forEach(l => {
          const dateStr = l.tanggal || (l.created_at ? l.created_at.split('T')[0] : '');
          const key = `${l.student_id}_${dateStr}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            deduped.push(l);
          }
        });
        setAttendanceLogs(deduped.reverse());
      }
    } catch (err) {
      console.error('Error fetching student attendance reports:', err);
    } finally {
      setLoading(false);
    }
  };

  // Manual Trigger to Purge Duplicate Student Logs
  const handleManualPurgeDuplicates = async () => {
    setPurgingDuplicates(true);
    setPurgeFeedback(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user;
      if (!currentUser) return;

      const result = await purgeDuplicateStudentAttendanceLogs(currentUser.id);
      if (result.purgedCount > 0) {
        setPurgeFeedback(`Pembersihan selesai! ${result.purgedCount} data log duplikat berhasil dihapus.`);
      } else {
        setPurgeFeedback('Semua data absensi siswa sudah bersih (tidak ada log ganda).');
      }
      await fetchInitialData();
    } catch (err: any) {
      setPurgeFeedback('Gagal membersihkan log: ' + err.message);
    } finally {
      setPurgingDuplicates(false);
      setTimeout(() => setPurgeFeedback(null), 5000);
    }
  };

  // Unique group/class list
  const uniqueGroups = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.kelompok && s.kelompok.trim()) {
        set.add(s.kelompok.trim());
      }
    });
    return ['Semua', ...Array.from(set).sort()];
  }, [students]);

  // Daily records aggregation: combines all active students with their attendance status on selectedDate
  const dailyAttendanceRecords = useMemo(() => {
    return students.map(student => {
      const logsForStudent = attendanceLogs.filter(
        l => l.student_id === student.id && (l.tanggal === selectedDate || l.tanggal?.startsWith(selectedDate))
      );

      const inLog = logsForStudent.find(l => l.type === 'in') || logsForStudent[0];
      const outLog = logsForStudent.find(l => l.type === 'out' && l.id !== inLog?.id);

      let status = 'Alpa'; // Default absent / not scanned
      let timeIn = inLog?.waktu ? format(new Date(inLog.waktu), 'HH:mm') : inLog?.created_at ? format(new Date(inLog.created_at), 'HH:mm') : '-';
      let timeOut = outLog?.waktu ? format(new Date(outLog.waktu), 'HH:mm') : outLog?.created_at ? format(new Date(outLog.created_at), 'HH:mm') : '-';
      let snapshot = inLog?.snapshot || inLog?.photo || inLog?.image || null;
      let logId = inLog?.id || null;

      if (inLog) {
        status = inLog.status || 'Hadir';
      }

      return {
        student,
        status,
        timeIn,
        timeOut,
        snapshot,
        logId,
        hasFaceBiometric: !!student.face_descriptor,
        hasAttended: !!inLog
      };
    });
  }, [students, attendanceLogs, selectedDate]);

  // Filtered Daily Records
  const filteredDailyRecords = useMemo(() => {
    return dailyAttendanceRecords.filter(rec => {
      const matchSearch = rec.student.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (rec.student.nomor_whatsapp && rec.student.nomor_whatsapp.includes(searchQuery));
      const matchGroup = selectedGroup === 'Semua' || rec.student.kelompok === selectedGroup;
      
      let matchStatus = true;
      if (selectedStatusFilter === 'Hadir') matchStatus = rec.status === 'Hadir';
      else if (selectedStatusFilter === 'Tidak Hadir') matchStatus = rec.status === 'Alpa' || rec.status === 'Belum Hadir';
      else if (selectedStatusFilter === 'Izin') matchStatus = rec.status === 'Izin';
      else if (selectedStatusFilter === 'Sakit') matchStatus = rec.status === 'Sakit';

      return matchSearch && matchGroup && matchStatus;
    });
  }, [dailyAttendanceRecords, searchQuery, selectedGroup, selectedStatusFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const totalPresent = dailyAttendanceRecords.filter(r => r.status === 'Hadir').length;
    const totalPermission = dailyAttendanceRecords.filter(r => r.status === 'Izin').length;
    const totalSick = dailyAttendanceRecords.filter(r => r.status === 'Sakit').length;
    const totalAbsent = dailyAttendanceRecords.filter(r => r.status === 'Alpa').length;
    
    const presentRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;
    const biometricRegisteredCount = students.filter(s => !!s.face_descriptor).length;

    return {
      totalStudents,
      totalPresent,
      totalPermission,
      totalSick,
      totalAbsent,
      presentRate,
      biometricRegisteredCount
    };
  }, [students, dailyAttendanceRecords]);

  // Monthly Summary calculation
  const monthlySummaryRecords = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    
    return students.map(student => {
      const studentMonthLogs = attendanceLogs.filter(l => l.student_id === student.id);
      
      // Count unique dates attended
      const attendedDates = new Set<string>();
      let izinCount = 0;
      let sakitCount = 0;

      studentMonthLogs.forEach(l => {
        if (l.tanggal) {
          attendedDates.add(l.tanggal);
          if (l.status === 'Izin') izinCount++;
          if (l.status === 'Sakit') sakitCount++;
        }
      });

      const presentCount = attendedDates.size - izinCount - sakitCount;
      const actualPresent = Math.max(0, presentCount);
      const totalEffectiveDays = 25; // Approx active school days per month
      const attendancePercent = Math.min(100, Math.round((actualPresent / totalEffectiveDays) * 100));

      return {
        student,
        presentCount: actualPresent,
        izinCount,
        sakitCount,
        absentCount: Math.max(0, totalEffectiveDays - actualPresent - izinCount - sakitCount),
        attendancePercent,
        hasFaceBiometric: !!student.face_descriptor
      };
    });
  }, [students, attendanceLogs, selectedMonth, selectedYear]);

  // Open Student Detail Modal
  const handleOpenStudentDetail = async (student: any) => {
    setSelectedStudentDetail(student);
    setLoadingDetail(true);
    try {
      const { data, error } = await supabase
        .from('student_attendance_logs')
        .select('*')
        .eq('student_id', student.id)
        .order('tanggal', { ascending: false })
        .limit(60);

      if (data) {
        // Ensure max 1 log per date in detail view
        const seenDates = new Set<string>();
        const dedupedDetail: any[] = [];
        const sorted = [...data].sort(
          (a, b) => new Date(a.waktu || a.created_at || '').getTime() - new Date(b.waktu || b.created_at || '').getTime()
        );
        sorted.forEach(l => {
          const dateStr = l.tanggal || (l.created_at ? l.created_at.split('T')[0] : '');
          if (!seenDates.has(dateStr)) {
            seenDates.add(dateStr);
            dedupedDetail.push(l);
          }
        });
        setStudentDetailLogs(dedupedDetail.reverse());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Handle Manual Status Update for a Student on the Selected Date
  const handleSaveManualStatus = async () => {
    if (!editingStudentStatus) return;
    setSavingManualStatus(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user;
      if (!currentUser) return;

      const studentId = editingStudentStatus.student.id;
      const existingLogId = editingStudentStatus.logId;

      if (manualStatusInput === 'Alpa' && existingLogId) {
        // Delete the log if marked as absent
        await supabase
          .from('student_attendance_logs')
          .delete()
          .eq('id', existingLogId)
          .eq('user_id', currentUser.id);
      } else if (existingLogId) {
        // Update existing log status
        await supabase
          .from('student_attendance_logs')
          .update({
            status: manualStatusInput,
            waktu: new Date().toISOString()
          })
          .eq('id', existingLogId)
          .eq('user_id', currentUser.id);
      } else {
        // Insert new manual log
        await supabase
          .from('student_attendance_logs')
          .insert([{
            user_id: currentUser.id,
            student_id: studentId,
            tanggal: selectedDate,
            waktu: new Date().toISOString(),
            status: manualStatusInput,
            type: 'in'
          }]);
      }

      setEditingStudentStatus(null);
      fetchInitialData();
    } catch (err: any) {
      alert('Gagal memperbarui status: ' + err.message);
    } finally {
      setSavingManualStatus(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['No', 'Nama Siswa', 'Kelompok/Kelas', 'Nomor WA', 'Status Kehadiran', 'Waktu Masuk', 'Waktu Pulang', 'Tanggal'];
    const rows = filteredDailyRecords.map((r, i) => [
      i + 1,
      `"${r.student.nama_lengkap}"`,
      `"${r.student.kelompok || '-'}"`,
      `"${r.student.nomor_whatsapp || '-'}"`,
      `"${r.status}"`,
      `"${r.timeIn}"`,
      `"${r.timeOut}"`,
      `"${selectedDate}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_presensi_siswa_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
            <ScanFace className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Rekap & Laporan Presensi Siswa
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>AI Face Scan Verified</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Pantau jumlah kehadiran, ketidakhadiran, dan verifikasi biometrik wajah harian siswa secara akurat.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0 flex-wrap">
          <button
            onClick={handleManualPurgeDuplicates}
            disabled={purgingDuplicates}
            className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors border border-rose-500/30"
            title="Bersihkan log absensi berlebih / dobel untuk siswa pada hari yang sama"
          >
            <Trash2 className={`w-4 h-4 ${purgingDuplicates ? 'animate-spin text-rose-400' : ''}`} />
            <span>{purgingDuplicates ? 'Membersihkan...' : 'Auto Purge Dobel'}</span>
          </button>

          <button
            onClick={fetchInitialData}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Sinkronisasi Data Presensi"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* Purge Notification Banner */}
      {purgeFeedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-medium shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{purgeFeedback}</span>
          </div>
          <button onClick={() => setPurgeFeedback(null)} className="text-emerald-600 hover:text-emerald-800 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Siswa */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Siswa</p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">{stats.totalStudents}</h3>
            <p className="text-[11px] text-indigo-600 font-medium mt-1">
              {stats.biometricRegisteredCount} Terdaftar Wajah Kiosk
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Siswa Hadir */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Siswa Hadir</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl sm:text-3xl font-black text-emerald-600">{stats.totalPresent}</h3>
              <span className="text-xs font-bold text-emerald-500">({stats.presentRate}%)</span>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              {format(parseISO(selectedDate), 'dd MMMM yyyy', { locale: id })}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Siswa Tidak Hadir / Belum Scan */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Tidak Hadir / Alpa</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl sm:text-3xl font-black text-rose-600">{stats.totalAbsent}</h3>
              <span className="text-xs font-bold text-rose-500">
                ({stats.totalStudents > 0 ? Math.round((stats.totalAbsent / stats.totalStudents) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[11px] text-rose-700 font-medium mt-1">
              Belum scan wajah hari ini
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Siswa Izin / Sakit */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Izin & Sakit</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl sm:text-3xl font-black text-amber-600">{stats.totalPermission + stats.totalSick}</h3>
              <span className="text-xs font-medium text-slate-500">
                ({stats.totalPermission} Izin, {stats.totalSick} Sakit)
              </span>
            </div>
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              Status dispensasi khusus
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Bar & View Selector */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* View Mode Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'daily' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rekap Harian
            </button>
            <button
              onClick={() => setViewMode('monthly_summary')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'monthly_summary' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Akumulasi Bulanan
            </button>
            <button
              onClick={() => setViewMode('all_logs')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'all_logs' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Log Real-Time
            </button>
          </div>

          {/* Date Picker / Month Selector */}
          <div className="flex items-center gap-2">
            {viewMode === 'daily' ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Hari Ini
                </button>
              </div>
            ) : viewMode === 'monthly_summary' ? (
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </div>

        {/* Search & Sub-filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama siswa atau no. WA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Kelas:</span>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {uniqueGroups.map(grp => (
                <option key={grp} value={grp}>{grp === 'Semua' ? 'Semua Kelompok / Kelas' : grp}</option>
              ))}
            </select>
          </div>

          {viewMode === 'daily' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 shrink-0">Status:</span>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="Semua">Semua Status</option>
                <option value="Hadir">Hadir (Scan Wajah)</option>
                <option value="Tidak Hadir">Tidak Hadir / Alpa</option>
                <option value="Izin">Izin</option>
                <option value="Sakit">Sakit</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Table Area */}
      {viewMode === 'daily' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Daftar Kehadiran Siswa — {format(parseISO(selectedDate), 'EEEE, dd MMMM yyyy', { locale: id })}
              </h3>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Menampilkan {filteredDailyRecords.length} dari {students.length} Siswa
            </span>
          </div>

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs font-medium">Memuat data presensi siswa...</p>
            </div>
          ) : filteredDailyRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">Tidak ada data siswa yang cocok</p>
              <p className="text-xs text-slate-400 mt-0.5">Coba sesuaikan filter pencarian atau kelompok.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Siswa</th>
                    <th className="py-3 px-4">Kelompok/Kelas</th>
                    <th className="py-3 px-4 text-center">Status Kehadiran</th>
                    <th className="py-3 px-4 text-center">Waktu Datang</th>
                    <th className="py-3 px-4 text-center">Waktu Pulang</th>
                    <th className="py-3 px-4 text-center">Biometrik Wajah</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDailyRecords.map((record, index) => {
                    const isHadir = record.status === 'Hadir';
                    const isAlpa = record.status === 'Alpa' || record.status === 'Belum Hadir';
                    const isIzin = record.status === 'Izin';
                    const isSakit = record.status === 'Sakit';

                    return (
                      <tr key={record.student.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center font-mono text-slate-400">{index + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {record.snapshot ? (
                              <img
                                src={record.snapshot}
                                alt="Face Snapshot"
                                className="w-9 h-9 rounded-xl object-cover border border-emerald-300 shadow-sm shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                                {record.student.nama_lengkap.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => handleOpenStudentDetail(record.student)}>
                                {record.student.nama_lengkap}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {record.student.nomor_whatsapp || 'Tanpa WA'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-600">
                          {record.student.kelompok || <span className="text-slate-400 italic">Tanpa Kelas</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isHadir ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            isIzin ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            isSakit ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                            'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {isHadir && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {isAlpa && <XCircle className="w-3 h-3 text-rose-600" />}
                            {isIzin && <AlertCircle className="w-3 h-3 text-amber-600" />}
                            {isSakit && <AlertCircle className="w-3 h-3 text-blue-600" />}
                            <span>{record.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                          {record.timeIn !== '-' ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {record.timeIn} WIB
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                          {record.timeOut !== '-' ? (
                            <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {record.timeOut} WIB
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {record.hasFaceBiometric ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                              <ShieldCheck className="w-3 h-3 text-indigo-600" />
                              <span>Aktif</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Belum Ada</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingStudentStatus(record);
                                setManualStatusInput(record.status === 'Alpa' ? 'Hadir' : record.status as any);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors"
                              title="Ubah status kehadiran siswa manual"
                            >
                              Ubah Status
                            </button>
                            <button
                              onClick={() => handleOpenStudentDetail(record.student)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                              title="Lihat riwayat presensi siswa"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Monthly Summary View */}
      {viewMode === 'monthly_summary' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Akumulasi Presensi Siswa — {monthNames[selectedMonth]} {selectedYear}
            </h3>
            <span className="text-xs font-medium text-slate-500">
              Total {monthlySummaryRecords.length} Siswa
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4 text-center text-emerald-700">Total Hadir</th>
                  <th className="py-3 px-4 text-center text-amber-700">Izin</th>
                  <th className="py-3 px-4 text-center text-blue-700">Sakit</th>
                  <th className="py-3 px-4 text-center text-rose-700">Alpa / Belum</th>
                  <th className="py-3 px-4 text-center">% Kehadiran</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlySummaryRecords.map((item, idx) => (
                  <tr key={item.student.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {item.student.nama_lengkap}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-600">
                      {item.student.kelompok || '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600 font-mono">
                      {item.presentCount} Hari
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-amber-600 font-mono">
                      {item.izinCount}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-blue-600 font-mono">
                      {item.sakitCount}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-rose-600 font-mono">
                      {item.absentCount}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.attendancePercent >= 80 ? 'bg-emerald-500' :
                              item.attendancePercent >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${item.attendancePercent}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-700">{item.attendancePercent}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenStudentDetail(item.student)}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold transition-colors"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Logs View */}
      {viewMode === 'all_logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Riwayat Log Scan Wajah Kiosk Terkini (30 Hari Terakhir)
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              {attendanceLogs.length} Aktivitas Scan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Foto Wajah</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Waktu Presensi</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Metode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendanceLogs.map((log, idx) => {
                  const student = students.find(s => s.id === log.student_id);
                  const timeFormatted = log.waktu ? format(new Date(log.waktu), 'HH:mm:ss') : log.created_at ? format(new Date(log.created_at), 'HH:mm:ss') : '-';
                  const dateFormatted = log.tanggal || (log.created_at ? format(new Date(log.created_at), 'yyyy-MM-dd') : '-');

                  return (
                    <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        {log.snapshot || log.photo ? (
                          <img
                            src={log.snapshot || log.photo}
                            alt="Snapshot"
                            className="w-10 h-10 rounded-xl object-cover border-2 border-emerald-400 shadow-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold">
                            <ScanFace className="w-5 h-5" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {student?.nama_lengkap || log.student_name || 'Siswa'}
                        {student?.kelompok && (
                          <span className="block text-[10px] font-normal text-slate-400">{student.kelompok}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-600">{dateFormatted}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{timeFormatted} WIB</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {log.status || 'Hadir'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-semibold">
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          <span>Gemini Face Mesh</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Detail Student Attendance History */}
      {selectedStudentDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 font-bold">
                  {selectedStudentDetail.nama_lengkap.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedStudentDetail.nama_lengkap}</h3>
                  <p className="text-xs text-slate-300">
                    {selectedStudentDetail.kelompok || 'Tanpa Kelas'} • {selectedStudentDetail.nomor_whatsapp || '-'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudentDetail(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between bg-indigo-50/70 p-3 rounded-2xl border border-indigo-100 text-xs">
                <div>
                  <span className="text-slate-500">Biometrik Wajah: </span>
                  <span className="font-bold text-indigo-700">
                    {selectedStudentDetail.face_descriptor ? 'Terdaftar & Aktif' : 'Belum Didaftarkan'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Total Scan Log: </span>
                  <span className="font-bold text-indigo-700">{studentDetailLogs.length} Hari</span>
                </div>
              </div>

              {loadingDetail ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                  <p className="text-xs font-medium">Memuat histori kehadiran siswa...</p>
                </div>
              ) : studentDetailLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Belum ada riwayat scan wajah</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Histori Pemindaian Kiosk</h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {studentDetailLogs.map((log, idx) => (
                      <div key={log.id || idx} className="p-3 bg-white flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          {log.snapshot || log.photo ? (
                            <img
                              src={log.snapshot || log.photo}
                              alt="Log Snapshot"
                              className="w-10 h-10 rounded-xl object-cover border border-emerald-400 shadow-sm shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-800">{log.tanggal}</p>
                            <p className="text-[11px] font-mono text-slate-500">
                              Pukul {log.waktu ? format(new Date(log.waktu), 'HH:mm:ss') : '-'} WIB
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {log.status || 'Hadir'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedStudentDetail(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Manual Attendance Status */}
      {editingStudentStatus && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Ubah Status Presensi Siswa
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {editingStudentStatus.student.nama_lengkap} • {format(parseISO(selectedDate), 'dd MMMM yyyy', { locale: id })}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Pilih Status Baru:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'Hadir', label: 'Hadir', color: 'border-emerald-500 text-emerald-700 bg-emerald-50' },
                  { value: 'Izin', label: 'Izin', color: 'border-amber-500 text-amber-700 bg-amber-50' },
                  { value: 'Sakit', label: 'Sakit', color: 'border-blue-500 text-blue-700 bg-blue-50' },
                  { value: 'Alpa', label: 'Alpa (Tidak Hadir)', color: 'border-rose-500 text-rose-700 bg-rose-50' },
                ].map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setManualStatusInput(st.value as any)}
                    className={`p-3 rounded-xl border-2 text-xs font-bold text-center transition-all ${
                      manualStatusInput === st.value
                        ? st.color + ' shadow-sm scale-105'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingStudentStatus(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveManualStatus}
                disabled={savingManualStatus}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {savingManualStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
