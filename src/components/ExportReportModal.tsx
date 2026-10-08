import React, { useState } from 'react';
import { 
  FileDown, 
  FileText, 
  Table as TableIcon, 
  X, 
  CheckCircle2, 
  Building, 
  MapPin, 
  UserCheck, 
  DollarSign, 
  CheckSquare, 
  Square,
  Sparkles,
  Printer
} from 'lucide-react';
import { 
  ReportExportData, 
  exportProfessionalPDF, 
  exportProfessionalCSV, 
  exportProfessionalDOCX 
} from '../lib/reportExporter';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: ReportExportData;
}

export default function ExportReportModal({
  isOpen,
  onClose,
  reportData
}: ExportReportModalProps) {
  if (!isOpen) return null;

  // Local state for customized header & signatures
  const [schoolName, setSchoolName] = useState(reportData.schoolName || 'Lembaga Pendidikan / Sekolah');
  const [city, setCity] = useState(reportData.city || 'Indonesia');
  const [principalName, setPrincipalName] = useState(reportData.principalName || 'Kepala Sekolah / Pimpinan');
  const [treasurerName, setTreasurerName] = useState(reportData.treasurerName || 'Bendahara Sekolah');

  // Checkbox options
  const [includeExecutiveSummary, setIncludeExecutiveSummary] = useState(true);
  const [includeSppDetails, setIncludeSppDetails] = useState(true);
  const [includeOtherIncomes, setIncludeOtherIncomes] = useState(true);
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [includeUnpaidStudents, setIncludeUnpaidStudents] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);

  const [isExporting, setIsExporting] = useState<'pdf' | 'csv' | 'docx' | null>(null);

  const getPayload = (): ReportExportData => ({
    ...reportData,
    schoolName,
    city,
    principalName,
    treasurerName,
    options: {
      includeExecutiveSummary,
      includeSppDetails,
      includeOtherIncomes,
      includeExpenses,
      includeUnpaidStudents,
      includeSignatures
    }
  });

  const handleExport = async (format: 'pdf' | 'csv' | 'docx') => {
    try {
      setIsExporting(format);
      const payload = getPayload();
      
      if (format === 'pdf') {
        exportProfessionalPDF(payload);
      } else if (format === 'csv') {
        exportProfessionalCSV(payload);
      } else if (format === 'docx') {
        await exportProfessionalDOCX(payload);
      }
    } catch (err: any) {
      console.error('Error exporting report:', err);
      alert('Gagal mengekspor laporan: ' + (err.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsExporting(null);
    }
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num || 0);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
        
        {/* Header Modal */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Printer className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Export Laporan Keuangan Resmi
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">
                  <Sparkles className="w-3 h-3" /> Lengkap & Profesional
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Periode: <b>{reportData.selectedBulan} {reportData.selectedTahun}</b>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-center sm:text-left sm:pl-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pemasukan</span>
              <span className="text-xs sm:text-sm font-black text-emerald-600 font-mono">
                {formatRupiah(reportData.totalPemasukan)}
              </span>
            </div>
            <div className="text-center sm:text-left sm:pl-2 border-x border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pengeluaran</span>
              <span className="text-xs sm:text-sm font-black text-rose-600 font-mono">
                {formatRupiah(reportData.totalPengeluaran)}
              </span>
            </div>
            <div className="text-center sm:text-left sm:pl-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {reportData.labaRugi >= 0 ? 'Surplus Bersih' : 'Defisit Bersih'}
              </span>
              <span className={`text-xs sm:text-sm font-black font-mono ${reportData.labaRugi >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                {formatRupiah(reportData.labaRugi)}
              </span>
            </div>
          </div>

          {/* Form Kop & Pengesahan */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-indigo-600" />
              <span>Identitas Lembaga & Lembar Pengesahan</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Nama Lembaga / Sekolah
                </label>
                <div className="relative">
                  <Building className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={schoolName}
                    onChange={e => setSchoolName(e.target.value)}
                    placeholder="Contoh: SMA Negeri 1 / SDIT Al-Hikmah"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Wilayah / Kota Pengesahan
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Contoh: Bandung / Jakarta Selatan"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Nama Kepala Sekolah / Pimpinan
                </label>
                <div className="relative">
                  <UserCheck className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={principalName}
                    onChange={e => setPrincipalName(e.target.value)}
                    placeholder="Nama Kepala Sekolah beserta gelar"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Nama Bendahara / Petugas Keuangan
                </label>
                <div className="relative">
                  <UserCheck className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={treasurerName}
                    onChange={e => setTreasurerName(e.target.value)}
                    placeholder="Nama Bendahara"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Opsi Komponen Laporan */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-indigo-600" />
              <span>Komponen yang Disertakan dalam Dokumen</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeExecutiveSummary}
                  onChange={e => setIncludeExecutiveSummary(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-700">Ringkasan Eksekutif Keuangan</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSppDetails}
                  onChange={e => setIncludeSppDetails(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-700">Rincian Penerimaan SPP Siswa</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeOtherIncomes}
                  onChange={e => setIncludeOtherIncomes(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-700">Rincian Pemasukan Lain-lain</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeExpenses}
                  onChange={e => setIncludeExpenses(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-700">Rincian Pengeluaran Kas & Belanja</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeUnpaidStudents}
                  onChange={e => setIncludeUnpaidStudents(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-700">Daftar Siswa Belum Lunas (Tunggakan)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSignatures}
                  onChange={e => setIncludeSignatures(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-700">Lembar Tanda Tangan & Pengesahan</span>
                {(reportData.adminSignature || reportData.schoolStamp) && (
                  <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    TTD & Stempel Aktif ✓
                  </span>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
            Pilih format dokumen resmi yang diinginkan:
          </span>

          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
            {/* Tombol PDF */}
            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting !== null}
              className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
              title="Download Dokumen PDF Siap Cetak"
            >
              <FileDown className="w-4 h-4" />
              <span>{isExporting === 'pdf' ? 'Membuat...' : 'PDF Resmi'}</span>
            </button>

            {/* Tombol Excel / CSV */}
            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting !== null}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              title="Download File Spreadsheet Excel / CSV"
            >
              <TableIcon className="w-4 h-4" />
              <span>{isExporting === 'csv' ? 'Membuat...' : 'Excel (CSV)'}</span>
            </button>

            {/* Tombol DOCX */}
            <button
              onClick={() => handleExport('docx')}
              disabled={isExporting !== null}
              className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
              title="Download Dokumen Microsoft Word"
            >
              <FileText className="w-4 h-4" />
              <span>{isExporting === 'docx' ? 'Membuat...' : 'Word (DOCX)'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
