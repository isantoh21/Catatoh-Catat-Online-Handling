import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Plus, X, Upload, Edit2, Trash2, Download, RefreshCw, Search, AlertTriangle, 
  CheckCircle2, GraduationCap, RotateCcw, Camera, UserCheck, Copy, Share2, 
  ExternalLink, Globe, Monitor, ScanFace, Sparkles, ShieldCheck, Smartphone, 
  Laptop, Bookmark, Info, MessageCircle, FileText, Users
} from 'lucide-react';
import { logActivity } from '../lib/activityLogger';
import { generateKioskToken } from '../lib/kioskAuth';
import Papa from 'papaparse';
import ConfirmModal from './ConfirmModal';
import StudentFaceRegistration from './students/StudentFaceRegistration';
import StudentAttendanceKiosk from './students/StudentAttendanceKiosk';
import StudentAttendanceReports from './students/StudentAttendanceReports';

export default function StudentsView() {
  const [mainTab, setMainTab] = useState<'students' | 'reports'>('students');
  const [students, setStudents] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFaceRegistrationOpen, setIsFaceRegistrationOpen] = useState(false);
  const [isAttendanceKioskOpen, setIsAttendanceKioskOpen] = useState(false);
  const [copiedAttendance, setCopiedAttendance] = useState(false);
  const [copiedRegistration, setCopiedRegistration] = useState(false);
  const [browserHomeModal, setBrowserHomeModal] = useState<{
    url: string;
    title: string;
    subtitle: string;
    theme: 'emerald' | 'indigo';
  } | null>(null);
  const [isCopiedModalUrl, setIsCopiedModalUrl] = useState(false);
  const [activeDeviceTab, setActiveDeviceTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const [nama, setNama] = useState('');
  const [whatsapp, setWhatsapp] = useState('62');
  const [nominalSpp, setNominalSpp] = useState('100000');
  const [kelompok, setKelompok] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [duplicateModal, setDuplicateModal] = useState<{isOpen: boolean, duplicates: any[]}>({isOpen: false, duplicates: []});
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; confirmText?: string; onConfirm: () => void } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('Semua Kelompok');
  const [activeStatusTab, setActiveStatusTab] = useState<'aktif'|'lulus'>('aktif');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) {
        setCurrentUserId(data.session.user.id);
      }
    });
    fetchStudents();

    const channel = supabase
      .channel('realtime-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload) => {
        console.log('Real-time update on students:', payload);
        fetchStudents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    if (!currentUser) {
      setStudents([]);
      setLoading(false);
      return;
    }
    setCurrentUserId(currentUser.id);

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (data) setStudents(data);
    setLoading(false);
  };

  const getAttendanceKioskUrl = () => {
    if (!currentUserId) return '';
    const token = generateKioskToken(currentUserId, 'scan');
    return `${window.location.origin}/absen-siswa/${currentUserId}?auth=${token}`;
  };

  const getRegistrationKioskUrl = () => {
    if (!currentUserId) return '';
    const token = generateKioskToken(currentUserId, 'manage');
    return `${window.location.origin}/daftar-wajah-siswa/${currentUserId}?auth=${token}`;
  };

  const handleShareWhatsApp = (type: 'attendance' | 'registration') => {
    const isAtt = type === 'attendance';
    const url = isAtt ? getAttendanceKioskUrl() : getRegistrationKioskUrl();
    if (!url) return;
    const title = isAtt ? 'Stand Absensi Wajah Siswa' : 'Kiosk Pendaftaran & Reset Wajah Siswa';
    const desc = isAtt
      ? 'Silakan gunakan link ini di tablet atau laptop lobi/kelas untuk presensi wajah siswa harian.'
      : 'Gunakan link ini untuk mendaftarkan foto biometrik wajah siswa baru atau melakukan reset biometrik wajah siswa.';
    const text = `Halo Bapak/Ibu Guru & Operator,\n\nBerikut link khusus *${title}*:\n${url}\n\n${desc}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = async (url: string, type: 'attendance' | 'registration') => {
    if (!url) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      if (type === 'attendance') {
        setCopiedAttendance(true);
        setTimeout(() => setCopiedAttendance(false), 3000);
      } else {
        setCopiedRegistration(true);
        setTimeout(() => setCopiedRegistration(false), 3000);
      }
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleOpenBrowserHomeGuide = (type: 'attendance' | 'registration') => {
    if (type === 'attendance') {
      setBrowserHomeModal({
        url: getAttendanceKioskUrl(),
        title: 'Stand Absensi Wajah Siswa',
        subtitle: 'Kiosk terkunci khusus absensi harian siswa (Layar Tablet / Lobi Sekolah)',
        theme: 'emerald'
      });
    } else {
      setBrowserHomeModal({
        url: getRegistrationKioskUrl(),
        title: 'Kiosk Registrasi & Reset Wajah Siswa',
        subtitle: 'Khusus operator untuk mendaftarkan dan mereset biometrik wajah siswa',
        theme: 'indigo'
      });
    }
    setIsCopiedModalUrl(false);
    setActiveDeviceTab('android');
  };

  const resetModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNama('');
    setWhatsapp('62');
    setNominalSpp('100000');
    setKelompok('');
    setError('');
  };

    const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!whatsapp.startsWith('62')) {
      setError('Nomor WhatsApp harus diawali dengan 62');
      return;
    }
    
    if (!nominalSpp || isNaN(Number(nominalSpp))) {
      setError('Nominal SPP harus berupa angka yang valid');
      return;
    }

    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    if (!currentUser) {
      setError('Sesi login tidak ditemukan. Silakan login kembali.');
      return;
    }

    // Check for duplicates before updating/inserting
    let query = supabase.from('students').select('id').eq('user_id', currentUser.id).ilike('nama_lengkap', nama);
    if (editingId) {
      // Exclude current student being edited
      query = query.neq('id', editingId);
    }
    
    const { data: existingStudents } = await query;
    
    if (existingStudents && existingStudents.length > 0) {
      setError(`Siswa dengan nama "${nama}" sudah ada di database.`);
      return;
    }

    if (editingId) {
      const { error: updateError } = await supabase.from('students')
        .update({ nama_lengkap: nama, nomor_whatsapp: whatsapp, nominal_spp: Number(nominalSpp), kelompok: kelompok || null })
        .eq('id', editingId)
        .eq('user_id', currentUser.id);
        
      if (updateError) {
        setError(updateError.message);
      } else {
        await logActivity('Ubah Data Siswa', `Mengubah data siswa: ${nama}`);
        resetModal();
        fetchStudents();
      }
    } else {
      const { error: insertError } = await supabase.from('students').insert([{ user_id: currentUser.id, nama_lengkap: nama, nomor_whatsapp: whatsapp, nominal_spp: Number(nominalSpp), status_aktif: true, kelompok: kelompok || null }]);

      if (insertError) {
        setError(insertError.message);
      } else {
        await logActivity('Tambah Siswa', `Menambah data siswa baru: ${nama}`);
        resetModal();
        fetchStudents();
      }
    }
  };

  const handleDelete = (id: string, studentName?: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Data Siswa',
      message: `Apakah Anda yakin ingin menghapus data siswa${studentName ? ` "${studentName}"` : ''}? Seluruh riwayat pembayaran siswa ini juga akan terhapus secara permanen.`,
      confirmText: 'Ya, Hapus Data',
      onConfirm: () => executeDelete(id)
    });
  };

  const executeDelete = async (id: string) => {
    setConfirmModal(null);
    setLoading(true);
    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    if (currentUser) {
      // Hapus pembayaran terkait dulu
      await supabase.from('payments').delete().eq('student_id', id).eq('user_id', currentUser.id);
      
      // Hapus siswa
      const { error } = await supabase.from('students').delete().eq('id', id).eq('user_id', currentUser.id);
      
      if (error) {
        alert('Gagal menghapus: ' + error.message);
      } else {
        await logActivity('Hapus Siswa', `Menghapus data siswa ID: ${id}`);
        fetchStudents();
      }
    }
    setLoading(false);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Massal Data Siswa',
      message: `Apakah Anda yakin ingin menghapus ${selectedIds.length} data siswa terpilih? Seluruh riwayat pembayaran mereka juga akan terhapus.`,
      confirmText: 'Ya, Hapus Semua Terpilih',
      onConfirm: executeBulkDelete
    });
  };

  const executeBulkDelete = async () => {
    setConfirmModal(null);
    setLoading(true);
    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    if (currentUser) {
      await supabase.from('payments').delete().in('student_id', selectedIds).eq('user_id', currentUser.id);
      const { error } = await supabase.from('students').delete().in('id', selectedIds).eq('user_id', currentUser.id);
      
      if (error) {
        alert('Gagal menghapus: ' + error.message);
      } else {
        await logActivity('Hapus Massal Siswa', `Menghapus ${selectedIds.length} data siswa beserta riwayat pembayarannya`);
        setSelectedIds([]);
        fetchStudents();
      }
    }
    setLoading(false);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(students.map((s: any) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const openEditModal = (student: any) => {
    setEditingId(student.id);
    setNama(student.nama_lengkap);
    setWhatsapp(student.nomor_whatsapp);
    setNominalSpp(student.nominal_spp?.toString() || '100000');
    setKelompok(student.kelompok || '');
    setIsModalOpen(true);
  };

  
  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction: direction as 'asc' | 'desc' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const parsedData = results.data as any[];
        
        // Validasi header CSV
        if (parsedData.length > 0 && (!parsedData[0].hasOwnProperty('nama_lengkap') || !parsedData[0].hasOwnProperty('nomor_whatsapp'))) {
          alert('Format CSV salah. Pastikan header adalah: nama_lengkap, nomor_whatsapp, nominal_spp (opsional), kelompok (opsional)');
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const currentUser = (await supabase.auth.getSession()).data.session?.user;
        if (!currentUser) {
          alert('Sesi login tidak ditemukan.');
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const validStudents = parsedData
          .map(row => {
            let wa = String(row.nomor_whatsapp).replace(/\D/g, '');
            if (wa && !wa.startsWith('62')) wa = '62' + wa;
            
            // Ambil nominal_spp, default 100000 jika kosong atau tidak valid
            let nominalSpp = 100000;
            if (row.nominal_spp && !isNaN(Number(row.nominal_spp))) {
              nominalSpp = Number(row.nominal_spp);
            }

            return {
              user_id: currentUser.id,
              nama_lengkap: row.nama_lengkap,
              nomor_whatsapp: wa,
              nominal_spp: nominalSpp,
              status_aktif: true,
              kelompok: row.kelompok || null
            };
          })
          .filter(s => s.nama_lengkap && s.nomor_whatsapp);

        if (validStudents.length === 0) {
          alert('Tidak ada data valid untuk diimport.');
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        // Cek duplikasi dengan data yang sudah ada di database (students state)
        // dan cegah duplikat dalam CSV sendiri
        const existingNames = new Set(students.map(s => s.nama_lengkap.toLowerCase().trim()));
        const uniqueUploads = [];
        const seenInCsv = new Set();

        for (const s of validStudents) {
          const nameKey = s.nama_lengkap.toLowerCase().trim();
          if (!existingNames.has(nameKey) && !seenInCsv.has(nameKey)) {
            uniqueUploads.push(s);
            seenInCsv.add(nameKey);
          }
        }

        if (uniqueUploads.length === 0) {
          alert('Semua data dalam CSV sudah ada di database atau merupakan duplikat.');
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const { error: insertError } = await supabase.from('students').insert(uniqueUploads);
        
        if (insertError) {
          alert('Gagal mengimport: ' + insertError.message);
        } else {
          const skippedCount = validStudents.length - uniqueUploads.length;
          let msg = 'Berhasil mengimport ' + uniqueUploads.length + ' siswa baru!';
          if (skippedCount > 0) {
            msg += ' (' + skippedCount + ' data dilewati karena dobel)';
          }
          await logActivity('Import CSV', `Mengimport ${uniqueUploads.length} data siswa dari CSV`);
          alert(msg);
          fetchStudents();
        }
        
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (err) => {
        alert('Gagal membaca file CSV: ' + err.message);
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const downloadTemplate = () => {
    const csvContent = "nama_lengkap,nomor_whatsapp,nominal_spp,kelompok\nAhmad,628123456789,150000,Kelas A\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_siswa.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  
  const baseFilteredStudents = students.filter(s => {
    const isAktifMatch = activeStatusTab === 'aktif' ? s.status_aktif === true : s.status_aktif === false;
    const matchSearch = s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        s.nomor_whatsapp.includes(searchQuery);
    const matchKelompok = filterKelompok === 'Semua Kelompok' || s.kelompok === filterKelompok;
    return matchSearch && matchKelompok && isAktifMatch;
  });

  // Apply sorting
  const sortedStudents = [...baseFilteredStudents].sort((a, b) => {
    if (!sortConfig) return 0;
    const aValue = (a[sortConfig.key] || '').toString().toLowerCase();
    const bValue = (b[sortConfig.key] || '').toString().toLowerCase();
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Apply pagination
  const totalPages = Math.ceil(sortedStudents.length / itemsPerPage);
  const paginatedStudents = sortedStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  
  const handleCheckDuplicates = () => {
    const studentMap = new Map();
    
    students.forEach(s => {
      const key = `${s.nama_lengkap.toLowerCase().trim()}_${s.kelompok || ''}`;
      if (!studentMap.has(key)) {
        studentMap.set(key, []);
      }
      studentMap.get(key).push(s);
    });

    const duplicates = [];
    studentMap.forEach((sList, key) => {
      if (sList.length > 1) {
        duplicates.push({
          nama_lengkap: sList[0].nama_lengkap,
          kelompok: sList[0].kelompok,
          records: sList
        });
      }
    });

    setDuplicateModal({ isOpen: true, duplicates });
  };

  const handleDeleteDuplicateStudent = async (studentId) => {
    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    if (currentUser) {
      const { count } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .eq('user_id', currentUser.id);
        
      if (count && count > 0) {
        alert('Siswa ini sudah memiliki riwayat pembayaran. Harap hapus riwayat pembayarannya terlebih dahulu.');
        return;
      }
      
      const { error } = await supabase.from('students').delete().eq('id', studentId).eq('user_id', currentUser.id);
      if (!error) {
        await logActivity('Hapus Duplikat', `Menghapus data siswa duplikat ID: ${studentId}`);
        setStudents(prev => prev.filter(s => s.id !== studentId));
        setDuplicateModal(prev => {
          const newDups = prev.duplicates.map(d => ({
            ...d,
            records: d.records.filter((r) => r.id !== studentId)
          })).filter(d => d.records.length > 1);
          return { ...prev, duplicates: newDups };
        });
      } else {
        alert('Gagal menghapus data: ' + error.message);
      }
    }
  };

  const uniqueKelompokList = Array.from(new Set(students.map(s => s.kelompok).filter(Boolean)));

  const handleToggleStatus = async (id: string, currentStatus: boolean, name: string) => {
    if (window.confirm(`Yakin ingin ${currentStatus ? 'me-nonaktifkan' : 'mengaktifkan'} siswa ${name}?`)) {
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      if (!currentUser) return;
      
      const { error } = await supabase
        .from('students')
        .update({ status_aktif: !currentStatus })
        .eq('id', id)
        .eq('user_id', currentUser.id);
        
      if (!error) {
        await logActivity(
          'Ubah Status Siswa', 
          `Mengubah status siswa ${name} menjadi ${!currentStatus ? 'Aktif' : 'Nonaktif'}`
        );
        fetchStudents();
      } else {
        alert('Gagal mengubah status: ' + error.message);
      }
    }
  };
  
  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      {/* Top Header & Sub-menu navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Siswa & Presensi</h1>
          <p className="text-sm text-slate-500">Kelola data siswa, biometrik wajah Kiosk, dan cek rekapitulasi kehadiran.</p>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          <button
            onClick={() => setMainTab('students')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              mainTab === 'students' ? 'bg-white text-indigo-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Data & Wajah Siswa</span>
          </button>
          <button
            onClick={() => setMainTab('reports')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              mainTab === 'reports' ? 'bg-white text-indigo-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Cek Kehadiran & Laporan</span>
          </button>
        </div>
      </div>

      {mainTab === 'reports' ? (
        <StudentAttendanceReports onNavigateToKiosk={() => setIsAttendanceKioskOpen(true)} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-start justify-end">
            {selectedIds.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
              >
                <Trash2 className="w-4 h-4" /> Hapus Terpilih ({selectedIds.length})
              </button>
            )}
            <button 
              onClick={fetchStudents}
              disabled={loading}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-bold items-center justify-center gap-2 transition-colors shadow-sm hidden sm:flex disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sync
            </button>
            <button 
              onClick={downloadTemplate}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-bold items-center justify-center gap-2 transition-colors shadow-sm hidden sm:flex"
            >
              <Download className="w-4 h-4" /> Template CSV
            </button>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />

            <button 
              onClick={handleCheckDuplicates}
              className="px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <AlertTriangle className="w-4 h-4" /> Cek Data Dobel
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-70"
            >
              <Upload className="w-4 h-4" /> 
              {isImporting ? 'Mengimport...' : 'Import CSV'}
            </button>
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Tambah Siswa
            </button>
          </div>

      {/* Kiosk Shareable Links Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. STAND MURNI ABSENSI SISWA */}
        <div className="bg-gradient-to-br from-slate-900 via-zinc-900 to-slate-950 border border-slate-800 rounded-3xl p-5 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Kiosk Stand Absensi Siswa</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">Terkunci & Aman</span>
            </div>

            <h3 className="text-lg font-black tracking-tight text-white mb-1.5">
              Stand Absensi Wajah Siswa
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Link khusus untuk pemindaian <span className="text-emerald-400 font-semibold">presensi harian siswa</span> di tablet atau laptop lobi/kelas. Pengaturan dan reset wajah disembunyikan agar siswa hanya fokus scan wajah.
            </p>

            {/* Quick URL Display */}
            {currentUserId && (
              <div className="mb-4 bg-black/40 border border-emerald-500/20 rounded-xl p-2.5 flex items-center justify-between gap-2">
                <div className="text-[11px] font-mono text-emerald-300/90 truncate select-all">
                  {getAttendanceKioskUrl()}
                </div>
                <button
                  onClick={() => handleCopyLink(getAttendanceKioskUrl(), 'attendance')}
                  className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
                  title="Salin Link Stand Absensi"
                >
                  {copiedAttendance ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAttendance ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={() => {
                const url = getAttendanceKioskUrl();
                if (url) window.open(url, '_blank');
                else setIsAttendanceKioskOpen(true);
              }}
              className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <Monitor className="w-4 h-4" />
              <span>Buka Stand</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
            <button
              onClick={() => handleCopyLink(getAttendanceKioskUrl(), 'attendance')}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
              title="Salin Link Stand Absensi Siswa"
            >
              {copiedAttendance ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedAttendance ? 'Link Tersalin!' : 'Salin Link'}</span>
            </button>
            <button
              onClick={() => handleShareWhatsApp('attendance')}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 hover:text-white rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shadow-sm"
              title="Bagikan Link Stand Absensi Siswa ke WhatsApp"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>Bagikan WA</span>
            </button>
            <button
              onClick={() => handleOpenBrowserHomeGuide('attendance')}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
              title="Pasang di Beranda Tablet/HP/PC"
            >
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Add to Home</span>
            </button>
          </div>
        </div>

        {/* 2. KIOSK PENDAFTARAN & RESET WAJAH SISWA */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-900/60 rounded-3xl p-5 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Mode Registrasi Wajah Siswa</span>
              </div>
              <span className="text-[11px] text-amber-400/90 font-mono">Daftar & Reset</span>
            </div>

            <h3 className="text-lg font-black tracking-tight text-white mb-1.5">
              Kiosk Pendaftaran Wajah Siswa
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Link khusus operator atau wali kelas untuk <span className="text-amber-300 font-semibold">mendaftarkan wajah siswa baru</span> atau <span className="text-rose-300 font-semibold">mereset biometrik</span> siswa yang telah terdaftar.
            </p>

            {/* Quick URL Display */}
            {currentUserId && (
              <div className="mb-4 bg-black/40 border border-indigo-500/20 rounded-xl p-2.5 flex items-center justify-between gap-2">
                <div className="text-[11px] font-mono text-indigo-300/90 truncate select-all">
                  {getRegistrationKioskUrl()}
                </div>
                <button
                  onClick={() => handleCopyLink(getRegistrationKioskUrl(), 'registration')}
                  className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
                  title="Salin Link Registrasi Wajah"
                >
                  {copiedRegistration ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRegistration ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-indigo-900/40">
            <button
              onClick={() => {
                const url = getRegistrationKioskUrl();
                if (url) window.open(url, '_blank');
                else setIsFaceRegistrationOpen(true);
              }}
              className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap"
            >
              <ScanFace className="w-4 h-4" />
              <span>Buka Registrasi</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
            <button
              onClick={() => handleCopyLink(getRegistrationKioskUrl(), 'registration')}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
              title="Salin Link Registrasi Wajah Siswa"
            >
              {copiedRegistration ? <CheckCircle2 className="w-4 h-4 text-indigo-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedRegistration ? 'Link Tersalin!' : 'Salin Link'}</span>
            </button>
            <button
              onClick={() => handleShareWhatsApp('registration')}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-500/40 text-indigo-300 hover:text-white rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shadow-sm"
              title="Bagikan Link Registrasi Wajah Siswa ke WhatsApp"
            >
              <MessageCircle className="w-4 h-4 text-indigo-400" />
              <span>Bagikan WA</span>
            </button>
            <button
              onClick={() => handleOpenBrowserHomeGuide('registration')}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
              title="Pasang di Beranda Tablet/HP/PC"
            >
              <Globe className="w-4 h-4 text-indigo-400" />
              <span>Add to Home</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Aktif/Lulus */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveStatusTab('aktif'); setCurrentPage(1); }}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeStatusTab === 'aktif' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Siswa Aktif
        </button>
        <button
          onClick={() => { setActiveStatusTab('lulus'); setCurrentPage(1); }}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeStatusTab === 'lulus' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Siswa Lulus
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari nama siswa atau no WhatsApp..." 
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" 
          />
        </div>
        <div className="w-full md:w-64 relative">
          <select
            value={filterKelompok}
            onChange={e => { setFilterKelompok(e.target.value); setCurrentPage(1); }}
            className="w-full pl-4 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 bg-slate-50"
          >
            <option value="Semua Kelompok">Semua Kelompok</option>
            {uniqueKelompokList.map(k => (
              <option key={k as string} value={k as string}>{k as string}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
        <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">Panduan Import CSV</h4>
        <p className="text-sm text-indigo-600">Pastikan file CSV Anda memiliki header baris pertama persis seperti ini: <strong>nama_lengkap, nomor_whatsapp, nominal_spp, kelompok</strong>. (Contoh: <i>Ahmad, 628123456789, 150000, Kelas A</i>)</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={students.length > 0 && selectedIds.length === students.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th onClick={() => handleSort('nama_lengkap')} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors">
    Nama Siswa {sortConfig?.key === 'nama_lengkap' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
  </th>
  <th onClick={() => handleSort('kelompok')} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors">
    Kelompok {sortConfig?.key === 'kelompok' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
  </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">WhatsApp</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Nominal SPP</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">Memuat data...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">Belum ada data siswa.</td></tr>
              ) : (
                paginatedStudents.map((s: any) => (
                  <tr key={s.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(s.id) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(s.id)}
                        onChange={() => handleSelect(s.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                          {s.nama_lengkap.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-slate-800">{s.nama_lengkap}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">{s.kelompok || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-slate-600">{s.nomor_whatsapp}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-700">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(s.nominal_spp || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {s.status_aktif ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-black uppercase tracking-wider">Aktif</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-md text-[10px] font-black uppercase tracking-wider">Nonaktif</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      <button onClick={() => handleToggleStatus(s.id, s.status_aktif, s.nama_lengkap)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title={s.status_aktif ? "Luluskan" : "Aktifkan Kembali"}>
                        {s.status_aktif ? <GraduationCap className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEditModal(s)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(s.id, s.nama_lengkap)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
            <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">Tampilkan</span>
                <select 
                  value={itemsPerPage} 
                  onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 border border-slate-200 rounded-md text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-xs font-bold text-slate-500">data</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 rounded-md text-xs font-bold text-slate-600 transition-colors"
                >
                  Sebelumnya
                </button>
                <span className="text-xs font-bold text-slate-600 px-2">Halaman {currentPage} dari {totalPages || 1}</span>
                <button 
                  disabled={currentPage >= totalPages} 
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 rounded-md text-xs font-bold text-slate-600 transition-colors"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Modal Tambah Siswa */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">{editingId ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</h3>
              <button onClick={() => resetModal()} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddStudent} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-xs font-medium">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Nama Lengkap</label>
                <input 
                  type="text" required value={nama} onChange={e => setNama(e.target.value)}
                  placeholder="Masukkan nama lengkap" 
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
                            <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Kelompok / Kelas (Opsional)</label>
                <select 
                  value={kelompok} 
                  onChange={(e) => setKelompok(e.target.value)} 
                  className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-bold text-slate-700 bg-white" 
                >
                  <option value="">Belum Ada Kelompok</option>
                  {uniqueKelompokList.map(k => <option key={k as string} value={k as string}>{k}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Nomor WhatsApp</label>
                <input 
                  type="tel" required value={whatsapp} 
                  onChange={e => {
                    const val = e.target.value.replace(/\\D/g, '');
                    setWhatsapp(val.length > 0 && !val.startsWith('62') ? '62' + val : val);
                  }}
                  placeholder="628..." 
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Nominal SPP (Rp)</label>
                <input 
                  type="number" required value={nominalSpp} 
                  onChange={e => setNominalSpp(e.target.value)}
                  placeholder="100000" 
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => resetModal()} className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  Batal
                </button>
                <button type="submit" className="flex-1 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">
                  {editingId ? 'Simpan Perubahan' : 'Simpan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {duplicateModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="font-bold text-lg text-slate-800">Cek Data Siswa Dobel</h3>
              </div>
              <button 
                onClick={() => setDuplicateModal({ isOpen: false, duplicates: [] })}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {duplicateModal.duplicates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 mb-2">Semua Data Siswa Aman!</h4>
                  <p className="text-sm text-slate-500 max-w-sm">Tidak ditemukan data siswa yang memiliki nama dan kelompok yang persis sama.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-amber-100 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm font-medium">
                    Ditemukan {duplicateModal.duplicates.length} siswa dengan nama yang sama. Silakan hapus data yang tidak diperlukan. (Siswa yang sudah memiliki catatan pembayaran tidak dapat dihapus di sini)
                  </div>
                  
                  {duplicateModal.duplicates.map((dup, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <div>
                          <h5 className="font-bold text-slate-800">{dup.nama_lengkap}</h5>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{dup.kelompok || 'Tanpa Kelompok'}</p>
                        </div>
                        <span className="px-3 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full">
                          {dup.records.length} Entri
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {dup.records.map((record: any) => (
                          <div key={record.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                            <div>
                              <p className="text-sm font-bold text-slate-700">{record.nomor_whatsapp}</p>
                              <div className="flex flex-col gap-1 mt-2">
                                <p className="text-xs text-slate-500">
                                  SPP: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(record.nominal_spp)}
                                </p>
                                <div className="flex items-center gap-2">
                                  {record.face_descriptor ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                      <CheckCircle2 className="w-3 h-3" /> Wajah Terdaftar
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                                      <X className="w-3 h-3" /> Belum Ada Wajah
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Dibuat: {new Date(record.created_at).toLocaleString('id-ID')}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteDuplicateStudent(record.id)}
                              className="px-3 py-1.5 bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white">
              <button
                onClick={() => setDuplicateModal({ isOpen: false, duplicates: [] })}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText || 'Ya, Hapus'}
          isLoading={loading}
        />
      )}

      {isFaceRegistrationOpen && (
        <StudentFaceRegistration 
          onClose={() => setIsFaceRegistrationOpen(false)} 
          targetUserId={currentUserId}
          initialStudents={students}
        />
      )}

      {isAttendanceKioskOpen && (
        <StudentAttendanceKiosk 
          onClose={() => setIsAttendanceKioskOpen(false)} 
          targetUserId={currentUserId}
        />
      )}

      {/* POPUP: BROWSER HOME & PWA GUIDE MODAL */}
      {browserHomeModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${browserHomeModal.theme === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                    {browserHomeModal.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {browserHomeModal.subtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBrowserHomeModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Link Box with Copy Button */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Alamat Link Kiosk (Salin untuk dibuka di Tablet / HP / PC):
              </label>
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="text"
                  readOnly
                  value={browserHomeModal.url}
                  className="bg-transparent text-xs font-mono text-slate-700 w-full outline-none select-all"
                />
                <button
                  onClick={async () => {
                    try {
                      if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(browserHomeModal.url);
                      } else {
                        const textArea = document.createElement('textarea');
                        textArea.value = browserHomeModal.url;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        textArea.remove();
                      }
                      setIsCopiedModalUrl(true);
                      setTimeout(() => setIsCopiedModalUrl(false), 3000);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-xs ${
                    isCopiedModalUrl
                      ? 'bg-emerald-600 text-white'
                      : browserHomeModal.theme === 'emerald'
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isCopiedModalUrl ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopiedModalUrl ? 'Tersalin!' : 'Salin'}</span>
                </button>
              </div>
            </div>

            {/* Step-by-step Tabs for Device */}
            <div className="space-y-3 pt-1">
              <div className="flex border-b border-slate-200 text-xs font-bold gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDeviceTab('android')}
                  className={`pb-2 px-2 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeDeviceTab === 'android'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Tablet / HP Android</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDeviceTab('ios')}
                  className={`pb-2 px-2 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeDeviceTab === 'ios'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>iPad / iPhone (iOS)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDeviceTab('desktop')}
                  className={`pb-2 px-2 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeDeviceTab === 'desktop'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                  <span>PC / Laptop Lobi</span>
                </button>
              </div>

              {/* Tab Content: Android */}
              {activeDeviceTab === 'android' && (
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs text-slate-700">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>Cara Pasang di Tablet Android (Chrome):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-slate-600">
                    <li>Buka tautan di atas menggunakan browser <strong>Google Chrome</strong> di tablet.</li>
                    <li>Ketuk tombol titik tiga (⋮) di pojok kanan atas browser Chrome.</li>
                    <li>Pilih menu <strong>"Tambahkan ke Layar Utama" (Add to Home screen)</strong> atau <strong>"Instal Aplikasi"</strong>.</li>
                    <li>Kiosk akan terpasang di layar utama tablet tanpa bilah URL/browser sehingga siswa dapat langsung absen wajah.</li>
                  </ol>
                </div>
              )}

              {/* Tab Content: iPad / iOS */}
              {activeDeviceTab === 'ios' && (
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs text-slate-700">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    <span>Cara Pasang di iPad / iPhone (Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-slate-600">
                    <li>Buka tautan di atas menggunakan browser bawaan <strong>Safari</strong> di iPad.</li>
                    <li>Ketuk tombol <strong>Bagikan (Share)</strong> — ikon kotak dengan panah ke atas.</li>
                    <li>Gulir menu lalu ketuk <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong>.</li>
                    <li>Kiosk presensi siswa akan langsung muncul sebagai ikon aplikasi di beranda iPad.</li>
                  </ol>
                </div>
              )}

              {/* Tab Content: Desktop PC */}
              {activeDeviceTab === 'desktop' && (
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs text-slate-700">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Bookmark className="w-4 h-4 text-slate-700" />
                    <span>Jadikan Bookmark & Pintasan Mandiri (Chrome / Edge):</span>
                  </div>
                  <ul className="space-y-1.5 leading-relaxed text-slate-600">
                    <li>&bull; <strong>Simpan Bookmark:</strong> Tekan kombinasi keyboard <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-mono font-bold">Ctrl + D</kbd> (atau <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-mono font-bold">Cmd + D</kbd> di Mac).</li>
                    <li>&bull; <strong>Jendela Layar Penuh (App Mode):</strong> Di Chrome, klik menu titik tiga (⋮) &rarr; <em>Simpan dan bagikan</em> &rarr; <em>Instal / Buat Pintasan</em> &rarr; Centang <strong>"Buka sebagai jendela"</strong>.</li>
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
    </div>
  );
}