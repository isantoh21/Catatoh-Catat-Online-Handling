import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface SppReceiptData {
  schoolName: string;
  schoolLogo?: string | null;
  city?: string;
  principalName?: string;
  treasurerName: string;
  
  student: {
    id: string;
    nama_lengkap: string;
    kelompok?: string;
    nomor_whatsapp?: string;
  };
  payment: {
    id: string;
    nominal_dibayar: number;
    tanggal_bayar: string;
    waktu_bayar?: string;
    tahun: number;
    bulan: string;
  };
  bulan: string;
}

export interface OtherIncomeReceiptData {
  schoolName: string;
  schoolLogo?: string | null;
  city?: string;
  treasurerName: string;
  otherIncome: {
    id: string;
    nama_pemasukan: string;
    nominal: number;
    tanggal: string;
    kategori?: string;
  };
}

/**
 * Konversi angka ke kalimat Terbilang standar bahasa Indonesia
 */
export const terbilang = (angka: number): string => {
  const bilangan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 
    'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ];
  const num = Math.floor(Math.abs(angka));
  if (num < 12) return bilangan[num];
  if (num < 20) return terbilang(num - 10) + ' Belas';
  if (num < 100) return terbilang(Math.floor(num / 10)) + ' Puluh ' + terbilang(num % 10);
  if (num < 200) return 'Seratus ' + terbilang(num - 100);
  if (num < 1000) return terbilang(Math.floor(num / 100)) + ' Ratus ' + terbilang(num % 100);
  if (num < 2000) return 'Seribu ' + terbilang(num - 1000);
  if (num < 1000000) return terbilang(Math.floor(num / 1000)) + ' Ribu ' + terbilang(num % 1000);
  if (num < 1000000000) return terbilang(Math.floor(num / 1000000)) + ' Juta ' + terbilang(num % 1000000);
  if (num < 1000000000000) return terbilang(Math.floor(num / 1000000000)) + ' Miliar ' + terbilang(num % 1000000000);
  return num.toString();
};

export const terbilangRupiah = (num: number): string => {
  const result = terbilang(num).trim().replace(/\s+/g, ' ');
  return result ? `${result} Rupiah` : 'Nol Rupiah';
};

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

/**
 * 1. EKSPOR KWITANSI RESMI PEMBAYARAN SPP SISWA (A5 LANDSCAPE)
 */
export const exportSppReceiptPDF = (data: SppReceiptData) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5'
  });

  const pageWidth = 210;
  const pageHeight = 148;
  const marginX = 12;
  const contentWidth = pageWidth - (marginX * 2); // 186mm

  // ==========================================
  // 1. FRAME & BORDER KEAMANAN RESMI (DOUBLE BORDER)
  // ==========================================
  // Frame Luar
  doc.setDrawColor(30, 27, 75); // Deep Indigo-950
  doc.setLineWidth(0.65);
  doc.roundedRect(8, 7, pageWidth - 16, pageHeight - 14, 2.5, 2.5, 'S');

  // Frame Dalam (Garis Halus)
  doc.setDrawColor(199, 210, 254); // Indigo-200
  doc.setLineWidth(0.2);
  doc.roundedRect(9.5, 8.5, pageWidth - 19, pageHeight - 17, 1.8, 1.8, 'S');

  // Aksen Ornamen Sudut
  doc.setFillColor(49, 46, 129); // Indigo-900
  doc.rect(10.5, 9.5, 2.5, 2.5, 'F');
  doc.rect(pageWidth - 13, 9.5, 2.5, 2.5, 'F');
  doc.rect(10.5, pageHeight - 12, 2.5, 2.5, 'F');
  doc.rect(pageWidth - 13, pageHeight - 12, 2.5, 2.5, 'F');

  // ==========================================
  // 2. KOP SURAT / IDENTITAS LEMBAGA (HEADER)
  // ==========================================
  let textStartX = marginX;
  
  if (data.schoolLogo) {
    try {
      let logoW = 22;
      let logoH = 18;
      const logoX = marginX + 1;
      let logoY = 11;

      try {
        const imgProps = (doc as any).getImageProperties(data.schoolLogo);
        if (imgProps?.width && imgProps?.height) {
          const aspect = imgProps.width / imgProps.height;
          const maxW = 26;
          const maxH = 18;
          if (aspect > maxW / maxH) {
            logoW = maxW;
            logoH = maxW / aspect;
          } else {
            logoH = maxH;
            logoW = maxH * aspect;
          }
          logoY = 11 + (maxH - logoH) / 2;
        }
      } catch {
        // Fallback default
      }

      doc.addImage(data.schoolLogo, logoX, logoY, logoW, logoH);
      textStartX = logoX + logoW + 5;
    } catch (e) {
      console.warn('Gagal memuat logo sekolah di kwitansi:', e);
    }
  }

  // Nama Sekolah & Subtitle Lembaga
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 27, 75); // Deep Indigo
  const sName = (data.schoolName || 'LEMBAGA PENDIDIKAN').toUpperCase();
  doc.text(sName, textStartX, 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(67, 56, 202); // Indigo-700
  doc.text('SISTEM MANAJEMEN KEUANGAN & PEMBAYARAN SPP SEKOLAH', textStartX, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(
    `Wilayah: ${data.city || 'Indonesia'} • Bukti Pembayaran Digital Resmi Terverifikasi`,
    textStartX,
    25.5
  );

  // Bagian Kanan Header: Label Box & No. Kwitansi
  const rightBadgeW = 58;
  const rightBadgeX = pageWidth - marginX - rightBadgeW;
  
  // Banner Judul Kwitansi
  doc.setFillColor(30, 27, 75); // Indigo-950
  doc.roundedRect(rightBadgeX, 11, rightBadgeW, 7.5, 1.5, 1.5, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('KWITANSI PEMBAYARAN SPP', rightBadgeX + (rightBadgeW / 2), 16, { align: 'center' });

  // Nomor Referensi & Tanggal
  const receiptNo = `KW-SPP/${data.payment.tahun}/${(data.payment.id || '0000').slice(0, 8).toUpperCase()}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85); // Slate-700
  doc.text(`No. Kwitansi : ${receiptNo}`, rightBadgeX, 22.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const payTime = data.payment.waktu_bayar ? ` • ${data.payment.waktu_bayar}` : '';
  doc.text(`Tgl Bayar   : ${formatDateIndo(data.payment.tanggal_bayar)}${payTime}`, rightBadgeX, 26.5);

  // Garis Pembatas Header (Double Line)
  doc.setDrawColor(30, 27, 75);
  doc.setLineWidth(0.45);
  doc.line(marginX, 30.5, pageWidth - marginX, 30.5);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.15);
  doc.line(marginX, 31.5, pageWidth - marginX, 31.5);

  // ==========================================
  // 3. KOTAK INFORMASI DATA SISWA & TRANSAKSI
  // ==========================================
  const infoBoxY = 34;
  const infoBoxH = 22;
  
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, infoBoxY, contentWidth, infoBoxH, 1.5, 1.5, 'FD');

  // Kolom Kiri Info
  const col1X = marginX + 4;
  const col1ValX = marginX + 38;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Telah Diterima Dari', col1X, infoBoxY + 5.5);
  doc.text('Kelas / Kelompok', col1X, infoBoxY + 11);
  doc.text('No. WhatsApp Ortu', col1X, infoBoxY + 16.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(`:  ${data.student.nama_lengkap || '-'}`, col1ValX, infoBoxY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`:  ${data.student.kelompok || 'Reguler / Umum'}`, col1ValX, infoBoxY + 11);
  doc.text(`:  ${data.student.nomor_whatsapp || '-'}`, col1ValX, infoBoxY + 16.5);

  // Kolom Kanan Info
  const col2X = marginX + (contentWidth / 2) + 2;
  const col2ValX = col2X + 34;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Untuk Pembayaran', col2X, infoBoxY + 5.5);
  doc.text('Metode Transaksi', col2X, infoBoxY + 11);
  doc.text('Status Pelunasan', col2X, infoBoxY + 16.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(49, 46, 129); // Indigo-900
  doc.text(`:  SPP Bulan ${data.bulan} ${data.payment.tahun}`, col2ValX, infoBoxY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(':  Kasir Sekolah / Transfer Bank', col2ValX, infoBoxY + 11);

  // Status Badge LUNAS
  doc.setFillColor(236, 253, 245); // Emerald-50
  doc.setDrawColor(52, 211, 153); // Emerald-400
  doc.roundedRect(col2ValX + 1.5, infoBoxY + 13, 26, 4.5, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(5, 150, 105); // Emerald-600
  doc.text('✓ LUNAS / SAH', col2ValX + 14.5, infoBoxY + 16.2, { align: 'center' });

  // ==========================================
  // 4. TABEL RINCIAN PEMBAYARAN
  // ==========================================
  const tableStartY = infoBoxY + infoBoxH + 3.5;

  autoTable(doc, {
    startY: tableStartY,
    theme: 'grid',
    showFoot: 'lastPage',
    headStyles: {
      fillColor: [49, 46, 129], // Indigo-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: 2
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    head: [
      ['No', 'Uraian / Deskripsi Pembayaran', 'Periode', 'Nominal Pembayaran (Rp)']
    ],
    body: [
      [
        '1',
        `Iuran Pembayaran SPP Siswa a.n. ${data.student.nama_lengkap}`,
        `${data.bulan} ${data.payment.tahun}`,
        formatRupiah(data.payment.nominal_dibayar)
      ]
    ],
    foot: [
      [
        { content: 'TOTAL PEMBAYARAN DITERIMA', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [238, 242, 255], textColor: [49, 46, 129] } },
        { content: formatRupiah(data.payment.nominal_dibayar), styles: { halign: 'right', fontStyle: 'bold', fillColor: [238, 242, 255], textColor: [49, 46, 129] } }
      ]
    ],
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 45 }
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'head') {
        hookData.cell.styles.halign = 'center';
        hookData.cell.styles.valign = 'middle';
      }
    },
    margin: { left: marginX, right: marginX }
  });

  const afterTableY = (doc as any).lastAutoTable.finalY + 3;

  // ==========================================
  // 5. BANNER TERBILANG (NOMINAL DALAM KATA)
  // ==========================================
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, afterTableY, contentWidth, 7, 1.2, 1.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 27, 75);
  doc.text('Terbilang :', marginX + 3, afterTableY + 4.6);

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(7.5);
  doc.setTextColor(67, 56, 202); // Indigo-700
  const terbilangText = `# ${terbilangRupiah(data.payment.nominal_dibayar)} #`;
  doc.text(terbilangText, marginX + 20, afterTableY + 4.6);

  // ==========================================
  // 6. TANDA TANGAN & STEMPEL KEABSAHAN RESMI
  // ==========================================
  const sigY = afterTableY + 10;

  // Sisi Kiri: Catatan & Stempel Keabsahan Digital
  const leftX = marginX + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Catatan & Keabsahan Dokumen:', leftX, sigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text('1. Kwitansi ini merupakan bukti pembayaran SPP digital yang sah & mengikat.', leftX, sigY + 4);
  doc.text('2. Harap disimpan dengan baik sebagai arsip bukti pembayaran yang sah.', leftX, sigY + 7.5);
  doc.text('3. Diterbitkan secara resmi melalui Sistem Informasi Keuangan Catatoh.', leftX, sigY + 11);

  // Stempel Digital Bulat (Official Verification Seal)
  const stampCenterX = marginX + 100;
  const stampCenterY = sigY + 10;

  doc.setDrawColor(16, 185, 129); // Emerald-500
  doc.setLineWidth(0.4);
  doc.circle(stampCenterX, stampCenterY, 9.5, 'S');

  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.15);
  doc.circle(stampCenterX, stampCenterY, 8.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(5, 150, 105);
  doc.text('PEMBAYARAN SPP', stampCenterX, stampCenterY - 4.5, { align: 'center' });
  
  doc.setFontSize(7.5);
  doc.text('★ LUNAS ★', stampCenterX, stampCenterY, { align: 'center' });
  
  doc.setFontSize(4.8);
  doc.text('TERVERIFIKASI SISTEM', stampCenterX, stampCenterY + 4, { align: 'center' });

  // Sisi Kanan: Titimangsa & TTD Penerima
  const rightSigCenterX = pageWidth - marginX - 32;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const signDateStr = `${data.city || 'Indonesia'}, ${formatDateIndo(data.payment.tanggal_bayar)}`;
  doc.text(signDateStr, rightSigCenterX, sigY, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text('Petugas Kasir / Penerima,', rightSigCenterX, sigY + 4.5, { align: 'center' });

  // Ruang Tanda Tangan & Nama Terang
  const nameY = sigY + 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const recipientName = data.treasurerName || 'Bendahara Sekolah';
  doc.text(`(  ${recipientName}  )`, rightSigCenterX, nameY, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Bagian Keuangan & Administrasi SPP', rightSigCenterX, nameY + 3.8, { align: 'center' });

  // ==========================================
  // 7. FOOTER SECURITY BAR
  // ==========================================
  const footLineY = pageHeight - 12;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.15);
  doc.line(marginX, footLineY, pageWidth - marginX, footLineY);

  const nowStr = new Date().toLocaleString('id-ID');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text(
    `Catatoh (catatoh.my.id) • Dokumen Transaksi Sah • ID: ${data.payment.id}`,
    marginX,
    pageHeight - 9
  );
  doc.text(
    `Dicetak pada: ${nowStr}`,
    pageWidth - marginX,
    pageHeight - 9,
    { align: 'right' }
  );

  // Simpan / Unduh Dokumen
  const safeStudentName = (data.student.nama_lengkap || 'Siswa').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Kwitansi_SPP_${safeStudentName}_${data.bulan}_${data.payment.tahun}.pdf`;
  doc.save(filename);
};

/**
 * 2. EKSPOR KWITANSI RESMI PENERIMAAN KAS LAIN-LAIN (A5 LANDSCAPE)
 */
export const exportOtherIncomeReceiptPDF = (data: OtherIncomeReceiptData) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5'
  });

  const pageWidth = 210;
  const pageHeight = 148;
  const marginX = 12;
  const contentWidth = pageWidth - (marginX * 2);

  // Double Border
  doc.setDrawColor(6, 95, 70); // Emerald-800
  doc.setLineWidth(0.65);
  doc.roundedRect(8, 7, pageWidth - 16, pageHeight - 14, 2.5, 2.5, 'S');

  doc.setDrawColor(167, 243, 208); // Emerald-200
  doc.setLineWidth(0.2);
  doc.roundedRect(9.5, 8.5, pageWidth - 19, pageHeight - 17, 1.8, 1.8, 'S');

  // Sudut
  doc.setFillColor(6, 95, 70);
  doc.rect(10.5, 9.5, 2.5, 2.5, 'F');
  doc.rect(pageWidth - 13, 9.5, 2.5, 2.5, 'F');
  doc.rect(10.5, pageHeight - 12, 2.5, 2.5, 'F');
  doc.rect(pageWidth - 13, pageHeight - 12, 2.5, 2.5, 'F');

  // Header Logo & School Name
  let textStartX = marginX;
  if (data.schoolLogo) {
    try {
      let logoW = 22;
      let logoH = 18;
      const logoX = marginX + 1;
      let logoY = 11;
      try {
        const imgProps = (doc as any).getImageProperties(data.schoolLogo);
        if (imgProps?.width && imgProps?.height) {
          const aspect = imgProps.width / imgProps.height;
          const maxW = 26;
          const maxH = 18;
          if (aspect > maxW / maxH) {
            logoW = maxW;
            logoH = maxW / aspect;
          } else {
            logoH = maxH;
            logoW = maxH * aspect;
          }
          logoY = 11 + (maxH - logoH) / 2;
        }
      } catch {}
      doc.addImage(data.schoolLogo, logoX, logoY, logoW, logoH);
      textStartX = logoX + logoW + 5;
    } catch (e) {
      console.warn('Gagal memuat logo sekolah:', e);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(6, 95, 70);
  doc.text((data.schoolName || 'LEMBAGA PENDIDIKAN').toUpperCase(), textStartX, 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(16, 149, 107);
  doc.text('BUKTI PENERIMAAN KAS & PEMASUKAN LAIN-LAIN', textStartX, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Wilayah: ${data.city || 'Indonesia'} • Bukti Transaksi Resmi Terverifikasi`, textStartX, 25.5);

  // Kanan Header: Label Box
  const rightBadgeW = 58;
  const rightBadgeX = pageWidth - marginX - rightBadgeW;
  doc.setFillColor(6, 95, 70);
  doc.roundedRect(rightBadgeX, 11, rightBadgeW, 7.5, 1.5, 1.5, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('BUKTI KAS MASUK', rightBadgeX + (rightBadgeW / 2), 16, { align: 'center' });

  const receiptNo = `INC-${(data.otherIncome.id || '0000').slice(0, 8).toUpperCase()}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`No. Bukti   : ${receiptNo}`, rightBadgeX, 22.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tgl Terima : ${formatDateIndo(data.otherIncome.tanggal)}`, rightBadgeX, 26.5);

  // Divider
  doc.setDrawColor(6, 95, 70);
  doc.setLineWidth(0.45);
  doc.line(marginX, 30.5, pageWidth - marginX, 30.5);

  // Info Box
  const infoBoxY = 34;
  const infoBoxH = 17;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, infoBoxY, contentWidth, infoBoxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Uraian / Sumber Pemasukan :', marginX + 4, infoBoxY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.otherIncome.nama_pemasukan || '-', marginX + 45, infoBoxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Tanggal Transaksi                :', marginX + 4, infoBoxY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(formatDateIndo(data.otherIncome.tanggal), marginX + 45, infoBoxY + 12);

  // Tabel
  const tableStartY = infoBoxY + infoBoxH + 3.5;
  autoTable(doc, {
    startY: tableStartY,
    theme: 'grid',
    showFoot: 'lastPage',
    headStyles: {
      fillColor: [6, 95, 70],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: 2
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    head: [
      ['No', 'Keperluan / Keterangan Pemasukan Kas', 'Tanggal', 'Jumlah Nominal (Rp)']
    ],
    body: [
      [
        '1',
        data.otherIncome.nama_pemasukan,
        formatDateIndo(data.otherIncome.tanggal),
        formatRupiah(data.otherIncome.nominal)
      ]
    ],
    foot: [
      [
        { content: 'TOTAL KAS MASUK DITERIMA', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [6, 95, 70] } },
        { content: formatRupiah(data.otherIncome.nominal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [6, 95, 70] } }
      ]
    ],
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 45 }
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'head') {
        hookData.cell.styles.halign = 'center';
        hookData.cell.styles.valign = 'middle';
      }
    },
    margin: { left: marginX, right: marginX }
  });

  const afterTableY = (doc as any).lastAutoTable.finalY + 3;

  // Terbilang
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, afterTableY, contentWidth, 7, 1.2, 1.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(6, 95, 70);
  doc.text('Terbilang :', marginX + 3, afterTableY + 4.6);

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(7.5);
  doc.setTextColor(6, 95, 70);
  doc.text(`# ${terbilangRupiah(data.otherIncome.nominal)} #`, marginX + 20, afterTableY + 4.6);

  // TTD & Stempel
  const sigY = afterTableY + 11;
  const leftX = marginX + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Catatan & Bukti Transaksi:', leftX, sigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text('1. Bukti penerimaan kas ini sah dan diakui dalam pembukuan keuangan lembaga.', leftX, sigY + 4);
  doc.text('2. Disimpan sebagai dokumen pertanggungjawaban arus kas masuk resmi.', leftX, sigY + 7.5);

  // Stempel Digital
  const stampCenterX = marginX + 100;
  const stampCenterY = sigY + 10;
  doc.setDrawColor(6, 95, 70);
  doc.setLineWidth(0.4);
  doc.circle(stampCenterX, stampCenterY, 9.5, 'S');
  doc.setLineWidth(0.15);
  doc.circle(stampCenterX, stampCenterY, 8.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(6, 95, 70);
  doc.text('KAS MASUK', stampCenterX, stampCenterY - 4.5, { align: 'center' });
  doc.setFontSize(7.5);
  doc.text('★ DITERIMA ★', stampCenterX, stampCenterY, { align: 'center' });
  doc.setFontSize(4.8);
  doc.text('TERVERIFIKASI', stampCenterX, stampCenterY + 4, { align: 'center' });

  // Sisi Kanan: Titimangsa & TTD
  const rightSigCenterX = pageWidth - marginX - 32;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`${data.city || 'Indonesia'}, ${formatDateIndo(data.otherIncome.tanggal)}`, rightSigCenterX, sigY, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text('Bendahara / Penerima Kas,', rightSigCenterX, sigY + 4.5, { align: 'center' });

  const nameY = sigY + 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`(  ${data.treasurerName || 'Bendahara'}  )`, rightSigCenterX, nameY, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Pengelola Kas & Keuangan', rightSigCenterX, nameY + 3.8, { align: 'center' });

  // Footer Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.15);
  doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Catatoh (catatoh.my.id) • Bukti Kas Masuk Sah • ID: ${data.otherIncome.id}`, marginX, pageHeight - 9);
  doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, pageWidth - marginX, pageHeight - 9, { align: 'right' });

  const safeName = (data.otherIncome.nama_pemasukan || 'Pemasukan').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Kwitansi_KasMasuk_${safeName}_${data.otherIncome.tanggal}.pdf`);
};
