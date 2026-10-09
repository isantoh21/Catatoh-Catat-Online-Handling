import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReceiptItem {
  no?: number;
  deskripsi: string;
  periode: string;
  nominal: number;
  studentName?: string;
  kelompok?: string;
}

export interface SppReceiptData {
  schoolName: string;
  schoolLogo?: string | null;
  city?: string;
  principalName?: string;
  treasurerName: string;
  adminSignature?: string | null;
  schoolStamp?: string | null;
  
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

  // Penyesuaian Otomatis Multi-Bulan & Kakak-Adik
  isMultiMonth?: boolean;
  isSiblingPayment?: boolean;
  paymentTypeTitle?: string;
  items?: ReceiptItem[];
  allStudents?: Array<{ id?: string; nama_lengkap: string; kelompok?: string; nomor_whatsapp?: string }>;
  noteText?: string;
}

export interface OtherIncomeReceiptData {
  schoolName: string;
  schoolLogo?: string | null;
  city?: string;
  treasurerName: string;
  adminSignature?: string | null;
  schoolStamp?: string | null;
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
 * 1. GENERATE KWITANSI RESMI PEMBAYARAN SPP SISWA (A5 LANDSCAPE)
 */
export const generateSppReceiptPdfDoc = (data: SppReceiptData): jsPDF => {
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

      const logoFormat = (data.schoolLogo.startsWith('data:image/png') || !data.schoolLogo.startsWith('data:image/jpeg')) ? 'PNG' : 'JPEG';
      doc.addImage(data.schoolLogo, logoFormat, logoX, logoY, logoW, logoH, undefined, 'FAST');
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

  // ==========================================
  // PARSING & PENYESUAIAN OTOMATIS: MULTI-BULAN & KAKAK-ADIK
  // ==========================================
  let effectiveItems: ReceiptItem[] = [];

  if (data.items && data.items.length > 0) {
    effectiveItems = data.items.map((it, idx) => ({
      no: it.no || idx + 1,
      deskripsi: it.deskripsi,
      periode: it.periode,
      nominal: Number(it.nominal) || 0,
      studentName: it.studentName,
      kelompok: it.kelompok
    }));
  } else {
    // Otomatis pecah jika bulan mengandung pemisah (&, koma, 'dan')
    const rawBulan = (data.bulan || data.payment.bulan || '').trim();
    const splitMonths = rawBulan
      .split(/&|,|\bdan\b/i)
      .map(b => b.trim())
      .filter(b => b.length > 0);

    const rawNames = (data.student.nama_lengkap || '').trim();
    const splitNames = (data.allStudents && data.allStudents.length > 1)
      ? data.allStudents.map(s => s.nama_lengkap)
      : rawNames.split(/&|\bdan\b/i).map(n => n.trim()).filter(n => n.length > 0);

    if (splitNames.length > 1 && splitMonths.length <= 1) {
      // Kasus Kakak-Adik (1 bulan, beberapa anak)
      const perStudent = Math.floor(data.payment.nominal_dibayar / splitNames.length);
      const rem = data.payment.nominal_dibayar % splitNames.length;
      effectiveItems = splitNames.map((sName, idx) => {
        const studentMeta = data.allStudents?.find(s => s.nama_lengkap === sName);
        const kel = studentMeta?.kelompok || '';
        return {
          no: idx + 1,
          deskripsi: `SPP Siswa a.n. ${sName}${kel ? ` (${kel})` : ''}`,
          periode: `${rawBulan || 'SPP'} ${data.payment.tahun}`,
          nominal: perStudent + (idx === 0 ? rem : 0),
          studentName: sName,
          kelompok: kel
        };
      });
    } else if (splitMonths.length > 1 && splitNames.length <= 1) {
      // Kasus Multi-Bulan (beberapa bulan, 1 anak)
      const perMonth = Math.floor(data.payment.nominal_dibayar / splitMonths.length);
      const rem = data.payment.nominal_dibayar % splitMonths.length;
      effectiveItems = splitMonths.map((mName, idx) => ({
        no: idx + 1,
        deskripsi: `Iuran Pembayaran SPP a.n. ${data.student.nama_lengkap}`,
        periode: `${mName} ${data.payment.tahun}`,
        nominal: perMonth + (idx === 0 ? rem : 0),
        studentName: data.student.nama_lengkap,
        kelompok: data.student.kelompok
      }));
    } else if (splitNames.length > 1 && splitMonths.length > 1) {
      // Kasus Kakak-Adik Sekaligus Multi-Bulan
      const totalUnits = splitNames.length * splitMonths.length;
      const perUnit = Math.floor(data.payment.nominal_dibayar / totalUnits);
      const rem = data.payment.nominal_dibayar % totalUnits;
      let counter = 0;
      effectiveItems = [];
      for (const sName of splitNames) {
        const studentMeta = data.allStudents?.find(s => s.nama_lengkap === sName);
        const kel = studentMeta?.kelompok || '';
        for (const mName of splitMonths) {
          counter++;
          effectiveItems.push({
            no: counter,
            deskripsi: `SPP Siswa a.n. ${sName}${kel ? ` (${kel})` : ''}`,
            periode: `${mName} ${data.payment.tahun}`,
            nominal: perUnit + (counter === 1 ? rem : 0),
            studentName: sName,
            kelompok: kel
          });
        }
      }
    } else {
      // Kasus Normal 1 Item
      effectiveItems = [
        {
          no: 1,
          deskripsi: `Iuran Pembayaran SPP Siswa a.n. ${data.student.nama_lengkap}`,
          periode: `${rawBulan || 'SPP'} ${data.payment.tahun}`,
          nominal: data.payment.nominal_dibayar,
          studentName: data.student.nama_lengkap,
          kelompok: data.student.kelompok
        }
      ];
    }
  }

  // ==========================================
  // DEDUPLIKASI ITEMS: Masing-masing anak & bulan hanya boleh 1 baris
  // ==========================================
  if (effectiveItems.length > 1) {
    const dedupeMap = new Map<string, ReceiptItem>();
    for (const item of effectiveItems) {
      const cleanName = (item.studentName || item.deskripsi.replace(/^SPP Siswa a\.n\.\s*/i, '').replace(/\s*\([^)]*\)$/, '')).trim().toLowerCase();
      const cleanPeriode = (item.periode || '').trim().toLowerCase();
      const key = `${cleanName}_${cleanPeriode}`;

      if (!dedupeMap.has(key)) {
        dedupeMap.set(key, { ...item });
      } else {
        const existing = dedupeMap.get(key)!;
        if (Math.abs(existing.nominal - item.nominal) > 100) {
          existing.nominal += item.nominal;
        }
      }
    }
    effectiveItems = Array.from(dedupeMap.values()).map((it, idx) => ({
      ...it,
      no: idx + 1
    }));
  }

  const isSibling = Boolean(
    data.isSiblingPayment ||
    (data.allStudents && data.allStudents.length > 1) ||
    (effectiveItems.length > 1 && new Set(effectiveItems.map(i => i.studentName).filter(Boolean)).size > 1)
  );

  const isMulti = Boolean(
    data.isMultiMonth ||
    (effectiveItems.length > 1 && !isSibling) ||
    (effectiveItems.length > (data.allStudents?.length || 1))
  );

  const totalPaymentNominal = effectiveItems.reduce((acc, it) => acc + (Number(it.nominal) || 0), 0) || data.payment.nominal_dibayar;

  // ==========================================
  // BANNER JUDUL KWITANSI (KOMPAK, TIDAK MENUTUPI KOP)
  // ==========================================
  let rightBadgeTitle = 'KWITANSI PEMBAYARAN SPP';
  if (data.paymentTypeTitle && data.paymentTypeTitle.length <= 26) {
    rightBadgeTitle = data.paymentTypeTitle;
  } else if (isSibling && isMulti) {
    rightBadgeTitle = 'KWITANSI KELUARGA';
  } else if (isSibling) {
    rightBadgeTitle = 'KWITANSI (KAKAK-ADIK)';
  } else if (isMulti) {
    rightBadgeTitle = `KWITANSI (${effectiveItems.length} BULAN)`;
  } else {
    rightBadgeTitle = 'KWITANSI PEMBAYARAN SPP';
  }

  // Lebar proporsional maksimal 52mm sehingga titik mulai X = 148mm (JAUH dari Kop teks di sebelah kiri)
  const rightBadgeW = 52;
  const rightBadgeX = pageWidth - marginX - rightBadgeW; // 210 - 10 - 52 = 148mm
  const rightBadgeH = 6.2;
  const rightBadgeY = 11;
  
  doc.setFillColor(30, 27, 75); // Indigo-950
  doc.roundedRect(rightBadgeX, rightBadgeY, rightBadgeW, rightBadgeH, 1.2, 1.2, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(rightBadgeTitle.length > 20 ? 6.5 : 7.2);
  doc.setTextColor(255, 255, 255);
  doc.text(rightBadgeTitle, rightBadgeX + (rightBadgeW / 2), rightBadgeY + 4.2, { align: 'center' });

  // Nomor Referensi & Tanggal
  const receiptNo = `KW-SPP/${data.payment.tahun}/${(data.payment.id || '0000').slice(0, 8).toUpperCase()}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85); // Slate-700
  doc.text(`No. Kwitansi : ${receiptNo}`, rightBadgeX, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  const payTime = data.payment.waktu_bayar ? ` • ${data.payment.waktu_bayar}` : '';
  doc.text(`Tgl Bayar   : ${formatDateIndo(data.payment.tanggal_bayar)}${payTime}`, rightBadgeX, 26);

  // Garis Pembatas Header (Double Line)
  doc.setDrawColor(30, 27, 75);
  doc.setLineWidth(0.45);
  doc.line(marginX, 30.5, pageWidth - marginX, 30.5);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.15);
  doc.line(marginX, 31.5, pageWidth - marginX, 31.5);

  // ==========================================
  // 3. KOTAK INFORMASI SISWA & TRANSAKSI
  // ==========================================
  const infoBoxY = 34;
  const infoBoxH = 22;
  
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, infoBoxY, contentWidth, infoBoxH, 1.5, 1.5, 'FD');

  // Kolom Kiri Info
  const col1X = marginX + 3.5;
  const col1ValX = marginX + 34;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Telah Diterima Dari', col1X, infoBoxY + 5.5);
  doc.text('Kelas / Kelompok', col1X, infoBoxY + 11);
  doc.text('No. WhatsApp Ortu', col1X, infoBoxY + 16.5);

  // Format Nama Siswa
  const studentDisplayName = data.student.nama_lengkap || '-';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(studentDisplayName.length > 34 ? 6.8 : (studentDisplayName.length > 24 ? 7.4 : 8.2));
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(`:  ${studentDisplayName}`, col1ValX, infoBoxY + 5.5, { maxWidth: 58 });

  // Format Kelompok
  let kelompokText = data.student.kelompok || 'Reguler / Umum';
  if (data.allStudents && data.allStudents.length > 1) {
    const kels = data.allStudents.map(s => s.kelompok || 'Reguler').filter((v, i, a) => a.indexOf(v) === i);
    kelompokText = kels.join(' & ');
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(30, 41, 59);
  doc.text(`:  ${kelompokText}`, col1ValX, infoBoxY + 11, { maxWidth: 58 });
  doc.text(`:  ${data.student.nomor_whatsapp || '-'}`, col1ValX, infoBoxY + 16.5);

  // Kolom Kanan Info (Diberi Jarak Bersih agar Tidak Bertabrakan dengan Kolom Kiri)
  const col2X = marginX + 97;
  const col2ValX = col2X + 30;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Untuk Pembayaran', col2X, infoBoxY + 5.5);
  doc.text('Metode Transaksi', col2X, infoBoxY + 11);
  doc.text('Status Pelunasan', col2X, infoBoxY + 16.5);

  // Format Keterangan Pembayaran
  let paymentForText = `SPP Bulan ${data.bulan} ${data.payment.tahun}`;
  const sCount = data.allStudents?.length || new Set(effectiveItems.map(i => i.studentName).filter(Boolean)).size || 1;
  if (isSibling && isMulti) {
    paymentForText = `SPP Keluarga (${sCount} Siswa, Multi-Bulan)`;
  } else if (isSibling) {
    paymentForText = `SPP Kakak-Adik (${sCount} Siswa)`;
  } else if (isMulti) {
    const monthNames = effectiveItems.map(i => i.periode.split(' ')[0]).join(', ');
    paymentForText = `SPP ${effectiveItems.length} Bulan (${monthNames})`;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(paymentForText.length > 30 ? 7.2 : 8);
  doc.setTextColor(49, 46, 129); // Indigo-900
  doc.text(`:  ${paymentForText}`, col2ValX, infoBoxY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(':  Transfer Bank', col2ValX, infoBoxY + 11);
  doc.text(':', col2ValX, infoBoxY + 16.5);

  // Status Badge LUNAS
  const badgeW = 27;
  const badgeH = 5;
  const badgeX = col2ValX + 3.5;
  const badgeY = infoBoxY + 13.2;

  doc.setFillColor(236, 253, 245); // Emerald-50
  doc.setDrawColor(16, 185, 129); // Emerald-500
  doc.setLineWidth(0.25);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.2, 1.2, 'FD');

  // Vector Checkmark
  doc.setDrawColor(5, 150, 105); // Emerald-600
  doc.setLineWidth(0.4);
  doc.line(badgeX + 3.5, badgeY + 2.7, badgeX + 4.8, badgeY + 3.9);
  doc.line(badgeX + 4.8, badgeY + 3.9, badgeX + 7.2, badgeY + 1.4);

  // Teks Status
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(5, 150, 105); // Emerald-600
  doc.text('LUNAS / SAH', badgeX + 8.5, badgeY + 3.6);

  // ==========================================
  // 4. TABEL RINCIAN PEMBAYARAN (ADAPTIF MULTI-BARIS)
  // ==========================================
  const tableStartY = infoBoxY + infoBoxH + 3.5;
  const tableFontSize = effectiveItems.length > 4 ? 6.5 : (effectiveItems.length > 2 ? 7 : 7.5);
  const tablePadding = effectiveItems.length > 4 ? 1.2 : (effectiveItems.length > 2 ? 1.6 : 2);

  autoTable(doc, {
    startY: tableStartY,
    theme: 'grid',
    showFoot: 'lastPage',
    headStyles: {
      fillColor: [49, 46, 129], // Indigo-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: tableFontSize,
      halign: 'center',
      valign: 'middle',
      cellPadding: tablePadding
    },
    styles: {
      fontSize: tableFontSize,
      cellPadding: tablePadding,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    head: [
      ['No', 'Uraian / Deskripsi Pembayaran', 'Periode', 'Nominal Pembayaran (Rp)']
    ],
    body: effectiveItems.map((item, idx) => [
      String(item.no || idx + 1),
      item.deskripsi,
      item.periode,
      formatRupiah(item.nominal)
    ]),
    foot: [
      [
        { content: 'TOTAL PEMBAYARAN DITERIMA', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [238, 242, 255], textColor: [49, 46, 129] } },
        { content: formatRupiah(totalPaymentNominal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [238, 242, 255], textColor: [49, 46, 129] } }
      ]
    ],
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 40 },
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

  const afterTableY = (doc as any).lastAutoTable.finalY + 2.5;

  // ==========================================
  // 5. BANNER TERBILANG (NOMINAL DALAM KATA)
  // ==========================================
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, afterTableY, contentWidth, 6.5, 1.2, 1.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(30, 27, 75);
  doc.text('Terbilang :', marginX + 3, afterTableY + 4.3);

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(7.2);
  doc.setTextColor(67, 56, 202); // Indigo-700
  const terbilangText = `# ${terbilangRupiah(totalPaymentNominal)} #`;
  doc.text(terbilangText, marginX + 18, afterTableY + 4.3);

  // ==========================================
  // 6. TANDA TANGAN & STEMPEL KEABSAHAN RESMI
  // ==========================================
  const sigY = afterTableY + 8;

  // Sisi Kiri: Catatan & Stempel Keabsahan Digital
  const leftX = marginX + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Catatan & Keabsahan Dokumen:', leftX, sigY);

  const dynamicNote1 = data.noteText
    ? data.noteText
    : (isSibling && isMulti)
      ? `1. Kwitansi ini mencakup lunas untuk ${effectiveItems.length} rincian SPP keluarga (kakak-beradik).`
      : isSibling
        ? `1. Kwitansi ini mencakup lunas gabungan SPP siswa kakak-beradik.`
        : isMulti
          ? `1. Kwitansi ini mencakup lunas sekaligus untuk ${effectiveItems.length} bulan iuran SPP.`
          : '1. Kwitansi ini merupakan bukti pembayaran SPP digital yang sah & mengikat.';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(dynamicNote1, leftX, sigY + 4);
  doc.text('2. Harap disimpan dengan baik sebagai arsip bukti pembayaran yang sah.', leftX, sigY + 7.5);
  doc.text('3. Diterbitkan secara resmi melalui Sistem Informasi Keuangan Catatoh.', leftX, sigY + 11);

  // Sisi Kanan: Titimangsa & TTD Penerima
  const rightSigCenterX = pageWidth - marginX - 32;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const signDateStr = `${data.city || 'Indonesia'}, ${formatDateIndo(data.payment.tanggal_bayar)}`;
  doc.text(signDateStr, rightSigCenterX, sigY, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text('Penerima,', rightSigCenterX, sigY + 4.5, { align: 'center' });

  // Ruang Tanda Tangan Admin & Stempel Sekolah Resmi
  const sigBoxW = 34;
  const sigBoxH = 15;
  let sigW = sigBoxW;
  let sigH = sigBoxH;
  const sigCenterY = sigY + 13;

  if (data.adminSignature) {
    try {
      const imgProps = (doc as any).getImageProperties(data.adminSignature);
      if (imgProps?.width && imgProps?.height) {
        const aspect = imgProps.width / imgProps.height;
        if (aspect > sigBoxW / sigBoxH) {
          sigW = sigBoxW;
          sigH = sigBoxW / aspect;
        } else {
          sigH = sigBoxH;
          sigW = sigBoxH * aspect;
        }
      }
      const sigX = rightSigCenterX - (sigW / 2);
      const sigTopY = sigCenterY - (sigH / 2);
      doc.addImage(data.adminSignature, 'PNG', sigX, sigTopY, sigW, sigH, undefined, 'FAST');
    } catch (e) {
      console.warn('Gagal memuat tanda tangan admin di kwitansi:', e);
    }
  }

  if (data.schoolStamp) {
    try {
      const stampBoxDim = 22;
      let stampW = stampBoxDim;
      let stampH = stampBoxDim;
      const imgProps = (doc as any).getImageProperties(data.schoolStamp);
      if (imgProps?.width && imgProps?.height) {
        const aspect = imgProps.width / imgProps.height;
        if (aspect >= 1) {
          stampW = stampBoxDim;
          stampH = stampBoxDim / aspect;
        } else {
          stampH = stampBoxDim;
          stampW = stampBoxDim * aspect;
        }
      }
      // Stempel sedikit menindih tanda tangan dari sebelah kiri
      const refLeft = data.adminSignature ? (rightSigCenterX - (sigW / 2)) : (rightSigCenterX - 11);
      const stampX = refLeft - (stampW * 0.42);
      const stampTopY = sigCenterY - (stampH / 2);
      doc.addImage(data.schoolStamp, 'PNG', stampX, stampTopY, stampW, stampH, undefined, 'FAST');
    } catch (e) {
      console.warn('Gagal memuat stempel sekolah di kwitansi:', e);
    }
  }

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

  return doc;
};

/**
 * Helper untuk men-generate Kwitansi SPP sebagai base64 / dataUri (misal untuk dikirim via WhatsApp)
 */
export const generateSppReceiptPdfBase64 = (data: SppReceiptData): { base64: string; dataUri: string; filename: string } => {
  const doc = generateSppReceiptPdfDoc(data);
  const safeStudentName = (data.student.nama_lengkap || 'Siswa').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Kwitansi_SPP_${safeStudentName}_${data.bulan}_${data.payment.tahun}.pdf`;
  const rawDataUri = doc.output('datauristring');
  const base64 = rawDataUri.includes(';base64,') ? rawDataUri.split(';base64,')[1] : (rawDataUri.split(',')[1] || '');
  const dataUri = `data:application/pdf;base64,${base64}`;
  return { base64, dataUri, filename };
};

/**
 * Unduh berkas Kwitansi SPP secara langsung di browser pengguna
 */
export const exportSppReceiptPDF = (data: SppReceiptData) => {
  const doc = generateSppReceiptPdfDoc(data);
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
      const logoFormat = (data.schoolLogo.startsWith('data:image/png') || !data.schoolLogo.startsWith('data:image/jpeg')) ? 'PNG' : 'JPEG';
      doc.addImage(data.schoolLogo, logoFormat, logoX, logoY, logoW, logoH, undefined, 'FAST');
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

  // Sisi Kanan: Titimangsa & TTD
  const rightSigCenterX = pageWidth - marginX - 32;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`${data.city || 'Indonesia'}, ${formatDateIndo(data.otherIncome.tanggal)}`, rightSigCenterX, sigY, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text('Bendahara / Penerima Kas,', rightSigCenterX, sigY + 4.5, { align: 'center' });

  // Ruang Tanda Tangan Admin & Stempel Sekolah Resmi
  const otherSigBoxW = 34;
  const otherSigBoxH = 15;
  let otherSigW = otherSigBoxW;
  let otherSigH = otherSigBoxH;
  const otherSigCenterY = sigY + 13;

  if (data.adminSignature) {
    try {
      const imgProps = (doc as any).getImageProperties(data.adminSignature);
      if (imgProps?.width && imgProps?.height) {
        const aspect = imgProps.width / imgProps.height;
        if (aspect > otherSigBoxW / otherSigBoxH) {
          otherSigW = otherSigBoxW;
          otherSigH = otherSigBoxW / aspect;
        } else {
          otherSigH = otherSigBoxH;
          otherSigW = otherSigBoxH * aspect;
        }
      }
      const sigX = rightSigCenterX - (otherSigW / 2);
      const sigTopY = otherSigCenterY - (otherSigH / 2);
      doc.addImage(data.adminSignature, 'PNG', sigX, sigTopY, otherSigW, otherSigH, undefined, 'FAST');
    } catch (e) {
      console.warn('Gagal memuat tanda tangan admin di kwitansi:', e);
    }
  }

  if (data.schoolStamp) {
    try {
      const stampBoxDim = 22;
      let otherStampW = stampBoxDim;
      let otherStampH = stampBoxDim;
      const imgProps = (doc as any).getImageProperties(data.schoolStamp);
      if (imgProps?.width && imgProps?.height) {
        const aspect = imgProps.width / imgProps.height;
        if (aspect >= 1) {
          otherStampW = stampBoxDim;
          otherStampH = stampBoxDim / aspect;
        } else {
          otherStampH = stampBoxDim;
          otherStampW = stampBoxDim * aspect;
        }
      }
      // Stempel sedikit menindih tanda tangan dari sebelah kiri
      const refLeft = data.adminSignature ? (rightSigCenterX - (otherSigW / 2)) : (rightSigCenterX - 11);
      const stampX = refLeft - (otherStampW * 0.42);
      const stampTopY = otherSigCenterY - (otherStampH / 2);
      doc.addImage(data.schoolStamp, 'PNG', stampX, stampTopY, otherStampW, otherStampH, undefined, 'FAST');
    } catch (e) {
      console.warn('Gagal memuat stempel sekolah di kwitansi:', e);
    }
  }

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
