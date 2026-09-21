import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Download, TrendingUp, TrendingDown, Wallet, Users, UserMinus, Code2, Layout, CheckCircle2, Copy, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import { FileText, FileDown } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import Papa from 'papaparse';
import { Table as TableIcon } from 'lucide-react';

const BULAN_OPTIONS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const YEAR_OPTIONS = Array.from({ length: 2045 - 2023 + 1 }, (_, i) => 2023 + i);

export default function ReportsView() {
  
  const currentDate = new Date();
  const [selectedBulan, setSelectedBulan] = useState(BULAN_OPTIONS[currentDate.getMonth()]);
  const [selectedTahun, setSelectedTahun] = useState(currentDate.getFullYear().toString());
  
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [otherIncomes, setOtherIncomes] = useState<any[]>([]);

  // Expense Form
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState<{isOpen: boolean, duplicates: any[]}>({isOpen: false, duplicates: []});
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; confirmText?: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    fetchData();

    const paymentsChannel = supabase
      .channel('realtime-reports-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        fetchData();
      })
      .subscribe();
      
    const otherIncomesChannel = supabase
      .channel('realtime-reports-other-incomes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'other_incomes' }, () => {
        fetchData();
      })
      .subscribe();

    const expensesChannel = supabase
      .channel('realtime-reports-expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(expensesChannel);
      supabase.removeChannel(otherIncomesChannel);
    };
  }, [selectedTahun]); // Re-fetch all data for the year when year changes

  const fetchData = async () => {
    setLoading(true);

    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    if (!currentUser) {
      setStudents([]);
      setPayments([]);
      setExpenses([]);
      setLoading(false);
      return;
    }

    // Fetch active students for metrics
    const { data: studentsData } = await supabase
      .from('students')
      .select('id, nama_lengkap, nominal_spp')
      .eq('user_id', currentUser.id)
      .eq('status_aktif', true);
      
    if (studentsData) setStudents(studentsData);

    // Fetch payments for selected year
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*, students(nama_lengkap, kelompok)')
      .eq('user_id', currentUser.id)
      .eq('tahun', parseInt(selectedTahun));
      
    if (paymentsData) setPayments(paymentsData);

    // Fetch expenses for selected year
    const { data: expensesData } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('tahun', parseInt(selectedTahun))
      .order('tanggal', { ascending: false });

    if (expensesData) setExpenses(expensesData);

    const { data: otherData } = await supabase.from('other_incomes').select('*').eq('user_id', currentUser.id).eq('tahun', parseInt(selectedTahun)).order('tanggal', { ascending: false });
    if (otherData) setOtherIncomes(otherData);

    setLoading(false);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseName || !newExpenseAmount) return;
    
    setIsSubmitting(true);
    const today = new Date().toISOString().split('T')[0];
    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    
    if (!currentUser) {
      alert('Sesi login tidak ditemukan.');
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from('expenses').insert([{
      user_id: currentUser.id,
      nama_pengeluaran: newExpenseName,
      nominal: parseInt(newExpenseAmount.replace(/\D/g, '')),
      tanggal: today,
      bulan: selectedBulan,
      tahun: parseInt(selectedTahun)
    }]);

    if (!error) {
      setNewExpenseName('');
      setNewExpenseAmount('');
      fetchData();
    } else {
      alert('Gagal menambah pengeluaran: ' + error.message);
    }
    setIsSubmitting(false);
  };

  const handleDeleteExpense = (id: string, expenseName?: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Pengeluaran',
      message: `Apakah Anda yakin ingin menghapus data pengeluaran${expenseName ? ` "${expenseName}"` : ''}?`,
      confirmText: 'Ya, Hapus Pengeluaran',
      onConfirm: () => executeDeleteExpense(id)
    });
  };

  const executeDeleteExpense = async (id: string) => {
    setConfirmModal(null);
    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    if (currentUser) {
      const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', currentUser.id);
      if (!error) {
        fetchData();
      } else {
        alert('Gagal menghapus pengeluaran: ' + error.message);
      }
    }
  };

  // 1. Data for Monthly Balance (Selected Month)
  const monthlyPayments = selectedBulan === 'Semua Bulan' 
    ? payments 
    : payments.filter(p => p.bulan === selectedBulan);
  const monthlyExpenses = selectedBulan === 'Semua Bulan'
    ? expenses
    : expenses.filter(e => e.bulan === selectedBulan);
  const monthlyOtherIncomes = selectedBulan === 'Semua Bulan' ? otherIncomes : otherIncomes.filter(i => i.bulan === selectedBulan);

  const totalPemasukanSpp = monthlyPayments.reduce((sum, p) => sum + Number(p.nominal_dibayar), 0);
  const totalPemasukanLain = monthlyOtherIncomes.reduce((sum, i) => sum + Number(i.nominal), 0);
  const totalPemasukan = totalPemasukanSpp + totalPemasukanLain;
  const totalPengeluaran = monthlyExpenses.reduce((sum, e) => sum + Number(e.nominal), 0);
  const labaRugi = totalPemasukan - totalPengeluaran;

  const totalLunas = monthlyPayments.length;
  const totalBelumLunas = selectedBulan === 'Semua Bulan' 
    ? (students.length * 12) - totalLunas 
    : students.length - totalLunas;

  const transactions = monthlyPayments.map(p => ({
    nama_lengkap: p.students?.nama_lengkap || 'Unknown',
    kelompok: p.students?.kelompok || '-',
    tanggal_bayar: p.tanggal_bayar,
    waktu_bayar: p.waktu_bayar,
    nominal_dibayar: p.nominal_dibayar
  }));

  // 2. Data for Yearly Chart
  const chartData = BULAN_OPTIONS.map(bulan => {
    const bPayments = payments.filter(p => p.bulan === bulan);
    const bExpenses = expenses.filter(e => e.bulan === bulan);
    const bOther = otherIncomes.filter(i => i.bulan === bulan);
    
    return {
      name: bulan.substring(0, 3), // Jan, Feb, Mar
      Pemasukan: bPayments.reduce((sum, p) => sum + Number(p.nominal_dibayar), 0) + bOther.reduce((sum, i) => sum + Number(i.nominal), 0),
      Pengeluaran: bExpenses.reduce((sum, e) => sum + Number(e.nominal), 0)
    };
  });

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };


  const getExportRows = () => {
    let no = 1;
    const rows = [
      ...transactions.map(t => ({
        jenis: 'Pemasukan SPP',
        kelompok: t.kelompok,
        keterangan: t.nama_lengkap,
        tanggal: t.tanggal_bayar,
        waktu: t.waktu_bayar,
        nominal: t.nominal_dibayar
      })),
      ...monthlyOtherIncomes.map(i => ({
        jenis: 'Pemasukan Lain',
        kelompok: '-',
        keterangan: i.nama_pemasukan,
        tanggal: i.tanggal,
        waktu: '-',
        nominal: i.nominal
      })),
      ...monthlyExpenses.map(e => ({
        jenis: 'Pengeluaran',
        kelompok: '-',
        keterangan: e.nama_pengeluaran,
        tanggal: e.tanggal,
        waktu: '-',
        nominal: e.nominal
      }))
    ].sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
    
    return rows.map(r => ({ ...r, no: no++ }));
  };

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === '-') return '-';
    const parts = timeStr.split(':');
    if (parts.length >= 2) return parts[0] + ':' + parts[1];
    return timeStr;
  };
  
  const handleCheckDuplicates = () => {
    // We check for duplicates based on student_id, bulan, and tahun in the payments list
    const paymentMap = new Map<string, any[]>();
    
    payments.forEach(p => {
      const key = `${p.student_id}_${p.bulan}_${p.tahun}`;
      if (!paymentMap.has(key)) {
        paymentMap.set(key, []);
      }
      paymentMap.get(key)!.push(p);
    });

    const duplicates: any[] = [];
    paymentMap.forEach((pList, key) => {
      if (pList.length > 1) {
        duplicates.push({
          student_id: pList[0].student_id,
          nama_lengkap: pList[0].students?.nama_lengkap,
          bulan: pList[0].bulan,
          tahun: pList[0].tahun,
          records: pList
        });
      }
    });

    setDuplicateModal({ isOpen: true, duplicates });
  };

  const handleDeleteDuplicate = async (paymentId: string) => {
    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    if (currentUser) {
      const { error } = await supabase.from('payments').delete().eq('id', paymentId).eq('user_id', currentUser.id);
      if (!error) {
        // Optimistically update local state so the modal updates immediately
        setPayments(prev => prev.filter(p => p.id !== paymentId));
        setDuplicateModal(prev => {
          const newDups = prev.duplicates.map(d => ({
            ...d,
            records: d.records.filter((r: any) => r.id !== paymentId)
          })).filter(d => d.records.length > 1);
          return { ...prev, duplicates: newDups };
        });
      } else {
        alert('Gagal menghapus data: ' + error.message);
      }
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const title = `Laporan Keuangan - ${selectedBulan} ${selectedTahun}`;
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); // indigo-900
    doc.text(title, 14, 20);
    
    doc.setFontSize(11);
    
    // Summary boxes representation
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text('Total Pemasukan:', 14, 30);
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text(formatRupiah(totalPemasukan), 50, 30);
    
    doc.setTextColor(71, 85, 105);
    doc.text('Total Pengeluaran:', 90, 30);
    doc.setTextColor(244, 63, 94); // rose-500
    doc.text(formatRupiah(totalPengeluaran), 130, 30);
    
    doc.setTextColor(71, 85, 105);
    doc.text('Laba / Rugi Bersih:', 14, 38);
    doc.setTextColor(labaRugi >= 0 ? 79 : 244, labaRugi >= 0 ? 70 : 63, labaRugi >= 0 ? 229 : 94); // indigo or rose
    doc.setFont('', 'bold');
    doc.text(formatRupiah(labaRugi), 50, 38);
    doc.setFont('', 'normal');

    const exportRows = getExportRows();

    autoTable(doc, {
      startY: 45,
      headStyles: { fillColor: [67, 56, 202], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      head: [['No', 'Kategori', 'Kelompok', 'Keterangan / Siswa', 'Tanggal', 'Waktu', 'Nominal']],
      body: exportRows.map(r => [
        r.no, 
        r.jenis, 
        r.kelompok, 
        r.keterangan, 
        new Date(r.tanggal).toLocaleDateString('id-ID'), 
        formatTime(r.waktu), 
        formatRupiah(r.nominal)
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        6: { halign: 'right' }
      }
    });

    doc.save(`Laporan_Keuangan_${selectedBulan}_${selectedTahun}.pdf`);
  };

  const handleExportCSV = () => {
    const rows = getExportRows().map(r => ({
      No: r.no,
      Kategori: r.jenis,
      Kelompok: r.kelompok,
      'Keterangan/Siswa': r.keterangan,
      Tanggal: new Date(r.tanggal).toLocaleDateString('id-ID'),
      Waktu: formatTime(r.waktu),
      Nominal: r.nominal
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `Laporan_Keuangan_${selectedBulan}_${selectedTahun}.csv`);
  };

  const handleExportDOCX = async () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `Laporan Keuangan - ${selectedBulan} ${selectedTahun}`,
                  bold: true,
                  size: 32,
                }),
              ],
            }),
            new Paragraph({ text: "", spacing: { after: 200 } }),
            new Paragraph({ children: [new TextRun({ text: "Total Pemasukan: ", bold: true }), new TextRun({ text: formatRupiah(totalPemasukan), color: "10b981" })] }),
            new Paragraph({ children: [new TextRun({ text: "Total Pengeluaran: ", bold: true }), new TextRun({ text: formatRupiah(totalPengeluaran), color: "f43f5e" })] }),
            new Paragraph({ children: [new TextRun({ text: "Laba / Rugi Bersih: ", bold: true }), new TextRun({ text: formatRupiah(labaRugi), color: labaRugi >= 0 ? "4f46e5" : "f43f5e", bold: true })] }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [new TextRun({ text: "Rincian Transaksi", bold: true, size: 24 })],
            }),
            new Paragraph({ text: "" }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: [
                    new TableCell({ shading: { fill: "4338ca" }, children: [new Paragraph({ children: [new TextRun({ text: "No", color: "ffffff", bold: true })] })] }),
                    new TableCell({ shading: { fill: "4338ca" }, children: [new Paragraph({ children: [new TextRun({ text: "Kategori", color: "ffffff", bold: true })] })] }),
                    new TableCell({ shading: { fill: "4338ca" }, children: [new Paragraph({ children: [new TextRun({ text: "Kelompok", color: "ffffff", bold: true })] })] }),
                    new TableCell({ shading: { fill: "4338ca" }, children: [new Paragraph({ children: [new TextRun({ text: "Keterangan/Siswa", color: "ffffff", bold: true })] })] }),
                    new TableCell({ shading: { fill: "4338ca" }, children: [new Paragraph({ children: [new TextRun({ text: "Tanggal", color: "ffffff", bold: true })] })] }),
                    new TableCell({ shading: { fill: "4338ca" }, children: [new Paragraph({ children: [new TextRun({ text: "Waktu", color: "ffffff", bold: true })] })] }),
                    new TableCell({ shading: { fill: "4338ca" }, children: [new Paragraph({ children: [new TextRun({ text: "Nominal", color: "ffffff", bold: true })] })] }),
                  ],
                }),
                ...getExportRows().map(
                  (r) =>
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph(r.no.toString())] }),
                        new TableCell({ children: [new Paragraph(r.jenis)] }),
                        new TableCell({ children: [new Paragraph(r.kelompok)] }),
                        new TableCell({ children: [new Paragraph(r.keterangan)] }),
                        new TableCell({ children: [new Paragraph(new Date(r.tanggal).toLocaleDateString('id-ID'))] }),
                        new TableCell({ children: [new Paragraph(formatTime(r.waktu))] }),
                        new TableCell({ children: [new Paragraph(formatRupiah(r.nominal))] }),
                      ],
                    })
                ),
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Laporan_Keuangan_${selectedBulan}_${selectedTahun}.docx`);
  };


  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 font-sans">
      <div className="p-6 md:px-10 md:py-8 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Laporan Keuangan & Laba Rugi</h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">Pantau Arus Kas Sekolah</p>
        </div>
        
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="max-w-6xl mx-auto space-y-8">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex flex-wrap gap-2">
                
                <button onClick={handleCheckDuplicates} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors">
                  <AlertTriangle className="w-4 h-4" /> Cek Data Dobel
                </button>
                <button onClick={handleExportPDF} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors">
                  <FileDown className="w-4 h-4" /> Export PDF
                </button>
                <button onClick={handleExportDOCX} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors">
                  <FileText className="w-4 h-4" /> Export DOCX
                </button>
                <button onClick={handleExportCSV} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors">
                  <TableIcon className="w-4 h-4" /> Export Excel (CSV)
                </button>
              </div>
              <div className="flex justify-end gap-4">
              <select 
                value={selectedBulan}
                onChange={e => setSelectedBulan(e.target.value)}
                className="pl-4 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 bg-white shadow-sm"
              >
                <option value="Semua Bulan">Semua Bulan</option>
                {BULAN_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select 
                value={selectedTahun}
                onChange={e => setSelectedTahun(e.target.value)}
                className="pl-4 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 bg-white shadow-sm"
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pemasukan</p>
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl font-black text-slate-800">{formatRupiah(totalPemasukan)}</p>
                <div className="mt-4 flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">SPP ({totalLunas} Lunas):</span>
                    <span className="text-emerald-600">{formatRupiah(totalPemasukanSpp)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-rose-500">Belum Lunas:</span>
                    <span className="text-rose-600">{totalBelumLunas} Siswa</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Lainnya:</span>
                    <span className="text-emerald-600">{formatRupiah(totalPemasukanLain)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pengeluaran</p>
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl font-black text-slate-800">{formatRupiah(totalPengeluaran)}</p>
                <div className="mt-4 flex gap-4 text-xs font-bold">
                  <span className="text-slate-500">{monthlyExpenses.length} Transaksi</span>
                </div>
              </div>

              <div className={`p-6 rounded-2xl border shadow-sm ${labaRugi >= 0 ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-rose-600 border-rose-700 text-white'}`}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80">Laba / Rugi Bersih</p>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Wallet className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl font-black">{formatRupiah(labaRugi)}</p>
                <div className="mt-4 flex gap-4 text-xs font-bold">
                  <span className="bg-white/20 px-2 py-1 rounded">Bulan {selectedBulan} {selectedTahun}</span>
                </div>
              </div>
            </div>

            {/* Chart Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                Grafik Keuangan Tahun {selectedTahun}
              </h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickFormatter={(value) => `Rp ${value / 1000}k`}
                      dx={-10}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatRupiah(value)}
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
                    <Bar dataKey="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Income Statement Detailed Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Pemasukan Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    Rincian Pemasukan SPP
                  </h3>
                </div>
                <div className="flex-1 overflow-auto max-h-96">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Siswa</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.length === 0 ? (
                        <tr><td colSpan={2} className="px-6 py-8 text-center text-sm text-slate-500">Belum ada pemasukan.</td></tr>
                      ) : (
                        transactions.map((t, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-800">{t.nama_lengkap}</p>
                              <p className="text-[10px] text-slate-500 font-semibold">
                                {new Date(t.tanggal_bayar).toLocaleDateString('id-ID')}
                                {t.waktu_bayar ? ` - ${t.waktu_bayar}` : ''}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-800 text-right">
                              {formatRupiah(t.nominal_dibayar)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>


              {/* Pemasukan Lain Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    Rincian Pemasukan Lain
                  </h3>
                </div>
                <div className="flex-1 overflow-auto max-h-96">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Keterangan</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthlyOtherIncomes.length === 0 ? (
                        <tr><td colSpan={2} className="px-6 py-8 text-center text-sm text-slate-500">Belum ada pemasukan lain.</td></tr>
                      ) : (
                        monthlyOtherIncomes.map((i, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-800">{i.nama_pemasukan}</p>
                              <p className="text-[10px] text-slate-500 font-semibold">
                                {new Date(i.tanggal).toLocaleDateString('id-ID')}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-800 text-right">
                              {formatRupiah(i.nominal)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pengeluaran Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                    Rincian Pengeluaran
                  </h3>
                </div>
                
                

                <div className="flex-1 overflow-auto max-h-[300px]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Keterangan</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Nominal</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthlyExpenses.length === 0 ? (
                        <tr><td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-500">Belum ada pengeluaran.</td></tr>
                      ) : (
                        monthlyExpenses.map((e, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-800">{e.nama_pengeluaran}</p>
                              <p className="text-[10px] text-slate-500 font-semibold">{new Date(e.tanggal).toLocaleDateString('id-ID')}</p>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-800 text-right">
                              {formatRupiah(e.nominal)}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <button 
                                onClick={() => handleDeleteExpense(e.id, e.nama_pengeluaran)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
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
          </div>

      </div>
      
      {duplicateModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="font-bold text-lg text-slate-800">Cek Data Dobel SPP</h3>
              </div>
              <button 
                onClick={() => setDuplicateModal({ isOpen: false, duplicates: [] })}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {duplicateModal.duplicates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 mb-2">Semua Data Aman!</h4>
                  <p className="text-sm text-slate-500 max-w-sm">Tidak ditemukan data pembayaran SPP yang dobel untuk tahun {selectedTahun}.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-amber-100 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm font-medium">
                    Ditemukan {duplicateModal.duplicates.length} siswa dengan pembayaran dobel (lebih dari satu kali) pada bulan dan tahun yang sama. Silakan hapus data yang berlebih.
                  </div>
                  
                  {duplicateModal.duplicates.map((dup, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <div>
                          <h5 className="font-bold text-slate-800">{dup.nama_lengkap}</h5>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{dup.bulan} {dup.tahun}</p>
                        </div>
                        <span className="px-3 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full">
                          {dup.records.length} Entri
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {dup.records.map((record: any) => (
                          <div key={record.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                            <div>
                              <p className="text-sm font-bold text-slate-700">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(record.nominal_dibayar)}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                Tanggal: {new Date(record.tanggal_bayar).toLocaleDateString('id-ID')} {record.waktu_bayar && `| Pukul: ${record.waktu_bayar}`}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteDuplicate(record.id)}
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
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
}
