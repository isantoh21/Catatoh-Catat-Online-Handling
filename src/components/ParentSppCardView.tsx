import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  CreditCard, 
  Phone, 
  User, 
  Users, 
  Printer, 
  RotateCcw,
  Sparkles,
  School,
  Copy,
  Check,
  ShieldCheck,
  Building2,
  CalendarRange,
  GraduationCap
} from 'lucide-react';

export const BULAN_LIST = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export interface AcademicMonthInfo {
  bulan: string;          // 'Juli', 'Agustus', ..., 'Juni'
  tahun: number;          // tahun kalender sesuai semester (e.g. 2026 atau 2027)
  order: number;          // urutan 1 s/d 12 dalam tahun ajaran
  semester: 'Ganjil' | 'Genap';
  semesterNumber: 1 | 2;
  key: string;            // e.g. "juli_2026"
}

// Menentukan tahun awal dari tahun ajaran berjalan di Indonesia:
// - Bulan Juli s/d Desember (indeks 6 - 11) -> Tahun Ajaran dimulai tahun ini (e.g. Juli 2026 -> TA 2026/2027)
// - Bulan Januari s/d Juni (indeks 0 - 5)   -> Tahun Ajaran dimulai tahun kemarin (e.g. Maret 2027 -> TA 2026/2027)
export const getDefaultAcademicStartYear = (date: Date = new Date()): number => {
  const month = date.getMonth(); // 0 = Jan, 6 = Jul
  const year = date.getFullYear();
  return month >= 6 ? year : year - 1;
};

// Menghasilkan daftar 12 bulan berurutan per Tahun Ajaran: Juli (Tahun X) s/d Juni (Tahun X+1)
export const getAcademicMonthsList = (startYear: number): AcademicMonthInfo[] => {
  const endYear = startYear + 1;
  return [
    { bulan: 'Juli', tahun: startYear, order: 1, semester: 'Ganjil', semesterNumber: 1, key: `juli_${startYear}` },
    { bulan: 'Agustus', tahun: startYear, order: 2, semester: 'Ganjil', semesterNumber: 1, key: `agustus_${startYear}` },
    { bulan: 'September', tahun: startYear, order: 3, semester: 'Ganjil', semesterNumber: 1, key: `september_${startYear}` },
    { bulan: 'Oktober', tahun: startYear, order: 4, semester: 'Ganjil', semesterNumber: 1, key: `oktober_${startYear}` },
    { bulan: 'November', tahun: startYear, order: 5, semester: 'Ganjil', semesterNumber: 1, key: `november_${startYear}` },
    { bulan: 'Desember', tahun: startYear, order: 6, semester: 'Ganjil', semesterNumber: 1, key: `desember_${startYear}` },
    { bulan: 'Januari', tahun: endYear, order: 7, semester: 'Genap', semesterNumber: 2, key: `januari_${endYear}` },
    { bulan: 'Februari', tahun: endYear, order: 8, semester: 'Genap', semesterNumber: 2, key: `februari_${endYear}` },
    { bulan: 'Maret', tahun: endYear, order: 9, semester: 'Genap', semesterNumber: 2, key: `maret_${endYear}` },
    { bulan: 'April', tahun: endYear, order: 10, semester: 'Genap', semesterNumber: 2, key: `april_${endYear}` },
    { bulan: 'Mei', tahun: endYear, order: 11, semester: 'Genap', semesterNumber: 2, key: `mei_${endYear}` },
    { bulan: 'Juni', tahun: endYear, order: 12, semester: 'Genap', semesterNumber: 2, key: `juni_${endYear}` },
  ];
};

interface PaymentRecord {
  bulan: string;
  tahun: number;
  tanggal_bayar?: string;
  waktu_bayar?: string;
}

interface StudentData {
  id: string;
  nama_lengkap: string;
  kelompok: string;
  nomor_whatsapp: string;
  user_id?: string;
  payments: Record<string, PaymentRecord>;
}

export default function ParentSppCardView() {
  const defaultStartYear = getDefaultAcademicStartYear();
  const { userId } = useParams<{ userId?: string }>();
  const [searchParams] = useSearchParams();

  // ID Sekolah unik didapatkan dari URL path (/kartu-spp-ortu/:userId) atau query param (?sekolah=... / ?school=...)
  const schoolId = userId || searchParams.get('sekolah') || searchParams.get('school') || searchParams.get('id') || null;

  // Tahun ajaran yang sedang dipilih (e.g. 2026 untuk TA 2026/2027)
  const [academicStartYear, setAcademicStartYear] = useState<number>(() => {
    const paramYear = searchParams.get('ta') || searchParams.get('tahun');
    if (paramYear) {
      const parsed = parseInt(paramYear.split('/')[0], 10);
      if (!isNaN(parsed) && parsed > 2000 && parsed < 2100) return parsed;
    }
    return defaultStartYear;
  });

  // Opsi pilihan tahun ajaran (+1 tahun ke depan, tahun berjalan, dan 3 tahun sebelumnya)
  const academicYearOptions = [
    defaultStartYear + 1,
    defaultStartYear,
    defaultStartYear - 1,
    defaultStartYear - 2,
    defaultStartYear - 3,
  ];

  const [phoneNumber, setPhoneNumber] = useState('');
  const [rememberPhone, setRememberPhone] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [selectedStudentIndex, setSelectedStudentIndex] = useState(0);
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logo?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [semesterFilter, setSemesterFilter] = useState<'all' | 'ganjil' | 'genap'>('all');

  // Normalisasi otomatis format nomor HP orang tua ke format 62xxxxxxxxxxx
  const normalizeTo62Format = (input: string): string => {
    if (!input) return '';
    let digits = input.replace(/\D/g, '');
    if (!digits) return '';

    if (digits.startsWith('0')) {
      digits = '62' + digits.slice(1);
    } else if (digits.startsWith('8')) {
      digits = '62' + digits;
    }
    return digits;
  };

  // Normalisasi variasi nomor HP untuk pencarian fleksibel
  const getPhoneVariants = (input: string): string[] => {
    const clean = input.replace(/\D/g, '');
    if (!clean) return [];
    const variants = new Set<string>();
    variants.add(clean);
    if (clean.startsWith('0')) {
      variants.add('62' + clean.slice(1));
    } else if (clean.startsWith('62')) {
      variants.add('0' + clean.slice(2));
    } else if (clean.startsWith('8')) {
      variants.add('62' + clean);
      variants.add('0' + clean);
    }
    return Array.from(variants);
  };

  // Format tanggal Indonesia (contoh: 15 Juli 2026)
  const formatTanggalIndo = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return `${day} ${BULAN_LIST[monthIndex] || parts[1]} ${year}`;
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch (e) {
      // Fallback
    }
    return dateStr;
  };

  // Format jam/waktu bayar (contoh: 08:30 WIB)
  const formatWaktuIndo = (timeStr?: string) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]} WIB`;
    }
    return `${timeStr} WIB`;
  };

  // Ambil profil identitas sekolah jika schoolId ada di URL
  useEffect(() => {
    if (schoolId) {
      fetchSchoolInfo(schoolId);
    }
  }, [schoolId]);

  // Inisialisasi dari URL query param atau localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hpFromUrl = params.get('hp') || params.get('phone') || params.get('wa');
    const savedPhone = localStorage.getItem('catatoh_parent_phone');

    if (hpFromUrl) {
      const normalized = normalizeTo62Format(hpFromUrl);
      setPhoneNumber(normalized);
      executeSearch(normalized, academicStartYear);
    } else if (savedPhone) {
      const normalized = normalizeTo62Format(savedPhone);
      setPhoneNumber(normalized);
    }
  }, []);

  // Handler interaktif saat mengetik nomor HP
  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw.trim()) {
      setPhoneNumber('');
      return;
    }

    let clean = raw.replace(/\D/g, '');

    if (clean.startsWith('08')) {
      clean = '628' + clean.slice(2);
    } else if (clean.startsWith('0') && clean.length >= 2) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8') && clean.length >= 2) {
      clean = '62' + clean;
    }

    setPhoneNumber(clean);
  };

  // Handler saat orang tua paste format seperti 08xx-xxxx-xxxx atau 62 xxx-xxxx-xxxx
  const handlePhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      const normalized = normalizeTo62Format(pastedText);
      setPhoneNumber(normalized);
    }
  };

  // Handler onBlur untuk memastikan nomor berformat bersih 62xxxxxxxxxxx
  const handlePhoneBlur = () => {
    if (phoneNumber) {
      const normalized = normalizeTo62Format(phoneNumber);
      if (normalized !== phoneNumber) {
        setPhoneNumber(normalized);
      }
    }
  };

  // Eksekusi pencarian data siswa & riwayat pembayaran untuk Tahun Ajaran tertentu (Juli s/d Juni)
  const executeSearch = async (phoneToSearch: string, startYearToUse = academicStartYear) => {
    const normalizedPhone = normalizeTo62Format(phoneToSearch);
    const cleanDigits = normalizedPhone || phoneToSearch.replace(/\D/g, '');
    if (cleanDigits.length < 8) {
      setErrorMessage('Silakan masukkan nomor HP / WhatsApp yang valid (minimal 8-10 digit).');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSearched(true);
    setShowSqlGuide(false);

    if (rememberPhone) {
      localStorage.setItem('catatoh_parent_phone', normalizedPhone);
    }

    const variants = getPhoneVariants(cleanDigits);
    const endYearToUse = startYearToUse + 1;

    try {
      let matchedStudents: any[] = [];
      let matchedPayments: any[] = [];

      // 1. Coba lewat RPC function get_parent_spp_card (mengambil data untuk kedua tahun kalender TA berjalan)
      try {
        const rpcParamsStart: Record<string, any> = {
          p_phone: variants[0],
          p_year: startYearToUse
        };
        const rpcParamsEnd: Record<string, any> = {
          p_phone: variants[0],
          p_year: endYearToUse
        };
        if (schoolId) {
          rpcParamsStart.p_user_id = schoolId;
          rpcParamsEnd.p_user_id = schoolId;
        }

        const [rpcRes1, rpcRes2] = await Promise.all([
          supabase.rpc('get_parent_spp_card', rpcParamsStart),
          supabase.rpc('get_parent_spp_card', rpcParamsEnd)
        ]);

        const combinedRpcData = [
          ...(Array.isArray(rpcRes1.data) ? rpcRes1.data : []),
          ...(Array.isArray(rpcRes2.data) ? rpcRes2.data : [])
        ];

        if (combinedRpcData.length > 0) {
          const studentMap: Record<string, StudentData> = {};
          combinedRpcData.forEach((row: any) => {
            if (!studentMap[row.student_id]) {
              studentMap[row.student_id] = {
                id: row.student_id,
                nama_lengkap: row.nama_lengkap,
                kelompok: row.kelompok || 'Reguler',
                nomor_whatsapp: row.nomor_whatsapp,
                user_id: row.user_id,
                payments: {}
              };
            }
            if (row.bulan && row.tahun) {
              const paymentKey = `${row.bulan.toLowerCase().trim()}_${row.tahun}`;
              studentMap[row.student_id].payments[paymentKey] = {
                bulan: row.bulan,
                tahun: row.tahun,
                tanggal_bayar: row.tanggal_bayar,
                waktu_bayar: row.waktu_bayar
              };
            }
          });
          const studentList = Object.values(studentMap);
          setStudents(studentList);
          setSelectedStudentIndex(0);

          if (!schoolInfo && studentList[0]?.user_id) {
            fetchSchoolInfo(studentList[0].user_id);
          }
          setLoading(false);
          return;
        }
      } catch (err) {
        // Fallback ke direct query di bawah
      }

      // 2. Fallback: Query tabel students langsung dengan nomor_whatsapp varian & isolasi per user_id sekolah
      let studentsQuery = supabase
        .from('students')
        .select('id, nama_lengkap, kelompok, nomor_whatsapp, user_id')
        .in('nomor_whatsapp', variants);

      if (schoolId) {
        studentsQuery = studentsQuery.eq('user_id', schoolId);
      }

      const { data: studentsData, error: studentsError } = await studentsQuery;

      if (studentsError) {
        console.warn('Students query error or RLS restricted:', studentsError);
        setErrorMessage('Data tidak dapat diakses atau nomor belum terdaftar. Silakan hubungi pihak tata usaha sekolah.');
        setShowSqlGuide(true);
        setStudents([]);
        setLoading(false);
        return;
      }

      if (!studentsData || studentsData.length === 0) {
        setStudents([]);
        const schoolContext = schoolInfo?.name ? ` di ${schoolInfo.name}` : '';
        setErrorMessage(`Tidak ditemukan data siswa dengan nomor WhatsApp ${phoneToSearch}${schoolContext}. Pastikan nomor HP sesuai dengan yang didaftarkan ke pihak sekolah.`);
        setLoading(false);
        return;
      }

      matchedStudents = studentsData;
      const studentIds = matchedStudents.map(s => s.id);

      // 3. Query payments untuk siswa tersebut KHUSUS Tahun Ajaran berjalan (mencakup startYear dan startYear + 1)
      let paymentsQuery = supabase
        .from('payments')
        .select('student_id, bulan, tahun, tanggal_bayar, waktu_bayar, user_id')
        .in('student_id', studentIds)
        .in('tahun', [startYearToUse, endYearToUse]);

      if (schoolId) {
        paymentsQuery = paymentsQuery.eq('user_id', schoolId);
      }

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;

      if (paymentsError) {
        console.warn('Payments query error:', paymentsError);
      } else if (paymentsData) {
        matchedPayments = paymentsData;
      }

      // 4. Susun struktur StudentData dengan key pembayaran `bulan_tahun` unik
      const formattedList: StudentData[] = matchedStudents.map(student => {
        const studentPayments: Record<string, PaymentRecord> = {};
        matchedPayments
          .filter(p => p.student_id === student.id)
          .forEach(p => {
            if (p.bulan && p.tahun) {
              const paymentKey = `${p.bulan.toLowerCase().trim()}_${p.tahun}`;
              studentPayments[paymentKey] = {
                bulan: p.bulan,
                tahun: p.tahun,
                tanggal_bayar: p.tanggal_bayar,
                waktu_bayar: p.waktu_bayar
              };
            }
          });

        return {
          id: student.id,
          nama_lengkap: student.nama_lengkap,
          kelompok: student.kelompok || 'Reguler',
          nomor_whatsapp: student.nomor_whatsapp,
          user_id: student.user_id,
          payments: studentPayments
        };
      });

      setStudents(formattedList);
      setSelectedStudentIndex(0);

      // Ambil branding sekolah dari admin user_id jika belum dimuat
      if (!schoolInfo && formattedList[0]?.user_id) {
        fetchSchoolInfo(formattedList[0].user_id);
      }

    } catch (err: any) {
      console.error('Error saat memeriksa kartu SPP:', err);
      setErrorMessage(err?.message || 'Terjadi gangguan jaringan saat memuat data SPP.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcademicYearChange = (newStartYear: number) => {
    setAcademicStartYear(newStartYear);
    if (phoneNumber.trim()) {
      executeSearch(phoneNumber, newStartYear);
    }
  };

  const fetchSchoolInfo = async (userId: string) => {
    try {
      const cachedSchool = localStorage.getItem('schoolName_' + userId);
      const cachedLogo = localStorage.getItem('schoolLogo_' + userId);
      if (cachedSchool) {
        setSchoolInfo({
          name: cachedSchool,
          logo: cachedLogo || undefined
        });
      }

      const { data } = await supabase
        .from('user_settings')
        .select('school_name, school_logo')
        .eq('user_id', userId)
        .maybeSingle();

      if (data && data.school_name) {
        setSchoolInfo({
          name: data.school_name,
          logo: data.school_logo || undefined
        });
        localStorage.setItem('schoolName_' + userId, data.school_name);
        if (data.school_logo) {
          localStorage.setItem('schoolLogo_' + userId, data.school_logo);
        }
      }
    } catch (e) {
      // Abaikan jika gagal
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeTo62Format(phoneNumber);
    if (normalized) {
      setPhoneNumber(normalized);
      executeSearch(normalized, academicStartYear);
    } else {
      executeSearch(phoneNumber, academicStartYear);
    }
  };

  const activeStudent = students[selectedStudentIndex] || null;

  // Daftar 12 bulan dalam tahun ajaran terpilih (Juli s/d Juni)
  const currentAcademicMonths = getAcademicMonthsList(academicStartYear);

  // Helper untuk mengambil catatan pembayaran untuk bulan dan tahun ajaran tertentu
  const getPaymentForMonth = (m: AcademicMonthInfo, student: StudentData | null): PaymentRecord | undefined => {
    if (!student || !student.payments) return undefined;
    const exactKey = `${m.bulan.toLowerCase().trim()}_${m.tahun}`;
    return student.payments[exactKey];
  };

  // Filter semester
  const filteredMonths = currentAcademicMonths.filter(m => {
    if (semesterFilter === 'ganjil') return m.semester === 'Ganjil';
    if (semesterFilter === 'genap') return m.semester === 'Genap';
    return true;
  });

  // Hitung statistik progress 1 tahun ajaran (12 bulan: Juli - Juni)
  const totalLunasCount = activeStudent 
    ? currentAcademicMonths.filter(m => !!getPaymentForMonth(m, activeStudent)).length 
    : 0;
  const progressPercent = Math.min(100, Math.round((totalLunasCount / 12) * 100));

  // Hitung per semester
  const lunasGanjilCount = activeStudent
    ? currentAcademicMonths.filter(m => m.semester === 'Ganjil' && !!getPaymentForMonth(m, activeStudent)).length
    : 0;
  const lunasGenapCount = activeStudent
    ? currentAcademicMonths.filter(m => m.semester === 'Genap' && !!getPaymentForMonth(m, activeStudent)).length
    : 0;

  // Salin SQL bantuan jika admin membutuhkan setup di Supabase
  const copySqlToClipboard = () => {
    const sql = `CREATE POLICY "Public membaca siswa untuk kartu spp ortu" ON students FOR SELECT TO anon USING (true);\nCREATE POLICY "Public membaca pembayaran untuk kartu spp ortu" ON payments FOR SELECT TO anon USING (true);`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const academicYearLabel = `${academicStartYear}/${academicStartYear + 1}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-indigo-900 text-white shadow-md border-b border-indigo-950 sticky top-0 z-20 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {schoolInfo?.logo ? (
              <img 
                src={schoolInfo.logo} 
                alt="Logo Sekolah" 
                className="w-10 h-10 rounded-xl object-contain bg-white p-1 border border-indigo-700 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-indigo-950 flex items-center justify-center font-black shadow-sm shrink-0">
                <School className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight truncate">
                  {schoolInfo?.name || 'Portal Kartu SPP Siswa'}
                </h1>
                {schoolId && (
                  <span className="hidden xs:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-400 text-indigo-950 rounded shrink-0">
                    Khusus
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-indigo-200 truncate">
                {schoolInfo?.name 
                  ? `Laman Khusus Orang Tua • ${schoolInfo.name}`
                  : 'Pemeriksaan Status Pembayaran SPP Orang Tua'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 bg-indigo-800/90 px-3 py-1.5 rounded-full border border-indigo-700/60 text-xs font-bold text-amber-300 shadow-sm">
              <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
              <span>TA {academicYearLabel}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        
        {/* Search Input Box */}
        <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm print:hidden">
          {/* Badge Khusus Sekolah Terisolasi */}
          {schoolInfo?.name ? (
            <div className="mb-4 px-3.5 py-2.5 bg-indigo-50/90 border border-indigo-100 rounded-xl flex flex-col xs:flex-row xs:items-center justify-between gap-2 text-xs text-indigo-950">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-indigo-600 font-bold block text-[10px] uppercase tracking-wider">PORTAL RESMI SPP</span>
                  <strong className="font-bold text-slate-900 text-sm">{schoolInfo.name}</strong>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-medium text-[11px] self-start xs:self-auto">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Data Khusus Sekolah Ini</span>
              </div>
            </div>
          ) : !schoolId ? (
            <div className="mb-4 px-3.5 py-2.5 bg-amber-50/80 border border-amber-200/70 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="leading-relaxed">
                Anda sedang membuka portal SPP umum. Gunakan tautan unik dari sekolah ananda (contoh: <code>catatoh.vercel.app/kartu-spp-ortu/[id-sekolah]</code>) agar data langsung terarah.
              </p>
            </div>
          ) : null}

          {/* Heading & Tahun Ajaran Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                Cek Kartu SPP Siswa
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Format Tahun Ajaran (Juli {academicStartYear} – Juni {academicStartYear + 1})
              </p>
            </div>

            {/* Selector Tahun Ajaran */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
              <label htmlFor="academicYearSelect" className="text-xs font-bold text-slate-600 flex items-center gap-1 pl-1.5">
                <CalendarRange className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tahun Ajaran:</span>
              </label>
              <select
                id="academicYearSelect"
                value={academicStartYear}
                onChange={(e) => handleAcademicYearChange(parseInt(e.target.value, 10))}
                className="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
              >
                {academicYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}/{year + 1} {year === defaultStartYear ? '(Berjalan)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  id="parentPhoneInput"
                  value={phoneNumber}
                  onChange={handlePhoneInputChange}
                  onPaste={handlePhonePaste}
                  onBlur={handlePhoneBlur}
                  placeholder="Contoh: 6281234567890 (otomatis dikonversi)"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm sm:text-base font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !phoneNumber.trim()}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm sm:text-base font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Mencari...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Cek Kartu SPP</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberPhone}
                  onChange={(e) => setRememberPhone(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Simpan nomor HP di browser ini</span>
              </label>
              {searched && (
                <button
                  type="button"
                  onClick={() => {
                    setPhoneNumber('');
                    setStudents([]);
                    setSearched(false);
                    setErrorMessage(null);
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          </form>

          {/* Pesan Error / Tidak Ditemukan */}
          {errorMessage && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold">{errorMessage}</p>
                <p className="text-rose-700 text-xs">
                  Tips: Jika Anda baru saja mendaftarkan nomor HP atau ganti nomor, hubungi wali kelas atau admin sekolah untuk pembaruan kontak.
                </p>
                {showSqlGuide && (
                  <div className="mt-3 pt-3 border-t border-rose-200">
                    <p className="text-[11px] font-bold text-slate-700">Untuk Pengelola/Admin Sekolah:</p>
                    <p className="text-[11px] text-slate-600 mb-2">
                      Pastikan aturan RLS Supabase telah mengizinkan akses anonim pembacaan data siswa & pembayaran untuk portal orang tua.
                    </p>
                    <button
                      type="button"
                      onClick={copySqlToClipboard}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSql ? 'SQL Tersalin ke Clipboard!' : 'Salin Perintah SQL RLS'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Bila Data Ditemukan */}
        {activeStudent && (
          <div className="space-y-6">
            {/* Pemilihan Siswa jika ada lebih dari 1 anak dengan no HP yang sama */}
            {students.length > 1 && (
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Ditemukan {students.length} Siswa untuk Nomor Ini (Pilih Siswa):
                </p>
                <div className="flex flex-wrap gap-2">
                  {students.map((st, idx) => (
                    <button
                      key={st.id}
                      onClick={() => setSelectedStudentIndex(idx)}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        selectedStudentIndex === idx
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>{st.nama_lengkap}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-medium">
                        {st.kelompok}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Profil Siswa & Ringkasan Kartu SPP */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              {/* Header Khusus Print (Hanya Tampil saat Dicetak) */}
              <div className="hidden print:flex items-center justify-between border-b-2 border-slate-800 pb-3 mb-2">
                <div className="flex items-center gap-3">
                  {schoolInfo?.logo && (
                    <img 
                      src={schoolInfo.logo} 
                      alt="Logo Sekolah" 
                      className="w-14 h-14 object-contain"
                    />
                  )}
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                      {schoolInfo?.name || 'SISTEM KARTU SPP DIGITAL'}
                    </h2>
                    <p className="text-xs font-semibold text-slate-600">
                      KARTU STATUS PEMBAYARAN SPP SISWA
                    </p>
                    <p className="text-xs font-bold text-indigo-900 mt-0.5">
                      Tahun Ajaran {academicYearLabel} (Juli {academicStartYear} – Juni {academicStartYear + 1})
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Dicetak Pada:</p>
                  <p className="font-bold text-slate-800">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 font-black text-lg flex items-center justify-center border border-indigo-200 shadow-inner shrink-0">
                    {activeStudent.nama_lengkap.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                      {activeStudent.nama_lengkap}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                        Kelas: {activeStudent.kelompok}
                      </span>
                      <span>•</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        Tahun Ajaran {academicYearLabel}
                      </span>
                      <span className="hidden xs:inline">•</span>
                      <span className="hidden xs:inline text-slate-400">Juli {academicStartYear} – Juni {academicStartYear + 1}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto print:hidden">
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-xs"
                    title="Cetak Kartu SPP"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>Cetak Kartu</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar Lunas SPP Tahun Ajaran Berjalan */}
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-2.5">
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 text-xs sm:text-sm">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    Progres SPP Tahun Ajaran {academicYearLabel}
                  </span>
                  <span className="font-black text-indigo-700">
                    {totalLunasCount} dari 12 Bulan Lunas ({progressPercent}%)
                  </span>
                </div>

                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden p-0.5 border border-slate-300/60">
                  <div 
                    className="h-full rounded-full transition-all duration-700 ease-out bg-emerald-500 shadow-sm"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 pt-0.5">
                  <div className="flex items-center gap-3">
                    <span>Sudah Lunas: <strong className="text-emerald-600">{totalLunasCount} Bulan</strong></span>
                    <span>Belum Lunas: <strong className="text-amber-600">{12 - totalLunasCount} Bulan</strong></span>
                  </div>
                  <div className="flex items-center gap-2 font-medium text-slate-500">
                    <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                      Ganjil: <b className="text-slate-800">{lunasGanjilCount}/6</b>
                    </span>
                    <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                      Genap: <b className="text-slate-800">{lunasGenapCount}/6</b>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Kartu Rincian 12 Bulan Tahun Ajaran (Juli s/d Juni) */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    Rincian Pembayaran Per Tahun Ajaran ({academicYearLabel})
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mulai Juli {academicStartYear} sampai dengan Juni {academicStartYear + 1}
                  </p>
                </div>

                {/* Filter Tab Semester */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold print:hidden self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setSemesterFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      semesterFilter === 'all'
                        ? 'bg-white text-indigo-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua (12 Bulan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSemesterFilter('ganjil')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      semesterFilter === 'ganjil'
                        ? 'bg-white text-amber-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sem. 1 / Ganjil
                  </button>
                  <button
                    type="button"
                    onClick={() => setSemesterFilter('genap')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      semesterFilter === 'genap'
                        ? 'bg-white text-sky-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sem. 2 / Genap
                  </button>
                </div>
              </div>

              {/* Grid 12 Bulan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredMonths.map((monthInfo) => {
                  const payment = getPaymentForMonth(monthInfo, activeStudent);
                  const isLunas = !!payment;

                  return (
                    <div
                      key={monthInfo.key}
                      className={`p-4 rounded-2xl border transition-all ${
                        isLunas
                          ? 'bg-white border-emerald-200 shadow-sm hover:border-emerald-300'
                          : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div>
                          <div className="font-black text-slate-800 text-sm">
                            {String(monthInfo.order).padStart(2, '0')}. {monthInfo.bulan} {monthInfo.tahun}
                          </div>
                          <span className={`inline-block text-[10px] font-bold mt-0.5 px-2 py-0.5 rounded ${
                            monthInfo.semester === 'Ganjil'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                              : 'bg-sky-50 text-sky-800 border border-sky-200/80'
                          }`}>
                            Semester {monthInfo.semesterNumber} ({monthInfo.semester})
                          </span>
                        </div>

                        {isLunas ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            LUNAS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200/70 text-slate-600 border border-slate-200 shrink-0">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Belum Bayar
                          </span>
                        )}
                      </div>

                      {isLunas ? (
                        <div className="space-y-1 text-xs text-slate-600 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100/80">
                          <div className="flex items-center gap-1.5 text-emerald-950 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{formatTanggalIndo(payment.tanggal_bayar)}</span>
                          </div>
                          {payment.waktu_bayar && (
                            <div className="flex items-center gap-1.5 text-emerald-800 text-[11px]">
                              <Clock className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span>Pukul {formatWaktuIndo(payment.waktu_bayar)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 p-2.5 rounded-xl bg-slate-100/60 border border-dashed border-slate-200">
                          <span>Belum ada catatan transaksi</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Note & Informasi Kontak */}
            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-xs text-indigo-900 space-y-1 print:hidden">
              <p className="font-bold flex items-center gap-1.5 text-indigo-950">
                <School className="w-4 h-4 text-indigo-700" />
                Catatan Penting untuk Orang Tua:
              </p>
              <p className="text-indigo-800/90 leading-relaxed">
                Halaman ini menampilkan riwayat status lunas SPP untuk <strong>Tahun Ajaran {academicYearLabel}</strong> (mulai Juli {academicStartYear} hingga Juni {academicStartYear + 1}). Jika terdapat pembayaran yang belum tercatat atau membutuhkan klarifikasi kuitansi, silakan konfirmasi ke bendahara atau pihak tata usaha sekolah.
              </p>
            </div>

            {/* Tanda Tangan Khusus Print */}
            <div className="hidden print:grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-300 text-xs">
              <div className="text-center">
                <p className="text-slate-500 mb-16">Mengetahui Orang Tua / Wali,</p>
                <p className="font-bold border-t border-slate-400 inline-block px-8 pt-1">
                  ( .................................................. )
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 mb-16">Bendahara / Administrasi Sekolah,</p>
                <p className="font-bold border-t border-slate-400 inline-block px-8 pt-1">
                  ( .................................................. )
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bila Belum Mencari */}
        {!searched && (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
              <CreditCard className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Cek Kartu Pembayaran SPP Ananda
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Silakan ketikkan nomor WhatsApp orang tua di atas untuk melihat status pembayaran SPP per <strong>Tahun Ajaran {academicYearLabel}</strong> (periode Juli {academicStartYear} – Juni {academicStartYear + 1}).
            </p>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200 bg-white print:hidden">
        <p>© {academicStartYear}–{academicStartYear + 1} {schoolInfo?.name || 'CATATOH'} • Sistem Informasi SPP Sekolah</p>
      </footer>
    </div>
  );
}
