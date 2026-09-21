import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, Search, FolderPlus, Folder, Check, Trash2, UserMinus, ChevronRight, UserPlus } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function GroupsView() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'assign' | 'manage'>('assign');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Groups (Assign)
  const [newGroupName, setNewGroupName] = useState('');
  const [targetGroup, setTargetGroup] = useState('');
  
  // Groups (Manage)
  const [selectedManageGroup, setSelectedManageGroup] = useState<string>('');
  
  // Table state
  const [searchQuery, setSearchQuery] = useState('');
  // In assign tab, we default to "Belum Ada Kelompok". In manage, it's driven by selectedManageGroup.
  const [filterKelompok, setFilterKelompok] = useState('Belum Ada Kelompok');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'} | null>({ key: 'nama_lengkap', direction: 'asc' });

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; confirmText?: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    fetchStudents();
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
        .order('nama_lengkap');
        
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
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
    } else {
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

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kelompok Siswa</h1>
          <p className="text-sm text-slate-500">Kelola penempatan siswa ke dalam kelompok/kelas secara batch</p>
        </div>
      </div>
      
      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('assign')}
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
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
          className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'manage' 
            ? 'border-indigo-600 text-indigo-700' 
            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Kelola Anggota Kelompok
        </button>
      </div>

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
              
              {uniqueGroups.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Belum ada kelompok yang dibuat.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {uniqueGroups.map(g => {
                    const count = students.filter(s => s.kelompok === g).length;
                    const isSelected = selectedManageGroup === g;
                    return (
                      <button
                        key={g}
                        onClick={() => { setSelectedManageGroup(g); setCurrentPage(1); }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm transition-colors ${
                          isSelected 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-800 font-bold' 
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="truncate pr-2">{g}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${isSelected ? 'bg-indigo-200 text-indigo-900' : 'bg-slate-100 text-slate-500'}`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {selectedIds.length > 0 && selectedManageGroup && (
                <div className="pt-4 border-t border-slate-100 mt-4">
                  <button
                    onClick={handleRemoveGroup}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <UserMinus className="w-4 h-4" />
                    Keluarkan {selectedIds.length} Siswa
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
             <h3 className="text-xs font-bold text-indigo-900 mb-2 flex items-center gap-1.5">
               <Folder className="w-4 h-4 text-indigo-600" />
               Statistik Kelompok
             </h3>
             <div className="space-y-2 mt-3">
               <div className="flex justify-between items-center text-xs">
                 <span className="text-indigo-700">Total Siswa</span>
                 <span className="font-bold text-indigo-900">{students.length}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                 <span className="text-indigo-700">Sudah Berkelompok</span>
                 <span className="font-bold text-indigo-900">{students.filter(s => s.kelompok).length}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                 <span className="text-rose-600">Belum Ada Kelompok</span>
                 <span className="font-bold text-rose-700">{students.filter(s => !s.kelompok).length}</span>
               </div>
             </div>
          </div>
        </div>

        {/* Main Table Area */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {activeTab === 'assign' ? (
                <select
                  value={filterKelompok}
                  onChange={e => { setFilterKelompok(e.target.value); setCurrentPage(1); }}
                  className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                >
                  <option value="Belum Ada Kelompok">Belum Ada Kelompok</option>
                  <option value="Semua Siswa">Semua Siswa</option>
                  {uniqueGroups.map(g => (
                    <option key={g} value={g}>Kelompok: {g}</option>
                  ))}
                </select>
              ) : (
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-indigo-500" />
                  {selectedManageGroup ? `Anggota Kelompok: ${selectedManageGroup}` : 'Pilih Kelompok...'}
                </h3>
              )}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari nama siswa..." 
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      checked={paginatedStudents.length > 0 && selectedIds.length === paginatedStudents.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th onClick={() => handleSort('nama_lengkap')} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600">
                    Nama Siswa {sortConfig?.key === 'nama_lengkap' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th onClick={() => handleSort('kelompok')} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600">
                    Kelompok Saat Ini {sortConfig?.key === 'kelompok' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-500">Memuat data...</td></tr>
                ) : paginatedStudents.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-500">
                    {activeTab === 'manage' && !selectedManageGroup 
                      ? 'Silakan pilih kelompok terlebih dahulu di menu samping.' 
                      : 'Tidak ada siswa ditemukan.'}
                  </td></tr>
                ) : (
                  paginatedStudents.map(student => (
                    <tr key={student.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(student.id) ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-6 py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(student.id)}
                          onChange={() => handleSelect(student.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-sm font-bold text-slate-800">{student.nama_lengkap}</p>
                      </td>
                      <td className="px-6 py-3">
                        {student.kelompok ? (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-md">
                            {student.kelompok}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
                            Belum Ada Kelompok
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
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
