import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plus, Trash2, Calendar, DollarSign, Search, Tag, X, Database, Printer } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { jsPDF } from 'jspdf';
import { logActivity } from '../lib/activityLogger';

const BULAN_OPTIONS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function OtherIncomeView() {
  const [otherIncomes, setOtherIncomes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [namaPemasukan, setNamaPemasukan] = useState('');
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
  const [isTableMissing, setIsTableMissing] = useState(false);

  useEffect(() => {
    fetchOtherIncomes();
  }, []);

  const fetchOtherIncomes = async () => {
    try {
      setLoading(true);
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      if (!currentUser) return;
      
      const { data, error } = await supabase
        .from('other_incomes')
        .select('*')
        .eq('user_id', currentUser.id);
        
      if (error) {
        if (error.code === 'PGRST205') {
          setIsTableMissing(true);
          return;
        }
        throw error;
      }
      setOtherIncomes(data || []);
    } catch (error) {
      console.error('Error fetching other_incomes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOtherIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaPemasukan || !nominal || !tanggal) return;
    
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
      
      const { error } = await supabase.from('other_incomes').insert([{
        user_id: currentUser.id,
        nama_pemasukan: namaPemasukan,
        nominal: parseInt(nominal.replace(/\D/g, '')),
        tanggal: tanggal,
        bulan: bulan,
        tahun: tahun
      }]);
      
      if (error) throw error;
      
      await logActivity('Tambah Pemasukan', `Mencatat pemasukan lain: ${namaPemasukan} (Rp ${parseInt(nominal.replace(/\D/g, '')).toLocaleString('id-ID')})`);
      
      setNamaPemasukan('');
      setNominal('');
      setTanggal(new Date().toISOString().split('T')[0]);
      
      fetchOtherIncomes();
    } catch (error: any) {
      console.error('Error adding otherIncome:', error);
      alert('Gagal menambah pemasukan: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCetakKwitansi = async (otherIncome: any) => {
    try {
      const sessionData = await supabase.auth.getSession();
      const currentUser = sessionData.data.session?.user;
      
      const rawEmail = currentUser?.email || '';
      const userName = currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || rawEmail.split('@')[0] || 'Admin';
      const formattedUserName = userName.charAt(0).toUpperCase() + userName.slice(1);
      
      let schoolName = currentUser ? localStorage.getItem('schoolName_' + currentUser.id) : null;
      if (!schoolName || schoolName.trim() === '') {
        schoolName = formattedUserName;
      }

      const schoolLogo = currentUser ? localStorage.getItem('schoolLogo_' + currentUser.id) : null;

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a5'
      });
      
      if (schoolLogo) {
        try {
          doc.addImage(schoolLogo, 20, 10, 20, 20);
        } catch (e) {
          console.error("Gagal memuat logo sekolah", e);
        }
      }
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('BUKTI PENERIMAAN KAS', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(schoolName, 105, 28, { align: 'center' });
      
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      
      doc.text(`No. Referensi : INC-${otherIncome.id.split('-')[0].toUpperCase()}`, 20, 45);
      doc.text(`Tanggal Terima : ${new Date(otherIncome.tanggal).toLocaleDateString('id-ID')}`, 20, 52);
      
      doc.text('Keterangan', 20, 65);
      doc.setFont('helvetica', 'bold');
      doc.text(`: ${otherIncome.nama_pemasukan}`, 60, 65);
      doc.setFont('helvetica', 'normal');
      
      doc.text('Uang sejumlah', 20, 75);
      doc.setFont('helvetica', 'bold');
      doc.text(`: Rp ${otherIncome.nominal.toLocaleString('id-ID')}`, 60, 75);
      doc.setFont('helvetica', 'normal');
      
      doc.setLineWidth(0.5);
      doc.line(20, 105, 190, 105);
      
      doc.text('Penerima,', 150, 115);
      doc.text(`( ${formattedUserName} )`, 140, 135);
      
      doc.save(`Kwitansi_Pemasukan_${otherIncome.nama_pemasukan}_${otherIncome.tanggal}.pdf`);
    } catch (err) {
      console.error('Error generating PDF', err);
      alert('Terjadi kesalahan saat membuat kwitansi.');
    }
  };

  const handleDeleteOtherIncome = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Pemasukan',
      message: `Apakah Anda yakin ingin menghapus data pemasukan \"${name}\"?`,
      confirmText: 'Ya, Hapus',
      onConfirm: () => executeDeleteOtherIncome(id)
    });
  };
  
  const executeDeleteOtherIncome = async (id: string) => {
    setConfirmModal(null);
    try {
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      if (!currentUser) return;
      
      const { error } = await supabase.from('other_incomes').delete().eq('id', id).eq('user_id', currentUser.id);
      if (error) throw error;
      
      await logActivity('Hapus Pemasukan', `Menghapus data pemasukan lain ID: ${id}`);
      
      fetchOtherIncomes();
    } catch (error: any) {
      console.error('Error deleting otherIncome:', error);
      alert('Gagal menghapus pemasukan: ' + error.message);
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
  
  const filteredOtherIncomes = otherIncomes.filter(e => {
    const matchSearch = e.nama_pemasukan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.bulan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.tahun.toString().includes(searchQuery.toLowerCase());
    const matchBulan = filterBulan === 'Semua Bulan' || e.bulan === filterBulan;
    return matchSearch && matchBulan;
  });
  
  const sortedOtherIncomes = [...filteredOtherIncomes].sort((a, b) => {
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
  
  const totalPages = Math.ceil(sortedOtherIncomes.length / itemsPerPage);
  const paginatedOtherIncomes = sortedOtherIncomes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (isTableMissing) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto font-sans">
        <div className="bg-white rounded-2xl shadow-sm border border-rose-200 overflow-hidden">
          <div className="bg-rose-50 border-b border-rose-100 p-6 flex items-start gap-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl mt-1 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Tabel Pemasukan Lainnya Belum Dibuat!</h2>
              <p className="text-sm text-slate-600 mt-2">
                Sistem mendeteksi bahwa tabel <code className="bg-rose-100 px-1.5 py-0.5 rounded text-rose-700">other_incomes</code> belum ada di database Supabase Anda. Anda perlu membuat tabel ini terlebih dahulu untuk dapat menggunakan fitur ini.
              </p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Cara Memperbaiki:</h3>
            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
              <li>Buka dashboard Supabase Anda.</li>
              <li>Buka menu <strong>SQL Editor</strong>.</li>
              <li>Buat query baru (New query) dan salin kode SQL di bawah ini.</li>
              <li>Klik <strong>Run</strong> untuk mengeksekusi kode tersebut.</li>
              <li>Setelah berhasil, silakan muat ulang (Refresh) halaman ini.</li>
            </ol>
            
            <div className="mt-4 bg-slate-900 rounded-xl p-4 overflow-x-auto relative group">
              <pre className="text-xs text-indigo-300 font-mono">
{`-- Buat Tabel Pemasukan Lainnya
CREATE TABLE IF NOT EXISTS other_incomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  nama_pemasukan TEXT NOT NULL,
  nominal NUMERIC NOT NULL,
  tanggal DATE NOT NULL,
  bulan TEXT NOT NULL,
  tahun INT NOT NULL
);

-- Aktifkan RLS
ALTER TABLE other_incomes ENABLE ROW LEVEL SECURITY;

-- Buat Kebijakan Keamanan
CREATE POLICY "Isolasi data other_incomes per user" ON other_incomes 
FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catat Pemasukan</h1>
          <p className="text-sm text-slate-500">Kelola dan pantau pemasukan operasional sekolah</p>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
          Input Pemasukan Baru
        </h2>
        <form onSubmit={handleAddOtherIncome} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Keterangan / Nama Pemasukan</label>
            <div className="relative">
              <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                required
                value={namaPemasukan}
                onChange={e => setNamaPemasukan(e.target.value)}
                placeholder="Contoh: Seragam, uang pendaftaran, uang Akad dll."
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
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pemasukan'}
            </button>
          </div>
        </form>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            Riwayat Pemasukan
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
                placeholder="Cari pemasukan..." 
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
                <th onClick={() => handleSort('nama_pemasukan')} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-rose-600">
                  Keterangan {sortConfig?.key === 'nama_pemasukan' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
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
              ) : paginatedOtherIncomes.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">Tidak ada riwayat pemasukan.</td></tr>
              ) : (
                paginatedOtherIncomes.map(otherIncome => (
                  <tr key={otherIncome.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-md">
                        {new Date(otherIncome.tanggal).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800">{otherIncome.nama_pemasukan}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-rose-600">{formatRupiah(otherIncome.nominal)}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleCetakKwitansi(otherIncome)}
                          className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                          title="Cetak Kwitansi PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteOtherIncome(otherIncome.id, otherIncome.nama_pemasukan)}
                          className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
