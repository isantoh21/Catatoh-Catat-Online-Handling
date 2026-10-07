import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Users, Search, FolderPlus, Folder, Check, Trash2, UserMinus, 
  ChevronRight, UserPlus, GraduationCap, Plus, Edit2, AlertCircle, 
  CheckCircle2, Clock, DollarSign, BookOpen, Sparkles, Filter, X
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { 
  ReRegistrationProgram, 
  getReRegistrationPrograms, 
  saveReRegistrationProgram, 
  deleteReRegistrationProgram,
  updateStudentRequirementStatus
} from '../lib/reRegistrationService';
import { logActivity } from '../lib/activityLogger';

export default function GroupsView() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tab State: 'assign' (Penempatan Siswa), 'manage' (Kelola Anggota), 'reregister' (Daftar ulang/Lulus)
  const [activeTab, setActiveTab] = useState<'assign' | 'manage' | 'reregister'>('assign');
  
  // Selection for Assign & Manage
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Groups (Assign)
  const [newGroupName, setNewGroupName] = useState('');
  const [targetGroup, setTargetGroup] = useState('');
  
  // Groups (Manage)
  const [selectedManageGroup, setSelectedManageGroup] = useState<string>('');
  
  // Table state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('Belum Ada Kelompok');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'} | null>({ key: 'nama_lengkap', direction: 'asc' });

  // Daftar Ulang / Lulus States
  const [programs, setPrograms] = useState<ReRegistrationProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [programFilterType, setProgramFilterType] = useState<'all' | 'daftar_ulang' | 'lulus'>('all');
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ReRegistrationProgram | null>(null);
  
  // Form fields for program modal
  const [progType, setProgType] = useState<'daftar_ulang' | 'lulus'>('daftar_ulang');
  const [progName, setProgName] = useState('');
  const [progFee, setProgFee] = useState<number | string>(150000);
  const [progDeadline, setProgDeadline] = useState('');
  const [progRequirements, setProgRequirements] = useState('');
  const [isSavingProg, setIsSavingProg] = useState(false);

  // Student Enrollment Modal in Program
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrolledStudentIds, setEnrolledStudentIds] = useState<string[]>([]);
  const [enrollSearchQuery, setEnrollSearchQuery] = useState('');

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; confirmText?: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    fetchStudents();
    fetchPrograms();

    const channel = supabase
      .channel('realtime-groups-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        fetchStudents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Reset selections when switching tabs
  useEffect(() => {
    setSelectedIds([]);
    setCurrentPage(1);
    setSearchQuery('');
  }, [activeTab]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      if (!currentUser) return;
      
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', currentUser.id)
        .neq('status_aktif', false)
        .order('nama_lengkap');
        
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const data = await getReRegistrationPrograms();
      setPrograms(data || []);
      if (data && data.length > 0 && !selectedProgramId) {
        setSelectedProgramId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching programs:', err);
    }
  };

  const uniqueGroups = Array.from(new Set(students.map(s => s.kelompok).filter(Boolean))) as string[];

  // If selectedManageGroup is not set but there are groups, set it.
  useEffect(() => {
    if (activeTab === 'manage' && !selectedManageGroup && uniqueGroups.length > 0) {
      setSelectedManageGroup(uniqueGroups[0]);
    }
  }, [activeTab, uniqueGroups, selectedManageGroup]);

  // Derived filtered data based on tab
  const baseFilteredStudents = students.filter(s => {
    const matchSearch = s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchGroup = true;
    if (activeTab === 'assign') {
      matchGroup = filterKelompok === 'Semua Siswa' 
                         ? true 
                         : filterKelompok === 'Belum Ada Kelompok' 
                           ? !s.kelompok 
                           : s.kelompok === filterKelompok;
    } else if (activeTab === 'manage') {
      matchGroup = s.kelompok === selectedManageGroup;
    }
    
    return matchSearch && matchGroup;
  });

  const sortedStudents = [...baseFilteredStudents].sort((a, b) => {
    if (!sortConfig) return 0;
    const aValue = (a[sortConfig.key] || '').toString().toLowerCase();
    const bValue = (b[sortConfig.key] || '').toString().toLowerCase();
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedStudents.length / itemsPerPage);
  const paginatedStudents = sortedStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginatedStudents.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };
  
  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction: direction as 'asc'|'desc' });
  };

  const handleAssignGroup = async () => {
    if (selectedIds.length === 0) return;
    const groupToAssign = newGroupName.trim() || targetGroup;
    
    if (!groupToAssign) {
      alert('Silakan pilih atau masukkan nama kelompok baru.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Penugasan',
      message: `Apakah Anda yakin ingin memasukkan ${selectedIds.length} siswa ke kelompok "${groupToAssign}"?`,
      confirmText: 'Terapkan',
      onConfirm: () => executeAssignGroup(groupToAssign)
    });
  };

  const executeAssignGroup = async (groupName: string) => {
    setConfirmModal(null);
    try {
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      if (!currentUser) return;
      
      const { error } = await supabase
        .from('students')
        .update({ kelompok: groupName })
        .in('id', selectedIds)
        .eq('user_id', currentUser.id);
        
      if (error) throw error;
      
      setSelectedIds([]);
      setNewGroupName('');
      fetchStudents();
    } catch (error: any) {
      console.error('Error assigning group:', error);
      alert('Gagal menerapkan kelompok: ' + error.message);
    }
  };

  const handleRemoveGroup = async () => {
    if (selectedIds.length === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'Keluarkan dari Kelompok',
      message: `Apakah Anda yakin ingin mengeluarkan ${selectedIds.length} siswa dari kelompok ${activeTab === 'manage' ? `"${selectedManageGroup}"` : 'mereka saat ini'}?`,
      confirmText: 'Keluarkan',
      onConfirm: executeRemoveGroup
    });
  };

  const executeRemoveGroup = async () => {
    setConfirmModal(null);
    try {
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      if (!currentUser) return;
      
      const { error } = await supabase
        .from('students')
        .update({ kelompok: null })
        .in('id', selectedIds)
        .eq('user_id', currentUser.id);
        
      if (error) throw error;
      
      setSelectedIds([]);
      fetchStudents();
    } catch (error: any) {
      console.error('Error removing group:', error);
      alert('Gagal mengeluarkan dari kelompok: ' + error.message);
    }
  };

  // --- PROGRAM (DAFTAR ULANG & KELULUSAN) HANDLERS ---
  const handleOpenAddProgramModal = () => {
    setEditingProgram(null);
    setProgType('daftar_ulang');
    setProgName('');
    setProgFee(150000);
    setProgDeadline('');
    setProgRequirements('');
    setIsProgramModalOpen(true);
  };

  const handleOpenEditProgramModal = (prog: ReRegistrationProgram) => {
    setEditingProgram(prog);
    setProgType(prog.type);
    setProgName(prog.name);
    setProgFee(prog.fee);
    setProgDeadline(prog.deadline || '');
    setProgRequirements(prog.requirements || '');
    setIsProgramModalOpen(true);
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progName.trim()) {
      alert('Nama program tidak boleh kosong.');
      return;
    }
    const feeNum = Number(progFee);
    if (isNaN(feeNum) || feeNum < 0) {
      alert('Nominal biaya harus berupa angka valid.');
      return;
    }

    setIsSavingProg(true);
    try {
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      const progToSave: ReRegistrationProgram = {
        id: editingProgram ? editingProgram.id : crypto.randomUUID(),
        user_id: currentUser?.id,
        type: progType,
        name: progName.trim(),
        fee: feeNum,
        deadline: progDeadline.trim() || undefined,
        requirements: progType === 'lulus' ? progRequirements.trim() : '',
        student_ids: editingProgram ? (editingProgram.student_ids || []) : [],
        student_requirements_status: editingProgram ? (editingProgram.student_requirements_status || {}) : {}
      };

      const updated = await saveReRegistrationProgram(progToSave, currentUser?.id);
      setPrograms(updated);
      setSelectedProgramId(progToSave.id);
      setIsProgramModalOpen(false);
      await logActivity(
        editingProgram ? 'Edit Program Daftar Ulang/Lulus' : 'Tambah Program Daftar Ulang/Lulus',
        `${editingProgram ? 'Memperbarui' : 'Menambahkan'} program ${progName} (${progType}) dengan biaya Rp ${feeNum.toLocaleString('id-ID')}`
      );
    } catch (err: any) {
      alert('Gagal menyimpan program: ' + err.message);
    } finally {
      setIsSavingProg(false);
    }
  };

  const handleDeleteProgram = (prog: ReRegistrationProgram) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Kelompok Program',
      message: `Apakah Anda yakin ingin menghapus kelompok "${prog.name}"? Data tagihan siswa di kelompok ini akan dihapus dari program.`,
      confirmText: 'Hapus Program',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const currentUser = (await supabase.auth.getSession()).data.session?.user;
          const updated = await deleteReRegistrationProgram(prog.id, currentUser?.id);
          setPrograms(updated);
          if (selectedProgramId === prog.id) {
            setSelectedProgramId(updated.length > 0 ? updated[0].id : '');
          }
        } catch (err: any) {
          alert('Gagal menghapus program: ' + err.message);
        }
      }
    });
  };

  // Open Enrollment Modal for current program
  const handleOpenEnrollModal = (prog: ReRegistrationProgram) => {
    setSelectedProgramId(prog.id);
    setEnrolledStudentIds(prog.student_ids || []);
    setEnrollSearchQuery('');
    setIsEnrollModalOpen(true);
  };

  const handleToggleEnrollStudent = (studentId: string) => {
    setEnrolledStudentIds(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSelectAllEnroll = () => {
    const visibleIds = students
      .filter(s => s.nama_lengkap.toLowerCase().includes(enrollSearchQuery.toLowerCase()))
      .map(s => s.id);
    const allSelected = visibleIds.every(id => enrolledStudentIds.includes(id));
    if (allSelected) {
      setEnrolledStudentIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setEnrolledStudentIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleSaveEnrollment = async () => {
    const currentProg = programs.find(p => p.id === selectedProgramId);
    if (!currentProg) return;

    try {
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      const updatedProg: ReRegistrationProgram = {
        ...currentProg,
        student_ids: enrolledStudentIds,
        updated_at: new Date().toISOString()
      };

      const updated = await saveReRegistrationProgram(updatedProg, currentUser?.id);
      setPrograms(updated);
      setIsEnrollModalOpen(false);
      await logActivity(
        'Update Siswa Daftar Ulang/Lulus',
        `Memperbarui anggota kelompok ${currentProg.name} menjadi ${enrolledStudentIds.length} siswa`
      );
    } catch (err: any) {
      alert('Gagal menyimpan siswa ke program: ' + err.message);
    }
  };

  const handleRemoveSingleStudentFromProgram = async (prog: ReRegistrationProgram, studentId: string) => {
    try {
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      const newStudentIds = (prog.student_ids || []).filter(id => id !== studentId);
      const updatedProg: ReRegistrationProgram = {
        ...prog,
        student_ids: newStudentIds,
        updated_at: new Date().toISOString()
      };
      const updated = await saveReRegistrationProgram(updatedProg, currentUser?.id);
      setPrograms(updated);
    } catch (err: any) {
      alert('Gagal mengeluarkan siswa: ' + err.message);
    }
  };

  const handleToggleRequirement = async (prog: ReRegistrationProgram, studentId: string) => {
    const currentStatus = prog.student_requirements_status?.[studentId] || false;
    const newStatus = !currentStatus;
    try {
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      const updatedProg = await updateStudentRequirementStatus(prog.id, studentId, newStatus, currentUser?.id);
      if (updatedProg) {
        setPrograms(prev => prev.map(p => p.id === updatedProg.id ? updatedProg : p));
      }
    } catch (err: any) {
      alert('Gagal memperbarui status syarat khusus: ' + err.message);
    }
  };

  const selectedProgram = programs.find(p => p.id === selectedProgramId);
  const enrolledStudentsInSelectedProg = selectedProgram 
    ? students.filter(s => selectedProgram.student_ids && selectedProgram.student_ids.includes(s.id))
    : [];

  const filteredPrograms = programs.filter(p => {
    if (programFilterType === 'all') return true;
    return p.type === programFilterType;
  });

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kelompok Siswa</h1>
          <p className="text-sm text-slate-500">Kelola penempatan kelas reguler, serta program Daftar Ulang dan Kelulusan</p>
        </div>
      </div>
      
      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('assign')}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'assign' 
            ? 'border-indigo-600 text-indigo-700' 
            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Penempatan Siswa
        </button>
        <button 
          onClick={() => setActiveTab('manage')}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'manage' 
            ? 'border-indigo-600 text-indigo-700' 
            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Kelola Anggota Kelompok
        </button>
        <button 
          onClick={() => setActiveTab('reregister')}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'reregister' 
            ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-lg' 
            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-amber-500" />
          Daftar ulang/Lulus
          {programs.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-indigo-100 text-indigo-700">
              {programs.length}
            </span>
          )}
        </button>
      </div>

      {/* --- TAB 3: DAFTAR ULANG / LULUS --- */}
      {activeTab === 'reregister' ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Controls for Programs */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-400 text-indigo-950">
                  Fitur Akademik
                </span>
                <h2 className="text-xl font-bold">Kelompok Daftar Ulang & Kelulusan</h2>
              </div>
              <p className="text-xs text-indigo-200 mt-1.5 max-w-xl leading-relaxed">
                Buat kelompok jenis daftar ulang atau kelulusan, tetapkan biaya tagihan otomatis ke kartu SPP, serta tambahkan syarat khusus kelulusan.
              </p>
            </div>
            <button
              onClick={handleOpenAddProgramModal}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-indigo-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-transform active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              + Buat Kelompok Program
            </button>
          </div>

          {/* Filter Bar & Program Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Filter Tipe:</span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                  <button
                    onClick={() => setProgramFilterType('all')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      programFilterType === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    Semua ({programs.length})
                  </button>
                  <button
                    onClick={() => setProgramFilterType('daftar_ulang')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      programFilterType === 'daftar_ulang' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    Daftar Ulang ({programs.filter(p => p.type === 'daftar_ulang').length})
                  </button>
                  <button
                    onClick={() => setProgramFilterType('lulus')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      programFilterType === 'lulus' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    Kelulusan ({programs.filter(p => p.type === 'lulus').length})
                  </button>
                </div>
              </div>
            </div>

            {/* Program Cards Grid */}
            {filteredPrograms.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-700">Belum Ada Kelompok Daftar Ulang / Lulus</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Tambahkan kelompok seperti "Daftar Ulang TA 2026/2027" atau "Kelulusan Angkatan VI" untuk menagihkan biaya dan mengatur syarat kelulusan.
                </p>
                <button
                  onClick={handleOpenAddProgramModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Buat Kelompok Sekarang
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPrograms.map(prog => {
                  const isSelected = selectedProgramId === prog.id;
                  const studentCount = (prog.student_ids || []).length;
                  const fulfilledReqCount = prog.type === 'lulus' 
                    ? Object.values(prog.student_requirements_status || {}).filter(Boolean).length
                    : 0;

                  return (
                    <div 
                      key={prog.id}
                      onClick={() => setSelectedProgramId(prog.id)}
                      className={`cursor-pointer rounded-2xl p-5 border transition-all text-left relative ${
                        isSelected 
                          ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 shadow-md' 
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                          prog.type === 'lulus'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        }`}>
                          {prog.type === 'lulus' ? <GraduationCap className="w-3 h-3" /> : <FolderPlus className="w-3 h-3" />}
                          {prog.type === 'lulus' ? 'Kelulusan' : 'Daftar Ulang'}
                        </span>

                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenEditProgramModal(prog)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Program"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProgram(prog)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Program"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-bold text-slate-800 text-base mb-1 truncate" title={prog.name}>
                        {prog.name}
                      </h3>

                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-xs font-semibold text-slate-400">Biaya:</span>
                        <span className="text-sm font-black text-indigo-600">
                          Rp {Number(prog.fee || 0).toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-slate-400">/ siswa</span>
                      </div>

                      {prog.deadline && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">
                            Batas: <b className="text-slate-700">{new Date(prog.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
                          </span>
                        </div>
                      )}

                      {prog.type === 'lulus' && prog.requirements && (
                        <div className="mb-3 p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-left">
                          <p className="text-[10px] font-extrabold uppercase text-amber-900 tracking-wider">Syarat Khusus:</p>
                          <p className="text-xs text-amber-950 font-medium line-clamp-2 mt-0.5">
                            {prog.requirements}
                          </p>
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">
                          <b className="text-slate-800">{studentCount}</b> Siswa Masuk
                        </span>

                        {prog.type === 'lulus' && (
                          <span className="text-[10px] font-bold text-slate-500">
                            Syarat: <b className="text-emerald-600">{fulfilledReqCount}</b>/{studentCount}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Enrolled Students Table for Selected Program */}
          {selectedProgram && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-800">
                      Siswa di Kelompok: <span className="text-indigo-600">{selectedProgram.name}</span>
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      selectedProgram.type === 'lulus' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {selectedProgram.type === 'lulus' ? 'Lulus' : 'Daftar Ulang'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Total tagihan di kartu SPP: <b className="text-slate-800">Rp {Number(selectedProgram.fee).toLocaleString('id-ID')}</b> per siswa
                    {selectedProgram.deadline && (
                      <span> • Batas Bayar: <b className="text-indigo-700">{new Date(selectedProgram.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</b></span>
                    )}
                    {selectedProgram.type === 'lulus' && selectedProgram.requirements && (
                      <span> • Syarat: <b className="text-amber-800">{selectedProgram.requirements}</b></span>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => handleOpenEnrollModal(selectedProgram)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  + Masukkan / Atur Siswa ({enrolledStudentsInSelectedProg.length})
                </button>
              </div>

              {enrolledStudentsInSelectedProg.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-600">Belum ada siswa yang dimasukkan ke kelompok ini.</p>
                  <p className="text-xs text-slate-400">Klik tombol "+ Masukkan / Atur Siswa" di atas untuk memilih siswa yang masuk ke kelompok ini.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <tr>
                        <th className="px-6 py-3">Nama Siswa</th>
                        <th className="px-6 py-3">Kelompok Reguler</th>
                        <th className="px-6 py-3">Nominal Tagihan</th>
                        {selectedProgram.type === 'lulus' && (
                          <th className="px-6 py-3 text-center">Validasi Syarat Khusus</th>
                        )}
                        <th className="px-6 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {enrolledStudentsInSelectedProg.map(student => {
                        const isReqFulfilled = selectedProgram.student_requirements_status?.[student.id] || false;

                        return (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-3.5">
                              <p className="font-bold text-slate-800">{student.nama_lengkap}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{student.nomor_whatsapp}</p>
                            </td>
                            <td className="px-6 py-3.5">
                              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                {student.kelompok || 'Reguler'}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 font-bold text-indigo-600">
                              Rp {Number(selectedProgram.fee).toLocaleString('id-ID')}
                            </td>
                            {selectedProgram.type === 'lulus' && (
                              <td className="px-6 py-3.5 text-center">
                                <button
                                  onClick={() => handleToggleRequirement(selectedProgram, student.id)}
                                  className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-xs ${
                                    isReqFulfilled
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                      : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                                  }`}
                                  title="Klik untuk ubah status syarat khusus"
                                >
                                  {isReqFulfilled ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      Sudah Terpenuhi
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                                      Belum Terpenuhi
                                    </>
                                  )}
                                </button>
                              </td>
                            )}
                            <td className="px-6 py-3.5 text-right">
                              <button
                                onClick={() => handleRemoveSingleStudentFromProgram(selectedProgram, student.id)}
                                className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
                              >
                                Keluarkan
                              </button>
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

          {/* Modal Buat / Edit Program */}
          {isProgramModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="font-bold text-slate-800 text-base">
                    {editingProgram ? 'Edit Kelompok Program' : 'Buat Kelompok Baru'}
                  </h3>
                  <button onClick={() => setIsProgramModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveProgram} className="p-6 space-y-4">
                  {/* Tipe Program */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">Tipe Kelompok</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setProgType('daftar_ulang')}
                        className={`p-3 rounded-xl border text-center font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                          progType === 'daftar_ulang'
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <FolderPlus className="w-5 h-5" />
                        Daftar Ulang
                      </button>
                      <button
                        type="button"
                        onClick={() => setProgType('lulus')}
                        className={`p-3 rounded-xl border text-center font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                          progType === 'lulus'
                            ? 'border-amber-500 bg-amber-50/70 text-amber-900 ring-2 ring-amber-500/20'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <GraduationCap className="w-5 h-5" />
                        Kelulusan (Lulus)
                      </button>
                    </div>
                  </div>

                  {/* Nama Program */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Nama Kelompok</label>
                    <input
                      type="text"
                      required
                      placeholder={progType === 'lulus' ? 'contoh: Kelulusan Angkatan VI' : 'contoh: Daftar Ulang TA 2026/2027'}
                      value={progName}
                      onChange={e => setProgName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Biaya Tagihan */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Biaya Tagihan (Rp)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rp</span>
                      <input
                        type="number"
                        required
                        min={0}
                        step={1000}
                        placeholder="contoh: 250000"
                        value={progFee}
                        onChange={e => setProgFee(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">Nominal ini akan otomatis masuk sebagai tagihan di kartu SPP siswa.</p>
                  </div>

                  {/* Batas Akhir Pembayaran (Deadline) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Batas Akhir / Deadline Pembayaran (Opsional)</span>
                      </label>
                      {progDeadline && (
                        <button
                          type="button"
                          onClick={() => setProgDeadline('')}
                          className="text-[10px] text-rose-500 hover:underline font-bold"
                        >
                          Hapus Batas
                        </button>
                      )}
                    </div>
                    <input
                      type="date"
                      value={progDeadline}
                      onChange={e => setProgDeadline(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                    <p className="text-[11px] text-slate-400">
                      Batas waktu tanggal terakhir bagi orang tua untuk menyelesaikan pembayaran program ini.
                    </p>
                  </div>

                  {/* Syarat Khusus (Khusus Lulus) */}
                  {progType === 'lulus' && (
                    <div className="space-y-1 p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl">
                      <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        Syarat Khusus Kelulusan (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="contoh: Memberikan 2 buku cerita/APE"
                        value={progRequirements}
                        onChange={e => setProgRequirements(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <p className="text-[10px] text-amber-800">
                        Syarat ini akan tercantum di kartu SPP siswa dan dapat divalidasi status pemenuhannya.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsProgramModalOpen(false)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProg}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
                    >
                      {isSavingProg ? 'Menyimpan...' : 'Simpan Program'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Masukkan / Atur Siswa ke Program */}
          {isEnrollModalOpen && selectedProgram && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      Atur Siswa Masuk: {selectedProgram.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pilih siswa yang akan mendapatkan tagihan program ini ({enrolledStudentIds.length} dipilih)
                    </p>
                  </div>
                  <button onClick={() => setIsEnrollModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 border-b border-slate-100 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari nama siswa..."
                      value={enrollSearchQuery}
                      onChange={e => setEnrollSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllEnroll}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl whitespace-nowrap transition-colors"
                  >
                    Pilih Semua / Batal
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
                  {students
                    .filter(s => s.nama_lengkap.toLowerCase().includes(enrollSearchQuery.toLowerCase()))
                    .map(student => {
                      const isChecked = enrolledStudentIds.includes(student.id);
                      return (
                        <label
                          key={student.id}
                          className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                            isChecked ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleEnrollStudent(student.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <div>
                              <p className="text-xs font-bold text-slate-800">{student.nama_lengkap}</p>
                              <p className="text-[10px] text-slate-500">
                                {student.nomor_whatsapp} • Kelompok: {student.kelompok || 'Belum Ada'}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isChecked ? 'bg-indigo-600 text-white' : 'text-slate-400'
                          }`}>
                            {isChecked ? 'Terdaftar' : 'Belum'}
                          </span>
                        </label>
                      );
                    })}
                </div>

                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                  <span className="text-xs font-bold text-slate-600">
                    Total Siswa Terpilih: <b className="text-indigo-600">{enrolledStudentIds.length}</b> Siswa
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEnrollModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEnrollment}
                      className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* --- TAB 1 & 2: PENEMPATAN & KELOLA KELOMPOK REGULER --- */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Controls */}
          <div className="lg:col-span-1 space-y-6">
            {activeTab === 'assign' ? (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <FolderPlus className="w-4 h-4 text-indigo-600" />
                  Terapkan Kelompok
                </h2>
                
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 font-medium">1. Pilih Kelompok Tersedia</p>
                  <select 
                    value={targetGroup}
                    onChange={e => { setTargetGroup(e.target.value); setNewGroupName(''); }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Pilih Kelompok --</option>
                    {uniqueGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-px bg-slate-200 flex-1"></div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Atau</span>
                  <div className="h-px bg-slate-200 flex-1"></div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-slate-500 font-medium">2. Buat Kelompok Baru</p>
                  <input 
                    type="text"
                    placeholder="Nama kelompok baru..."
                    value={newGroupName}
                    onChange={e => { setNewGroupName(e.target.value); setTargetGroup(''); }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  onClick={handleAssignGroup}
                  disabled={selectedIds.length === 0 || (!targetGroup && !newGroupName.trim())}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm mt-4"
                >
                  <Check className="w-4 h-4" />
                  Terapkan ke {selectedIds.length} Siswa
                </button>
              </div>
            ) : (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Folder className="w-4 h-4 text-indigo-600" />
                  Pilih Kelompok
                </h2>
                
                <div className="space-y-2">
                  {uniqueGroups.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Belum ada kelompok yang dibuat.</p>
                  ) : (
                    uniqueGroups.map(g => {
                      const count = students.filter(s => s.kelompok === g).length;
                      return (
                        <button
                          key={g}
                          onClick={() => { setSelectedManageGroup(g); setSelectedIds([]); }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-left border transition-all ${
                            selectedManageGroup === g 
                              ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold' 
                              : 'border-slate-100 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <span className="text-sm truncate">{g}</span>
                          <span className="text-xs bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-500">
                            {count}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                {selectedManageGroup && (
                  <button
                    onClick={handleRemoveGroup}
                    disabled={selectedIds.length === 0}
                    className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 disabled:opacity-50 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors mt-4 border border-rose-200"
                  >
                    <UserMinus className="w-4 h-4" />
                    Keluarkan {selectedIds.length} Siswa
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Table Area */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Cari siswa..." 
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {activeTab === 'assign' && (
                <div className="w-full sm:w-auto flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filter:</span>
                  <select 
                    value={filterKelompok}
                    onChange={e => { setFilterKelompok(e.target.value); setCurrentPage(1); }}
                    className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="Belum Ada Kelompok">Belum Ada Kelompok</option>
                    <option value="Semua Siswa">Semua Siswa</option>
                    {uniqueGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 w-12 text-center">
                      <input 
                        type="checkbox" 
                        checked={paginatedStudents.length > 0 && selectedIds.length === paginatedStudents.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th 
                      onClick={() => handleSort('nama_lengkap')}
                      className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600"
                    >
                      Nama Siswa {sortConfig?.key === 'nama_lengkap' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th 
                      onClick={() => handleSort('kelompok')}
                      className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600"
                    >
                      Kelompok {sortConfig?.key === 'kelompok' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-500">
                        Memuat data siswa...
                      </td>
                    </tr>
                  ) : paginatedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-500">
                        Tidak ada siswa yang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map(student => {
                      const isSelected = selectedIds.includes(student.id);
                      return (
                        <tr 
                          key={student.id} 
                          onClick={() => handleSelect(student.id)}
                          className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}
                        >
                          <td className="px-6 py-3 text-center" onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => handleSelect(student.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <p className="text-sm font-bold text-slate-800">{student.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{student.nomor_whatsapp}</p>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                              student.kelompok ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                              {student.kelompok || 'Belum Ada'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

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
                  className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 rounded-md text-xs font-bold text-slate-600 transition-colors shadow-sm"
                >
                  Sebelumnya
                </button>
                <span className="text-xs font-bold text-slate-600 px-2">Halaman {currentPage} dari {totalPages || 1}</span>
                <button 
                  disabled={currentPage >= totalPages} 
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 rounded-md text-xs font-bold text-slate-600 transition-colors shadow-sm"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
