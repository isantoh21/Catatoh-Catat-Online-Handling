import { supabase } from './supabaseClient';

export interface WhatsAppTemplates {
  broadcast: string;        // Tagihan SPP (Reminder / Broadcast)
  receiptReceived: string;  // Resi Masuk (Auto-Reply Webhook saat bukti dikirim ortu)
  receiptApproved: string;  // Resi Divalidasi / Disetujui (Lunas)
  receiptRejected: string;  // Resi Ditolak
}

export const DEFAULT_TEMPLATES: WhatsAppTemplates = {
  broadcast: 
`Halo Ayah/Bunda [NAMA_SISWA],

Mohon maaf mengingatkan, untuk pembayaran SPP bulan [BULAN] [TAHUN] sebesar [NOMINAL] belum tercatat.

Cek kartu progres SPP ananda di link resmi:
[LINK_SPP]

Terima kasih.`,

  receiptReceived: 
`Halo Ayah/Bunda, bukti pembayaran SPP [NAMA_SISWA] untuk bulan *[BULAN]*[NOMINAL_TEKS] pada tanggal *[TANGGAL]* telah kami terima dan masuk antrean moderasi bendahara sekolah. Kami akan segera mengonfirmasi status pembayarannya.

Cek kartu SPP ananda di link resmi:
[LINK_SPP]

Terima kasih! 🙏`,

  receiptApproved: 
`*BUKTI PEMBAYARAN SPP DIVERIFIKASI* ✅

Alhamdulillah, pembayaran SPP ananda *[NAMA_SISWA]* untuk bulan *[BULAN] [TAHUN]* sebesar *[NOMINAL]* telah diverifikasi dan dicatat *LUNAS*.

Cek status kartu SPP & riwayat pembayaran di link resmi:
[LINK_SPP]

Terima kasih atas kerja samanya. Semoga ananda senantiasa berprestasi. 🙏`,

  receiptRejected: 
`*PEMBERITAHUAN VERIFIKASI SPP* ⚠️

Halo Ayah/Bunda, mohon maaf bukti pembayaran SPP ananda *[NAMA_SISWA]* belum dapat kami verifikasi dengan alasan:

👉 *[ALASAN_PENOLAKAN]*

Mohon mengirimkan ulang foto struk transfer yang jelas atau cek rincian tagihan di link kartu SPP berikut:
[LINK_SPP]

Terima kasih.`
};

export async function getWhatsAppTemplates(userId?: string): Promise<WhatsAppTemplates> {
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    activeUserId = session?.user?.id;
  }

  // 1. Cek LocalStorage
  if (activeUserId) {
    try {
      const localStr = localStorage.getItem('waTemplates_' + activeUserId);
      if (localStr) {
        const parsed = JSON.parse(localStr);
        return {
          broadcast: parsed.broadcast || localStorage.getItem('waTemplate_' + activeUserId) || DEFAULT_TEMPLATES.broadcast,
          receiptReceived: parsed.receiptReceived || DEFAULT_TEMPLATES.receiptReceived,
          receiptApproved: parsed.receiptApproved || DEFAULT_TEMPLATES.receiptApproved,
          receiptRejected: parsed.receiptRejected || DEFAULT_TEMPLATES.receiptRejected,
        };
      }
    } catch (_) {}
  }

  // 2. Cek Supabase Auth user_metadata
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const meta = session?.user?.user_metadata;
    if (meta?.wa_templates) {
      return {
        broadcast: meta.wa_templates.broadcast || meta.wa_template || DEFAULT_TEMPLATES.broadcast,
        receiptReceived: meta.wa_templates.receiptReceived || DEFAULT_TEMPLATES.receiptReceived,
        receiptApproved: meta.wa_templates.receiptApproved || DEFAULT_TEMPLATES.receiptApproved,
        receiptRejected: meta.wa_templates.receiptRejected || DEFAULT_TEMPLATES.receiptRejected,
      };
    } else if (meta?.wa_template) {
      return {
        ...DEFAULT_TEMPLATES,
        broadcast: meta.wa_template,
      };
    }
  } catch (_) {}

  // 3. Cek user_settings di Supabase
  if (activeUserId) {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('wa_gateway_config')
        .eq('user_id', activeUserId)
        .maybeSingle();

      if (data?.wa_gateway_config?.templates) {
        return {
          ...DEFAULT_TEMPLATES,
          ...data.wa_gateway_config.templates,
        };
      }
    } catch (_) {}
  }

  return { ...DEFAULT_TEMPLATES };
}

export async function saveWhatsAppTemplates(
  templates: WhatsAppTemplates,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    activeUserId = session?.user?.id;
  }

  if (activeUserId) {
    // Simpan ke local storage
    try {
      localStorage.setItem('waTemplates_' + activeUserId, JSON.stringify(templates));
      localStorage.setItem('waTemplate_' + activeUserId, templates.broadcast);
    } catch (_) {}

    try {
      // Simpan ke user_metadata
      await supabase.auth.updateUser({
        data: {
          wa_templates: templates,
          wa_template: templates.broadcast,
        }
      });

      // Simpan ke user_settings (wa_gateway_config.templates)
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('wa_gateway_config')
          .eq('user_id', activeUserId)
          .maybeSingle();

        const currentConfig = data?.wa_gateway_config || {};
        await supabase
          .from('user_settings')
          .update({
            wa_gateway_config: {
              ...currentConfig,
              templates,
            }
          } as any)
          .eq('user_id', activeUserId);
      } catch (_) {}

      return { success: true };
    } catch (err: any) {
      console.error('Gagal menyimpan WhatsApp templates:', err);
      return { success: false, error: err.message || 'Gagal menyimpan template' };
    }
  }

  return { success: true };
}

// FORMATTER: Resi Masuk (Auto-Reply)
export function formatReceiptReceivedMessage(
  template: string,
  data: {
    studentName?: string;
    bulan: string;
    tahun?: number;
    nominal?: number;
    tanggal: string;
    bank?: string;
    linkSpp?: string;
  }
): string {
  const activeTemplate = template || DEFAULT_TEMPLATES.receiptReceived;
  const studentNameStr = data.studentName ? `ananda *${data.studentName}*` : 'ananda';
  const nominalVal = data.nominal && data.nominal > 0 ? `Rp ${data.nominal.toLocaleString('id-ID')}` : '';
  const nominalTeks = data.nominal && data.nominal > 0 ? ` sebesar *${nominalVal}*` : '';

  return activeTemplate
    .replace(/\[NAMA_SISWA\]/g, studentNameStr)
    .replace(/\[BULAN\]/g, data.bulan || '')
    .replace(/\[TAHUN\]/g, String(data.tahun || new Date().getFullYear()))
    .replace(/\[NOMINAL\]/g, nominalVal)
    .replace(/\[NOMINAL_TEKS\]/g, nominalTeks)
    .replace(/\[TANGGAL\]/g, data.tanggal || new Date().toISOString().split('T')[0])
    .replace(/\[BANK\]/g, data.bank || 'Bank / E-Wallet')
    .replace(/\[LINK_SPP\]/g, data.linkSpp || '');
}

// FORMATTER: Resi Divalidasi / Approved
export function formatReceiptApprovedMessage(
  template: string,
  data: {
    studentName: string;
    bulan: string;
    tahun: number | string;
    nominal: number;
    tanggal?: string;
    bank?: string;
    linkSpp?: string;
  }
): string {
  const activeTemplate = template || DEFAULT_TEMPLATES.receiptApproved;
  const nominalVal = `Rp ${Number(data.nominal || 0).toLocaleString('id-ID')}`;

  return activeTemplate
    .replace(/\[NAMA_SISWA\]/g, data.studentName)
    .replace(/\[BULAN\]/g, data.bulan)
    .replace(/\[TAHUN\]/g, String(data.tahun))
    .replace(/\[NOMINAL\]/g, nominalVal)
    .replace(/\[TANGGAL\]/g, data.tanggal || '')
    .replace(/\[BANK\]/g, data.bank || '')
    .replace(/\[LINK_SPP\]/g, data.linkSpp || '');
}

// FORMATTER: Resi Ditolak / Rejected
export function formatReceiptRejectedMessage(
  template: string,
  data: {
    studentName: string;
    reason: string;
    bulan?: string;
    tahun?: number | string;
    nominal?: number;
    linkSpp?: string;
  }
): string {
  const activeTemplate = template || DEFAULT_TEMPLATES.receiptRejected;
  const nominalVal = data.nominal ? `Rp ${Number(data.nominal).toLocaleString('id-ID')}` : '';

  return activeTemplate
    .replace(/\[NAMA_SISWA\]/g, data.studentName)
    .replace(/\[ALASAN_PENOLAKAN\]/g, data.reason)
    .replace(/\[BULAN\]/g, data.bulan || '')
    .replace(/\[TAHUN\]/g, String(data.tahun || ''))
    .replace(/\[NOMINAL\]/g, nominalVal)
    .replace(/\[LINK_SPP\]/g, data.linkSpp || '');
}
