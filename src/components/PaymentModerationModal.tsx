import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, XCircle, Clock, Search, Filter, MessageSquare, 
  ExternalLink, ZoomIn, RefreshCw, AlertCircle, Sparkles, Send,
  ChevronRight, Calendar, DollarSign, UserCheck, ShieldAlert, Check, X, Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLogger';
import { PaymentVerification } from '../types/whatsapp';
import { 
  getPaymentVerifications, 
  sendWhatsAppMessage, 
  getWhatsAppGatewayConfig,
  saveLocalVerifications,
  deletePaymentVerification,
  clearLocalVerifications,
  isRealTransferReceipt
} from '../lib/whatsappGateway';

const BULAN_OPTIONS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

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

  // Simulation modal state
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [simStudentId, setSimStudentId] = useState('');
  const [simBulan, setSimBulan] = useState(BULAN_OPTIONS[new Date().getMonth()]);
  const [simNominal, setSimNominal] = useState('100000');
  const [simMessage, setSimMessage] = useState('Assalamualaikum bendahara, ini bukti transfer SPP ananda.');

  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (uid) setCurrentUserId(uid);

    const items = await getPaymentVerifications(uid);
    setVerifications(items);
    setLoading(false);
  };

  if (!isOpen) return null;

  // Handle Approve Payment
  const handleApprove = async (item: PaymentVerification) => {
    setIsProcessingAction(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;

      // 1. Simpan ke tabel payments menggunakan tanggal & jam transfer asli dari struk
      const targetStudent = students.find(s => s.id === item.student_id);
      const studentName = targetStudent?.nama_lengkap || item.student_name || 'Siswa';
      const tanggalBayar = item.tanggal_transfer || new Date().toISOString().split('T')[0];
      const waktuBayar = item.waktu_transfer || new Date().toTimeString().slice(0, 5);

      if (item.student_id) {
        await supabase.from('payments').insert([
          {
            user_id: uid,
            student_id: item.student_id,
            bulan: item.bulan,
            tahun: item.tahun,
            nominal_dibayar: item.nominal,
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

      // 3. Kirim pesan WhatsApp otomatis ke nomor orang tua
      const config = await getWhatsAppGatewayConfig(uid);
      if (config.appkey && config.authkey && item.sender_phone) {
        const approvalMsg = `*BUKTI PEMBAYARAN SPP DIVERIFIKASI* ✅\n\nAlhamdulillah, pembayaran SPP ananda *${studentName}* untuk bulan *${item.bulan} ${item.tahun}* sebesar *Rp ${item.nominal.toLocaleString('id-ID')}* telah diverifikasi dan dicatat *LUNAS*.\n\nTerima kasih atas kerja samanya. Semoga ananda senantiasa berprestasi. 🙏`;
        
        await sendWhatsAppMessage({
          apiUrl: config.apiUrl,
          appkey: config.appkey,
          authkey: config.authkey,
          to: item.sender_phone,
          message: approvalMsg
        });
      }

      // 4. Update UI & log activity
      await logActivity(
        'Verifikasi SPP via WhatsApp',
        `Menyetujui bukti transfer SPP bulan ${item.bulan} ${item.tahun} untuk ${studentName} dari no ${item.sender_phone}`
      );

      const updated = verifications.map(v => v.id === item.id ? { ...v, status: 'approved' as const } : v);
      setVerifications(updated);
      saveLocalVerifications(updated, uid);

      if (onPaymentApproved) {
        onPaymentApproved();
      }
    } catch (err: any) {
      alert('Terjadi kesalahan saat memproses: ' + err.message);
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

      // 2. Kirim pesan penolakan sopan ke nomor orang tua
      const config = await getWhatsAppGatewayConfig(uid);
      if (config.appkey && config.authkey && rejectingItem.sender_phone) {
        const rejectMsg = `*PEMBERITAHUAN VERIFIKASI SPP* ⚠️\n\nHalo Ayah/Bunda, mohon maaf bukti pembayaran SPP ananda *${rejectingItem.student_name || 'Siswa'}* belum dapat kami verifikasi dengan alasan:\n\n👉 *${finalReason}*\n\nMohon mengirimkan ulang foto struk transfer yang jelas atau konfirmasi kembali ke pihak tata usaha. Terima kasih.`;

        await sendWhatsAppMessage({
          apiUrl: config.apiUrl,
          appkey: config.appkey,
          authkey: config.authkey,
          to: rejectingItem.sender_phone,
          message: rejectMsg
        });
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
          .or(`user_id.eq.${currentUserId},user_id.is.null`);
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

      const newRecord: PaymentVerification = {
        id: generatedId,
        user_id: currentUserId || undefined,
        student_id: targetStudent.id,
        student_name: targetStudent.nama_lengkap,
        student_kelompok: targetStudent.kelompok || '-',
        sender_phone: targetStudent.nomor_whatsapp || '6281234567890',
        sender_name: targetStudent.nama_wali || 'Wali Murid',
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
        confidence_notes: 'Struk BCA Mobile Berhasil terverifikasi oleh Gemini Vision',
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

  // Filter items
  const filteredItems = verifications.filter(item => {
    if (filterTab !== 'all' && item.status !== filterTab) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (item.student_name || '').toLowerCase().includes(q);
      const matchPhone = (item.sender_phone || '').includes(q);
      const matchMsg = (item.message_text || '').toLowerCase().includes(q);
      return matchName || matchPhone || matchMsg;
    }
    return true;
  });

  const pendingCount = verifications.filter(v => v.status === 'pending').length;

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
              const matchedStudent = students.find(s => s.id === item.student_id);
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
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-800">
                              {item.student_name || 'Siswa Belum Dipilih'}
                            </h4>
                            {item.student_kelompok && (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-bold">
                                {item.student_kelompok}
                              </span>
                            )}
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

                        {/* Matched vs Selector & Delete Button */}
                        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2">
                          {item.status === 'pending' ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-slate-500">Kaitkan Siswa:</span>
                              <select
                                value={item.student_id || ''}
                                onChange={e => handleUpdateItem(item.id, 'student_id', e.target.value)}
                                className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                              >
                                <option value="">-- Pilih Nama Siswa --</option>
                                {students.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.nama_lengkap} ({s.kelompok})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              {item.student_name}
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
                            Nominal (Rp)
                          </label>
                          {item.status === 'pending' ? (
                            <input
                              type="number"
                              value={item.nominal}
                              onChange={e => handleUpdateItem(item.id, 'nominal', Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                            />
                          ) : (
                            <div className="text-xs font-bold text-emerald-700 px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                              Rp {item.nominal.toLocaleString('id-ID')}
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
                          disabled={isProcessingAction || !item.student_id}
                          onClick={() => handleApprove(item)}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                          title={!item.student_id ? 'Pilih nama siswa terlebih dahulu' : 'Verifikasi dan catat lunas'}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Setujui & Tandai Lunas</span>
                        </button>
                      </div>
                    )}

                    {item.status === 'approved' && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700 font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Telah Disetujui & Masuk Catatan SPP
                        </span>
                        <span className="text-[11px] font-normal text-slate-500">Notifikasi WA terkirim</span>
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
                  onChange={e => setSimStudentId(e.target.value)}
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
    </div>
  );
}
