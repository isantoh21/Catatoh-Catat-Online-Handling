import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { CalendarDays, Loader2, Download, X, MapPin, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

export default function AttendanceReports() {
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      // Fetch settings strictly for current user
      let settingsData = null;
      if (currentUser?.id) {
        const { data } = await supabase
          .from('attendance_settings')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        settingsData = data;
      }
      if (settingsData) setSettings(settingsData);
      
      // Default fallback
      const tz = settingsData?.timezone || 'Asia/Jakarta';
      const maxArrival = settingsData?.arrival_end || '07:30';

      // Auto-purge logs older than 7 days to keep storage super minimal
      if (currentUser?.id) {
        try {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          await supabase
            .from('attendance_logs')
            .delete()
            .eq('user_id', currentUser.id)
            .lt('created_at', sevenDaysAgo.toISOString());
        } catch (purgeErr) {
          console.warn('Auto-purge attendance logs error:', purgeErr);
        }
      }

      // Fetch teachers strictly for current user with nip fallback
      let teachersRes = currentUser?.id 
        ? await supabase.from('teachers').select('id, name, nip').eq('user_id', currentUser.id).order('name')
        : { data: null, error: null };

      if (teachersRes.error && (teachersRes.error.code === 'PGRST204' || teachersRes.error.message?.includes('nip'))) {
        teachersRes = await supabase.from('teachers').select('id, name').eq('user_id', currentUser!.id).order('name');
      }

      if (teachersRes.data) setTeachers(teachersRes.data as any);

      // Determine date range in UTC
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      let logsData: any[] = [];
      const teacherIds = (teachersRes.data || []).map((t: any) => t.id);

      if (teacherIds.length > 0 && currentUser?.id) {
        // Primary: fetch logs by teacher IDs isolated by user_id
        let logsRes = await supabase
          .from('attendance_logs')
          .select('*')
          .in('teacher_id', teacherIds)
          .eq('user_id', currentUser.id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        if (!logsRes.error && logsRes.data) {
          logsData = logsRes.data;
        } else {
          // Fallback by user_id
          const fbRes = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('user_id', currentUser.id)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());
          if (fbRes.data) logsData = fbRes.data;
        }
      }

      if (logsData) {
        setLogs(logsData);
      }

      // Fetch approved leave requests for the month strictly for current user
      let leavesData: any[] = [];
      if (teacherIds.length > 0 && currentUser?.id) {
        let leavesRes = await supabase
          .from('leave_requests')
          .select('*')
          .in('teacher_id', teacherIds)
          .eq('user_id', currentUser.id)
          .eq('status', 'approved');

        if (!leavesRes.error && leavesRes.data) {
          leavesData = leavesRes.data;
        } else {
          const fbLeaves = await supabase
            .from('leave_requests')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('status', 'approved');
          if (fbLeaves.data) leavesData = fbLeaves.data;
        }
      }
      
      if (leavesData) {
        setLeaves(leavesData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const reportData = useMemo(() => {
    if (!settings || !teachers.length) return [];
    const tz = settings.timezone || 'Asia/Jakarta';
    const maxArrival = settings.arrival_end || '07:30'; // e.g. "07:30"

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const now = new Date();
    const todayStr = formatInTimeZone(now, tz, 'yyyy-MM-dd');

    return teachers.map(teacher => {
      const teacherLogs = logs.filter(log => log.teacher_id === teacher.id);
      const teacherLeaves = leaves.filter(leave => leave.teacher_id === teacher.id);
      
      const activeDaysStr = teacher.active_work_days || '1,2,3,4,5';
      const activeDaysArr = activeDaysStr.split(',').map(Number);
      
      let presentCount = 0;
      let lateCount = 0;
      let tidakHadirCount = 0;
      let izinCount = 0;
      let sakitCount = 0;
      let cutiCount = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(selectedYear, selectedMonth, day);
        const dayOfWeek = currentDate.getDay(); // 0 = Sun, 6 = Sat
        
        // Format to YYYY-MM-DD for matching
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Check leave requests for this day
        const hasLeave = teacherLeaves.find(leave => {
          if (!leave.start_date || !leave.end_date) {
            return leave.created_at?.startsWith(dateStr);
          }
          return leave.start_date <= dateStr && leave.end_date >= dateStr;
        });

        if (hasLeave) {
          const typeLower = (hasLeave.type || '').toLowerCase();
          if (typeLower === 'izin') izinCount++;
          else if (typeLower === 'sakit') sakitCount++;
          else if (typeLower === 'cuti') cutiCount++;
          continue; // Skip attendance checks if on leave
        }

        // Match logs for this specific date using accurate timezone formatting
        const dayLogs = teacherLogs.filter(log => {
          try {
            const logDateStr = formatInTimeZone(new Date(log.created_at), tz, 'yyyy-MM-dd');
            return logDateStr === dateStr;
          } catch (e) {
            return false;
          }
        });

        const inLog = dayLogs.find(log => log.type === 'in');
        const outLog = dayLogs.find(log => log.type === 'out');

        // Logic for Saturday (bebas)
        if (dayOfWeek === 6) {
          if (inLog) {
             presentCount++;
          }
          // if no log on saturday, it's fine. Not counted as 'Tidak Hadir'.
          continue;
        }

        // Logic for Sunday (libur)
        if (dayOfWeek === 0) {
          continue;
        }

        // Is it an active work day?
        if (!activeDaysArr.includes(dayOfWeek)) {
          // If they are not scheduled to work, we don't count it as absent.
          continue;
        }

        // Normal active working day (Mon-Fri)
        if (inLog) {
          // GURU HADIR: Jika sudah ada log masuk (inLog), guru dihitung HADIR!
          presentCount++;
          
          // Periksa apakah terlambat datang
          try {
            const timeStr = formatInTimeZone(new Date(inLog.created_at), tz, 'HH:mm:ss');
            const formattedMaxArrival = maxArrival.length === 5 ? `${maxArrival}:00` : maxArrival;
            if (timeStr > formattedMaxArrival) {
              lateCount++;
            }
          } catch (e) {
            // fallback
          }
        } else {
          // Tidak ada log masuk sama sekali
          // Hanya dihitung "Tidak Hadir" jika tanggal tersebut sudah lewat dari hari ini
          if (dateStr < todayStr) {
            tidakHadirCount++;
          }
        }
      }

      return {
        id: teacher.id,
        name: teacher.name,
        presentCount,
        lateCount,
        tidakHadirCount,
        izinCount,
        sakitCount,
        cutiCount
      };
    });
  }, [teachers, logs, leaves, settings, selectedYear, selectedMonth]);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const selectedTeacherData = useMemo(() => {
    if (!selectedTeacherId) return null;
    const teacher = teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) return null;

    const teacherLogs = logs.filter(log => log.teacher_id === selectedTeacherId).map(log => ({
      ...log,
      category: 'log'
    }));
    
    const teacherLeaves = leaves.filter(leave => leave.teacher_id === selectedTeacherId).map(leave => ({
      ...leave,
      category: 'leave'
    }));

    const combined = [...teacherLogs, ...teacherLeaves].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return {
      teacher,
      timeline: combined
    };
  }, [selectedTeacherId, teachers, logs, leaves]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Rekapitulasi Kehadiran</h2>
          <p className="text-slate-500 text-sm mt-1">Laporan jumlah kehadiran, keterlambatan, dan ketidakhadiran (izin/sakit/cuti).</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {months.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-sm text-slate-500">
              <th className="px-6 py-4 font-medium">Nama Guru</th>
              <th className="px-6 py-4 font-medium text-center">Hadir</th>
              <th className="px-6 py-4 font-medium text-center">Tepat Waktu</th>
              <th className="px-6 py-4 font-medium text-center">Terlambat</th>
              <th className="px-6 py-4 font-medium text-center text-rose-600">Tidak Hadir</th>
              <th className="px-6 py-4 font-medium text-center">Izin</th>
              <th className="px-6 py-4 font-medium text-center">Sakit</th>
              <th className="px-6 py-4 font-medium text-center">Cuti</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
                  Mengkalkulasi data...
                </td>
              </tr>
            ) : reportData.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                  Belum ada data absensi pada bulan ini.
                </td>
              </tr>
            ) : (
              reportData.map((data) => (
                <tr 
                  key={data.id} 
                  onClick={() => setSelectedTeacherId(data.id)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800 group-hover:text-indigo-600 transition-colors">{data.name}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold">
                      {data.presentCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold">
                      {data.presentCount - data.lateCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold">
                      {data.lateCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold">
                      {data.izinCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold">
                      {data.sakitCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-purple-50 text-purple-700 font-bold">
                      {data.cutiCount}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedTeacherId && selectedTeacherData && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Detail Histori: {selectedTeacherData.teacher.name}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Bulan {months[selectedMonth]} {selectedYear}
                </p>
              </div>
              <button 
                onClick={() => setSelectedTeacherId(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {selectedTeacherData.timeline.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  Tidak ada histori absen atau cuti pada bulan ini.
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedTeacherData.timeline.map((item, idx) => {
                    const dateObj = parseISO(item.created_at);
                    const tz = settings?.timezone || 'Asia/Jakarta';
                    const dateStr = formatInTimeZone(dateObj, tz, 'dd MMM yyyy', { locale: id });
                    const timeStr = formatInTimeZone(dateObj, tz, 'HH:mm');

                    if (item.category === 'log') {
                      return (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                          <div className={`p-3 rounded-xl ${item.type === 'in' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            <Clock className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-slate-800 text-sm">
                                {item.type === 'in' ? 'Absen Masuk' : 'Absen Pulang'}
                              </h4>
                              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                {dateStr}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1.5">
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <span>{timeStr}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                {item.latitude != null && item.longitude != null ? (
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:underline truncate max-w-[200px] sm:max-w-xs block"
                                  >
                                    {Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)}
                                  </a>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">
                                    Presensi Kamera Kiosk (Wajah)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                          <div className={`p-3 rounded-xl ${
                            item.type === 'Izin' ? 'bg-blue-50 text-blue-600' : 
                            item.type === 'Sakit' ? 'bg-amber-50 text-amber-600' : 
                            'bg-purple-50 text-purple-600'
                          }`}>
                            <CalendarDays className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-slate-800 text-sm">
                                Pengajuan {item.type}
                              </h4>
                              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                {dateStr}
                              </span>
                            </div>
                            <div className="mt-2 text-sm text-slate-600">
                              <span className="block italic">"{item.reason}"</span>
                              <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                Disetujui
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
