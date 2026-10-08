import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import { 
  Check, 
  X, 
  ArrowRight, 
  ChevronDown, 
  Copy, 
  CreditCard,
  Calculator
} from 'lucide-react';

interface PricingViewProps {
  schoolName?: string;
  schoolLogo?: string;
}

export default function PricingView({ schoolName = 'CATATOH', schoolLogo = '' }: PricingViewProps) {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [studentCount, setStudentCount] = useState(250);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copiedBank, setCopiedBank] = useState(false);

  const handleCopyBca = () => {
    navigator.clipboard.writeText('7805556218');
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2000);
  };

  const hoursSavedPerMonth = Math.round((studentCount / 100) * 16);
  const paperReamsSaved = Math.max(1, Math.round((studentCount / 100) * 2.5));

  const faqs = [
    {
      q: 'Apakah Paket Standar (Free) benar-benar gratis tanpa batas waktu?',
      a: 'Ya, 100% gratis selamanya. Sekolah dapat mencatat pembayaran SPP, mengelola siswa, mencetak kuitansi PDF resmi, dan membagikan tautan kartu SPP online ke wali murid tanpa dikenakan biaya.'
    },
    {
      q: 'Bagaimana prosedur aktivasi untuk Paket Premium?',
      a: 'Pilih Paket Premium saat mendaftar akun atau di menu Pengaturan. Pembayaran dilakukan via transfer resmi ke BCA No. Rekening 7805556218 a.n Muhammad Ikhsan. Setelah transfer, kirimkan bukti bayar ke WhatsApp Admin untuk aktivasi status Premium.'
    },
    {
      q: 'Apakah sekolah harus membeli mesin fingerprint atau kamera khusus?',
      a: 'Tidak perlu. Fitur Presensi Wajah AI CATATOH berjalan di browser perangkat smartphone atau tablet Android/iPad biasa yang memiliki kamera depan. Cukup letakkan tablet di meja piket atau gerbang masuk sekolah.'
    },
    {
      q: 'Apakah nomor WhatsApp sekolah aman dari risiko pemblokiran?',
      a: 'Sangat aman. Sistem gateway CATATOH menerapkan jeda acak dinamis (random dynamic delay) yang meniru ritme pengetikan manusia alami untuk mencegah risiko pemblokiran broadcast WhatsApp.'
    },
    {
      q: 'Bisakah sekolah beralih dari Paket Standar ke Premium sewaktu-waktu?',
      a: 'Tentu saja. Semua data siswa, kelas, dan riwayat pembayaran SPP yang dicatat pada paket Standar akan tetap tersimpan saat sekolah beralih ke paket Premium.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#fafafc] text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Floating Island Navbar */}
      <PublicNavbar schoolName={schoolName} schoolLogo={schoolLogo} />

      {/* HEADER SECTION */}
      <section className="pt-32 sm:pt-40 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="space-y-4 max-w-2xl mx-auto">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
            <span>Biaya Transparan & Terjangkau</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-950">
            Pilihan Paket untuk Sekolah Anda
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Mulai gratis dengan paket Standar tanpa kartu kredit, atau aktifkan presensi wajah biometrik dan WhatsApp gateway otomatis dengan paket Premium.
          </p>

          {/* Billing Switcher */}
          <div className="pt-4 flex items-center justify-center">
            <div className="bg-slate-100 p-1 rounded-full border border-slate-200 flex items-center">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bayar Bulanan
              </button>
              
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  billingCycle === 'yearly'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Bayar Tahunan</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  Hemat 110rb
                </span>
              </button>
            </div>
          </div>

        </div>

        {/* PRICING CARDS (DOUBLE-BEZEL ARCHITECTURE) */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
          
          {/* 1. STANDAR (FREE) */}
          <div className="p-2 bg-slate-200/60 rounded-3xl border border-slate-200/90 flex flex-col justify-between">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 h-full flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 text-base">Paket Standar</h3>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                    Gratis
                  </span>
                </div>

                <div>
                  <div className="text-3xl font-extrabold text-slate-900 font-mono">Rp 0</div>
                  <div className="text-xs text-slate-500 mt-1">Selamanya tanpa batas waktu</div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  Cocok untuk sekolah atau madrasah yang baru beralih dari buku tulis fisik ke sistem pencatatan online.
                </p>

                <div className="space-y-2.5 pt-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Data Siswa & Kelas Tanpa Batas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Pencatatan SPP & Kas Masuk/Keluar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Cetak Nota Kuitansi PDF Standar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Kartu SPP Online Wali Murid (24 Jam)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Ekspor Data ke File Excel/CSV</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <span className="line-through">Presensi Wajah AI</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <span className="line-through">WhatsApp Gateway Otomatis</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => navigate('/login?mode=register&tier=free')}
                  className="w-full py-2.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                >
                  Mulai Akun Standar
                </button>
              </div>
            </div>
          </div>

          {/* 2. PAKET PREMIUM */}
          <div className="p-2 bg-slate-900 rounded-3xl border border-slate-800 shadow-md flex flex-col justify-between">
            <div className="bg-slate-900 rounded-2xl p-6 text-white h-full flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-white text-base">Paket Premium</h3>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30">
                    Rekomendasi
                  </span>
                </div>

                <div>
                  <div className="text-3xl font-extrabold text-white font-mono">
                    {billingCycle === 'yearly' ? 'Rp 250.000' : 'Rp 30.000'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {billingCycle === 'yearly' ? 'Per tahun (hemat Rp 110.000)' : 'Per bulan'}
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-800 pt-3">
                  Solusi lengkap dengan presensi biometrik wajah siswa & guru, serta pengiriman pesan WhatsApp otomatis.
                </p>

                <div className="space-y-2.5 pt-2 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span><strong>Semua Fitur Paket Standar</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span><strong>Presensi Wajah AI</strong> (Kiosk Kamera Piket)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span><strong>Geofence GPS</strong> Radius Gerbang Sekolah</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span><strong>WhatsApp Gateway</strong> Notifikasi Hadir/Pulang</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span><strong>Broadcast Tagihan SPP</strong> dengan Delay Anti-Ban</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span><strong>Pembaca Struk OCR</strong> Bukti Transfer Bank</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Dukungan Teknis Prioritas via WhatsApp</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={() => navigate(`/login?mode=register&tier=premium&cycle=${billingCycle}`)}
                  className="w-full py-2.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Pilih Paket Premium</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 3. PAKET YAYASAN */}
          <div className="p-2 bg-slate-200/60 rounded-3xl border border-slate-200/90 flex flex-col justify-between">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 h-full flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 text-base">Paket Yayasan</h3>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                    Multi-Unit
                  </span>
                </div>

                <div>
                  <div className="text-2xl font-extrabold text-slate-900">Konsultasi</div>
                  <div className="text-xs text-slate-500 mt-1">Sesuai jumlah jenjang sekolah</div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  Khusus yayasan pendidikan yang menaungi beberapa jenjang (TK, SD, SMP, SMA/SMK) dalam satu akun terpusat.
                </p>

                <div className="space-y-2.5 pt-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Konsolidasi Kas Semua Jenjang Sekolah</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Akses Khusus Pengurus Yayasan Pusat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Pendampingan Onboarding Staf Tata Usaha</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Dukungan Teknis Langsung</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <a
                  href="https://threads.net/@isantoh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Hubungi Kami</span>
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* BANK ACTIVATION INFO BOX */}
        <div className="mt-10 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Rekening Resmi Pembayaran Paket Premium:</div>
              <div className="text-xs text-slate-600 mt-0.5">
                BCA: <strong className="font-mono text-slate-900">7805556218</strong> a.n Muhammad Ikhsan
              </div>
            </div>
          </div>

          <button
            onClick={handleCopyBca}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedBank ? 'Tersalin' : 'Salin Rekening'}</span>
          </button>
        </div>

      </section>

      {/* EFISIENSI KALKULATOR */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-slate-200/60">
        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-xs space-y-8">
          
          <div className="text-center max-w-lg mx-auto space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Kalkulator Estimasi Efisiensi Waktu & Kertas
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Geser jumlah siswa untuk melihat perkiraan penghematan operasional sekolah per bulan.
            </p>
          </div>

          <div className="space-y-3 max-w-md mx-auto">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700">Jumlah Siswa:</span>
              <span className="text-base font-bold text-blue-600 font-mono">{studentCount} Siswa</span>
            </div>
            <input
              type="range"
              min="50"
              max="1200"
              step="25"
              value={studentCount}
              onChange={(e) => setStudentCount(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>50</span>
              <span>400</span>
              <span>800</span>
              <span>1200</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center max-w-lg mx-auto">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-2xl font-bold text-slate-900 font-mono">~{hoursSavedPerMonth} Jam</div>
              <div className="text-xs text-slate-600 mt-1">Waktu Staf Dihemat per Bulan</div>
              <div className="text-[10px] text-slate-400 mt-1">Bebas ketik rekapan presensi & SPP</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-2xl font-bold text-slate-900 font-mono">~{paperReamsSaved} Rim</div>
              <div className="text-xs text-slate-600 mt-1">Kertas & Buku SPP Terpangkas</div>
              <div className="text-[10px] text-slate-400 mt-1">Penghematan cetak kartu & nota fisik</div>
            </div>
          </div>

        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto border-t border-slate-200/60">
        <div className="text-center mb-10 space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Pertanyaan yang Sering Diajukan
          </h2>
          <p className="text-xs text-slate-500">
            Keterangan seputar pemakaian, pendaftaran, dan metode aktivasi sistem.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div 
                key={faq.q}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-slate-900 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-slate-900' : 'text-slate-400'}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Public Footer */}
      <PublicFooter schoolName={schoolName} />

    </div>
  );
}
