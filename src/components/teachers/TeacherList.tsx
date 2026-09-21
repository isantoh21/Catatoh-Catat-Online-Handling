import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { generateKioskToken } from '../../lib/kioskAuth';
import { 
  User, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  AlertCircle, 
  Edit2, 
  X, 
  Save, 
  ExternalLink, 
  Monitor, 
  RotateCcw, 
  ScanFace,
  Sparkles, 
  Search, 
  ShieldCheck, 
  Smartphone,
  Globe,
  Plus,
  Loader2,
  Bookmark,
  Check,
  HelpCircle
} from 'lucide-react';

interface TeacherListProps {
  onNavigateToSettings?: () => void;
}

export default function TeacherList({ onNavigateToSettings }: TeacherListProps) {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Add teacher modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNip, setNewNip] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Edit modal state
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editNip, setEditNip] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete confirmation popup state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; nip?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset face confirmation popup state
  const [resetFaceTarget, setResetFaceTarget] = useState<{ id: string; name: string } | null>(null);
  const [isResettingFace, setIsResettingFace] = useState(false);

  // Add to Browser Home Modal State (Replaced Shortcut Desktop)
  const [browserHomeModal, setBrowserHomeModal] = useState<{
    url: string;
    title: string;
    subtitle: string;
    theme: 'emerald' | 'indigo';
  } | null>(null);
  const [isCopiedModalUrl, setIsCopiedModalUrl] = useState(false);
  const [activeDeviceTab, setActiveDeviceTab] = useState<'android' | 'ios' | 'desktop'>('android');

  const [isCopiedAttendance, setIsCopiedAttendance] = useState(false);
  const [isCopiedManage, setIsCopiedManage] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) {
        setCurrentUserId(data.session.user.id);
      }
    });
    fetchTeachers();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg('');
    setTimeout(() => setErrorMsg(''), 7000);
  };

  // Helper to ensure we have the real authenticated user's ID
  const getAuthenticatedUserId = async (): Promise<string> => {
    if (currentUserId) return currentUserId;
    const session = (await supabase.auth.getSession()).data.session;
    if (session?.user?.id) {
      setCurrentUserId(session.user.id);
      return session.user.id;
    }
    return '';
  };

  const fetchTeachers = async () => {
    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setCurrentUserId(currentUser.id);

    // Filter strictly by user_id to prevent any data mixing between accounts
    const res = await supabase
      .from('teachers')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('name', { ascending: true });

    if (res.error) {
      console.error('Error fetching teachers:', res.error);
      showError('Gagal memuat data guru: ' + (res.error.message || ''));
    } else {
      setTeachers(res.data || []);
    }
    setLoading(false);
  };

  // 1. Kiosk Murni Absensi (Untuk Tablet/Stand di Lobi)
  const handleOpenAttendanceKiosk = async () => {
    const uid = await getAuthenticatedUserId();
    if (!uid) {
      showError('Sesi Anda belum terdeteksi. Silakan muat ulang halaman.');
      return;
    }
    const kioskUrl = `${window.location.origin}/absen/${uid}?auth=${generateKioskToken(uid, 'scan')}`;
    window.open(kioskUrl, '_blank');
  };

  const handleCopyAttendanceLink = async () => {
    const uid = await getAuthenticatedUserId();
    if (!uid) {
      showError('Sesi Anda belum terdeteksi. Silakan muat ulang halaman.');
      return;
    }
    const finalUrl = `${window.location.origin}/absen/${uid}?auth=${generateKioskToken(uid, 'scan')}`;
    navigator.clipboard.writeText(finalUrl);
    setIsCopiedAttendance(true);
    setTimeout(() => setIsCopiedAttendance(false), 2000);
  };

  // 2. Kiosk Kelola Wajah (Pendaftaran & Reset)
  const handleOpenManageKiosk = async () => {
    const uid = await getAuthenticatedUserId();
    if (!uid) {
      showError('Sesi Anda belum terdeteksi. Silakan muat ulang halaman.');
      return;
    }
    const manageUrl = `${window.location.origin}/absen/${uid}?auth=${generateKioskToken(uid, 'manage')}`;
    window.open(manageUrl, '_blank');
  };

  const handleCopyManageLink = async () => {
    const uid = await getAuthenticatedUserId();
    if (!uid) {
      showError('Sesi Anda belum terdeteksi. Silakan muat ulang halaman.');
      return;
    }
    const manageUrl = `${window.location.origin}/absen/${uid}?auth=${generateKioskToken(uid, 'manage')}`;
    navigator.clipboard.writeText(manageUrl);
    setIsCopiedManage(true);
    setTimeout(() => setIsCopiedManage(false), 2000);
  };

  // 3. Add to Browser Home Guide Trigger
  const handleOpenBrowserHomeGuide = async (type: 'attendance' | 'manage') => {
    const uid = await getAuthenticatedUserId();
    if (!uid) {
      showError('Sesi Anda belum terdeteksi. Silakan muat ulang halaman.');
      return;
    }
    if (type === 'attendance') {
      setBrowserHomeModal({
        url: `${window.location.origin}/absen/${uid}?auth=${generateKioskToken(uid, 'scan')}`,
        title: 'Stand Presensi Wajah Guru',
        subtitle: 'Pasang Kiosk Presensi di layar beranda tablet atau browser lobi agar siap digunakan setiap hari.',
        theme: 'emerald'
      });
    } else {
      setBrowserHomeModal({
        url: `${window.location.origin}/absen/${uid}?auth=${generateKioskToken(uid, 'manage')}`,
        title: 'Kiosk Registrasi Wajah',
        subtitle: 'Pasang link registrasi di layar operator untuk kemudahan mendaftarkan wajah guru baru.',
        theme: 'indigo'
      });
    }
  };

  // Add new teacher directly from dashboard
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    const cleanNip = newNip.trim();
    if (!cleanName) return;

    setIsAdding(true);
    try {
      const uid = await getAuthenticatedUserId();
      if (!uid) throw new Error('Sesi akun tidak valid.');

      const uniqueId = Math.random().toString(36).substring(2, 7);
      const payload: any = {
        name: cleanName,
        nip: cleanNip || null,
        username: `guru_${uniqueId}`,
        pin: '0000',
        user_id: uid
      };

      let insertRes = await supabase.from('teachers').insert([payload]).select().single();
      if (insertRes.error && (insertRes.error.code === 'PGRST204' || insertRes.error.message?.toLowerCase().includes('nip'))) {
        delete payload.nip;
        insertRes = await supabase.from('teachers').insert([payload]).select().single();
      }

      if (insertRes.error) throw insertRes.error;

      showSuccess(`Guru "${cleanName}" berhasil ditambahkan! Guru kini siap dipindai di Kiosk.`);
      setIsAddModalOpen(false);
      setNewName('');
      setNewNip('');
      fetchTeachers();
    } catch (err: any) {
      console.error('Error adding teacher:', err);
      showError(`Gagal menambahkan guru: ${err.message || 'Terjadi kesalahan sistem.'}`);
    } finally {
      setIsAdding(false);
    }
  };

  // Update teacher
  const openEditModal = (t: any) => {
    setEditingTeacher(t);
    setEditName(t.name || '');
    setEditNip(t.nip || '');
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    const cleanName = editName.trim();
    const cleanNip = editNip.trim();

    if (!cleanName) return;

    setIsUpdating(true);
    try {
      const uid = await getAuthenticatedUserId();
      const updatePayload: any = {
        name: cleanName,
        nip: cleanNip || null
      };

      let query = supabase.from('teachers').update(updatePayload).eq('id', editingTeacher.id);
      if (uid) {
        query = query.eq('user_id', uid);
      }

      let { error } = await query;

      if (error && (error.code === 'PGRST204' || error.message?.toLowerCase().includes('nip'))) {
        delete updatePayload.nip;
        let fallback = supabase.from('teachers').update(updatePayload).eq('id', editingTeacher.id);
        if (uid) fallback = fallback.eq('user_id', uid);
        const res = await fallback;
        error = res.error;
      }

      if (error) throw error;

      setEditingTeacher(null);
      fetchTeachers();
      showSuccess(`Data guru ${cleanName} berhasil diperbarui!`);
    } catch (err: any) {
      console.error('Error updating teacher:', err);
      showError(`Gagal memperbarui guru: ${err.message || 'Terjadi kesalahan.'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Confirmation Delete Action
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const uid = await getAuthenticatedUserId();
      const targetId = deleteTarget.id;
      const targetName = deleteTarget.name;

      // 1. Delete associated attendance_logs first (prevents foreign key constraint errors)
      let logQuery = supabase.from('attendance_logs').delete().eq('teacher_id', targetId);
      if (uid) logQuery = logQuery.eq('user_id', uid);
      await logQuery;

      // 2. Delete associated leave_requests if any
      let leaveQuery = supabase.from('leave_requests').delete().eq('teacher_id', targetId);
      if (uid) leaveQuery = leaveQuery.eq('user_id', uid);
      await leaveQuery;

      // 3. Delete teacher record
      let teacherQuery = supabase.from('teachers').delete().eq('id', targetId);
      if (uid) teacherQuery = teacherQuery.eq('user_id', uid);
      const { error } = await teacherQuery;

      if (error) throw error;

      setDeleteTarget(null);
      fetchTeachers();
      showSuccess(`Data guru "${targetName}" beserta seluruh riwayat presensinya berhasil dihapus.`);
    } catch (err: any) {
      console.error('Error deleting teacher:', err);
      showError(`Gagal menghapus guru: ${err.message || 'Terjadi kendala saat menghapus data.'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Confirmation Reset Face Action
  const handleConfirmResetFace = async () => {
    if (!resetFaceTarget) return;

    setIsResettingFace(true);
    try {
      const uid = await getAuthenticatedUserId();
      let query = supabase.from('teachers').update({ face_descriptor: null }).eq('id', resetFaceTarget.id);
      if (uid) query = query.eq('user_id', uid);
      const { error } = await query;

      if (error) throw error;

      setResetFaceTarget(null);
      fetchTeachers();
      showSuccess(`Data wajah untuk "${resetFaceTarget.name}" berhasil direset! Guru siap scan ulang di Kiosk.`);
    } catch (err: any) {
      console.error('Error resetting face:', err);
      showError(`Gagal mereset data wajah: ${err.message || 'Terjadi kesalahan sistem.'}`);
    } finally {
      setIsResettingFace(false);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.nip && t.nip.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const registeredFaceCount = teachers.filter(t => !!t.face_descriptor).length;

  return (
    <div className="space-y-6">
      {/* Differentiated Kiosk Links Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. KIOSK MURNI ABSENSI (STAND TABLET/LOBI) */}
        <div className="bg-gradient-to-br from-slate-900 via-zinc-900 to-slate-950 border border-slate-800 rounded-3xl p-5 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Kiosk Murni Absensi (Stand Lobi)</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">Terkunci & Aman</span>
            </div>

            <h3 className="text-lg font-black tracking-tight text-white mb-1.5">
              Stand Absensi Guru
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Link ini <span className="text-emerald-400 font-semibold">khusus untuk absensi saja</span>. Tombol pendaftaran dan reset wajah disembunyikan total agar aman dipasang di tablet/layar lobi sekolah tanpa risiko diutak-atik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={handleOpenAttendanceKiosk}
              className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <Monitor className="w-4 h-4" />
              <span>Buka Stand</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
            <button
              onClick={handleCopyAttendanceLink}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
              title="Salin Link Stand Absensi"
            >
              {isCopiedAttendance ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{isCopiedAttendance ? 'Tersalin' : 'Salin'}</span>
            </button>
            <button
              onClick={() => handleOpenBrowserHomeGuide('attendance')}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 hover:text-white rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shadow-sm"
              title="Pasang di Beranda Browser / Layar Utama (HP, Tablet, PC)"
            >
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Add to Browser Home</span>
            </button>
          </div>
        </div>

        {/* 2. KIOSK KELOLA WAJAH (PENDAFTARAN & RESET) */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-900/60 rounded-3xl p-5 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Mode Kelola Wajah (Operator/Admin)</span>
              </div>
              <span className="text-[11px] text-amber-400/90 font-mono">Daftar & Reset</span>
            </div>

            <h3 className="text-lg font-black tracking-tight text-white mb-1.5">
              Kiosk Registrasi & Reset Wajah
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Link khusus operator untuk <span className="text-amber-300 font-semibold">mendaftarkan wajah guru baru</span>, scan ulang, serta <span className="text-rose-300 font-semibold">mereset biometrik wajah</span>. Kiosk ini <span className="text-amber-400 font-bold underline">hanya untuk registrasi</span> dan tidak memproses scan absensi harian.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-indigo-900/40">
            <button
              onClick={handleOpenManageKiosk}
              className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap"
            >
              <ScanFace className="w-4 h-4" />
              <span>Buka Registrasi</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
            <button
              onClick={handleCopyManageLink}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
              title="Salin Link Kelola Wajah"
            >
              {isCopiedManage ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{isCopiedManage ? 'Tersalin' : 'Salin'}</span>
            </button>
            <button
              onClick={() => handleOpenBrowserHomeGuide('manage')}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-500/40 text-indigo-300 hover:text-white rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shadow-sm"
              title="Pasang di Beranda Browser / Layar Utama (HP, Tablet, PC)"
            >
              <Globe className="w-4 h-4 text-indigo-400" />
              <span>Add to Browser Home</span>
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl flex items-start gap-3 text-sm font-medium border border-rose-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl flex items-start gap-3 text-sm font-medium border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* Main Table: Full Width */}
      <div className="w-full space-y-4">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
          {/* Header & Search & Add Teacher Button */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>Daftar Guru & Status Biometrik</span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  {teachers.length}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {registeredFaceCount} dari {teachers.length} guru sudah memiliki data scan wajah aktif.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama atau NIP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={() => {
                  setNewName('');
                  setNewNip('');
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Guru</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Nama Guru & Identitas</th>
                  <th className="px-6 py-3.5 text-center">Status Wajah Biometrik</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        <span>Memuat data guru...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                      {searchQuery ? (
                        'Tidak ada guru yang cocok dengan pencarian.'
                      ) : (
                        <div className="space-y-2">
                          <p>Belum ada data guru.</p>
                          <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah Guru Pertama</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{t.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {t.nip ? `NIP: ${t.nip}` : 'ID: ' + t.id.substring(0, 8)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {t.face_descriptor ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Wajah Terdaftar</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium">
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            <span>Belum Terdaftar</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                        {t.face_descriptor && (
                          <button
                            onClick={() => setResetFaceTarget({ id: t.id, name: t.name })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 rounded-xl transition-colors cursor-pointer"
                            title="Reset Wajah (Hapus data wajah agar bisa scan ulang di Kiosk)"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                            <span>Reset Wajah</span>
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(t)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer inline-block"
                          title="Edit Nama / NIP"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: t.id, name: t.name, nip: t.nip })}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer inline-block"
                          title="Hapus Guru"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* POPUP 1: ADD TO BROWSER HOME GUIDE MODAL (Replaced Old Shortcut Desktop) */}
      {browserHomeModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl border flex-shrink-0 ${
                  browserHomeModal.theme === 'emerald'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                }`}>
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold mb-1 ${
                    browserHomeModal.theme === 'emerald'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Add to Browser Home</span>
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl">
                    Pasang Kiosk ke Beranda Browser
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {browserHomeModal.subtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBrowserHomeModal(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick URL Copy Bar */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Alamat Link Kiosk Sekolah Anda:</span>
                <span className="text-[11px] text-emerald-600 font-bold">Privat & Terisolasi</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-xl">
                <input
                  type="text"
                  readOnly
                  value={browserHomeModal.url}
                  className="bg-transparent border-none text-xs text-slate-700 font-mono flex-1 px-2 focus:outline-none select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(browserHomeModal.url);
                    setIsCopiedModalUrl(true);
                    setTimeout(() => setIsCopiedModalUrl(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isCopiedModalUrl ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopiedModalUrl ? 'Tersalin' : 'Salin Link'}</span>
                </button>
              </div>
            </div>

            {/* Device Selector Tabs */}
            <div className="space-y-3">
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveDeviceTab('android')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeDeviceTab === 'android'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tablet / HP Android
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDeviceTab('ios')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeDeviceTab === 'ios'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  iPad / iPhone (Safari)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDeviceTab('desktop')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeDeviceTab === 'desktop'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Komputer / Laptop PC
                </button>
              </div>

              {/* Tab Content: Android */}
              {activeDeviceTab === 'android' && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-2 text-xs text-slate-700">
                  <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>Cara Pasang di Tablet/HP Android (Google Chrome / Edge)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed text-slate-700">
                    <li>Buka link Kiosk di browser Chrome pada tablet/HP Anda.</li>
                    <li>Ketuk ikon <strong>Menu Titik Tiga (⋮)</strong> di sudut kanan atas browser.</li>
                    <li>Pilih menu <strong>"Tambahkan ke Layar Utama" (Add to Home screen)</strong> atau <strong>"Instal Aplikasi"</strong>.</li>
                    <li>Beri nama Kiosk lalu ketuk <strong>Tambah</strong>.</li>
                    <li>Ikon Kiosk akan langsung terpasang di beranda layar utama tablet dan terbuka dalam mode layar penuh (fullscreen).</li>
                  </ol>
                </div>
              )}

              {/* Tab Content: iOS/iPad */}
              {activeDeviceTab === 'ios' && (
                <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2 text-xs text-slate-700">
                  <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    <span>Cara Pasang di iPad / iPhone (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed text-slate-700">
                    <li>Buka link Kiosk menggunakan browser <strong>Safari</strong> bawaan iPad/iPhone.</li>
                    <li>Ketuk tombol <strong>Bagikan (Share)</strong> — ikon kotak dengan panah ke atas (⎋).</li>
                    <li>Gulir menu ke bawah lalu ketuk <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong>.</li>
                    <li>Ketuk tombol <strong>Tambah (Add)</strong> di pojok kanan atas.</li>
                    <li>Kiosk presensi akan langsung muncul sebagai ikon aplikasi di beranda iPad.</li>
                  </ol>
                </div>
              )}

              {/* Tab Content: Desktop PC */}
              {activeDeviceTab === 'desktop' && (
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs text-slate-700">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Bookmark className="w-4 h-4 text-slate-700" />
                    <span>Jadikan Bookmark & Beranda di PC Lobi (Chrome / Edge)</span>
                  </div>
                  <ul className="space-y-1.5 leading-relaxed text-slate-700">
                    <li>&bull; <strong>Simpan Bookmark Instan:</strong> Buka link di browser lalu tekan kombinasi keyboard <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-mono font-bold">Ctrl + D</kbd> (atau <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-mono font-bold">Cmd + D</kbd> di Mac) lalu simpan ke Bilah Bookmark.</li>
                    <li>&bull; <strong>Buka sebagai Jendela Mandiri:</strong> Di browser Chrome/Edge, klik titik tiga (⋮) &rarr; <em>Simpan dan bagikan</em> &rarr; <em>Instal / Buat Pintasan</em> &rarr; Centang <strong>"Buka sebagai jendela"</strong>.</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBrowserHomeModal(null)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(browserHomeModal.url, '_blank');
                  setBrowserHomeModal(null);
                }}
                className={`px-5 py-2.5 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-md ${
                  browserHomeModal.theme === 'emerald'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka di Tab Baru Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: CONFIRMATION DELETE TEACHER MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl flex-shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-slate-900 text-lg">
                  Konfirmasi Hapus Guru
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Apakah Anda yakin ingin menghapus data guru <strong className="text-slate-900">{deleteTarget.name}</strong>
                  {deleteTarget.nip ? ` (NIP: ${deleteTarget.nip})` : ''}?
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-2xl text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Peringatan Keamanan Data:</span>
              </div>
              <p className="leading-relaxed">
                Tindakan ini tidak dapat dibatalkan. Seluruh riwayat presensi masuk dan pulang yang berkaitan dengan guru ini akan ikut dibersihkan secara aman dari sistem database sekolah Anda.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Guru'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 3: CONFIRMATION RESET FACE MODAL */}
      {resetFaceTarget && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-amber-100 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl flex-shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-slate-900 text-lg">
                  Konfirmasi Reset Wajah
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Reset data biometrik wajah untuk <strong className="text-slate-900">{resetFaceTarget.name}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Informasi:</span>
              </div>
              <p className="leading-relaxed">
                Data rekaman titik wajah akan dikosongkan. Guru dapat melakukan pendaftaran atau scan ulang wajah baru di <strong>Kiosk Registrasi & Reset Wajah</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isResettingFace}
                onClick={() => setResetFaceTarget(null)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isResettingFace}
                onClick={handleConfirmResetFace}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
              >
                {isResettingFace ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>{isResettingFace ? 'Mereset...' : 'Ya, Reset Wajah'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 4: ADD NEW TEACHER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Tambah Guru Baru</h3>
                  <p className="text-xs text-slate-500">Daftarkan nama guru ke database sekolah Anda</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTeacher} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Nama Lengkap Guru *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso, S.Pd"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  NIP / Nomor Identitas (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 198501152010011002"
                  value={newNip}
                  onChange={(e) => setNewNip(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900">
                <span className="font-semibold">Catatan:</span> Setelah nama guru ditambahkan, guru dapat langsung dipindai wajahnya melalui <strong>Kiosk Registrasi Wajah</strong>.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAdding || !newName.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>{isAdding ? 'Menambahkan...' : 'Simpan Guru'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP 5: EDIT TEACHER MODAL */}
      {editingTeacher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Edit Data Guru</h3>
                  <p className="text-xs text-slate-500">Perbarui nama atau identitas guru</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTeacher(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTeacher} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Nama Lengkap Guru
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  NIP / Identitas (Opsional)
                </label>
                <input
                  type="text"
                  value={editNip}
                  onChange={(e) => setEditNip(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating || !editName.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  <Save className="w-4 h-4" />
                  <span>{isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
