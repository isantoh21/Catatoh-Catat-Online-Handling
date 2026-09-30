import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLogger';
import { 
  Search, Calendar, DollarSign, X, MessageCircle, RefreshCw, CheckSquare, Square, Save, 
  CheckCircle2, Settings, Printer, Link2, Check, ExternalLink, Share2, ShieldCheck, 
  Building2, Copy, MessageSquare, Play, Pause, AlertTriangle, AlertCircle, XCircle, 
  Clock, Users, Info, Loader2, Send, StopCircle, ArrowRight, Filter, ShieldAlert
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import ConfirmModal from './ConfirmModal';
import PaymentModerationModal from './PaymentModerationModal';
import { getPaymentVerifications, sendWhatsAppMessage, validateWhatsAppNumber } from '../lib/whatsappGateway';
import { usePremiumStatus } from '../lib/premiumService';
import PremiumLockModal from './PremiumLockModal';

const BULAN_OPTIONS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const YEAR_OPTIONS = Array.from({ length: 2045 - 2023 + 1 }, (_, i) => 2023 + i);

export default function DashboardView() {
  const navigate = useNavigate();
  const { isPremium } = usePremiumStatus();
  const [premiumLockFeature, setPremiumLockFeature] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Moderasi Pembayaran WhatsApp State
  const [isModerationModalOpen, setIsModerationModalOpen] = useState(false);
  const [pendingVerificationsCount, setPendingVerificationsCount] = useState(0);
  
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

  // Batch Reminder WhatsApp State
  const [selectedReminderIds, setSelectedReminderIds] = useState<string[]>([]);
  const [reminderFilterKelompok, setReminderFilterKelompok] = useState<string>('Semua Kelompok');
  const [reminderSearchQuery, setReminderSearchQuery] = useState<string>('');
  const [safetyIntervalPreset, setSafetyIntervalPreset] = useState<'safe' | 'standard' | 'relaxed' | 'custom'>('safe');
  const [customMinDelay, setCustomMinDelay] = useState<number>(10);
  const [customMaxDelay, setCustomMaxDelay] = useState<number>(20);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [isBatchPaused, setIsBatchPaused] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    successCount: number;
    failCount: number;
    currentStudentName: string;
  }>({ current: 0, total: 0, successCount: 0, failCount: 0, currentStudentName: '' });
  const [batchCountdown, setBatchCountdown] = useState<number>(0);
  const [batchCountdownTargetName, setBatchCountdownTargetName] = useState<string>('');
  const [studentSendStatuses, setStudentSendStatuses] = useState<Record<string, {
    status: 'idle' | 'sending' | 'success' | 'failed';
    error?: string;
    timestamp?: string;
  }>>({});
  const [sendingSingleId, setSendingSingleId] = useState<string | null>(null);

  const batchCancelRef = useRef<boolean>(false);
  const batchPauseRef = useRef<boolean>(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedModalBulan, setSelectedModalBulan] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [nominal, setNominal] = useState('100000');
  const [tanggalBayar, setTanggalBayar] = useState("");
  const [waktuBayar, setWaktuBayar] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; confirmText?: string; onConfirm: () => void } | null>(null);

  const DEFAULT_WA_TEMPLATE = "Halo Ayah/Bunda [NAMA_SISWA],\n\nMohon maaf mengingatkan, untuk pembayaran SPP bulan [BULAN] [TAHUN] sebesar [NOMINAL] belum tercatat.\n\nCek kartu progres SPP ananda di link resmi:\n[LINK_SPP]\n\nTerima kasih.";
  const [waTemplate, setWaTemplate] = useState(DEFAULT_WA_TEMPLATE);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [tempWaTemplate, setTempWaTemplate] = useState('');
  const [copiedParentLink, setCopiedParentLink] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedShareBroadcast, setCopiedShareBroadcast] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentSchoolName, setCurrentSchoolName] = useState<string>('');

  const getSchoolParentUrl = () => {
    if (currentUserId) {
      return `catatoh.vercel.app/kartu-spp-ortu/${currentUserId}`;
    }
    return 'catatoh.vercel.app/kartu-spp-ortu';
  };

  const handleCopyParentLink = async () => {
    const parentUrl = getSchoolParentUrl();
    const fullUrl = `https://${parentUrl}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = fullUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopiedParentLink(true);
      setTimeout(() => setCopiedParentLink(false), 2500);
    } catch (err) {
      console.error('Gagal menyalin link:', err);
    }
  };

  // Use a separate useEffect just for loading user identity and WA template
  useEffect(() => {
    const loadUserData = async () => {
      const sessionData = await supabase.auth.getSession();
      const currentUser = sessionData.data.session?.user;
      if (currentUser) {
        setCurrentUserId(currentUser.id);

        const savedSchool = localStorage.getItem('schoolName_' + currentUser.id);
        if (savedSchool) {
          setCurrentSchoolName(savedSchool);
        }

        try {
          const { data: settings } = await supabase
            .from('user_settings')
            .select('school_name')
            .eq('user_id', currentUser.id)
            .maybeSingle();

          if (settings?.school_name) {
            setCurrentSchoolName(settings.school_name);
            localStorage.setItem('schoolName_' + currentUser.id, settings.school_name);
          }
        } catch (e) {
          // Abaikan
        }

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
    loadUserData();
    refreshPendingCount();

    const interval = setInterval(() => {
      refreshPendingCount();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const refreshPendingCount = async () => {
    try {
      const sessionData = await supabase.auth.getSession();
      const uid = sessionData.data.session?.user?.id;
      const list = await getPaymentVerifications(uid);
      const pending = list.filter(item => item.status === 'pending').length;
      setPendingVerificationsCount(pending);
    } catch (e) {
      // Abaikan jika offline / gagal
    }
  };

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
          let logoW = 20;
          let logoH = 20;
          let logoX = 20;
          let logoY = 10;

          try {
            const imgProps = (doc as any).getImageProperties(schoolLogo);
            if (imgProps && imgProps.width && imgProps.height) {
              const aspect = imgProps.width / imgProps.height;
              const maxW = 35; // Lebar maksimal di kwitansi (mm)
              const maxH = 22; // Tinggi maksimal di kwitansi (mm)
              
              if (aspect > maxW / maxH) {
                // Gambar horizontal / landscape
                logoW = maxW;
                logoH = maxW / aspect;
              } else {
                // Gambar persegi / portrait
                logoH = maxH;
                logoW = maxH * aspect;
              }
              // Posisikan tepat di tengah area header (tinggi 22mm)
              logoY = 10 + (maxH - logoH) / 2;
            }
          } catch (propErr) {
            console.warn("Could not read image properties, using default dimensions", propErr);
          }

          doc.addImage(schoolLogo, logoX, logoY, logoW, logoH);
        } catch (e) {
          console.error("Gagal memuat logo sekolah di kwitansi", e);
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


  // Reminder data filtering
  const targetReminderBulan = reminderBulan || (selectedBulan === 'Semua Bulan' ? BULAN_OPTIONS[new Date().getMonth()] : selectedBulan);
  
  // Seluruh siswa yang belum lunas pada bulan reminder yang dipilih
  const allBelumLunasStudents = students.filter(s => 
    !payments.some(p => p.student_id === s.id && p.bulan === targetReminderBulan)
  );

  // Filter khusus di dalam Reminder Modal (pencarian nama/WA & filter kelompok)
  const reminderFilteredStudents = allBelumLunasStudents.filter(s => {
    const matchKelompok = reminderFilterKelompok === 'Semua Kelompok' || s.kelompok === reminderFilterKelompok;
    const matchSearch = !reminderSearchQuery.trim() || 
      s.nama_lengkap.toLowerCase().includes(reminderSearchQuery.toLowerCase()) ||
      (s.nomor_whatsapp && s.nomor_whatsapp.includes(reminderSearchQuery));
    return matchKelompok && matchSearch;
  });

  const handleOpenModerasiModal = () => {
    if (!isPremium) {
      setPremiumLockFeature('Moderasi Bukti Bayar WhatsApp (Verifikasi Struk Otomatis)');
      return;
    }
    setIsModerationModalOpen(true);
  };

  // Buka modal reminder dan inisialisasi checklist default
  // Buka modal reminder dan inisialisasi checklist default (hanya nomor valid yang dicentang otomatis)
  const handleOpenReminderModal = (bulanToUse?: string) => {
    const target = bulanToUse || (selectedBulan === 'Semua Bulan' ? BULAN_OPTIONS[new Date().getMonth()] : selectedBulan);
    setReminderBulan(target);
    const unpayed = students.filter(s => 
      !payments.some(p => p.student_id === s.id && p.bulan === target)
    );
    // Centang default HANYA siswa yang nomor WA-nya valid (min 10 digit)
    const withValidPhone = unpayed
      .filter(s => validateWhatsAppNumber(s.nomor_whatsapp).valid)
      .map(s => s.id);
    setSelectedReminderIds(withValidPhone);
    setIsReminderModalOpen(true);
  };

  // Tutup modal dengan peringatan jika batch sedang berjalan
  const handleCloseReminderModal = () => {
    if (isBatchRunning) {
      if (window.confirm('Pengiriman pesan massal masih berlangsung. Anda yakin ingin membatalkan dan keluar?')) {
        handleStopBatch();
        setIsReminderModalOpen(false);
      }
    } else {
      setIsReminderModalOpen(false);
    }
  };

  // Helper pemformat template pesan reminder
  const formatReminderMessage = (student: any) => {
    const parentSppLink = `https://${getSchoolParentUrl()}`;
    return waTemplate
      .replace(/\[NAMA_SISWA\]/g, student.nama_lengkap)
      .replace(/\[BULAN\]/g, targetReminderBulan)
      .replace(/\[TAHUN\]/g, selectedTahun)
      .replace(/\[NOMINAL\]/g, "Rp" + (student.nominal_spp ? student.nominal_spp.toLocaleString('id-ID') : '0'))
      .replace(/\[LINK_SPP\]/g, parentSppLink);
  };

  // Fallback: Kirim manual via link wa.me
  const handleKirimManualWA = (student: any) => {
    const val = validateWhatsAppNumber(student.nomor_whatsapp || '');
    const cleanPhone = val.cleanNumber || (student.nomor_whatsapp || '').replace(/[^0-9]/g, '');
    const message = formatReminderMessage(student);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Kirim satuan langsung via WhatsApp Gateway
  const handleKirimSingleWA = async (student: any) => {
    if (!isPremium) {
      setPremiumLockFeature('WhatsApp Gateway (Pengiriman Otomatis)');
      return;
    }
    const val = validateWhatsAppNumber(student.nomor_whatsapp);
    if (!val.valid) {
      setStudentSendStatuses(prev => ({
        ...prev,
        [student.id]: { 
          status: 'failed', 
          error: val.message || 'Nomor tidak valid',
          code: val.reason 
        }
      }));
      alert(`Nomor WhatsApp ${student.nama_lengkap} ${val.message}. Mohon perbaiki nomor telepon siswa.`);
      return;
    }

    setSendingSingleId(student.id);
    setStudentSendStatuses(prev => ({
      ...prev,
      [student.id]: { status: 'sending' }
    }));

    try {
      const message = formatReminderMessage(student);
      const res = await sendWhatsAppMessage({
        to: student.nomor_whatsapp,
        message: message,
        userId: currentUserId
      });

      if (res.success) {
        setStudentSendStatuses(prev => ({
          ...prev,
          [student.id]: { 
            status: 'success', 
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) 
          }
        }));
        await logActivity(
          'Kirim Reminder WA',
          `Kirim reminder SPP ${targetReminderBulan} ke ${student.nama_lengkap} (${student.nomor_whatsapp}) via WhatsApp`,
          'info'
        );
      } else {
        setStudentSendStatuses(prev => ({
          ...prev,
          [student.id]: { 
            status: 'failed', 
            error: res.error || 'Gagal mengirim pesan WhatsApp',
            code: res.code
          }
        }));
      }
    } catch (err: any) {
      setStudentSendStatuses(prev => ({
        ...prev,
        [student.id]: { 
          status: 'failed', 
          error: err.message || 'Error koneksi gateway',
          code: 'NETWORK_ERROR'
        }
      }));
    } finally {
      setSendingSingleId(null);
    }
  };

  // Hitung rentang delay teraman untuk menghindari pemblokiran Meta/WhatsApp
  const getDelayRange = () => {
    switch (safetyIntervalPreset) {
      case 'relaxed':
        return { min: 20, max: 35 };
      case 'standard':
        return { min: 8, max: 15 };
      case 'custom':
        return { 
          min: Math.max(6, Number(customMinDelay) || 10), 
          max: Math.max(Number(customMinDelay) || 10, Number(customMaxDelay) || 20) 
        };
      case 'safe':
      default:
        // Default interval pengiriman aman: 10 hingga 20 detik acak
        return { min: 10, max: 20 };
    }
  };

  // Countdown timer sleep yang responsif terhadap Pause & Stop
  const sleepWithCountdown = async (seconds: number, targetName: string) => {
    setBatchCountdown(seconds);
    setBatchCountdownTargetName(targetName);
    
    for (let s = seconds; s > 0; s--) {
      if (batchCancelRef.current) break;
      
      // Tunggu selagi pause aktif
      while (batchPauseRef.current && !batchCancelRef.current) {
        await new Promise(r => setTimeout(r, 400));
      }
      
      setBatchCountdown(s);
      await new Promise(r => setTimeout(r, 1000));
    }
    
    setBatchCountdown(0);
    setBatchCountdownTargetName('');
  };

  // Eksekusi pengiriman batch / massal via WhatsApp dengan interval acak anti-banned
  const handleStartBatchSend = async () => {
    if (!isPremium) {
      setPremiumLockFeature('WhatsApp Gateway (Pengiriman Massal)');
      return;
    }
    const targetStudents = reminderFilteredStudents.filter(s => selectedReminderIds.includes(s.id));
    if (targetStudents.length === 0) {
      alert('Silakan pilih minimal 1 siswa dengan mencentang kotak di daftar.');
      return;
    }

    batchCancelRef.current = false;
    batchPauseRef.current = false;
    setIsBatchRunning(true);
    setIsBatchPaused(false);

    const { min, max } = getDelayRange();
    let successCount = 0;
    let failCount = 0;

    setBatchProgress({
      current: 0,
      total: targetStudents.length,
      successCount: 0,
      failCount: 0,
      currentStudentName: targetStudents[0]?.nama_lengkap || ''
    });

    for (let i = 0; i < targetStudents.length; i++) {
      if (batchCancelRef.current) break;

      // Tunggu jika sedang di-pause
      while (batchPauseRef.current && !batchCancelRef.current) {
        await new Promise(r => setTimeout(r, 400));
      }

      if (batchCancelRef.current) break;

      const student = targetStudents[i];
      setBatchProgress(prev => ({
        ...prev,
        current: i + 1,
        currentStudentName: student.nama_lengkap
      }));

      // Tandai baris siswa sedang mengirim
      setStudentSendStatuses(prev => ({
        ...prev,
        [student.id]: { status: 'sending' }
      }));

      try {
        const val = validateWhatsAppNumber(student.nomor_whatsapp);
        if (!val.valid) {
          failCount++;
          setStudentSendStatuses(prev => ({
            ...prev,
            [student.id]: { 
              status: 'failed', 
              error: val.message || 'Nomor tidak valid',
              code: val.reason 
            }
          }));
          setBatchProgress(prev => ({ ...prev, failCount }));
          continue; // Lanjut ke siswa berikutnya tanpa delay
        }

        const message = formatReminderMessage(student);
        const res = await sendWhatsAppMessage({
          to: student.nomor_whatsapp,
          message: message,
          userId: currentUserId
        });

        if (res.success) {
          successCount++;
          setStudentSendStatuses(prev => ({
            ...prev,
            [student.id]: { 
              status: 'success', 
              timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) 
            }
          }));
          setBatchProgress(prev => ({ ...prev, successCount }));
        } else {
          failCount++;
          setStudentSendStatuses(prev => ({
            ...prev,
            [student.id]: { 
              status: 'failed', 
              error: res.error || 'Gagal mengirim via WhatsApp',
              code: res.code 
            }
          }));
          setBatchProgress(prev => ({ ...prev, failCount }));
        }
      } catch (err: any) {
        failCount++;
        setStudentSendStatuses(prev => ({
          ...prev,
          [student.id]: { 
            status: 'failed', 
            error: err.message || 'Error pengiriman',
            code: 'EXCEPTION'
          }
        }));
        setBatchProgress(prev => ({ ...prev, failCount }));
      }

      // Berikan jeda acak aman (random jitter) sebelum pesan berikutnya
      if (i < targetStudents.length - 1 && !batchCancelRef.current) {
        const nextStudent = targetStudents[i + 1];
        const randomDelay = Math.floor(Math.random() * (max - min + 1)) + min;
        await sleepWithCountdown(randomDelay, nextStudent.nama_lengkap);
      }
    }

    await logActivity(
      'Kirim Reminder WA Massal',
      `Kirim reminder SPP massal ${targetReminderBulan}: ${successCount} sukses, ${failCount} gagal dari total ${targetStudents.length} siswa.`,
      successCount > 0 ? 'info' : 'warning'
    );

    setIsBatchRunning(false);
    setIsBatchPaused(false);
    setBatchCountdown(0);
  };

  const handleTogglePauseBatch = () => {
    if (isBatchPaused) {
      batchPauseRef.current = false;
      setIsBatchPaused(false);
    } else {
      batchPauseRef.current = true;
      setIsBatchPaused(true);
    }
  };

  const handleStopBatch = () => {
    batchCancelRef.current = true;
    batchPauseRef.current = false;
    setIsBatchPaused(false);
    setIsBatchRunning(false);
    setBatchCountdown(0);
  };

  const handleToggleSelectAllReminder = () => {
    const allIds = reminderFilteredStudents.map(s => s.id);
    const areAllSelected = allIds.length > 0 && allIds.every(id => selectedReminderIds.includes(id));
    if (areAllSelected) {
      setSelectedReminderIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedReminderIds(prev => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const handleSelectOnlyValid = () => {
    const validIds = reminderFilteredStudents
      .filter(s => validateWhatsAppNumber(s.nomor_whatsapp).valid && studentSendStatuses[s.id]?.status !== 'success')
      .map(s => s.id);
    setSelectedReminderIds(validIds);
  };

  const handleSelectOnlyUnsent = () => {
    const unsentIds = reminderFilteredStudents
      .filter(s => studentSendStatuses[s.id]?.status !== 'success')
      .map(s => s.id);
    setSelectedReminderIds(unsentIds);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pembayaran SPP</h1>
          <p className="text-sm text-slate-500">
            {currentSchoolName ? `Monitor dan kelola pembayaran siswa • ${currentSchoolName}` : 'Monitor dan catat pembayaran bulanan siswa'}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <button 
            onClick={handleOpenModerasiModal}
            id="btnModerasiBuktiWa"
            className="h-10 w-10 relative rounded-xl flex items-center justify-center transition-all shadow-sm bg-gradient-to-r from-indigo-900 to-indigo-800 text-white hover:from-indigo-950 hover:to-indigo-900 border border-indigo-700 cursor-pointer"
            title={!isPremium ? "Fitur Khusus Akun Premium ⭐ (Moderasi Bukti Transfer WA)" : "Moderasi Bukti Transfer WA (Chat)"}
            aria-label="Moderasi Bukti Transfer WA"
          >
            <MessageSquare className="w-5 h-5 text-amber-300 shrink-0" />
            {!isPremium ? (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white font-black shadow-xs ring-1 ring-white">
                ★
              </span>
            ) : pendingVerificationsCount > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold bg-amber-400 text-indigo-950 flex items-center justify-center shadow border-2 border-white animate-pulse">
                {pendingVerificationsCount}
              </span>
            ) : null}
          </button>

          <button 
            onClick={() => handleOpenReminderModal()}
            id="btnKirimReminderWa"
            className="h-10 w-10 rounded-xl flex items-center justify-center transition-colors shadow-sm bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600 cursor-pointer relative"
            title="Kirim Reminder SPP via WhatsApp"
            aria-label="Kirim Reminder SPP via WhatsApp"
          >
            <MessageCircle className="w-5 h-5 shrink-0" />
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
      {/* WhatsApp Batch & Single Reminder Modal */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-200 shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-800">Kirim Reminder WhatsApp</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Anti-Ban Proteksi
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Kirim pengingat SPP otomatis ke orang tua langsung melalui WhatsApp Gateway.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyParentLink}
                  className={`px-3 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                    copiedParentLink
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-400/20'
                      : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300'
                  }`}
                  title={copiedParentLink ? "Link Kartu SPP Berhasil Disalin!" : `Salin link kartu SPP orang tua (${getSchoolParentUrl()})`}
                >
                  {copiedParentLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>Link SPP</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setTempWaTemplate(waTemplate); setIsTemplateModalOpen(true); }}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  title="Ubah teks dan format template pesan broadcast/pengingat WA"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Ubah Template Broadcast WA</span>
                </button>

                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-sm">
                  <span className="text-xs text-slate-500 font-medium">Bulan:</span>
                  <select 
                    value={targetReminderBulan}
                    disabled={isBatchRunning}
                    onChange={e => handleOpenReminderModal(e.target.value)}
                    className="text-xs font-bold text-slate-700 focus:outline-none bg-transparent cursor-pointer disabled:opacity-50"
                  >
                    {BULAN_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <button 
                  onClick={handleCloseReminderModal}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!isPremium && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-900 shadow-xs">
                  <div className="w-6 h-6 rounded-full bg-amber-200/80 text-amber-800 flex items-center justify-center font-black shrink-0 text-xs">
                    ★
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-bold text-amber-950">Mode Akun Free — Pengiriman Manual wa.me Aktif</p>
                    <p className="text-amber-800 leading-relaxed">
                      Anda dapat mengirimkan pengingat SPP secara gratis menggunakan tombol <strong>Kirim Manual (wa.me)</strong> pada setiap siswa. 
                      Fitur pengiriman otomatis sekali klik langsung via server gateway serta broadcast massal (batch) merupakan fitur khusus <strong>Akun Premium ⭐</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Box Pengaturan Interval Keamanan Anti-Blokir */}
              <div className="bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 p-4 rounded-xl border border-emerald-200/80 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        Interval Keamanan Anti-Blokir
                        <span className="text-[10px] font-normal text-emerald-700 bg-emerald-100/80 px-2 py-0.2 rounded-md">
                          Fitur Keamanan Anti-Blokir
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        Pengiriman WhatsApp massal rentan dicurigai jika pesan dikirim berturut-turut terlalu cepat. Kami menerapkan <span className="font-semibold text-emerald-800">jeda acak dinamis (random jitter)</span> agar menyerupai ritme ketikan manusia asli.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Preset Options */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-3">
                  <button
                    type="button"
                    disabled={isBatchRunning}
                    onClick={() => setSafetyIntervalPreset('safe')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer disabled:opacity-50 ${
                      safetyIntervalPreset === 'safe'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">🛡️ Sangat Aman</span>
                      {safetyIntervalPreset === 'safe' && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${safetyIntervalPreset === 'safe' ? 'text-emerald-100' : 'text-slate-500'}`}>
                      10 - 20 detik (Acak)
                    </p>
                    <span className={`text-[9px] block mt-1 font-medium ${safetyIntervalPreset === 'safe' ? 'text-emerald-200' : 'text-emerald-600'}`}>
                      Rekomendasi Utama
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isBatchRunning}
                    onClick={() => setSafetyIntervalPreset('relaxed')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer disabled:opacity-50 ${
                      safetyIntervalPreset === 'relaxed'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">🧘 Ekstra Santai</span>
                      {safetyIntervalPreset === 'relaxed' && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${safetyIntervalPreset === 'relaxed' ? 'text-emerald-100' : 'text-slate-500'}`}>
                      20 - 35 detik (Acak)
                    </p>
                    <span className={`text-[9px] block mt-1 font-medium ${safetyIntervalPreset === 'relaxed' ? 'text-emerald-200' : 'text-slate-400'}`}>
                      Untuk akun baru / blast banyak
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isBatchRunning}
                    onClick={() => setSafetyIntervalPreset('standard')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer disabled:opacity-50 ${
                      safetyIntervalPreset === 'standard'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">⚡ Standar</span>
                      {safetyIntervalPreset === 'standard' && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${safetyIntervalPreset === 'standard' ? 'text-emerald-100' : 'text-slate-500'}`}>
                      8 - 15 detik (Acak)
                    </p>
                    <span className={`text-[9px] block mt-1 font-medium ${safetyIntervalPreset === 'standard' ? 'text-emerald-200' : 'text-slate-400'}`}>
                      Akun yang sudah sering chat
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isBatchRunning}
                    onClick={() => setSafetyIntervalPreset('custom')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer disabled:opacity-50 ${
                      safetyIntervalPreset === 'custom'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">⚙️ Kustom</span>
                      {safetyIntervalPreset === 'custom' && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${safetyIntervalPreset === 'custom' ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {customMinDelay} - {customMaxDelay} detik
                    </p>
                    <span className={`text-[9px] block mt-1 font-medium ${safetyIntervalPreset === 'custom' ? 'text-emerald-200' : 'text-slate-400'}`}>
                      Tentukan rentang sendiri
                    </span>
                  </button>
                </div>

                {/* Input Kustom (jika preset custom aktif) */}
                {safetyIntervalPreset === 'custom' && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-emerald-200/60 bg-white/70 p-2.5 rounded-lg">
                    <span className="text-xs text-slate-600 font-medium">Rentang Detik Acak:</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min="6"
                        max="60"
                        disabled={isBatchRunning}
                        value={customMinDelay}
                        onChange={e => setCustomMinDelay(Math.max(6, Number(e.target.value)))}
                        className="w-16 px-2 py-1 text-xs border border-slate-300 rounded font-semibold text-center focus:ring-1 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-slate-400">s/d</span>
                      <input 
                        type="number" 
                        min={customMinDelay || 6}
                        max="120"
                        disabled={isBatchRunning}
                        value={customMaxDelay}
                        onChange={e => setCustomMaxDelay(Math.max(Number(customMinDelay), Number(e.target.value)))}
                        className="w-16 px-2 py-1 text-xs border border-slate-300 rounded font-semibold text-center focus:ring-1 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-slate-500 font-medium">detik</span>
                    </div>
                    <span className="text-[10px] text-amber-700 ml-auto bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Minimal 6 detik untuk mencegah banned instan.
                    </span>
                  </div>
                )}
              </div>

              {/* Panel Status Live Progress Pengiriman Batch */}
              {(isBatchRunning || batchProgress.total > 0) && (
                <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg border border-slate-800 space-y-3 animate-in fade-in duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isBatchRunning ? (
                        <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                      <span className="text-xs font-bold">
                        {isBatchRunning ? 'Sedang Mengirim Pesan Massal...' : 'Pengiriman Massal Selesai'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300">
                        {batchProgress.current} dari {batchProgress.total} Siswa
                      </span>
                    </div>

                    {/* Kontrol Pause / Stop */}
                    {isBatchRunning && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTogglePauseBatch}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isBatchPaused 
                              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' 
                              : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                          }`}
                        >
                          {isBatchPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                          {isBatchPaused ? 'Lanjutkan' : 'Jeda'}
                        </button>
                        <button
                          type="button"
                          onClick={handleStopBatch}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <StopCircle className="w-3.5 h-3.5" />
                          Hentikan
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` 
                      }}
                    />
                  </div>

                  {/* Stats Counter & Countdown Jeda */}
                  <div className="flex flex-wrap items-center justify-between text-xs gap-2 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {batchProgress.successCount} Berhasil
                      </span>
                      <span className="text-rose-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> {batchProgress.failCount} Gagal
                      </span>
                      <span className="text-slate-400">
                        Sisa: {Math.max(0, batchProgress.total - batchProgress.current)}
                      </span>
                    </div>

                    {/* Countdown Banner */}
                    {batchCountdown > 0 && isBatchRunning && (
                      <div className="flex items-center gap-1.5 text-amber-300 font-mono text-[11px] animate-pulse">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Jeda Aman: {batchCountdown}s sebelum ke &quot;{batchCountdownTargetName}&quot;</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Toolbar Pencarian & Filter List */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Cari nama atau nomor WA..."
                      value={reminderSearchQuery}
                      onChange={e => setReminderSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <select
                    value={reminderFilterKelompok}
                    onChange={e => setReminderFilterKelompok(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none bg-white text-slate-700 font-medium"
                  >
                    <option value="Semua Kelompok">Semua Kelompok</option>
                    {uniqueKelompokList.map(k => (
                      <option key={k as string} value={k as string}>{k as string}</option>
                    ))}
                  </select>
                </div>

                {/* Seleksi Tombol */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    disabled={isBatchRunning}
                    onClick={handleToggleSelectAllReminder}
                    className="px-2.5 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {reminderFilteredStudents.length > 0 && reminderFilteredStudents.every(s => selectedReminderIds.includes(s.id))
                      ? 'Batal Pilih Semua'
                      : `Pilih Semua (${reminderFilteredStudents.length})`
                    }
                  </button>
                  <button
                    type="button"
                    disabled={isBatchRunning}
                    onClick={handleSelectOnlyValid}
                    className="px-2.5 py-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    title="Pilih hanya siswa dengan nomor WhatsApp valid (min 10 digit) yang belum terkirim"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Pilih yg Valid
                  </button>
                  <button
                    type="button"
                    disabled={isBatchRunning}
                    onClick={handleSelectOnlyUnsent}
                    className="px-2.5 py-1 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Pilih yg Belum Terkirim
                  </button>
                </div>
              </div>

              {/* Status Header Baris */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  Menampilkan <strong className="text-slate-800">{reminderFilteredStudents.length}</strong> siswa belum lunas bulan <strong>{targetReminderBulan}</strong>
                </span>
                <span>
                  <strong className="text-emerald-700">{selectedReminderIds.length}</strong> siswa terpilih untuk batch
                </span>
              </div>

              {/* Daftar Siswa */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                {reminderFilteredStudents.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-800">Tidak ada tagihan yang belum lunas!</p>
                    <p className="text-xs text-slate-500 mt-0.5">Semua siswa pada filter ini sudah tercatat lunas untuk bulan {targetReminderBulan}.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 max-h-[38vh] overflow-y-auto">
                    {reminderFilteredStudents.map(student => {
                      const isSelected = selectedReminderIds.includes(student.id);
                      const statusObj = studentSendStatuses[student.id];
                      const isSendingThis = sendingSingleId === student.id || (isBatchRunning && statusObj?.status === 'sending');
                      const phoneValidation = validateWhatsAppNumber(student.nomor_whatsapp || '');
                      const isValidPhone = phoneValidation.valid;

                      return (
                        <li 
                          key={student.id} 
                          className={`p-3 sm:p-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-colors ${
                            isSelected ? 'bg-indigo-50/20' : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-[200px]">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isBatchRunning}
                              onChange={() => {
                                setSelectedReminderIds(prev => 
                                  prev.includes(student.id) 
                                    ? prev.filter(id => id !== student.id)
                                    : [...prev, student.id]
                                );
                              }}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer disabled:opacity-50"
                            />

                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {student.nama_lengkap.charAt(0).toUpperCase()}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-slate-800 leading-tight">
                                  {student.nama_lengkap}
                                </p>
                                {student.kelompok && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    {student.kelompok}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                {isValidPhone ? (
                                  <span className="text-[11px] text-slate-600 font-mono font-medium">
                                    {student.nomor_whatsapp}
                                  </span>
                                ) : phoneValidation.reason === 'TOO_SHORT' ? (
                                  <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    {student.nomor_whatsapp} (Kurang Digit: {phoneValidation.cleanNumber.length} angka)
                                  </span>
                                ) : phoneValidation.reason === 'TOO_LONG' ? (
                                  <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    {student.nomor_whatsapp} (Terlalu Panjang)
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 flex items-center gap-1">
                                    <XCircle className="w-3 h-3 text-rose-500" />
                                    Nomor WA Belum Ada
                                  </span>
                                )}
                                <span className="text-[11px] text-slate-400">•</span>
                                <span className="text-[11px] font-semibold text-slate-700">
                                  Rp{(student.nominal_spp || 100000).toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Status Badge & Actions */}
                          <div className="flex items-center gap-2 ml-auto">
                            {/* Status Chip */}
                            {statusObj?.status === 'sending' && (
                              <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                                Mengirim...
                              </span>
                            )}
                            {statusObj?.status === 'success' && (
                              <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Terkirim {statusObj.timestamp ? `(${statusObj.timestamp})` : ''}
                              </span>
                            )}
                            {statusObj?.status === 'failed' && (
                              <div>
                                {statusObj.code === 'NUMBER_NOT_FOUND' || (statusObj.error && statusObj.error.toLowerCase().includes('tidak ditemukan')) || (statusObj.error && statusObj.error.toLowerCase().includes('tidak terdaftar')) ? (
                                  <span 
                                    className="px-2 py-1 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-xs"
                                    title={statusObj.error || 'Nomor tidak terdaftar di WhatsApp'}
                                  >
                                    <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                    Nomor Tidak Terdaftar di WA
                                  </span>
                                ) : statusObj.code === 'TOO_SHORT' || statusObj.code === 'INVALID_NUMBER_LENGTH' || (statusObj.error && statusObj.error.toLowerCase().includes('kurang digit')) ? (
                                  <span 
                                    className="px-2 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-xs"
                                    title={statusObj.error || 'Nomor kurang digit (minimal 10 digit)'}
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    Kurang Digit ({phoneValidation.cleanNumber.length} angka)
                                  </span>
                                ) : statusObj.code === 'SESSION_NOT_WORKING' ? (
                                  <span 
                                    className="px-2 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-xs"
                                    title={statusObj.error}
                                  >
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    WA Belum Terhubung
                                  </span>
                                ) : (
                                  <span 
                                    className="px-2 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 cursor-help"
                                    title={statusObj.error || 'Gagal mengirim'}
                                  >
                                    <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                    Gagal: {statusObj.error ? (statusObj.error.length > 25 ? statusObj.error.slice(0, 25) + '...' : statusObj.error) : 'Error'}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Tombol Kirim Satuan via WhatsApp (Otomatis Gateway - Premium) */}
                            <button
                              type="button"
                              disabled={isBatchRunning || isSendingThis || (isPremium && !isValidPhone)}
                              onClick={() => handleKirimSingleWA(student)}
                              className={!isPremium
                                ? "px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border border-slate-200 hover:border-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                : "px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                              }
                              title={!isPremium ? "Kirim Otomatis Gateway (Fitur Khusus Akun Premium ⭐)" : (!isValidPhone ? (phoneValidation.message || 'Nomor tidak valid') : 'Kirim reminder langsung sekarang via WhatsApp Gateway')}
                            >
                              {!isPremium ? (
                                <>
                                  <span className="text-[11px] text-amber-500 font-black">★</span>
                                  <span>Otomatis</span>
                                </>
                              ) : isSendingThis ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Mengirim...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Kirim WA</span>
                                </>
                              )}
                            </button>

                            {/* Tombol Fallback Manual WhatsApp Web (wa.me) */}
                            <button
                              type="button"
                              disabled={isBatchRunning || !student.nomor_whatsapp}
                              onClick={() => handleKirimManualWA(student)}
                              className={!isPremium
                                ? "px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 shadow-xs"
                                : "p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                              }
                              title={!isPremium ? "Buka WhatsApp Web / wa.me untuk kirim pesan manual langsung ke orang tua" : "Fallback: Buka wa.me manual di tab baru jika dibutuhkan"}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              {!isPremium && <span>Kirim Manual (wa.me)</span>}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Pesan menggunakan template SPP resmi yang telah disesuaikan.</span>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  disabled={isBatchRunning}
                  onClick={handleCloseReminderModal}
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Tutup
                </button>

                {/* Tombol Utama Kirim Massal (WhatsApp) */}
                <button
                  type="button"
                  disabled={isBatchRunning || (isPremium && selectedReminderIds.length === 0)}
                  onClick={handleStartBatchSend}
                  className={!isPremium
                    ? "px-4 py-2 text-xs sm:text-sm font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                    : "px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  }
                  title={!isPremium ? "Kirim Otomatis Massal (Fitur Khusus Akun Premium ⭐)" : undefined}
                >
                  {!isPremium ? (
                    <>
                      <span className="text-amber-600 font-black">★</span>
                      <span>Kirim Batch Otomatis (Premium)</span>
                    </>
                  ) : isBatchRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Sedang Mengirim Massal ({batchProgress.current}/{batchProgress.total})...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Kirim Batch ke {selectedReminderIds.length} Siswa</span>
                    </>
                  )}
                </button>
              </div>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
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
                <li><span className="font-bold text-indigo-600">[LINK_SPP]</span> : Link kartu SPP orang tua / siswa</li>
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

      {/* Share / Detail Link Kartu SPP Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-900 to-indigo-800 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-indigo-950 flex items-center justify-center font-black shadow-sm">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    Link Khusus Kartu SPP Sekolah
                  </h3>
                  <p className="text-[11px] text-indigo-200">
                    {currentSchoolName || 'Sekolah Terdaftar'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsShareModalOpen(false)} 
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-indigo-800/80 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm text-slate-600 max-h-[75vh] overflow-y-auto">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Keamanan & Isolasi Data Sekolah</p>
                  <p className="text-emerald-800 text-[11px] mt-0.5 leading-relaxed">
                    Setiap sekolah memiliki link mandiri dengan kode unik sekolah Anda. Orang tua yang membuka link ini <strong>hanya dapat melihat siswa dari {currentSchoolName || 'sekolah Anda'}</strong>, sehingga data tidak akan tertukar atau bercampur dengan sekolah lain.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tautan Khusus Orang Tua:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://${getSchoolParentUrl()}`}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 select-all"
                  />
                  <button
                    onClick={handleCopyParentLink}
                    className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-sm cursor-pointer"
                  >
                    {copiedParentLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedParentLink ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Teks Siaran / Broadcast WhatsApp Siap Kirim ke Grup Orang Tua:
                </label>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap">
{`Kepada Yth. Bapak/Ibu Orang Tua / Wali Siswa ${currentSchoolName || ''},

Untuk mengecek status lunas pembayaran SPP ananda tahun berjalan, Bapak/Ibu dapat mengakses portal resmi kartu SPP sekolah melalui link berikut:

👉 https://${getSchoolParentUrl()}

Cara Cek:
1. Klik tautan di atas
2. Masukkan nomor WhatsApp yang terdaftar di sekolah
3. Tekan "Cek Kartu SPP"

Terima kasih atas perhatian dan kerja samanya.`}
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={async () => {
                      const text = `Kepada Yth. Bapak/Ibu Orang Tua / Wali Siswa ${currentSchoolName || ''},\n\nUntuk mengecek status lunas pembayaran SPP ananda tahun berjalan, Bapak/Ibu dapat mengakses portal resmi kartu SPP sekolah melalui link berikut:\n\n👉 https://${getSchoolParentUrl()}\n\nCara Cek:\n1. Klik tautan di atas\n2. Masukkan nomor WhatsApp yang terdaftar di sekolah\n3. Tekan "Cek Kartu SPP"\n\nTerima kasih atas perhatian dan kerja samanya.`;
                      await navigator.clipboard.writeText(text);
                      setCopiedShareBroadcast(true);
                      setTimeout(() => setCopiedShareBroadcast(false), 2500);
                    }}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedShareBroadcast ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedShareBroadcast ? 'Format WA Tersalin!' : 'Salin Pesan Broadcast WA'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <a
                href={`/kartu-spp-ortu${currentUserId ? `/${currentUserId}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
              >
                <span>Buka & Uji Coba Laman</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Moderasi Bukti Pembayaran WhatsApp */}
      <PaymentModerationModal
        isOpen={isModerationModalOpen}
        onClose={() => {
          setIsModerationModalOpen(false);
          refreshPendingCount();
        }}
        students={students}
        onPaymentApproved={() => {
          fetchData();
          refreshPendingCount();
        }}
      />

      {/* MODAL KUNCI PREMIUM */}
      <PremiumLockModal
        isOpen={!!premiumLockFeature}
        onClose={() => setPremiumLockFeature(null)}
        featureName={premiumLockFeature || 'Fitur WhatsApp Gateway'}
      />

    </div>
  );
}
