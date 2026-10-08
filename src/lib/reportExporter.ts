import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  BorderStyle 
} from 'docx';
import Papa from 'papaparse';

export interface ReportExportData {
  schoolName: string;
  schoolLogo?: string;
  city: string;
  principalName: string;
  treasurerName: string;
  selectedBulan: string;
  selectedTahun: string;
  
  // Financial metrics
  totalPemasukanSpp: number;
  totalPemasukanLain: number;
  totalPemasukan: number;
  totalPengeluaran: number;
  labaRugi: number;
  
  // Student metrics
  totalStudents: number;
  totalLunas: number;
  totalBelumLunas: number;
  totalNominalTunggakan: number;
  
  // Detailed lists
  sppTransactions: Array<{
    nama_lengkap: string;
    kelompok: string;
    tanggal_bayar: string;
    waktu_bayar?: string;
    nominal_dibayar: number;
  }>;
  otherIncomes: Array<{
    nama_pemasukan: string;
    tanggal: string;
    nominal: number;
  }>;
  expenses: Array<{
    nama_pengeluaran: string;
    tanggal: string;
    nominal: number;
  }>;
  unpaidStudents: Array<{
    nama_lengkap: string;
    kelompok: string;
    nomor_whatsapp?: string;
    nominal_spp: number;
  }>;
  
  // Configurable options
  options?: {
    includeExecutiveSummary?: boolean;
    includeSppDetails?: boolean;
    includeOtherIncomes?: boolean;
    includeExpenses?: boolean;
    includeUnpaidStudents?: boolean;
    includeSignatures?: boolean;
  };
}

const formatRupiah = (num: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(num || 0);
};

const formatDateIndo = (dateStr: string): string => {
  if (!dateStr || dateStr === '-') return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const saveAs = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ==========================================
// 1. GENERATE PROFESSIONAL PDF REPORT
// ==========================================
export const exportProfessionalPDF = (data: ReportExportData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2);
  
  const printDateWithDay = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const signDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const currentTime = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const opts = {
    includeExecutiveSummary: true,
    includeSppDetails: true,
    includeOtherIncomes: true,
    includeExpenses: true,
    includeUnpaidStudents: true,
    includeSignatures: true,
    ...data.options
  };

  // 1. KOP SURAT RESMI
  let startY = 14;

  // Nama Sekolah & Identitas Lembaga
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 27, 75); // Indigo-950
  doc.text((data.schoolName || 'LEMBAGA PENDIDIKAN').toUpperCase(), pageWidth / 2, startY, { align: 'center' });

  startY += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(67, 56, 202); // Indigo-700
  doc.text('SISTEM KEUANGAN & MANAJEMEN PEMBAYARAN SPP SEKOLAH', pageWidth / 2, startY, { align: 'center' });

  startY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(`Wilayah: ${data.city || 'Indonesia'} • Layanan Terpadu Catatoh (catatoh.my.id)`, pageWidth / 2, startY, { align: 'center' });

  startY += 4;
  // Garis Ganda Kop Surat
  doc.setDrawColor(49, 46, 129); // Tebal indigo
  doc.setLineWidth(0.7);
  doc.line(marginX, startY, pageWidth - marginX, startY);

  startY += 1;
  doc.setDrawColor(148, 163, 184); // Tipis slate
  doc.setLineWidth(0.2);
  doc.line(marginX, startY, pageWidth - marginX, startY);

  // 2. JUDUL DOKUMEN & METADATA
  startY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text('LAPORAN PERTANGGUNGJAWABAN KEUANGAN DAN ARUS KAS', pageWidth / 2, startY, { align: 'center' });

  startY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text(`Periode: Bulan ${data.selectedBulan} Tahun ${data.selectedTahun}`, pageWidth / 2, startY, { align: 'center' });

  startY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Dicetak secara resmi pada: ${printDateWithDay}, Pukul ${currentTime} WIB • Dokumen Sah`, pageWidth / 2, startY, { align: 'center' });

  startY += 5;

  // 3. RINGKASAN EKSEKUTIF FINANSIAL
  if (opts.includeExecutiveSummary) {
    const boxY = startY;
    const boxHeight = 22;
    const colWidth = contentWidth / 4;

    // Background Card Box
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, boxY, contentWidth, boxHeight, 2, 2, 'FD');

    // Kolom 1: Penerimaan SPP
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('PENERIMAAN SPP', marginX + 4, boxY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129); // Emerald-600
    doc.text(formatRupiah(data.totalPemasukanSpp), marginX + 4, boxY + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${data.totalLunas} Siswa Lunas`, marginX + 4, boxY + 16.5);

    // Divider line 1
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX + colWidth, boxY + 3, marginX + colWidth, boxY + boxHeight - 3);

    // Kolom 2: Pemasukan Lain
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('PEMASUKAN LAIN', marginX + colWidth + 4, boxY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129);
    doc.text(formatRupiah(data.totalPemasukanLain), marginX + colWidth + 4, boxY + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${data.otherIncomes.length} Transaksi Masuk`, marginX + colWidth + 4, boxY + 16.5);

    // Divider line 2
    doc.line(marginX + (colWidth * 2), boxY + 3, marginX + (colWidth * 2), boxY + boxHeight - 3);

    // Kolom 3: Total Pengeluaran
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL PENGELUARAN', marginX + (colWidth * 2) + 4, boxY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(244, 63, 94); // Rose-500
    doc.text(formatRupiah(data.totalPengeluaran), marginX + (colWidth * 2) + 4, boxY + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${data.expenses.length} Transaksi Kas`, marginX + (colWidth * 2) + 4, boxY + 16.5);

    // Divider line 3
    doc.line(marginX + (colWidth * 3), boxY + 3, marginX + (colWidth * 3), boxY + boxHeight - 3);

    // Kolom 4: Laba / Rugi (Surplus / Defisit)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(data.labaRugi >= 0 ? 'SURPLUS BERSIH' : 'DEFISIT BERSIH', marginX + (colWidth * 3) + 4, boxY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(data.labaRugi >= 0 ? 67 : 225, data.labaRugi >= 0 ? 56 : 29, data.labaRugi >= 0 ? 202 : 72);
    doc.text(formatRupiah(data.labaRugi), marginX + (colWidth * 3) + 4, boxY + 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(data.labaRugi >= 0 ? 16 : 225, data.labaRugi >= 0 ? 185 : 29, data.labaRugi >= 0 ? 129 : 72);
    doc.text(data.labaRugi >= 0 ? 'KAS POSITIF (+)' : 'DEFISIT KAS (-)', marginX + (colWidth * 3) + 4, boxY + 16.5);

    startY = boxY + boxHeight + 4;

    // Sub-info: Rasio Pelunasan SPP
    const pctLunas = data.totalStudents > 0 ? Math.round((data.totalLunas / data.totalStudents) * 100) : 0;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Statistik SPP: Tingkat Pelunasan ${pctLunas}% (${data.totalLunas}/${data.totalStudents} Siswa) • Belum Lunas: ${data.totalBelumLunas} Siswa (Potensi: ${formatRupiah(data.totalNominalTunggakan)})`,
      marginX,
      startY
    );
    startY += 5;
  }

  // 4. TABEL 1: RINCIAN PENERIMAAN SPP SISWA
  if (opts.includeSppDetails) {
    autoTable(doc, {
      startY: startY,
      theme: 'grid',
      headStyles: {
        fillColor: [49, 46, 129], // Indigo-900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        valign: 'middle',
        cellPadding: 2.5
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // Slate-50
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15
      },
      head: [
        [
          { content: 'BAGIAN I: RINCIAN PENERIMAAN SPP SISWA', colSpan: 6, styles: { fillColor: [30, 27, 75], halign: 'center', valign: 'middle', fontStyle: 'bold' } }
        ],
        ['No', 'Nama Siswa', 'Kelas / Kelompok', 'Tanggal Bayar', 'Waktu', 'Nominal (Rp)']
      ],
      body: data.sppTransactions.length === 0
        ? [[{ content: 'Tidak ada data penerimaan SPP pada periode ini.', colSpan: 6, styles: { halign: 'center', textColor: [148, 163, 184] } }]]
        : data.sppTransactions.map((t, idx) => [
            (idx + 1).toString(),
            t.nama_lengkap,
            t.kelompok || '-',
            formatDateIndo(t.tanggal_bayar),
            t.waktu_bayar || '-',
            formatRupiah(t.nominal_dibayar)
          ]),
      foot: [
        [
          { content: 'TOTAL PENERIMAAN SPP', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right', fillColor: [238, 242, 255], textColor: [49, 46, 129] } },
          { content: formatRupiah(data.totalPemasukanSpp), styles: { fontStyle: 'bold', halign: 'right', fillColor: [238, 242, 255], textColor: [49, 46, 129] } }
        ]
      ],
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 28 },
        3: { halign: 'center', cellWidth: 28 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'right', cellWidth: 32 }
      },
      didParseCell: (data) => {
        if (data.section === 'head') {
          data.cell.styles.halign = 'center';
          data.cell.styles.valign = 'middle';
        }
      },
      margin: { left: marginX, right: marginX }
    });

    startY = (doc as any).lastAutoTable.finalY + 6;
  }

  // 5. TABEL 2: RINCIAN PEMASUKAN LAIN (Jika ada transaksi)
  if (opts.includeOtherIncomes && data.otherIncomes.length > 0) {
    if (startY > pageHeight - 40) {
      doc.addPage();
      startY = 15;
    }

    autoTable(doc, {
      startY: startY,
      theme: 'grid',
      headStyles: {
        fillColor: [16, 149, 107], // Emerald-700
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        valign: 'middle',
        cellPadding: 2.5
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15
      },
      head: [
        [
          { content: 'BAGIAN II: RINCIAN PEMASUKAN LAIN-LAIN / KAS MASUK', colSpan: 4, styles: { fillColor: [6, 95, 70], halign: 'center', valign: 'middle', fontStyle: 'bold' } }
        ],
        ['No', 'Uraian / Sumber Pemasukan', 'Tanggal', 'Nominal (Rp)']
      ],
      body: data.otherIncomes.map((item, idx) => [
        (idx + 1).toString(),
        item.nama_pemasukan,
        formatDateIndo(item.tanggal),
        formatRupiah(item.nominal)
      ]),
      foot: [
        [
          { content: 'TOTAL PEMASUKAN LAIN', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [236, 253, 245], textColor: [6, 95, 70] } },
          { content: formatRupiah(data.totalPemasukanLain), styles: { fontStyle: 'bold', halign: 'right', fillColor: [236, 253, 245], textColor: [6, 95, 70] } }
        ]
      ],
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 35 }
      },
      didParseCell: (data) => {
        if (data.section === 'head') {
          data.cell.styles.halign = 'center';
          data.cell.styles.valign = 'middle';
        }
      },
      margin: { left: marginX, right: marginX }
    });

    startY = (doc as any).lastAutoTable.finalY + 6;
  }

  // 6. TABEL 3: RINCIAN PENGELUARAN KAS & OPERASIONAL
  if (opts.includeExpenses) {
    if (startY > pageHeight - 40) {
      doc.addPage();
      startY = 15;
    }

    autoTable(doc, {
      startY: startY,
      theme: 'grid',
      headStyles: {
        fillColor: [159, 18, 57], // Rose-800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        valign: 'middle',
        cellPadding: 2.5
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15
      },
      head: [
        [
          { content: 'BAGIAN III: RINCIAN PENGELUARAN KAS & OPERASIONAL', colSpan: 4, styles: { fillColor: [136, 19, 55], halign: 'center', valign: 'middle', fontStyle: 'bold' } }
        ],
        ['No', 'Keperluan / Keterangan Pengeluaran', 'Tanggal', 'Nominal (Rp)']
      ],
      body: data.expenses.length === 0
        ? [[{ content: 'Tidak ada data pengeluaran kas pada periode ini.', colSpan: 4, styles: { halign: 'center', textColor: [148, 163, 184] } }]]
        : data.expenses.map((e, idx) => [
            (idx + 1).toString(),
            e.nama_pengeluaran,
            formatDateIndo(e.tanggal),
            formatRupiah(e.nominal)
          ]),
      foot: [
        [
          { content: 'TOTAL PENGELUARAN KAS', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 241, 242], textColor: [159, 18, 57] } },
          { content: formatRupiah(data.totalPengeluaran), styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 241, 242], textColor: [159, 18, 57] } }
        ]
      ],
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 35 }
      },
      didParseCell: (data) => {
        if (data.section === 'head') {
          data.cell.styles.halign = 'center';
          data.cell.styles.valign = 'middle';
        }
      },
      margin: { left: marginX, right: marginX }
    });

    startY = (doc as any).lastAutoTable.finalY + 6;
  }

  // 7. TABEL 4: DAFTAR SISWA BELUM LUNAS SPP (Jika diaktifkan & ada data)
  if (opts.includeUnpaidStudents && data.unpaidStudents.length > 0) {
    if (startY > pageHeight - 40) {
      doc.addPage();
      startY = 15;
    }

    autoTable(doc, {
      startY: startY,
      theme: 'grid',
      headStyles: {
        fillColor: [180, 83, 9], // Amber-700
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        valign: 'middle',
        cellPadding: 2.5
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15
      },
      head: [
        [
          { content: 'BAGIAN IV: DAFTAR SISWA MENUNGGAK / BELUM LUNAS SPP', colSpan: 5, styles: { fillColor: [146, 64, 14], halign: 'center', valign: 'middle', fontStyle: 'bold' } }
        ],
        ['No', 'Nama Siswa', 'Kelas / Kelompok', 'No. WhatsApp Orang Tua', 'Nominal Tagihan (Rp)']
      ],
      body: data.unpaidStudents.map((s, idx) => [
        (idx + 1).toString(),
        s.nama_lengkap,
        s.kelompok || '-',
        s.nomor_whatsapp || '-',
        formatRupiah(s.nominal_spp)
      ]),
      foot: [
        [
          { content: 'TOTAL ESTIMASI POTENSI TUNGGAKAN', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [254, 243, 199], textColor: [146, 64, 14] } },
          { content: formatRupiah(data.totalNominalTunggakan), styles: { fontStyle: 'bold', halign: 'right', fillColor: [254, 243, 199], textColor: [146, 64, 14] } }
        ]
      ],
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 32 },
        3: { halign: 'center', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 35 }
      },
      didParseCell: (data) => {
        if (data.section === 'head') {
          data.cell.styles.halign = 'center';
          data.cell.styles.valign = 'middle';
        }
      },
      margin: { left: marginX, right: marginX }
    });

    startY = (doc as any).lastAutoTable.finalY + 8;
  }

  // 8. LEMBAR PENGESAHAN RESMI (SIGNATURE BLOCK)
  if (opts.includeSignatures) {
    if (startY > pageHeight - 55) {
      doc.addPage();
      startY = 25;
    } else {
      startY += 8;
    }

    const sigY = startY;
    // Exactly centered at 25% and 75% of printable area width (45.5mm from margins and center)
    const colLeftX = marginX + (contentWidth * 0.25);
    const colRightX = marginX + (contentWidth * 0.75);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85); // Slate-700

    // Kiri: Mengetahui Kepala Sekolah
    doc.text('Mengetahui,', colLeftX, sigY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text('Kepala Sekolah / Pimpinan Lembaga', colLeftX, sigY + 5, { align: 'center' });

    // Kanan: Bendahara (format tanggal standar: Kota, Tanggal Bulan Tahun)
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.city || 'Indonesia'}, ${signDate}`, colRightX, sigY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text('Bendahara / Petugas Keuangan', colRightX, sigY + 5, { align: 'center' });

    // Tempat TTD & Stempel (space 25mm bersih)
    const nameY = sigY + 30;
    
    // Nama Kepala Sekolah (Kiri)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`(  ${data.principalName || '...........................................'}  )`, colLeftX, nameY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('NIP / Tanda Tangan & Cap Lembaga', colLeftX, nameY + 4.5, { align: 'center' });

    // Nama Bendahara (Kanan)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`(  ${data.treasurerName || '...........................................'}  )`, colRightX, nameY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Bagian Keuangan & Administrasi', colRightX, nameY + 4.5, { align: 'center' });
  }

  // 9. FOOTER DI SETIAP HALAMAN (PAGE NUMBERING & IDENTITY)
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(
      `Dokumen Resmi Laporan Keuangan • ${data.schoolName || 'Catatoh'} • Periode: ${data.selectedBulan} ${data.selectedTahun}`,
      marginX,
      pageHeight - 8
    );
    doc.text(
      `Halaman ${i} dari ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  const filename = `Laporan_Keuangan_${(data.schoolName || 'Sekolah').replace(/[^a-zA-Z0-9]/g, '_')}_${data.selectedBulan}_${data.selectedTahun}.pdf`;
  doc.save(filename);
};

// ==========================================
// 2. GENERATE PROFESSIONAL EXCEL / CSV REPORT
// ==========================================
export const exportProfessionalCSV = (data: ReportExportData) => {
  const currentDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const currentTime = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const lines: string[][] = [
    ['LAPORAN PERTANGGUNGJAWABAN KEUANGAN DAN ARUS KAS SEKOLAH'],
    ['Nama Lembaga / Sekolah', data.schoolName || 'Sekolah'],
    ['Wilayah / Kota', data.city || 'Indonesia'],
    ['Periode Pembukuan', `Bulan ${data.selectedBulan} Tahun ${data.selectedTahun}`],
    ['Waktu Ekspor', `${currentDate}, Pukul ${currentTime} WIB`],
    ['Platform Sistem', 'Catatoh - Catat Online Handling (catatoh.my.id)'],
    [''],
    ['=== RINGKASAN EKSEKUTIF KEUANGAN ==='],
    ['Kategori Metrik', 'Jumlah Transaksi / Siswa', 'Nominal (Rp)', 'Catatan Status'],
    ['Total Penerimaan SPP', `${data.totalLunas} Siswa Lunas`, data.totalPemasukanSpp.toString(), 'Pemasukan Utama SPP'],
    ['Total Pemasukan Lain-lain', `${data.otherIncomes.length} Transaksi`, data.totalPemasukanLain.toString(), 'Pemasukan Kas & Donasi'],
    ['TOTAL SELURUH PEMASUKAN', `${data.sppTransactions.length + data.otherIncomes.length} Transaksi`, data.totalPemasukan.toString(), 'Kas Masuk'],
    ['TOTAL SELURUH PENGELUARAN', `${data.expenses.length} Transaksi`, data.totalPengeluaran.toString(), 'Kas Keluar'],
    ['SURPLUS / (DEFISIT) BERSIH', '-', data.labaRugi.toString(), data.labaRugi >= 0 ? 'SURPLUS KAS (+)' : 'DEFISIT KAS (-)'],
    ['Total Siswa Terdaftar', `${data.totalStudents} Siswa`, '-', '-'],
    ['Siswa Menunggak / Belum Lunas', `${data.totalBelumLunas} Siswa`, data.totalNominalTunggakan.toString(), 'Potensi Tagihan Tertunggak'],
    [''],
    ['=== BAGIAN I: RINCIAN PENERIMAAN SPP SISWA ==='],
    ['No', 'Nama Lengkap Siswa', 'Kelas / Kelompok', 'Tanggal Bayar', 'Waktu Bayar', 'Nominal SPP (Rp)']
  ];

  if (data.sppTransactions.length === 0) {
    lines.push(['-', 'Tidak ada transaksi penerimaan SPP pada periode ini.', '-', '-', '-', '0']);
  } else {
    data.sppTransactions.forEach((t, idx) => {
      lines.push([
        (idx + 1).toString(),
        t.nama_lengkap,
        t.kelompok || '-',
        formatDateIndo(t.tanggal_bayar),
        t.waktu_bayar || '-',
        t.nominal_dibayar.toString()
      ]);
    });
  }
  lines.push(['', 'TOTAL PENERIMAAN SPP', '', '', '', data.totalPemasukanSpp.toString()]);
  lines.push(['']);

  // Bagian II: Pemasukan Lain
  lines.push(['=== BAGIAN II: RINCIAN PEMASUKAN LAIN-LAIN ===']);
  lines.push(['No', 'Uraian / Sumber Pemasukan', 'Tanggal', 'Nominal (Rp)']);
  if (data.otherIncomes.length === 0) {
    lines.push(['-', 'Tidak ada pemasukan lain.', '-', '0']);
  } else {
    data.otherIncomes.forEach((i, idx) => {
      lines.push([
        (idx + 1).toString(),
        i.nama_pemasukan,
        formatDateIndo(i.tanggal),
        i.nominal.toString()
      ]);
    });
  }
  lines.push(['', 'TOTAL PEMASUKAN LAIN', '', data.totalPemasukanLain.toString()]);
  lines.push(['']);

  // Bagian III: Pengeluaran Kas
  lines.push(['=== BAGIAN III: RINCIAN PENGELUARAN KAS & OPERASIONAL ===']);
  lines.push(['No', 'Uraian Keperluan Pengeluaran', 'Tanggal', 'Nominal (Rp)']);
  if (data.expenses.length === 0) {
    lines.push(['-', 'Tidak ada data pengeluaran kas.', '-', '0']);
  } else {
    data.expenses.forEach((e, idx) => {
      lines.push([
        (idx + 1).toString(),
        e.nama_pengeluaran,
        formatDateIndo(e.tanggal),
        e.nominal.toString()
      ]);
    });
  }
  lines.push(['', 'TOTAL PENGELUARAN KAS', '', data.totalPengeluaran.toString()]);
  lines.push(['']);

  // Bagian IV: Siswa Belum Lunas
  if (data.unpaidStudents.length > 0) {
    lines.push(['=== BAGIAN IV: DAFTAR SISWA BELUM LUNAS SPP ===']);
    lines.push(['No', 'Nama Siswa', 'Kelas / Kelompok', 'No. WhatsApp Orang Tua', 'Tagihan SPP (Rp)']);
    data.unpaidStudents.forEach((s, idx) => {
      lines.push([
        (idx + 1).toString(),
        s.nama_lengkap,
        s.kelompok || '-',
        s.nomor_whatsapp || '-',
        s.nominal_spp.toString()
      ]);
    });
    lines.push(['', 'TOTAL ESTIMASI TUNGGAKAN', '', '', data.totalNominalTunggakan.toString()]);
    lines.push(['']);
  }

  // Tanda Tangan
  lines.push(['=== LEMBAR PENGESAHAN RESMI ===']);
  lines.push(['Mengetahui: Kepala Sekolah', data.principalName || '..................', 'Tanggal', currentDate]);
  lines.push(['Bendahara / Petugas Keuangan', data.treasurerName || '..................', 'Wilayah', data.city || 'Indonesia']);

  const csvContent = Papa.unparse(lines);
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `Laporan_Keuangan_${(data.schoolName || 'Sekolah').replace(/[^a-zA-Z0-9]/g, '_')}_${data.selectedBulan}_${data.selectedTahun}.csv`;
  saveAs(blob, filename);
};

// ==========================================
// 3. GENERATE PROFESSIONAL DOCX REPORT
// ==========================================
export const exportProfessionalDOCX = async (data: ReportExportData) => {
  const currentDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: [
          // Kop Surat
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: (data.schoolName || 'LEMBAGA PENDIDIKAN').toUpperCase(),
                bold: true,
                size: 28,
                color: '1e1b4b'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'SISTEM KEUANGAN & MANAJEMEN PEMBAYARAN SPP SEKOLAH',
                bold: true,
                size: 18,
                color: '4338ca'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Wilayah: ${data.city || 'Indonesia'} • Layanan Terpadu Catatoh (catatoh.my.id)`,
                size: 16,
                color: '64748b'
              })
            ],
            spacing: { after: 200 }
          }),

          // Judul Laporan
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'LAPORAN PERTANGGUNGJAWABAN KEUANGAN & ARUS KAS',
                bold: true,
                size: 22,
                color: '0f172a'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Periode: Bulan ${data.selectedBulan} Tahun ${data.selectedTahun}`,
                bold: true,
                size: 19,
                color: '4f46e5'
              })
            ],
            spacing: { after: 300 }
          }),

          // Ringkasan Eksekutif Finansial Table
          new Paragraph({
            children: [
              new TextRun({
                text: 'I. RINGKASAN EKSEKUTIF KEUANGAN',
                bold: true,
                size: 20,
                color: '1e1b4b'
              })
            ],
            spacing: { after: 120 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ shading: { fill: '1e1b4b' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Komponen Finansial', color: 'ffffff', bold: true })] })] }),
                  new TableCell({ shading: { fill: '1e1b4b' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Rincian / Volume', color: 'ffffff', bold: true })] })] }),
                  new TableCell({ shading: { fill: '1e1b4b' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nominal (Rp)', color: 'ffffff', bold: true })] })] }),
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Penerimaan SPP Siswa')] }),
                  new TableCell({ children: [new Paragraph(`${data.totalLunas} Siswa Lunas`)] }),
                  new TableCell({ children: [new Paragraph(formatRupiah(data.totalPemasukanSpp))] }),
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Penerimaan Lain-lain / Donasi')] }),
                  new TableCell({ children: [new Paragraph(`${data.otherIncomes.length} Transaksi`)] }),
                  new TableCell({ children: [new Paragraph(formatRupiah(data.totalPemasukanLain))] }),
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ shading: { fill: 'ecfdf5' }, children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL PEMASUKAN BERSIH', bold: true, color: '065f46' })] })] }),
                  new TableCell({ shading: { fill: 'ecfdf5' }, children: [new Paragraph({ children: [new TextRun({ text: `${data.sppTransactions.length + data.otherIncomes.length} Transaksi`, bold: true })] })] }),
                  new TableCell({ shading: { fill: 'ecfdf5' }, children: [new Paragraph({ children: [new TextRun({ text: formatRupiah(data.totalPemasukan), bold: true, color: '065f46' })] })] }),
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ shading: { fill: 'fff1f2' }, children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL PENGELUARAN KAS', bold: true, color: '9f1239' })] })] }),
                  new TableCell({ shading: { fill: 'fff1f2' }, children: [new Paragraph({ children: [new TextRun({ text: `${data.expenses.length} Transaksi`, bold: true })] })] }),
                  new TableCell({ shading: { fill: 'fff1f2' }, children: [new Paragraph({ children: [new TextRun({ text: formatRupiah(data.totalPengeluaran), bold: true, color: '9f1239' })] })] }),
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ shading: { fill: data.labaRugi >= 0 ? 'eef2ff' : 'fff1f2' }, children: [new Paragraph({ children: [new TextRun({ text: 'SURPLUS / (DEFISIT) BERSIH', bold: true, color: data.labaRugi >= 0 ? '312e81' : '9f1239' })] })] }),
                  new TableCell({ shading: { fill: data.labaRugi >= 0 ? 'eef2ff' : 'fff1f2' }, children: [new Paragraph({ children: [new TextRun({ text: data.labaRugi >= 0 ? 'KAS SURPLUS (+)' : 'DEFISIT (-)', bold: true })] })] }),
                  new TableCell({ shading: { fill: data.labaRugi >= 0 ? 'eef2ff' : 'fff1f2' }, children: [new Paragraph({ children: [new TextRun({ text: formatRupiah(data.labaRugi), bold: true, color: data.labaRugi >= 0 ? '312e81' : '9f1239' })] })] }),
                ]
              })
            ]
          }),

          new Paragraph({ text: '', spacing: { after: 200 } }),

          // Tabel Rincian SPP
          new Paragraph({
            children: [
              new TextRun({
                text: 'II. RINCIAN PENERIMAAN SPP SISWA',
                bold: true,
                size: 20,
                color: '1e1b4b'
              })
            ],
            spacing: { after: 120 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ shading: { fill: '312e81' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'No', color: 'ffffff', bold: true })] })] }),
                  new TableCell({ shading: { fill: '312e81' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nama Siswa', color: 'ffffff', bold: true })] })] }),
                  new TableCell({ shading: { fill: '312e81' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Kelompok', color: 'ffffff', bold: true })] })] }),
                  new TableCell({ shading: { fill: '312e81' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Tanggal', color: 'ffffff', bold: true })] })] }),
                  new TableCell({ shading: { fill: '312e81' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nominal', color: 'ffffff', bold: true })] })] }),
                ]
              }),
              ...data.sppTransactions.map((t, idx) => (
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph((idx + 1).toString())] }),
                    new TableCell({ children: [new Paragraph(t.nama_lengkap)] }),
                    new TableCell({ children: [new Paragraph(t.kelompok || '-')] }),
                    new TableCell({ children: [new Paragraph(formatDateIndo(t.tanggal_bayar))] }),
                    new TableCell({ children: [new Paragraph(formatRupiah(t.nominal_dibayar))] }),
                  ]
                })
              )),
              new TableRow({
                children: [
                  new TableCell({ shading: { fill: 'eef2ff' }, columnSpan: 4, children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL PENERIMAAN SPP', bold: true })] })] }),
                  new TableCell({ shading: { fill: 'eef2ff' }, children: [new Paragraph({ children: [new TextRun({ text: formatRupiah(data.totalPemasukanSpp), bold: true })] })] }),
                ]
              })
            ]
          }),

          new Paragraph({ text: '', spacing: { after: 200 } }),

          // Tabel Pengeluaran
          new Paragraph({
            children: [
              new TextRun({
                text: 'III. RINCIAN PENGELUARAN KAS',
                bold: true,
                size: 20,
                color: '1e1b4b'
              })
            ],
            spacing: { after: 120 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ shading: { fill: '881337' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'No', color: 'ffffff', bold: true })] })] }),
                  new TableCell({ shading: { fill: '881337' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Uraian Pengeluaran', color: 'ffffff', bold: true })] })] }),
                  new TableCell({ shading: { fill: '881337' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Tanggal', color: 'ffffff', bold: true })] })] }),
                  new TableCell({ shading: { fill: '881337' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nominal', color: 'ffffff', bold: true })] })] }),
                ]
              }),
              ...data.expenses.map((e, idx) => (
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph((idx + 1).toString())] }),
                    new TableCell({ children: [new Paragraph(e.nama_pengeluaran)] }),
                    new TableCell({ children: [new Paragraph(formatDateIndo(e.tanggal))] }),
                    new TableCell({ children: [new Paragraph(formatRupiah(e.nominal))] }),
                  ]
                })
              )),
              new TableRow({
                children: [
                  new TableCell({ shading: { fill: 'fff1f2' }, columnSpan: 3, children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL PENGELUARAN KAS', bold: true })] })] }),
                  new TableCell({ shading: { fill: 'fff1f2' }, children: [new Paragraph({ children: [new TextRun({ text: formatRupiah(data.totalPengeluaran), bold: true })] })] }),
                ]
              })
            ]
          }),

          new Paragraph({ text: '', spacing: { after: 400 } }),

          // Pengesahan Tanda Tangan
          new Paragraph({
            children: [
              new TextRun({
                text: 'IV. PENGESAHAN DOKUMEN',
                bold: true,
                size: 20,
                color: '1e1b4b'
              })
            ],
            spacing: { after: 160 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Mengetahui,', bold: true })] }),
                      new Paragraph({ children: [new TextRun({ text: 'Kepala Sekolah / Pimpinan', bold: true })] }),
                      new Paragraph({ text: '', spacing: { after: 600 } }),
                      new Paragraph({ children: [new TextRun({ text: `( ${data.principalName || '...........................................'} )`, bold: true })] }),
                      new Paragraph({ children: [new TextRun({ text: 'NIP / Stempel Lembaga' })] }),
                    ]
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: `${data.city || 'Indonesia'}, ${currentDate}` })] }),
                      new Paragraph({ children: [new TextRun({ text: 'Bendahara / Pengelola Keuangan', bold: true })] }),
                      new Paragraph({ text: '', spacing: { after: 600 } }),
                      new Paragraph({ children: [new TextRun({ text: `( ${data.treasurerName || '...........................................'} )`, bold: true })] }),
                      new Paragraph({ children: [new TextRun({ text: 'Bagian Administrasi Keuangan' })] }),
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const filename = `Laporan_Keuangan_${(data.schoolName || 'Sekolah').replace(/[^a-zA-Z0-9]/g, '_')}_${data.selectedBulan}_${data.selectedTahun}.docx`;
  saveAs(blob, filename);
};
