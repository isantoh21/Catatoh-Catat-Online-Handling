import React from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLogger';
import { Search, Calendar, DollarSign, X, MessageCircle, RefreshCw, CheckSquare, Square, Save, CheckCircle2, Settings, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import ConfirmModal from './ConfirmModal';

const BULAN_OPTIONS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const YEAR_OPTIONS = Array.from({ length: 2045 - 2023 + 1 }, (_, i) => 2023 + i);

export default function DashboardView() {
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const currentDate = new Date();
  const [selectedBulan, setSelectedBulan] = useState(BULAN_OPTIONS[currentDate.getMonth()]);
  const [selectedTahun, setSelectedTahun] = useState(currentDate.getFullYear().toString());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('Semua Kelompok');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('Semua Status');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'} | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderBulan, setReminderBulan] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedModalBulan, setSelectedModalBulan] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [nominal, setNominal] = useState('100000');
  const [tanggalBayar, setTanggalBayar] = useState("");
  const [waktuBayar, setWaktuBayar] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; confirmText?: string; onConfirm: () => void } | null>(null);

  const DEFAULT_WA_TEMPLATE = "Halo Ayah/Bunda [NAMA_SISWA],\n\nMohon maaf mengingatkan, untuk pembayaran SPP bulan [BULAN] [TAHUN] sebesar [NOMINAL] belum tercatat.\n\nTerima kasih.";
  const [waTemplate, setWaTemplate] = useState(DEFAULT_WA_TEMPLATE);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [tempWaTemplate, setTempWaTemplate] = useState('');

  // Use a separate useEffect just for loading template once
  useEffect(() => {
    const loadTemplate = async () => {
      const sessionData = await supabase.auth.getSession();
      const currentUser = sessionData.data.session?.user;
      if (currentUser) {
        // Cek metadata dari database (Supabase Auth) untuk lintas perangkat
        if (currentUser.user_metadata && currentUser.user_metadata.wa_template) {
          setWaTemplate(currentUser.user_metadata.wa_template);
          localStorage.setItem('waTemplate_' + currentUser.id, currentUser.user_metadata.wa_template); // Sync lokal
        } else {
          // Fallback ke localStorage jika belum ada di database
          const savedTemplate = localStorage.getItem('waTemplate_' + currentUser.id);
          if (savedTemplate) {
            setWaTemplate(savedTemplate);
          }
        }
      }
    };
    loadTemplate();
  }, []);


  useEffect(() => {
    fetchData();

    const studentsChannel = supabase
      .channel('realtime-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload) => {
        console.log('Real-time update on students:', payload);
        fetchData();
      })
      .subscribe();
      
    const paymentsChannel = supabase
      .channel('realtime-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, (payload) => {
        console.log('Real-time update on payments:', payload);
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(studentsChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, [selectedBulan, selectedTahun]);

  const handleSaveTemplate = async () => {
    const sessionData = await supabase.auth.getSession();
    const currentUser = sessionData.data.session?.user;
    if (currentUser) {
      // Simpan lokal agar cepat
      localStorage.setItem('waTemplate_' + currentUser.id, tempWaTemplate);
      
      // Simpan ke metadata Supabase agar sinkron dan aman ketika login di perangkat/browser lain
      await supabase.auth.updateUser({
        data: { wa_template: tempWaTemplate }
      });

      setWaTemplate(tempWaTemplate);
      setIsTemplateModalOpen(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch active students
    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    if (!currentUser) return;
    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('status_aktif', true)
      .order('nama_lengkap', { ascending: true });
      
    if (studentsData) setStudents(studentsData);

    // Fetch payments for selected year
    let paymentsQuery = supabase
      .from('payments')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('tahun', parseInt(selectedTahun));
      
    if (selectedBulan !== 'Semua Bulan') {
      paymentsQuery = paymentsQuery.eq('bulan', selectedBulan);
    }
    const { data: paymentsData } = await paymentsQuery;
      
    if (paymentsData) setPayments(paymentsData);
    
    setLoading(false);
  };

  
  const handleCetakKwitansi = async (student: any, payment: any, bulan: string) => {
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
      doc.text('BUKTI PEMBAYARAN SPP', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(schoolName, 105, 28, { align: 'center' });
      
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      
      doc.text(`No. Referensi : INV-${payment.id.split('-')[0].toUpperCase()}`, 20, 45);
      doc.text(`Tanggal Bayar : ${new Date(payment.tanggal_bayar).toLocaleDateString('id-ID')}`, 20, 52);
      
      doc.text('Telah terima dari', 20, 65);
      doc.setFont('helvetica', 'bold');
      doc.text(`: ${student.nama_lengkap}`, 60, 65);
      doc.setFont('helvetica', 'normal');
      
      doc.text('Uang sejumlah', 20, 75);
      doc.setFont('helvetica', 'bold');
      doc.text(`: Rp ${payment.nominal_dibayar.toLocaleString('id-ID')}`, 60, 75);
      doc.setFont('helvetica', 'normal');
      
      doc.text('Untuk pembayaran', 20, 85);
      doc.text(`: SPP Bulan ${bulan} ${payment.tahun}`, 60, 85);
      
      if (student.kelompok) {
         doc.text('Kelompok/Kelas', 20, 95);
         doc.text(`: ${student.kelompok}`, 60, 95);
      }
      
      doc.setLineWidth(0.5);
      doc.line(20, 105, 190, 105);
      
      doc.text('Penerima,', 150, 115);
      doc.text(`( ${formattedUserName} )`, 140, 135);
      
      doc.save(`Kwitansi_SPP_${student.nama_lengkap}_${bulan}_${payment.tahun}.pdf`);
    } catch (err) {
      console.error('Error generating PDF', err);
      alert('Terjadi kesalahan saat membuat kwitansi.');
    }
  };

  const handleBatalkanLunas = (studentId: string, explicitBulan?: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Batalkan Lunas',
      message: `Apakah Anda yakin ingin membatalkan status lunas untuk siswa ini pada bulan ${explicitBulan || selectedBulan} ${selectedTahun}?`,
      confirmText: 'Ya, Batalkan',
      onConfirm: async () => {
        setIsSubmitting(true);
        const { error } = await supabase
          .from('payments')
          .delete()
          .eq('student_id', studentId)
          .eq('bulan', explicitBulan || selectedBulan)
          .eq('tahun', parseInt(selectedTahun));

        setIsSubmitting(false);
        if (error) {
          console.error('Error delete payment:', error);
          alert('Gagal membatalkan pembayaran. Error: ' + error.message);
        } else {
          setConfirmModal(null);
          const student = students.find(s => s.id === studentId);
          await logActivity('Batalkan Lunas SPP', `Membatalkan lunas SPP bulan ${explicitBulan || selectedBulan} ${selectedTahun} untuk siswa ${student?.nama_lengkap || studentId}`);
          fetchData();
        }
      }
    });
  };

  const handleOpenModal = (student: any, explicitBulan?: string) => {
    setSelectedModalBulan(explicitBulan || selectedBulan);
    setSelectedStudent(student);
    setNominal(student.nominal_spp?.toString() || '100000');
    
    const now = new Date();
    setTanggalBayar(now.toISOString().split('T')[0]);
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setWaktuBayar(`${hours}:${minutes}`);
    
    setIsModalOpen(true);
  };

  const handleTandaiLunas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    
    setIsSubmitting(true);
    
    const targetBulan = selectedModalBulan || selectedBulan;
    const targetTahun = parseInt(selectedTahun);
    
    // Cek duplikasi sebelum insert
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('student_id', selectedStudent.id)
      .eq('bulan', targetBulan)
      .eq('tahun', targetTahun)
      .maybeSingle();
      
    if (existingPayment) {
      alert(`Pembayaran untuk ${selectedStudent.nama_lengkap} pada bulan ${targetBulan} ${targetTahun} sudah tercatat sebelumnya. Data tidak disimpan untuk menghindari duplikasi.`);
      setIsSubmitting(false);
      setIsModalOpen(false);
      return;
    }
    
    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    const { error } = await supabase.from('payments').insert([
      { 
        user_id: currentUser?.id,
        student_id: selectedStudent.id,
        bulan: targetBulan,
        tahun: targetTahun,
        nominal_dibayar: parseFloat(nominal),
        tanggal_bayar: tanggalBayar,
        waktu_bayar: waktuBayar || null,
      }
    ]);

    setIsSubmitting(false);
    
    if (error) {
      console.error('Error insert payment:', error);
      alert('Gagal menyimpan data pembayaran. Error: ' + error.message);
    } else {
      await logActivity('Tandai Lunas SPP', `Menandai lunas SPP bulan ${targetBulan} ${targetTahun} untuk siswa ${selectedStudent.nama_lengkap}`);
      setIsModalOpen(false);
      fetchData();
    }
  };

  
  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction: direction as 'asc'|'desc' });
  };

  const handleBulkLunas = () => {
    if (selectedIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Tandai Lunas',
      message: `Apakah Anda yakin ingin menandai ${selectedIds.length} siswa terpilih sebagai Lunas?`,
      confirmText: 'Tandai Lunas',
      onConfirm: executeBulkLunas
    });
  };

  const executeBulkLunas = async () => {
    setConfirmModal(null);
    setIsSubmitting(true);
    
    const targetBulan = selectedModalBulan || selectedBulan;
    const targetTahun = parseInt(selectedTahun);
    
    // Cek pembayaran yang sudah ada untuk siswa yang dipilih di bulan dan tahun yang sama
    const { data: existingPayments } = await supabase
      .from('payments')
      .select('student_id')
      .in('student_id', selectedIds)
      .eq('bulan', targetBulan)
      .eq('tahun', targetTahun);
      
    const existingIds = new Set(existingPayments?.map(p => p.student_id) || []);
    
    const validIds = selectedIds.filter(id => !existingIds.has(id));
    
    if (validIds.length === 0) {
      alert('Semua siswa yang dipilih sudah tercatat lunas untuk bulan ini.');
      setIsSubmitting(false);
      setSelectedIds([]);
      return;
    }
    
    if (existingIds.size > 0) {
      alert(`Ditemukan ${existingIds.size} siswa yang sudah lunas sebelumnya. Hanya ${validIds.length} siswa yang akan diproses untuk menghindari duplikasi.`);
    }

    const today = new Date().toISOString().split('T')[0];
    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    const records = validIds.map(id => {
      const student = students.find(s => s.id === id);
      return {
        user_id: currentUser?.id,
        student_id: id,
        bulan: targetBulan,
        tahun: targetTahun,
        nominal_dibayar: student?.nominal_spp || 100000,
        tanggal_bayar: today,
      };
    });

    const { error } = await supabase.from('payments').insert(records);
    setIsSubmitting(false);
    
    if (!error) {
      await logActivity('Tandai Lunas Massal', `Menandai lunas SPP massal untuk ${validIds.length} siswa pada bulan ${targetBulan} ${targetTahun}`);
      setSelectedIds([]);
      fetchData();
    } else {
      alert('Gagal menyimpan pembayaran: ' + error.message);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginatedStudents.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  
  const uniqueKelompokList = Array.from(new Set(students.map(s => s.kelompok).filter(Boolean)));

  const baseFilteredStudents = students.filter(s => {
    const matchSearch = s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase());
    const matchKelompok = filterKelompok === 'Semua Kelompok' || s.kelompok === filterKelompok;
    
    let matchPaymentStatus = true;
    if (filterPaymentStatus !== 'Semua Status') {
      let isLunas = false;
      if (selectedBulan === 'Semua Bulan') {
        // If "Semua Bulan" is selected, we consider it lunas if there's any payment? 
        // Or wait, maybe this logic is tricky. Let's just check if they have at least one payment in the selected year.
        isLunas = payments.some(p => p.student_id === s.id);
      } else {
        isLunas = payments.some(p => p.student_id === s.id && p.bulan === selectedBulan);
      }
      
      if (filterPaymentStatus === 'Lunas' && !isLunas) matchPaymentStatus = false;
      if (filterPaymentStatus === 'Belum Lunas' && isLunas) matchPaymentStatus = false;
    }
    
    return matchSearch && matchKelompok && matchPaymentStatus;
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


  const belumLunasStudents = baseFilteredStudents.filter(s => 
    !payments.some(p => p.student_id === s.id && p.bulan === (isReminderModalOpen ? reminderBulan : selectedBulan))
  );

  const handleKirimWA = (student: any) => {
    let message = waTemplate
      .replace(/\[NAMA_SISWA\]/g, student.nama_lengkap)
      .replace(/\[BULAN\]/g, reminderBulan || selectedBulan)
      .replace(/\[TAHUN\]/g, selectedTahun)
      .replace(/\[NOMINAL\]/g, "Rp" + (student.nominal_spp ? student.nominal_spp.toLocaleString('id-ID') : '0'));
    const url = `https://wa.me/${student.nomor_whatsapp}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pembayaran SPP</h1>
          <p className="text-sm text-slate-500">Monitor dan catat pembayaran bulanan siswa</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button 
            onClick={() => { setTempWaTemplate(waTemplate); setIsTemplateModalOpen(true); }}
            className="px-4 py-2 text-sm font-bold rounded-xl flex items-center gap-2 transition-colors shadow-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
          >
            <Settings className="w-5 h-5" />
            Template WA
          </button>
          <button 
            onClick={() => { setReminderBulan(selectedBulan === 'Semua Bulan' ? 'Januari' : selectedBulan); setIsReminderModalOpen(true); }}
            className="px-4 py-2 text-sm font-bold rounded-xl flex items-center gap-2 transition-colors shadow-sm bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <MessageCircle className="w-5 h-5" />
            Kirim Reminder
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4">
        <div className="flex-1 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari nama siswa..." 
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" 
            />
          </div>
          <div className="w-full sm:w-40 relative">
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
          <div className="w-full sm:w-40 relative">
            <select
              value={filterPaymentStatus}
              onChange={e => { setFilterPaymentStatus(e.target.value); setCurrentPage(1); }}
              className="w-full pl-4 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 bg-slate-50"
            >
              <option value="Semua Status">Semua Status</option>
              <option value="Lunas">Sudah Lunas</option>
              <option value="Belum Lunas">Belum Lunas</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-4 lg:justify-end">
          <div className="flex gap-2 items-center">
            {selectedIds.length > 0 && (
              <button 
                onClick={handleBulkLunas}
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
              >
                <CheckSquare className="w-4 h-4" /> Tandai Lunas ({selectedIds.length})
              </button>
            )}
            <button 
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-bold items-center justify-center gap-2 transition-colors shadow-sm hidden sm:flex disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sync
            </button>
          </div>
          <div className="relative w-40">
            <select 
              value={selectedBulan}
              onChange={e => setSelectedBulan(e.target.value)}
              className="w-full pl-4 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 bg-slate-50"
            >
              <option value="Semua Bulan">Semua Bulan</option>
              {BULAN_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="relative w-32">
            <select 
              value={selectedTahun}
              onChange={e => setSelectedTahun(e.target.value)}
              className="w-full pl-4 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 bg-slate-50"
            >
              {YEAR_OPTIONS.map(y => (
                <option key={y} value={y.toString()}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

{/* Matrix / Regular Table Switch */}
      {selectedBulan === 'Semua Bulan' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-50">
                <tr>
                  <th onClick={() => handleSort('nama_lengkap')} className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-10 border-r border-slate-100 shadow-[1px_0_0_0_#f1f5f9] cursor-pointer hover:text-indigo-600">
    Nama Siswa {sortConfig?.key === 'nama_lengkap' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
  </th>
  <th onClick={() => handleSort('kelompok')} className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky left-[180px] bg-slate-50 z-10 border-r border-slate-100 shadow-[1px_0_0_0_#f1f5f9] cursor-pointer hover:text-indigo-600 min-w-[120px]">
    Kelompok {sortConfig?.key === 'kelompok' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
  </th>
                  {BULAN_OPTIONS.map(b => (
                    <th key={b} className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center min-w-[80px]">{b.slice(0, 3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.length === 0 ? (
                  <tr><td colSpan={14} className="px-6 py-8 text-center text-sm text-slate-500">Tidak ada data siswa.</td></tr>
                ) : (
                  paginatedStudents.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group/row">
                      <td className="px-6 py-3 sticky left-0 bg-white group-hover/row:bg-slate-50 z-10 border-r border-slate-100 shadow-[1px_0_0_0_#f1f5f9] transition-colors">
    <p className="text-sm font-bold text-slate-800 truncate w-[140px]" title={student.nama_lengkap}>{student.nama_lengkap}</p>
  </td>
  <td className="px-6 py-3 sticky left-[180px] bg-white group-hover/row:bg-slate-50 z-10 border-r border-slate-100 shadow-[1px_0_0_0_#f1f5f9] transition-colors text-center">
    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">{student.kelompok || '-'}</span>
  </td>
                      {BULAN_OPTIONS.map(b => {
                        const payment = payments.find(p => p.student_id === student.id && p.bulan === b);
                        return (
                          <td key={b} className="px-2 py-2 text-center">
                            {payment ? (
                              <div className="flex items-center justify-center gap-1">
                                <button 
                                  onClick={() => handleCetakKwitansi(student, payment, b)}
                                  className="w-6 h-6 bg-blue-50 text-blue-600 rounded flex items-center justify-center hover:bg-blue-100 hover:text-blue-700 transition-colors"
                                  title="Cetak Kwitansi PDF"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleBatalkanLunas(student.id, b)}
                                  className="w-6 h-6 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors group"
                                  title="Batalkan Lunas"
                                >
                                  <span className="text-[10px] font-black group-hover:hidden">✓</span>
                                  <X className="w-3 h-3 hidden group-hover:block" />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => handleOpenModal(student, b)}
                                className="w-7 h-7 mx-auto bg-slate-100 text-slate-400 hover:bg-indigo-600 hover:text-white rounded flex items-center justify-center transition-colors"
                                title="Tandai Lunas"
                              >
                                <span className="text-sm font-black">+</span>
                              </button>
                            )}
                          </td>
                        )
                      })}
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
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={paginatedStudents.length > 0 && selectedIds.length === paginatedStudents.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th onClick={() => handleSort('nama_lengkap')} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors">
    Nama Siswa {sortConfig?.key === 'nama_lengkap' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
  </th>
  <th onClick={() => handleSort('kelompok')} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors">
    Kelompok {sortConfig?.key === 'kelompok' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
  </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Periode</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">Memuat data...</td></tr>
              ) : paginatedStudents.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">Tidak ada data siswa aktif.</td></tr>
              ) : (
                paginatedStudents.map(student => {
                  const payment = payments.find(p => p.student_id === student.id && p.bulan === selectedBulan);
                  const isLunas = !!payment;

                  return (
                    <tr key={student.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(student.id) ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-6 py-4 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(student.id)}
                          onChange={() => handleSelect(student.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shadow-sm">
                            {student.nama_lengkap.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-800">{student.nama_lengkap}</p>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{student.nomor_whatsapp}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                          {student.kelompok || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                          {selectedBulan} {selectedTahun}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isLunas ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-black uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Lunas
                            </span>
                            {payment?.tanggal_bayar && (
                              <span className="text-[10px] font-semibold text-slate-500">
                                {new Date(payment.tanggal_bayar).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {payment.waktu_bayar && ` • ${payment.waktu_bayar.slice(0,5)}`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-700 rounded-md text-[10px] font-black uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span> Belum Bayar
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isLunas ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="flex flex-col items-end gap-0.5 mr-2">
                              <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Lunas</span>
                              <span className="text-[10px] font-bold text-slate-400">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(payment.nominal_dibayar)}
                              </span>
                            </div>
                            <button
                              onClick={() => handleCetakKwitansi(student, payment, selectedBulan)}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md text-[10px] font-bold transition-colors border border-blue-200 shadow-sm flex items-center gap-1.5"
                              title="Cetak Kwitansi PDF"
                            >
                              <Printer className="w-3.5 h-3.5" /> Cetak
                            </button>
                            <button
                              onClick={() => handleBatalkanLunas(student.id)}
                              disabled={isSubmitting}
                              className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 rounded-md text-[10px] font-bold transition-colors border border-rose-200 shadow-sm"
                              title="Batalkan Lunas"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleOpenModal(student)}
                            disabled={isSubmitting}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                          >
                            Tandai Lunas
                          </button>
                        )}
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

      )}
      {/* Payment Modal */}
      {isModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">Catat Pembayaran SPP</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleTandaiLunas} className="p-6 space-y-5">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-white text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                  {selectedStudent.nama_lengkap.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 leading-tight">{selectedStudent.nama_lengkap}</p>
                  <p className="text-xs text-indigo-600 font-bold mt-1">Periode: {selectedModalBulan || selectedBulan} {selectedTahun}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tanggal Transfer</label>
                  <input type="date" required value={tanggalBayar} onChange={e => setTanggalBayar(e.target.value)} className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm font-bold text-slate-700" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Waktu Transfer</label>
                  <input type="time" required value={waktuBayar} onChange={e => setWaktuBayar(e.target.value)} className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm font-bold text-slate-700" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nominal Pembayaran (Rp)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rp</span>
                    <input type="number" required value={nominal} onChange={e => setNominal(e.target.value)} className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm font-bold text-slate-700" />
                  </div>
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-70">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Lunas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Reminder Modal */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-slate-800">Kirim Reminder WA</h3>
                <select 
                  value={reminderBulan}
                  onChange={e => setReminderBulan(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold text-slate-700"
                >
                  {BULAN_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <button onClick={() => setIsReminderModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-0 max-h-[60vh] overflow-y-auto">
              {belumLunasStudents.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-800">Semua Lunas!</p>
                  <p className="text-xs text-slate-500 mt-1">Tidak ada tagihan yang belum dibayar bulan ini.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {belumLunasStudents.map(student => (
                    <li key={student.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                          {student.nama_lengkap.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 leading-tight">{student.nama_lengkap}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{student.nomor_whatsapp}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleKirimWA(student)}
                        className="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Kirim WA
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setIsReminderModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">
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
          confirmText={confirmModal.confirmText || 'Ya, Lanjutkan'}
          isLoading={isSubmitting}
        />
      )}

      {/* WA Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-600" />
                Pengaturan Template WA
              </h3>
              <button onClick={() => setIsTemplateModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm text-slate-600">
              <p>
                Gunakan variabel berikut untuk menampilkan data secara otomatis:
              </p>
              <ul className="list-disc pl-5 font-mono text-xs text-slate-500 space-y-1">
                <li><span className="font-bold text-indigo-600">[NAMA_SISWA]</span> : Nama siswa</li>
                <li><span className="font-bold text-indigo-600">[BULAN]</span> : Bulan tagihan</li>
                <li><span className="font-bold text-indigo-600">[TAHUN]</span> : Tahun tagihan</li>
                <li><span className="font-bold text-indigo-600">[NOMINAL]</span> : Nominal tagihan (format Rupiah)</li>
              </ul>
              
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700 mb-2">Pesan Template</label>
                <textarea
                  value={tempWaTemplate}
                  onChange={(e) => setTempWaTemplate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y min-h-[150px]"
                  placeholder="Tulis template WA di sini..."
                ></textarea>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
              >
                Simpan Template
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
