export interface WhatsAppGatewayConfig {
  apiUrl: string;
  appkey: string;
  authkey: string;
  autoReplyEnabled: boolean;
  autoReplyMessage?: string;
  schoolUserId?: string;
}

export interface PaymentVerification {
  id: string;
  user_id?: string;
  student_id?: string | null;
  student_name?: string;
  student_kelompok?: string;
  sender_phone: string;
  sender_name?: string;
  message_text?: string;
  proof_image_url: string;
  bulan: string;
  tahun: number;
  nominal: number;
  tanggal_transfer?: string; // YYYY-MM-DD extracted by Gemini
  waktu_transfer?: string;   // HH:mm extracted by Gemini
  bank_pengirim?: string;    // e.g. BCA, BRI, Mandiri, BSI, DANA
  bank_tujuan?: string;
  nama_rekening_pengirim?: string;
  is_valid_receipt?: boolean;
  confidence_notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason?: string;
  created_at: string;
  updated_at?: string;
}
