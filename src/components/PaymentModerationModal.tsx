import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, XCircle, Clock, Search, Filter, MessageSquare, 
  ExternalLink, ZoomIn, RefreshCw, AlertCircle, Sparkles, Send,
  ChevronRight, Calendar, DollarSign, UserCheck, ShieldAlert, Check, X, Trash2, Crown, Settings, Edit3, Users
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLogger';
import { PaymentVerification } from '../types/whatsapp';
import { usePremiumStatus } from '../lib/premiumService';
import { 
  getPaymentVerifications, 
  sendWhatsAppMessage, 
  getWhatsAppGatewayConfig,
  saveLocalVerifications,
  deletePaymentVerification,
  clearLocalVerifications,
  isRealTransferReceipt
} from '../lib/whatsappGateway';
import WhatsAppTemplateModal from './WhatsAppTemplateModal';
import { 
  WhatsAppTemplates, 
  DEFAULT_TEMPLATES, 
  getWhatsAppTemplates, 
  formatReceiptApprovedMessage, 
  formatReceiptRejectedMessage 
} from '../lib/whatsappTemplates';

const BULAN_OPTIONS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Mendeteksi semua siswa yang terkait dengan bukti transfer.
 * Jika nomor WhatsApp sama pada 2 siswa atau lebih, siswa tersebut adalah kakak-beradik.
 */
export const getMatchedStudentsForItem = (item: PaymentVerification, allStudents: any[]): any[] => {
  if (!allStudents || allStudents.length === 0) return [];
  const cleanSenderPhone = (item.sender_phone || '').replace(/\D/g, '');
  const senderSuffix8 = cleanSenderPhone.length >= 8 ? cleanSenderPhone.slice(-8) : '';

  // Periksa juga jika bukti bayar telah terhubung ke salah satu student_id
  const targetStudent = allStudents.find(s => s.id === item.student_id);
  const targetPhone = targetStudent ? (targetStudent.nomor_whatsapp || '').replace(/\D/g, '') : '';
  const targetSuffix8 = targetPhone.length >= 8 ? targetPhone.slice(-8) : '';

  const matched = allStudents.filter(s => {
    // 1. Siswa yang ID-nya langsung tertaut
    if (item.student_id && s.id === item.student_id) return true;

    const sPhone = (s.nomor_whatsapp || '').replace(/\D/g, '');
    if (!sPhone || sPhone.length < 8) return false;
    const sSuffix8 = sPhone.slice(-8);

    // 2. Cocok dengan sender_phone
    if (cleanSenderPhone) {
      if (sPhone === cleanSenderPhone) return true;
      if (senderSuffix8 && (sPhone.endsWith(senderSuffix8) || cleanSenderPhone.endsWith(sSuffix8))) {
        return true;
      }
    }

    // 3. Cocok dengan nomor WA targetStudent (deteksi saudara kandung / kakak adik)
    if (targetPhone) {
      if (sPhone === targetPhone) return true;
      if (targetSuffix8 && (sPhone.endsWith(targetSuffix8) || targetPhone.endsWith(sSuffix8))) {
        return true;
      }
    }

    return false;
  });

  // Hapus duplikasi berdasarkan ID
  const uniqueMap = new Map<string, any>();
  matched.forEach(s => uniqueMap.set(s.id, s));
  return Array.from(uniqueMap.values());
};

interface PaymentModerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: any[];
  onPaymentApproved?: () => void;
  onOpenGatewaySettings?: () => void;
}

export default function PaymentModerationModal({
  isOpen,
  onClose,
  students,
  onPaymentApproved,
  onOpenGatewaySettings
}: PaymentModerationModalProps) {
  const [verifications, setVerifications] = useState<PaymentVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Lightbox for receipt zoom
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Reject modal state
  const [rejectingItem, setRejectingItem] = useState<PaymentVerification | null>(null);
  const [rejectReason, setRejectReason] = useState('Nominal tidak sesuai / belum masuk mutasi');
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Edit modal state (khusus untuk koreksi nominal / data pembayaran)
  const [editingItem, setEditingItem] = useState<PaymentVerification | null>(null);
  const [editNominal, setEditNominal] = useState<string>('');
  const [editBulan, setEditBulan] = useState<string>('');
  const [editTahun, setEditTahun] = useState<number>(new Date().getFullYear());
  const [editTanggal, setEditTanggal] = useState<string>('');
  const [editWaktu, setEditWaktu] = useState<string>('');

  // Simulation modal state
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [simStudentId, setSimStudentId] = useState('');
  const [simBulan, setSimBulan] = useState(BULAN_OPTIONS[new Date().getMonth()]);
  const [simNominal, setSimNominal] = useState('100000');
  const [simMessage, setSimMessage] = useState('Assalamualaikum bendahara, ini bukti transfer SPP ananda.');

  const { isPremium, loading: premiumLoading } = usePremiumStatus();
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [templates, setTemplates] = useState<WhatsAppTemplates>(DEFAULT_TEMPLATES);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateModalInitialTab, setTemplateModalInitialTab] = useState<'broadcast' | 'receiptReceived' | 'receiptApproved' | 'receiptRejected'>('receiptApproved');

  useEffect(() => {
    if (isOpen && isPremium) {
      loadData();
    }
  }, [isOpen, isPremium]);

  // Auto-purge: Bersihkan bukti transfer berstatus 'approved' yang sudah berumur lebih dari 30 hari
  const purgeExpiredApprovedVerifications = async (items: PaymentVerification[], uid?: string) => {
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const expiredApproved = items.filter(item => {
      if (item.status !== 'approved') return false;
      const recordDate = new Date(item.updated_at || item.created_at).getTime();
      return (now - recordDate) > thirtyDaysInMs;
    });

    if (expiredApproved.length > 0) {
      const expiredIds = expiredApproved.map(item => item.id);
      try {
        if (uid) {
          await supabase
            .from('payment_verifications')
            .delete()
            .in('id', expiredIds)
            .eq('user_id', uid);
        } else {
          await supabase
            .from('payment_verifications')
            .delete()
            .in('id', expiredIds);
        }
      } catch (err) {
        console.warn('Auto-purge Supabase warning:', err);
      }

      for (const item of expiredApproved) {
        deletePaymentVerification(item.id, uid).catch(() => {});
      }

      const keptItems = items.filter(item => !expiredIds.includes(item.id));
      saveLocalVerifications(keptItems, uid);
      return keptItems;
    }

    return items;
  };

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (uid) setCurrentUserId(uid);

    const [items, loadedTemplates] = await Promise.all([
      getPaymentVerifications(uid),
      getWhatsAppTemplates(uid)
    ]);
    const purgedItems = await purgeExpiredApprovedVerifications(items, uid);
    setVerifications(purgedItems);
    setTemplates(loadedTemplates);
    setLoading(false);
  };

  if (!isOpen) return null;

  // Handle Approve Payment (Mendukung Pembayaran Kakak-Adik / Multi Siswa)
  const handleApprove = async (item: PaymentVerification) => {
    setIsProcessingAction(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;

      // Deteksi siswa: jika nomor WA sama pada 2 siswa atau lebih, mereka adalah kakak-adik
      const matchedStudents = getMatchedStudentsForItem(item, students);
      const targetStudent = students.find(s => s.id === item.student_id);
      const targetStudents = matchedStudents.length > 0 ? matchedStudents : (targetStudent ? [targetStudent] : []);

      if (targetStudents.length === 0 && !item.student_id) {
        alert('Pilih siswa terlebih dahulu sebelum menyetujui pembayaran.');
        return;
      }

      const count = targetStudents.length || 1;
      const totalNominal = Number(item.nominal) || 0;
      // Bagi rata nominal untuk seluruh siswa (misal: Rp 200.000 untuk 2 anak -> Rp 100.000 / anak)
      const perStudentNominal = Math.floor(totalNominal / count);
      const remainder = totalNominal % count;
      const tanggalBayar = item.tanggal_transfer || new Date().toISOString().split('T')[0];
      const waktuBayar = item.waktu_transfer || new Date().toTimeString().slice(0, 5);

      // 1. Simpan ke tabel payments untuk SEMUA siswa terdeteksi (kakak-adik)
      if (targetStudents.length > 0) {
        const paymentsToInsert = targetStudents.map((st, idx) => ({
          user_id: uid,
          student_id: st.id,
          bulan: item.bulan,
          tahun: item.tahun,
          nominal_dibayar: perStudentNominal + (idx === 0 ? remainder : 0),
          tanggal_bayar: tanggalBayar,
          waktu_bayar: waktuBayar,
        }));
        const { error: insertPayError } = await supabase.from('payments').insert(paymentsToInsert);
        if (insertPayError) {
          console.warn('Gagal insert ke payments:', insertPayError);
        }
      } else if (item.student_id) {
        await supabase.from('payments').insert([
          {
            user_id: uid,
            student_id: item.student_id,
            bulan: item.bulan,
            tahun: item.tahun,
            nominal_dibayar: totalNominal,
            tanggal_bayar: tanggalBayar,
            waktu_bayar: waktuBayar,
          }
        ]);
      }

      // 2. Perbarui status verifikasi di Supabase / server
      try {
        await supabase
          .from('payment_verifications')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', item.id);
      } catch (e) {
        // Fallback
      }

      try {
        const res = await fetch(`/api/webhook/verifications/${item.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'approved' })
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          await res.json();
        }
      } catch (e) {
        // Abaikan jika di static host seperti Vercel
      }

      // 3. Kirim pesan WhatsApp otomatis ke nomor orang tua via Gateway
      const targetPhone = item.sender_phone || targetStudents[0]?.nomor_whatsapp || targetStudent?.nomor_whatsapp;
      let waSuccess = false;
      let waMsg = '';

      const studentNames = targetStudents.length > 0
        ? targetStudents.map(s => s.nama_lengkap).join(' & ')
        : (item.student_name || 'Siswa');

      if (targetPhone) {
        const approvalMsg = formatReceiptApprovedMessage(templates.receiptApproved, {
          studentName: studentNames,
          bulan: item.bulan,
          tahun: item.tahun,
          nominal: totalNominal,
          tanggal: tanggalBayar,
          bank: item.bank_pengirim
        });

        try {
          const config = await getWhatsAppGatewayConfig(uid);
          const sendRes = await sendWhatsAppMessage({
            apiUrl: config?.apiUrl,
            appkey: config?.appkey,
            authkey: config?.authkey,
            to: targetPhone,
            message: approvalMsg,
            userId: uid,
          });
          waSuccess = sendRes.success;
          if (!sendRes.success) waMsg = sendRes.error || '';
        } catch (waErr: any) {
          waMsg = waErr.message || '';
          console.warn('Gagal mengirim notifikasi WA approval:', waErr);
        }
      }

      // 4. Update UI & log activity
      const logDesc = targetStudents.length > 1
        ? `Menyetujui bukti transfer SPP bulan ${item.bulan} ${item.tahun} untuk ${studentNames} (${targetStudents.length} siswa kakak-adik @ Rp ${perStudentNominal.toLocaleString('id-ID')}) dari no ${item.sender_phone}`
        : `Menyetujui bukti transfer SPP bulan ${item.bulan} ${item.tahun} untuk ${studentNames} dari no ${item.sender_phone}`;

      await logActivity('Verifikasi SPP via WhatsApp', logDesc);

      const updated = verifications.map(v => v.id === item.id ? { ...v, status: 'approved' as const } : v);
      setVerifications(updated);
      saveLocalVerifications(updated, uid);

      if (onPaymentApproved) {
        onPaymentApproved();
      }

      const alertSuccessMsg = targetStudents.length > 1
        ? `✅ Pembayaran untuk ananda ${studentNames} (${targetStudents.length} siswa kakak-adik) berhasil disetujui & dicatat LUNAS masing-masing Rp ${perStudentNominal.toLocaleString('id-ID')}.`
        : `✅ Pembayaran ananda ${studentNames} berhasil disetujui & dicatat LUNAS.`;

      if (waSuccess) {
        alert(`${alertSuccessMsg}\n\nPesan konfirmasi WhatsApp telah berhasil terkirim ke nomor ${targetPhone}.`);
      } else if (targetPhone) {
        alert(`ℹ️ ${alertSuccessMsg}\n\nCatatan WA: ${waMsg || 'Pesan sedang dalam antrean pengiriman WhatsApp.'}`);
      }
    } catch (err: any) {
      alert('Terjadi kesalahan saat memproses: ' + err.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Resend WhatsApp notification for approved item
  const handleResendNotification = async (item: PaymentVerification) => {
    setIsProcessingAction(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      const matchedStudents = getMatchedStudentsForItem(item, students);
      const targetStudent = students.find(s => s.id === item.student_id);
      const targetStudents = matchedStudents.length > 0 ? matchedStudents : (targetStudent ? [targetStudent] : []);
      const studentName = targetStudents.length > 0
        ? targetStudents.map(s => s.nama_lengkap).join(' & ')
        : (item.student_name || 'Siswa');
      const targetPhone = item.sender_phone || targetStudents[0]?.nomor_whatsapp || targetStudent?.nomor_whatsapp;

      if (!targetPhone) {
        alert('Nomor WhatsApp orang tua tidak ditemukan.');
        return;
      }

      const approvalMsg = formatReceiptApprovedMessage(templates.receiptApproved, {
        studentName,
        bulan: item.bulan,
        tahun: item.tahun,
        nominal: item.nominal,
        tanggal: item.tanggal_transfer,
        bank: item.bank_pengirim
      });

      const config = await getWhatsAppGatewayConfig(uid);
      const sendRes = await sendWhatsAppMessage({
        apiUrl: config?.apiUrl,
        appkey: config?.appkey,
        authkey: config?.authkey,
        to: targetPhone,
        message: approvalMsg,
        userId: uid,
      });

      if (sendRes.success) {
        alert(`✅ Pesan konfirmasi pelunasan berhasil dikirim ulang ke nomor ${targetPhone}.`);
      } else {
        alert(`⚠️ Gagal mengirim pesan WhatsApp: ${sendRes.error || 'Pastikan WhatsApp berstatus WORKING di Pengaturan Gateway.'}`);
      }
    } catch (e: any) {
      alert('Terjadi kesalahan saat mengirim pesan: ' + e.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Reject Payment
  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    setIsProcessingAction(true);
    const finalReason = rejectReason === 'Lainnya' ? customRejectReason : rejectReason;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;

      // 1. Update di Supabase / server
      try {
        await supabase
          .from('payment_verifications')
          .update({ 
            status: 'rejected', 
            reject_reason: finalReason, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', rejectingItem.id);
      } catch (e) {
        // Fallback
      }

      try {
        const res = await fetch(`/api/webhook/verifications/${rejectingItem.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'rejected', rejectReason: finalReason })
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          await res.json();
        }
      } catch (e) {
        // Abaikan jika di static host seperti Vercel
      }

      // 2. Kirim pesan penolakan sopan ke nomor orang tua via Gateway
      const matchedStudents = getMatchedStudentsForItem(rejectingItem, students);
      const rejectTargetStudent = students.find(s => s.id === rejectingItem.student_id);
      const targetStudents = matchedStudents.length > 0 ? matchedStudents : (rejectTargetStudent ? [rejectTargetStudent] : []);
      const targetPhone = rejectingItem.sender_phone || targetStudents[0]?.nomor_whatsapp || rejectTargetStudent?.nomor_whatsapp;
      const rejectStudentName = targetStudents.length > 0
        ? targetStudents.map(s => s.nama_lengkap).join(' & ')
        : (rejectingItem.student_name || 'Siswa');

      if (targetPhone) {
        const rejectMsg = formatReceiptRejectedMessage(templates.receiptRejected, {
          studentName: rejectStudentName,
          reason: finalReason,
          bulan: rejectingItem.bulan,
          tahun: rejectingItem.tahun,
          nominal: rejectingItem.nominal
        });

        try {
          const config = await getWhatsAppGatewayConfig(uid);
          await sendWhatsAppMessage({
            apiUrl: config?.apiUrl,
            appkey: config?.appkey,
            authkey: config?.authkey,
            to: targetPhone,
            message: rejectMsg,
            userId: uid,
          });
        } catch (waErr) {
          console.warn('Gagal mengirim notifikasi WA reject:', waErr);
        }
      }

      // 3. Update state
      const updated = verifications.map(v => v.id === rejectingItem.id ? { 
        ...v, 
        status: 'rejected' as const, 
        reject_reason: finalReason 
      } : v);
      setVerifications(updated);
      saveLocalVerifications(updated, uid);
      setRejectingItem(null);
    } catch (err: any) {
      alert('Gagal menolak verifikasi: ' + err.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Delete Single Item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Hapus bukti pembayaran ini secara permanen?')) return;
    setIsProcessingAction(true);
    try {
      await deletePaymentVerification(itemId, currentUserId);
      const updated = verifications.filter(v => v.id !== itemId);
      setVerifications(updated);
      saveLocalVerifications(updated, currentUserId);
    } catch (e: any) {
      alert('Gagal menghapus bukti: ' + e.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Clear All Items
  const handleClearAll = async () => {
    if (!confirm('Kosongkan semua antrean bukti transfer ini? Tindakan ini akan menghapus semua bukti transfer dari database dan cache.')) return;
    setIsProcessingAction(true);
    try {
      clearLocalVerifications(currentUserId);
      if (currentUserId) {
        await supabase
          .from('payment_verifications')
          .delete()
          .eq('user_id', currentUserId);
      }
      await fetch('/api/webhook/verifications/reset', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      }).catch(() => {});

      setVerifications([]);
    } catch (e: any) {
      alert('Gagal mengosongkan antrean: ' + e.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Update item data before approval
  const handleUpdateItem = (id: string, field: keyof PaymentVerification, value: any) => {
    setVerifications(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'student_id') {
          const found = students.find(s => s.id === value);
          if (found) {
            updated.student_name = found.nama_lengkap;
            updated.student_kelompok = found.kelompok;
            if (!item.nominal || item.nominal === 100000) {
              updated.nominal = found.nominal_spp || 100000;
            }
          }
        }
        return updated;
      }
      return item;
    }));
  };

  // Handle Open Edit Modal (khusus untuk koreksi data & nominal)
  const handleOpenEditModal = (item: PaymentVerification) => {
    setEditingItem(item);
    setEditNominal(String(item.nominal || ''));
    setEditBulan(item.bulan || BULAN_OPTIONS[new Date().getMonth()]);
    setEditTahun(item.tahun || new Date().getFullYear());
    setEditTanggal(item.tanggal_transfer || new Date().toISOString().split('T')[0]);
    setEditWaktu(item.waktu_transfer || '09:00');
  };

  // Handle Save Edit Approved / Pending item
  const handleSaveEditApproved = async () => {
    if (!editingItem) return;
    const newNominal = Number(editNominal);
    if (isNaN(newNominal) || newNominal <= 0) {
      alert('Nominal harus berupa angka valid lebih dari 0.');
      return;
    }

    setIsProcessingAction(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || currentUserId;

      const oldNominal = editingItem.nominal;
      const oldBulan = editingItem.bulan;
      const oldTahun = editingItem.tahun;

      // 1. Update tabel payment_verifications di Supabase
      const { error: pvError } = await supabase
        .from('payment_verifications')
        .update({
          nominal: newNominal,
          bulan: editBulan,
          tahun: Number(editTahun),
          tanggal_transfer: editTanggal,
          waktu_transfer: editWaktu,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingItem.id);

      if (pvError) {
        console.warn('Gagal update tabel payment_verifications:', pvError);
      }

      // Coba juga sync ke serverless backend API jika tersedia
      try {
        await fetch('/api/webhook/verifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            nominal: newNominal,
            bulan: editBulan,
            tahun: Number(editTahun),
            tanggal_transfer: editTanggal,
            waktu_transfer: editWaktu,
          })
        });
      } catch (_) {}

      // 2. Jika item sudah disetujui (approved),
      // perbarui juga data di tabel `payments` agar laporan SPP, dashboard & keuangan sinkron
      if (editingItem.status === 'approved') {
        const matchedStudents = getMatchedStudentsForItem(editingItem, students);
        if (matchedStudents.length > 1) {
          const count = matchedStudents.length;
          const perStudentNewNominal = Math.floor(newNominal / count);
          const remainder = newNominal % count;

          for (let i = 0; i < matchedStudents.length; i++) {
            const st = matchedStudents[i];
            const stNominal = perStudentNewNominal + (i === 0 ? remainder : 0);
            let paymentUpdateQuery = supabase
              .from('payments')
              .update({
                nominal_dibayar: stNominal,
                bulan: editBulan,
                tahun: Number(editTahun),
                tanggal_bayar: editTanggal,
                waktu_bayar: editWaktu,
              })
              .eq('student_id', st.id)
              .eq('bulan', oldBulan)
              .eq('tahun', oldTahun);

            if (uid) {
              paymentUpdateQuery = paymentUpdateQuery.eq('user_id', uid);
            }
            await paymentUpdateQuery;
          }
        } else if (editingItem.student_id) {
          let paymentUpdateQuery = supabase
            .from('payments')
            .update({
              nominal_dibayar: newNominal,
              bulan: editBulan,
              tahun: Number(editTahun),
              tanggal_bayar: editTanggal,
              waktu_bayar: editWaktu,
            })
            .eq('student_id', editingItem.student_id)
            .eq('bulan', oldBulan)
            .eq('tahun', oldTahun);

          if (uid) {
            paymentUpdateQuery = paymentUpdateQuery.eq('user_id', uid);
          }

          const { data: updatedPayments, error: payError } = await paymentUpdateQuery.select();

          if ((!updatedPayments || updatedPayments.length === 0) && !payError) {
            const { data: existing } = await supabase
              .from('payments')
              .select('id')
              .eq('student_id', editingItem.student_id)
              .eq('bulan', editBulan)
              .eq('tahun', Number(editTahun))
              .maybeSingle();

            if (existing) {
              await supabase
                .from('payments')
                .update({
                  nominal_dibayar: newNominal,
                  tanggal_bayar: editTanggal,
                  waktu_bayar: editWaktu,
                })
                .eq('id', existing.id);
            }
          }
        }
      }

      // 3. Perbarui state verifications lokal & cache localStorage
      const updated = verifications.map(v => {
        if (v.id === editingItem.id) {
          return {
            ...v,
            nominal: newNominal,
            bulan: editBulan,
            tahun: Number(editTahun),
            tanggal_transfer: editTanggal,
            waktu_transfer: editWaktu,
          };
        }
        return v;
      });

      setVerifications(updated);
      saveLocalVerifications(updated, uid);

      // 4. Log aktivitas perubahan
      await logActivity(
        'Koreksi Nominal SPP Verifikasi WA',
        `Mengoreksi nominal bukti bayar ${editingItem.student_name || 'siswa'} (${editBulan} ${editTahun}) dari Rp ${oldNominal.toLocaleString('id-ID')} menjadi Rp ${newNominal.toLocaleString('id-ID')}`
      );

      // 5. Trigger reload dashboard jika ada
      if (onPaymentApproved) {
        onPaymentApproved();
      }

      setEditingItem(null);
      alert(`✅ Berhasil! Nominal pembayaran telah diubah menjadi Rp ${newNominal.toLocaleString('id-ID')}.\nCatatan pembayaran SPP dan laporan keuangan telah disinkronkan.`);
    } catch (err: any) {
      alert('Gagal menyimpan perubahan: ' + (err.message || err));
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Simulation
  const handleRunSimulation = async () => {
    const targetStudent = students.find(s => s.id === simStudentId) || students[0];
    if (!targetStudent) {
      alert('Silakan tambahkan data siswa terlebih dahulu di menu Data Siswa.');
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const timeNow = new Date().toTimeString().slice(0, 5);
      const currentYear = new Date().getFullYear();
      const generatedId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const simSiblings = getMatchedStudentsForItem({ sender_phone: targetStudent.nomor_whatsapp, student_id: targetStudent.id } as any, students);
      const isSimSibling = simSiblings.length > 1;
      const simCombinedName = isSimSibling ? simSiblings.map(s => s.nama_lengkap).join(' & ') : targetStudent.nama_lengkap;
      const simCombinedKelompok = isSimSibling ? simSiblings.map(s => s.kelompok || '-').join(', ') : (targetStudent.kelompok || '-');

      const confNotes = isSimSibling
        ? `👨‍👩‍👧‍👦 Terdeteksi Transfer Kakak-Adik (${simSiblings.length} Siswa): ${simCombinedName}. Struk BCA Mobile Berhasil terverifikasi oleh Gemini Vision`
        : 'Struk BCA Mobile Berhasil terverifikasi oleh Gemini Vision';

      const newRecord: PaymentVerification = {
        id: generatedId,
        user_id: currentUserId || undefined,
        student_id: targetStudent.id,
        student_name: simCombinedName,
        student_kelompok: simCombinedKelompok,
        sender_phone: targetStudent.nomor_whatsapp || '6281234567890',
        sender_name: targetStudent.nama_wali || simCombinedName,
        message_text: simMessage || 'Assalamualaikum bendahara, ini bukti transfer SPP ananda.',
        proof_image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
        bulan: simBulan,
        tahun: currentYear,
        nominal: Number(simNominal) || targetStudent.nominal_spp || 100000,
        tanggal_transfer: today,
        waktu_transfer: timeNow,
        bank_pengirim: 'BCA Mobile',
        bank_tujuan: 'BSI Sekolah',
        nama_rekening_pengirim: targetStudent.nama_wali || targetStudent.nama_lengkap,
        confidence_notes: confNotes,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      // 1. Simpan ke Supabase jika tabel payment_verifications ada
      if (currentUserId) {
        try {
          const { data: supaInserted, error: supaErr } = await supabase
            .from('payment_verifications')
            .insert([{
              user_id: currentUserId,
              student_id: newRecord.student_id,
              sender_phone: newRecord.sender_phone,
              sender_name: newRecord.sender_name,
              message_text: newRecord.message_text,
              proof_image_url: newRecord.proof_image_url,
              bulan: newRecord.bulan,
              tahun: newRecord.tahun,
              nominal: newRecord.nominal,
              tanggal_transfer: newRecord.tanggal_transfer,
              waktu_transfer: newRecord.waktu_transfer,
              bank_pengirim: newRecord.bank_pengirim,
              bank_tujuan: newRecord.bank_tujuan,
              nama_rekening_pengirim: newRecord.nama_rekening_pengirim,
              confidence_notes: newRecord.confidence_notes,
              status: 'pending'
            }])
            .select()
            .single();

          if (!supaErr && supaInserted?.id) {
            newRecord.id = supaInserted.id;
          }
        } catch (supaErr) {
          console.warn('Simulasi Supabase insert fallback to local:', supaErr);
        }
      }

      // 2. Coba sync ke server backend jika tersedia (bukan Vercel static)
      try {
        const res = await fetch('/api/webhook/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            studentId: targetStudent.id,
            studentName: targetStudent.nama_lengkap,
            senderPhone: targetStudent.nomor_whatsapp || '6281234567890',
            messageText: simMessage,
            proofImageUrl: newRecord.proof_image_url,
            bulan: simBulan,
            nominal: Number(simNominal),
            tanggal: newRecord.tanggal_transfer,
            waktu: newRecord.waktu_transfer,
            bank: newRecord.bank_pengirim
          })
        });

        // Hanya parse JSON bila response valid & berheader application/json (mencegah error di Safari/Vercel)
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data?.success && data?.data?.id) {
            newRecord.id = data.data.id;
          }
        }
      } catch (backendErr) {
        // Backend offline / Vercel SPA static hosting: tidak apa-apa, simulasi tetap berhasil di client
      }

      // 3. Masukkan ke state antrean moderasi & local storage
      setVerifications(prev => [newRecord, ...prev.filter(v => v.id !== newRecord.id)]);
      saveLocalVerifications([newRecord, ...verifications.filter(v => v.id !== newRecord.id)], currentUserId);
      setIsSimulateModalOpen(false);
      setFilterTab('pending');
    } catch (e: any) {
      alert('Gagal membuat simulasi: ' + (e.message || e));
    }
  };

  // Filter items: HANYA tampilkan bukti bayar dari siswa yang terdaftar (atau memiliki no WA siswa terdaftar)
  const filteredItems = verifications.filter(item => {
    const matched = getMatchedStudentsForItem(item, students);
    if (!item.student_id && matched.length === 0) return false;
    if (filterTab !== 'all' && item.status !== filterTab) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (item.student_name || '').toLowerCase().includes(q) ||
        matched.some(s => (s.nama_lengkap || '').toLowerCase().includes(q));
      const matchPhone = (item.sender_phone || '').includes(q);
      const matchMsg = (item.message_text || '').toLowerCase().includes(q);
      return matchName || matchPhone || matchMsg;
    }
    return true;
  });

  const pendingCount = verifications.filter(v => {
    if (v.status !== 'pending') return false;
    const matched = getMatchedStudentsForItem(v, students);
    return Boolean(v.student_id) || matched.length > 0;
  }).length;

  if (!isOpen) return null;

  if (!isPremium && !premiumLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-md w-full p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30 text-slate-950">
            <Crown className="w-8 h-8" />
          </div>
          <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-3 inline-block">
            FITUR EKSKLUSIF PREMIUM ⭐
          </span>
          <h3 className="text-xl font-black text-white mb-2">
            Moderasi Bukti Bayar WhatsApp
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            Fitur verifikasi foto struk transfer otomatis via Inbound Webhook WhatsApp ini hanya tersedia untuk pengguna <strong>Akun Premium</strong>.
          </p>

          <div className="space-y-2.5">
            <a
              href="https://threads.net/@isantoh"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Hubungi Superadmin untuk Aktivasi</span>
            </a>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup / Kembali
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[90vh] max-h-[850px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-indigo-900 to-indigo-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Moderasi Bukti Bayar WhatsApp</h2>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-400 text-indigo-950">
                    {pendingCount} Menunggu
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200">
                Verifikasi foto struk transfer yang dikirim orang tua melalui WhatsApp Inbound Webhook
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {verifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isProcessingAction}
                className="px-2.5 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                title="Kosongkan semua antrean bukti transfer (Hapus database & cache)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kosongkan Antrean</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setTemplateModalInitialTab('receiptApproved');
                setIsTemplateModalOpen(true);
              }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer border border-white/20"
              title="Edit susunan template pesan WA resi masuk, disetujui, dan ditolak"
            >
              <Settings className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden md:inline">Template Pesan Resi</span>
            </button>
            <button
              onClick={() => setIsSimulateModalOpen(true)}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-indigo-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Coba simulasi bukti masuk tanpa menunggu orang tua kirim WA"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulasi Bukti Masuk</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs w-full sm:w-auto">
            <button
              onClick={() => setFilterTab('pending')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                filterTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Perlu Verifikasi</span>
              {pendingCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterTab === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilterTab('approved')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                filterTab === 'approved'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Disetujui</span>
            </button>
            <button
              onClick={() => setFilterTab('rejected')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                filterTab === 'rejected'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Ditolak</span>
            </button>
            <button
              onClick={() => setFilterTab('all')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Semua</span>
            </button>
          </div>

          {/* Search & Refresh */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari siswa/nomor..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
              title="Muat ulang data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-100/60">
          {/* Banner Informasi Auto-Purge 30 Hari pada Tab Disetujui */}
          {filterTab === 'approved' && (
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold">Auto-Purge 30 Hari Aktif: </span>
                  <span>Bukti transfer yang telah disetujui otomatis dibersihkan dari laman moderasi ini setelah 30 hari untuk menjaga performa. (Catatan pembayaran SPP siswa di laporan & kartu SPP tetap tersimpan aman).</span>
                </div>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-0.5 bg-emerald-200/60 text-emerald-800 font-extrabold rounded-md text-[10px] uppercase tracking-wider shrink-0 border border-emerald-300">
                Maksimal 30 Hari
              </span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Memuat antrean bukti pembayaran...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {filterTab === 'pending' ? 'Tidak Ada Bukti yang Perlu Diverifikasi' : 'Belum Ada Data Bukti Pembayaran'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
                {filterTab === 'pending'
                  ? 'Semua bukti pembayaran yang masuk via WhatsApp telah selesai diperiksa dan diverifikasi lunas.'
                  : 'Ketika orang tua mengirim foto struk transfer ke nomor WhatsApp sekolah, sistem otomatis menangkap dan menampilkannya di sini.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setIsSimulateModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Coba Simulasi Bukti Transfer</span>
                </button>
                {onOpenGatewaySettings && (
                  <button
                    onClick={onOpenGatewaySettings}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Buka Pengaturan Gateway WA
                  </button>
                )}
              </div>
            </div>
          ) : (
            filteredItems.map(item => {
              const matchedStudents = getMatchedStudentsForItem(item, students);
              const isSibling = matchedStudents.length > 1;
              const count = matchedStudents.length || 1;
              const totalNominal = Number(item.nominal) || 0;
              const perStudentNominal = Math.floor(totalNominal / count);

              const formattedDate = new Date(item.created_at).toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden flex flex-col md:flex-row ${
                    item.status === 'pending'
                      ? 'border-amber-300 ring-2 ring-amber-400/20'
                      : item.status === 'approved'
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-rose-200 bg-rose-50/20'
                  }`}
                >
                  {/* Left: Receipt Photo Thumbnail */}
                  <div className="w-full md:w-56 h-48 md:h-auto bg-slate-900 shrink-0 relative group overflow-hidden flex items-center justify-center">
                    <img
                      src={item.proof_image_url}
                      alt="Struk Transfer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
                      <button
                        onClick={() => setZoomedImage(item.proof_image_url)}
                        className="px-3 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md hover:bg-slate-100 cursor-pointer"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>Perbesar</span>
                      </button>
                      <a
                        href={item.proof_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg transition-colors cursor-pointer"
                        title="Buka gambar di tab baru"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        item.status === 'pending'
                          ? 'bg-amber-400 text-indigo-950'
                          : item.status === 'approved'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-rose-500 text-white'
                      }`}>
                        {item.status === 'pending' ? 'Perlu Verifikasi' : item.status === 'approved' ? 'Lunas' : 'Ditolak'}
                      </span>
                    </div>
                  </div>

                  {/* Middle & Right: Details & Verification Action */}
                  <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      {/* Top Row: Sender & Timestamp */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-800">
                              {isSibling 
                                ? matchedStudents.map(s => s.nama_lengkap).join(' & ')
                                : (matchedStudents[0]?.nama_lengkap || item.student_name || 'Siswa Belum Dipilih')}
                            </h4>
                            {isSibling ? (
                              <span className="px-2 py-0.5 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border border-amber-300 rounded-md text-[10px] font-extrabold flex items-center gap-1">
                                <Users className="w-3 h-3 text-amber-600" />
                                <span>Kakak Adik ({matchedStudents.length} Siswa)</span>
                              </span>
                            ) : (matchedStudents[0]?.kelompok || item.student_kelompok) ? (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-bold">
                                {matchedStudents[0]?.kelompok || item.student_kelompok}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <a 
                              href={`https://wa.me/${item.sender_phone}`}
                              target="_blank" 
                              rel="noreferrer"
                              className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                            >
                              +{item.sender_phone}
                            </a>
                            <span>•</span>
                            <span>{formattedDate}</span>
                          </div>
                        </div>

                        {/* Student match badge & Delete button */}
                        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2">
                          {isSibling ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold shadow-2xs">
                              <Users className="w-3.5 h-3.5 text-amber-600" />
                              <span>{matchedStudents.length} Siswa Terdeteksi</span>
                            </span>
                          ) : item.student_id || matchedStudents.length > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{matchedStudents[0]?.nama_lengkap || item.student_name || 'Siswa Terdaftar'}</span>
                              {(matchedStudents[0]?.kelompok || item.student_kelompok) && (matchedStudents[0]?.kelompok || item.student_kelompok) !== '-' && (
                                <span className="text-emerald-600 font-medium">({matchedStudents[0]?.kelompok || item.student_kelompok})</span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Nomor tidak terdaftar
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={isProcessingAction}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Hapus bukti pembayaran ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Kakak-Adik Split Breakdown Banner */}
                      {isSibling && (
                        <div className="p-3 bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-indigo-50/70 border border-amber-200 rounded-xl space-y-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-amber-500 text-white rounded-md text-[10px] font-black uppercase tracking-wider">
                                👨‍👩‍👧‍👦 Kakak Adik
                              </span>
                              <span className="font-bold text-slate-800 text-xs">
                                Nomor WA sama untuk {matchedStudents.length} siswa (1 Transfer untuk {matchedStudents.length} anak)
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200 shadow-2xs">
                              Dibagi {matchedStudents.length}: <span className="text-emerald-700 font-extrabold">Rp {perStudentNominal.toLocaleString('id-ID')}</span> / anak
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                            {matchedStudents.map((st, idx) => {
                              const stNominal = perStudentNominal + (idx === 0 ? (totalNominal % count) : 0);
                              return (
                                <div key={st.id} className="p-2 bg-white/90 rounded-lg border border-amber-100 flex items-center justify-between">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </div>
                                    <div className="truncate">
                                      <p className="font-bold text-slate-800 truncate">{st.nama_lengkap}</p>
                                      <p className="text-[10px] text-slate-500">{st.kelompok || 'Tanpa Kelas'} • SPP: Rp {(st.nominal_spp || 0).toLocaleString('id-ID')}</p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 ml-2">
                                    <span className="text-[9px] text-slate-400 block font-medium">Bagi Nominal</span>
                                    <span className="font-extrabold text-emerald-600 text-xs">Rp {stNominal.toLocaleString('id-ID')}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-slate-500 italic">
                            💡 Saat disetujui, nominal total (Rp {totalNominal.toLocaleString('id-ID')}) otomatis dibagi rata ({matchedStudents.length} siswa) dan seluruh siswa langsung tercatat <strong>LUNAS</strong> untuk bulan {item.bulan} {item.tahun}.
                          </p>
                        </div>
                      )}

                      {/* Gemini Vision Detection Badge */}
                      {(item.bank_pengirim || item.tanggal_transfer || item.confidence_notes) && (
                        <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>Terbaca Gemini:</span>
                            <span className="font-bold text-indigo-800">
                              {item.bank_pengirim || 'Bukti Transfer'}
                              {item.nama_rekening_pengirim ? ` a/n ${item.nama_rekening_pengirim}` : ''}
                            </span>
                          </div>
                          <div className="text-[11px] text-indigo-700 bg-white/90 px-2 py-0.5 rounded-md border border-indigo-100 font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-indigo-500" />
                            <span>{item.tanggal_transfer || 'Sesuai Struk'}</span>
                            {item.waktu_transfer && (
                              <span className="text-slate-500">({item.waktu_transfer} WIB)</span>
                            )}
                          </div>
                          {item.confidence_notes && (
                            <p className="w-full text-[10px] text-indigo-600 italic mt-0.5">
                              {item.confidence_notes}
                            </p>
                          )}
                        </div>
                      )}

                      {/* WhatsApp Message Bubble */}
                      {item.message_text && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <p className="italic">"{item.message_text}"</p>
                        </div>
                      )}

                      {/* Rejection notice if rejected */}
                      {item.status === 'rejected' && item.reject_reason && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Alasan Penolakan: </span>
                            <span>{item.reject_reason}</span>
                          </div>
                        </div>
                      )}

                      {/* Editable Payment Parameters for Approval */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Tgl Bayar</span>
                          </label>
                          {item.status === 'pending' ? (
                            <input
                              type="date"
                              value={item.tanggal_transfer || new Date().toISOString().split('T')[0]}
                              onChange={e => handleUpdateItem(item.id, 'tanggal_transfer', e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                            />
                          ) : (
                            <div className="text-xs font-medium text-slate-800 px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
                              {item.tanggal_transfer || '-'}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Waktu</span>
                          </label>
                          {item.status === 'pending' ? (
                            <input
                              type="time"
                              value={item.waktu_transfer || '09:00'}
                              onChange={e => handleUpdateItem(item.id, 'waktu_transfer', e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                            />
                          ) : (
                            <div className="text-xs font-medium text-slate-800 px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
                              {item.waktu_transfer || '-'}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Bulan SPP
                          </label>
                          {item.status === 'pending' ? (
                            <select
                              value={item.bulan}
                              onChange={e => handleUpdateItem(item.id, 'bulan', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                            >
                              {BULAN_OPTIONS.map(b => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="text-xs font-bold text-slate-800 px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
                              {item.bulan} {item.tahun}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            {isSibling ? 'Total Struk (Rp)' : 'Nominal (Rp)'}
                          </label>
                          {item.status === 'pending' ? (
                            <div>
                              <input
                                type="number"
                                value={item.nominal}
                                onChange={e => handleUpdateItem(item.id, 'nominal', Number(e.target.value))}
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                              />
                              {isSibling && (
                                <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                                  @{perStudentNominal.toLocaleString('id-ID')} / anak
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                              <div>
                                <span className="text-xs font-bold text-emerald-700 block">
                                  Rp {totalNominal.toLocaleString('id-ID')}
                                </span>
                                {isSibling && (
                                  <span className="text-[10px] text-emerald-600 block">
                                    @{perStudentNominal.toLocaleString('id-ID')} / anak
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-md transition-colors cursor-pointer ml-1"
                                title="Edit nominal pembayaran"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    {item.status === 'pending' && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isProcessingAction}
                          onClick={() => {
                            setRejectingItem(item);
                            setRejectReason('Nominal tidak sesuai / belum masuk mutasi');
                            setCustomRejectReason('');
                          }}
                          className="px-3.5 py-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Tolak</span>
                        </button>

                        <button
                          type="button"
                          disabled={isProcessingAction || (!item.student_id && matchedStudents.length === 0)}
                          onClick={() => handleApprove(item)}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                          title={(!item.student_id && matchedStudents.length === 0) ? 'Pilih nama siswa terlebih dahulu' : 'Verifikasi dan catat lunas'}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {isSibling 
                              ? `Setujui & Lunaskan ${matchedStudents.length} Siswa (Rp ${perStudentNominal.toLocaleString('id-ID')}/anak)`
                              : 'Setujui & Tandai Lunas'}
                          </span>
                        </button>
                      </div>
                    )}

                    {item.status === 'approved' && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-700 font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {isSibling 
                              ? `Telah Disetujui & Masuk Catatan SPP (${matchedStudents.length} Siswa LUNAS)`
                              : 'Telah Disetujui & Masuk Catatan SPP'}
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isProcessingAction}
                            onClick={() => handleOpenEditModal(item)}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                            title="Koreksi nominal atau bulan SPP pembayaran yang sudah disetujui"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                            <span>Edit Nominal / Data</span>
                          </button>

                          <button
                            type="button"
                            disabled={isProcessingAction}
                            onClick={() => handleResendNotification(item)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            title="Kirim ulang konfirmasi pelunasan ke nomor WhatsApp orang tua"
                          >
                            <Send className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Kirim Ulang WA</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Lightbox / Zoom Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 p-2 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-colors z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={zoomedImage} alt="Struk Transfer Full" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Tolak Bukti Pembayaran</h3>
                <p className="text-xs text-slate-500">Pemberitahuan akan dikirim otomatis ke nomor orang tua</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Pilih Alasan Penolakan
                </label>
                <select
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 font-medium text-slate-800"
                >
                  <option value="Nominal tidak sesuai / belum masuk mutasi">Nominal tidak sesuai / belum masuk mutasi bank</option>
                  <option value="Foto struk buram / tidak dapat dibaca">Foto struk buram / tidak dapat dibaca</option>
                  <option value="Bulan SPP sudah lunas sebelumnya">Bulan SPP yang dimaksud sudah lunas sebelumnya</option>
                  <option value="Nama pengirim / rekening tidak dikenal">Nama pengirim / rekening tidak dikenal</option>
                  <option value="Lainnya">Alasan Lainnya (Tulis Sendiri)</option>
                </select>
              </div>

              {rejectReason === 'Lainnya' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Tulis Alasan
                  </label>
                  <textarea
                    rows={2}
                    value={customRejectReason}
                    onChange={e => setCustomRejectReason(e.target.value)}
                    placeholder="Contoh: Transfer kurang Rp 25.000..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleConfirmReject}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                {isProcessingAction ? 'Memproses...' : 'Kirim Penolakan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulation Modal */}
      {isSimulateModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-900">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold">Simulasi Bukti Transfer Masuk</h3>
              </div>
              <button onClick={() => setIsSimulateModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Uji coba sistem moderasi ini dengan membuat simulasi pesan WhatsApp masuk dari orang tua murid.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Siswa</label>
                <select
                  value={simStudentId}
                  onChange={e => {
                    const newId = e.target.value;
                    setSimStudentId(newId);
                    const found = students.find(s => s.id === newId);
                    if (found) {
                      const sibs = getMatchedStudentsForItem({ sender_phone: found.nomor_whatsapp, student_id: found.id } as any, students);
                      if (sibs.length > 1) {
                        const totalSpp = sibs.reduce((sum, s) => sum + (s.nominal_spp || 100000), 0);
                        setSimNominal(String(totalSpp));
                      } else if (found.nominal_spp) {
                        setSimNominal(String(found.nominal_spp));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nama_lengkap} - {s.kelompok}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const selectedSimStudent = students.find(s => s.id === simStudentId);
                const simSiblings = selectedSimStudent ? getMatchedStudentsForItem({ sender_phone: selectedSimStudent.nomor_whatsapp, student_id: selectedSimStudent.id } as any, students) : [];
                if (simSiblings.length > 1) {
                  const totalSpp = simSiblings.reduce((sum, s) => sum + (s.nominal_spp || 100000), 0);
                  return (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                      <Users className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Terdeteksi Kakak-Adik ({simSiblings.length} Siswa): </span>
                        <span>{simSiblings.map(s => s.nama_lengkap).join(' & ')} memiliki nomor WhatsApp sama. Nominal otomatis diisi total transfer kedua anak (Rp {totalSpp.toLocaleString('id-ID')}).</span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Bulan SPP</label>
                  <select
                    value={simBulan}
                    onChange={e => setSimBulan(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  >
                    {BULAN_OPTIONS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nominal (Rp)</label>
                  <input
                    type="number"
                    value={simNominal}
                    onChange={e => setSimNominal(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Isi Pesan WA</label>
                <input
                  type="text"
                  value={simMessage}
                  onChange={e => setSimMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRunSimulation}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Buat Bukti Masuk</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Approved / Verified Payment Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Koreksi Data Bukti Pembayaran</h3>
                  <p className="text-xs text-slate-500">Edit nominal jika AI Gemini salah membaca sen (,00)</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingItem(null)} 
                disabled={isProcessingAction}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student Info Box */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Nama Siswa</span>
                <span className="font-bold text-slate-800 text-sm">{editingItem.student_name || 'Siswa'}</span>
                {editingItem.student_kelompok && editingItem.student_kelompok !== '-' && (
                  <span className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold">
                    {editingItem.student_kelompok}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Status</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                  editingItem.status === 'approved' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {editingItem.status === 'approved' ? 'Sudah Disetujui' : 'Menunggu'}
                </span>
              </div>
            </div>

            <div className="space-y-3.5">
              {/* Nominal Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                    <span>Nominal Pembayaran (Rp)</span>
                  </label>
                  {Number(editNominal) > 0 && (
                    <span className="text-xs font-extrabold text-emerald-600">
                      Rp {Number(editNominal).toLocaleString('id-ID')}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={editNominal}
                  onChange={e => setEditNominal(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900"
                  placeholder="Contoh: 750000"
                />

                {/* Quick-Fix Sensor Buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {/* Tombol Buang Biaya Admin 2.500 */}
                  {Number(editNominal) > 10000 && (Number(editNominal) % 5000 === 2500 || String(editNominal).endsWith('2500')) && (
                    <button
                      type="button"
                      onClick={() => setEditNominal(String(Number(editNominal) - 2500))}
                      className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[11px] font-bold rounded-lg border border-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Genapkan biaya admin transfer BI-FAST Rp 2.500 ke nominal asli SPP"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-700" />
                      <span>Genapkan Biaya Admin (-2.500): Rp {(Number(editNominal) - 2500).toLocaleString('id-ID')}</span>
                    </button>
                  )}

                  {Number(editNominal) >= 10000000 && Number(editNominal) % 100 === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        let candidate = Number(editNominal) / 100;
                        if (candidate > 10000 && (candidate % 5000 === 2500 || String(candidate).endsWith('2500'))) {
                          candidate = candidate - 2500;
                        }
                        setEditNominal(String(candidate));
                      }}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold rounded-lg border border-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Koreksi 2 angka nol akibat membaca pecahan sen (,00)"
                    >
                      <Sparkles className="w-3 h-3 text-amber-700" />
                      <span>Koreksi Sen ,00 (Bagi 100): Rp {(Number(editNominal) / 100).toLocaleString('id-ID')}</span>
                    </button>
                  )}

                  {(() => {
                    const targetSt = students.find(s => s.id === editingItem.student_id);
                    if (targetSt?.nominal_spp && targetSt.nominal_spp !== Number(editNominal)) {
                      return (
                        <button
                          type="button"
                          onClick={() => setEditNominal(String(targetSt.nominal_spp))}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                        >
                          Pakai SPP Siswa: Rp {targetSt.nominal_spp.toLocaleString('id-ID')}
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Bulan & Tahun */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Bulan SPP
                  </label>
                  <select
                    value={editBulan}
                    onChange={e => setEditBulan(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-slate-800"
                  >
                    {BULAN_OPTIONS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Tahun
                  </label>
                  <input
                    type="number"
                    value={editTahun}
                    onChange={e => setEditTahun(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-slate-800"
                  />
                </div>
              </div>

              {/* Tanggal & Waktu */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Tanggal Transfer
                  </label>
                  <input
                    type="date"
                    value={editTanggal}
                    onChange={e => setEditTanggal(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Waktu
                  </label>
                  <input
                    type="time"
                    value={editWaktu}
                    onChange={e => setEditWaktu(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleSaveEditApproved}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isProcessingAction ? (
                  <span>Menyimpan...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengaturan Template WA */}
      <WhatsAppTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        initialTab={templateModalInitialTab}
        onSaved={(newTemplates) => setTemplates(newTemplates)}
      />
    </div>
  );
}
