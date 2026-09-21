import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLogger';
import { Plus, Trash2, Calendar, DollarSign, Search, Tag, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const BULAN_OPTIONS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function ExpensesView() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [namaPengeluaran, setNamaPengeluaran] = useState('');
  const [nominal, setNominal] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Table state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBulan, setFilterBulan] = useState('Semua Bulan');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'} | null>({ key: 'tanggal', direction: 'desc' });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; confirmText?: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      if (!currentUser) return;
      
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', currentUser.id);
        
      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaPengeluaran || !nominal || !tanggal) return;
    
    setIsSubmitting(true);
    try {
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      if (!currentUser) {
        alert('Sesi login tidak ditemukan.');
        return;
      }
      
      const dateObj = new Date(tanggal);
      const bulan = BULAN_OPTIONS[dateObj.getMonth()];
      const tahun = dateObj.getFullYear();
      
      const { error } = await supabase.from('expenses').insert([{
        user_id: currentUser.id,
        nama_pengeluaran: namaPengeluaran,
        nominal: parseInt(nominal.replace(/\D/g, '')),
        tanggal: tanggal,
        bulan: bulan,
        tahun: tahun
      }]);
      
      if (error) throw error;
      
      await logActivity('Tambah Pengeluaran', `Mencatat pengeluaran: ${namaPengeluaran} (Rp ${parseInt(nominal.replace(/\D/g, '')).toLocaleString('id-ID')})`);
      
      setNamaPengeluaran('');
      setNominal('');
      setTanggal(new Date().toISOString().split('T')[0]);
      
      fetchExpenses();
    } catch (error: any) {
      console.error('Error adding expense:', error);
      alert('Gagal menambah pengeluaran: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Pengeluaran',
      message: `Apakah Anda yakin ingin menghapus data pengeluaran \"${name}\"?`,
      confirmText: 'Ya, Hapus',
      onConfirm: () => executeDeleteExpense(id)
    });
  };
  
  const executeDeleteExpense = async (id: string) => {
    setConfirmModal(null);
    try {
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      if (!currentUser) return;
      
      const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', currentUser.id);
      if (error) throw error;
      
      await logActivity('Hapus Pengeluaran', `Menghapus data pengeluaran ID: ${id}`);
      
      fetchExpenses();
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      alert('Gagal menghapus pengeluaran: ' + error.message);
    }
  };

  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(number);
  };
  
  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction: direction as 'asc'|'desc' });
  };
  
  const filteredExpenses = expenses.filter(e => {
    const matchSearch = e.nama_pengeluaran.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.bulan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.tahun.toString().includes(searchQuery.toLowerCase());
    const matchBulan = filterBulan === 'Semua Bulan' || e.bulan === filterBulan;
    return matchSearch && matchBulan;
  });
  
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    if (!sortConfig) return 0;
    
    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];
    
    if (sortConfig.key === 'nominal') {
      aValue = Number(aValue);
      bValue = Number(bValue);
    }
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });
  
  const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage);
  const paginatedExpenses = sortedExpenses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catat Pengeluaran</h1>
          <p className="text-sm text-slate-500">Kelola dan pantau pengeluaran operasional sekolah</p>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
          Input Pengeluaran Baru
        </h2>
        <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal</label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="date"
                required
                value={tanggal}
                onChange={e => setTanggal(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Keterangan / Nama Pengeluaran</label>
            <div className="relative">
              <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                required
                value={namaPengeluaran}
                onChange={e => setNamaPengeluaran(e.target.value)}
                placeholder="Contoh: Beli ATK, Listrik, Internet..."
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nominal (Rp)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rp</span>
              <input 
                type="number"
                required
                value={nominal}
                onChange={e => setNominal(e.target.value)}
                placeholder="0"
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
          <div className="md:col-span-4 mt-2">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}
            </button>
          </div>
        </form>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            Riwayat Pengeluaran
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <select
              value={filterBulan}
              onChange={(e) => { setFilterBulan(e.target.value); setCurrentPage(1); }}
              className="w-full sm:w-40 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white shadow-sm font-semibold text-slate-700"
            >
              <option value="Semua Bulan">Semua Bulan</option>
              {BULAN_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari pengeluaran..." 
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-sm"
              />
              {searchQuery && (
                <button 
                  onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-slate-100">
              <tr>
                <th onClick={() => handleSort('tanggal')} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-rose-600">
                  Tanggal {sortConfig?.key === 'tanggal' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                </th>
                <th onClick={() => handleSort('nama_pengeluaran')} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-rose-600">
                  Keterangan {sortConfig?.key === 'nama_pengeluaran' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                </th>
                <th onClick={() => handleSort('nominal')} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-rose-600 text-right">
                  Nominal {sortConfig?.key === 'nominal' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">Memuat data...</td></tr>
              ) : paginatedExpenses.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">Tidak ada riwayat pengeluaran.</td></tr>
              ) : (
                paginatedExpenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-md">
                        {new Date(expense.tanggal).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800">{expense.nama_pengeluaran}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-rose-600">{formatRupiah(expense.nominal)}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleDeleteExpense(expense.id, expense.nama_pengeluaran)}
                        className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                        title="Hapus"
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
        
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500">Tampilkan</span>
            <select 
              value={itemsPerPage} 
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 border border-slate-200 rounded-md text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
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
