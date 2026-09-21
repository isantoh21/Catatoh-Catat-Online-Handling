import React, { useState } from 'react';
import { Search, BookOpen, Users, DollarSign, MessageCircle, FileText, Settings, BookMarked, ChevronDown, ChevronUp, UserCheck, Monitor } from 'lucide-react';

const GUIDE_SECTIONS = [
  {
    id: 'intro',
    icon: <BookOpen className="w-5 h-5 text-indigo-500" />,
    title: '1. Pendahuluan & Gambaran Umum',
    content: 'CATATOH (Catat Online Handling) adalah aplikasi pencatatan multifungsi sekolah all-in-one yang dirancang untuk memudahkan pencatatan SPP, tabungan, arus kas keuangan, presensi wajah (kiosk biometrik) guru dan siswa, serta laporan otomatis terintegrasi dalam satu platform digital.'
  },
  {
    id: 'pengaturan',
    icon: <Settings className="w-5 h-5 text-indigo-500" />,
    title: '2. Pengaturan Profil & Sistem',
    content: `Langkah pertama yang sebaiknya Anda lakukan adalah mengatur profil sekolah Anda:
1. Buka menu **Pengaturan Profil** di navigasi utama.
2. **Nama & Logo Sekolah**: Masukkan nama sekolah dan unggah logo (format gambar biasa). Identitas ini akan digunakan sebagai kop surat pada setiap laporan PDF yang Anda cetak.
3. **Kata Sandi**: Jika Anda ingin mengganti kata sandi login Anda, ketik sandi baru dan klik "Update Password".
4. **Pengaturan Absensi**: Tentukan koordinat (Latitude/Longitude) sekolah dan radius maksimal (dalam meter) jika Anda ingin mengaktifkan pembatasan lokasi absensi (Geofencing). Anda juga bisa mengatur batasan jam masuk dan pulang.`
  },
  {
    id: 'kelompok',
    icon: <BookMarked className="w-5 h-5 text-indigo-500" />,
    title: '3. Manajemen Kelompok Kelas',
    content: `Sebelum memasukkan data siswa, disarankan untuk membuat daftar kelas terlebih dahulu.
1. Buka menu **Data Siswa**.
2. Gunakan fitur *Filter Kelompok* atau masuk ke bagian manajemen kelompok untuk membuat kategori kelas (contoh: "Kelas 1A", "Kelas 2B", "TK Besar").
3. Pengelompokan ini akan memudahkan Anda saat memfilter tunggakan SPP atau saat mencetak laporan tagihan.`
  },
  {
    id: 'siswa',
    icon: <Users className="w-5 h-5 text-indigo-500" />,
    title: '4. Manajemen Data Siswa',
    content: `Cara menambah, mengubah, dan menghapus siswa:
1. Buka menu **Data Siswa**.
2. **Tambah Siswa**: Klik tombol "Tambah Siswa", isi Nama Lengkap, Nomor WhatsApp Orang Tua (pastikan diawali dengan angka 62, misal 62812xxx), Nominal SPP bulanan anak tersebut, dan pilih Kelompok kelasnya.
3. **Edit/Hapus**: Klik ikon pensil untuk mengubah data siswa, atau ikon tempat sampah untuk menghapus.
4. **Perhatian Penting**: Jika Anda menghapus data siswa, MAKA SELURUH RIWAYAT PEMBAYARAN SPP SISWA TERSEBUT JUGA AKAN IKUT TERHAPUS. Lakukan dengan hati-hati.`
  },
  {
    id: 'pembayaran',
    icon: <DollarSign className="w-5 h-5 text-indigo-500" />,
    title: '5. Dashboard, Pencatatan SPP & Portal Kartu SPP Orang Tua',
    content: `Menu **Dashboard / Pembayaran** adalah pusat pencatatan SPP harian Anda:
1. Pilih **Bulan dan Tahun** tagihan pada filter di atas tabel. Tabel akan otomatis menampilkan siapa saja yang "Belum" atau "Sudah Lunas" pada bulan tersebut.
2. **Mencatat Lunas**: Klik tombol "Tandai Lunas" pada baris siswa yang membayar. Sistem akan mencatat tanggal dan jam pembayaran secara otomatis.
3. **Membatalkan Lunas**: Jika terjadi kesalahan, Anda bisa membatalkan status lunas (menghapus pembayaran) sehingga statusnya kembali menjadi "Belum" dibayar.
4. **Link Cek Kartu SPP Orang Tua**: Di atas tabel terdapat tombol *"Copy Link Cek Kartu SPP Orang Tua"* (\`catatoh.vercel.app/kartu-spp-ortu\`). Anda dapat membagikan link ini ke orang tua/wali murid agar mereka dapat mengecek secara mandiri progres pembayaran SPP anak mereka pada tahun berjalan (menampilkan bulan lunas lengkap dengan tanggal dan waktu bayar, dengan nominal yang disembunyikan demi privasi).`
  },
  {
    id: 'wa',
    icon: <MessageCircle className="w-5 h-5 text-emerald-500" />,
    title: '6. Pengingat & Template WhatsApp',
    content: `Kirim tagihan langsung ke nomor WhatsApp orang tua siswa:
1. **Atur Template**: Di menu Pembayaran, klik tombol "Template WA". Anda bisa menulis draf pesan tagihan sesuai gaya bahasa sekolah Anda.
2. **Variabel Otomatis**: Gunakan kata kunci seperti \`[NAMA_SISWA]\`, \`[BULAN]\`, \`[TAHUN]\`, dan \`[NOMINAL]\`. Sistem akan mengganti variabel ini dengan data siswa yang bersangkutan secara otomatis.
3. **Kirim Pesan**: Setelah tersimpan, klik tombol berlogo WA ("Kirim WA") pada siswa yang belum lunas. Browser akan langsung membuka WhatsApp (Web atau Desktop) dengan pesan yang sudah terisi otomatis. Anda tinggal tekan kirim.`
  },
  {
    id: 'pemasukan_pengeluaran',
    icon: <DollarSign className="w-5 h-5 text-rose-500" />,
    title: '7. Pemasukan Lainnya & Pengeluaran',
    content: `Catat semua arus kas sekolah agar laporan keuangan menjadi akurat:
1. **Pengeluaran**: Buka menu "Pengeluaran". Catat setiap biaya operasional (seperti pembelian ATK, bayar listrik, honor, dll). Data ini akan mengurangi saldo total.
2. **Pemasukan Lainnya**: Buka menu "Pemasukan Lain". Catat uang masuk yang BUKAN dari SPP bulanan (contoh: Uang Gedung, Uang Pangkal, Donasi, Penjualan Seragam). Data ini akan menambah saldo total di laporan.`
  },
  {
    id: 'siswa_kiosk',
    icon: <UserCheck className="w-5 h-5 text-emerald-500" />,
    title: '8. Manajemen Absensi Siswa (Kiosk Wajah)',
    content: `Selain mencatat data SPP, Anda juga dapat merekam kehadiran (presensi) siswa melalui Kiosk Wajah:
1. Buka menu **Data Siswa**.
2. **Daftarkan Wajah**: Klik tombol "Daftar Wajah" (Kiosk Registrasi) untuk merekam struktur wajah masing-masing siswa. Pilih siswa dari daftar dropdown, lalu hadapkan wajah ke kamera untuk mendaftar.
3. **Mulai Presensi**: Untuk mulai mendeteksi kehadiran, klik "Kiosk Absen". Biarkan halaman ini terbuka penuh di perangkat (tablet/komputer) lobi.
4. **Otomatis Hadir**: Siswa cukup berdiri di depan kamera setiap pagi. Sistem akan otomatis menyapa dan menyimpan data kehadiran mereka sebagai "Hadir" pada hari itu.`
  },
  {
    id: 'guru',
    icon: <UserCheck className="w-5 h-5 text-indigo-500" />,
    title: '9. Manajemen Guru & Kehadiran (Kiosk Wajah)',
    content: `Anda juga dapat mengelola data guru dan memantau kehadiran lewat Kiosk Wajah (Face Recognition):
1. Buka menu **Guru / Pegawai**.
2. **Tambah Guru**: Masukkan nama dan data diri lainnya.
3. **Pendaftaran Wajah (Face Registration)**: Buka "Mode Kiosk". Pastikan wajah setiap guru didaftarkan (direkam) di sistem pertama kali sebelum mereka bisa mulai absen.
4. **Cara Absen (Kiosk)**: Buka menu "Mode Kiosk" pada tablet, PC, atau laptop yang ditaruh di lobi sekolah (sebaiknya mode Fullscreen). Guru cukup berdiri di depan kamera, maka sistem akan secara otomatis mengenali wajah guru, mengucapkan salam, dan mencatat jam masuk/pulangnya sesuai rentang waktu yang sudah diatur.`
  },
  {
    id: 'laporan',
    icon: <FileText className="w-5 h-5 text-indigo-500" />,
    title: '10. Laporan & Ekspor PDF',
    content: `Pantau kesehatan keuangan sekolah di menu **Laporan**:
1. Pilih **Bulan dan Tahun** laporan yang ingin dilihat.
2. Sistem akan menyajikan total Pemasukan SPP, Pemasukan Lainnya, Total Pengeluaran, dan Arus Kas Bersih (Saldo Akhir).
3. Anda juga bisa melihat daftar detail dari seluruh transaksi di bulan tersebut.
4. **Cetak & Ekspor**: Klik tombol **Ekspor PDF** untuk membuat laporan siap cetak berdesain profesional (lengkap dengan kop surat dan logo sekolah Anda). Anda juga bisa menyimpannya dalam format Excel untuk rekapitulasi manual.`
  }
];

export default function GuideView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const filteredSections = GUIDE_SECTIONS.filter(section => 
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const expandAll = () => {
    const all = {};
    GUIDE_SECTIONS.forEach(s => all[s.id] = true);
    setExpandedSections(all);
  };

  const collapseAll = () => {
    setExpandedSections({});
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp('(' + query + ')', 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <mark key={index} className="bg-amber-200 text-amber-900 rounded px-1">{part}</mark> : 
        part
    );
  };

  // Convert step text to properly formatted elements (e.g. bolding numbers, creating paragraphs)
  const formatContent = (content: string, query: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-3">
        {lines.map((line, idx) => {
          // If the line starts with a number bullet (e.g., "1. ", "2. ")
          if (/^\d+\.\s/.test(line)) {
            return (
              <div key={idx} className="flex gap-3 text-slate-600 text-[15px] leading-relaxed">
                <span className="font-bold text-indigo-500 shrink-0">{line.match(/^\d+\./)?.[0]}</span>
                <span>
                  {/* Split markdown-like bold for very simple rendering if present */}
                  {highlightText(line.replace(/^\d+\.\s/, '').replace(/\*\*(.*?)\*\*/g, '$1'), query)}
                </span>
              </div>
            );
          }
          return (
            <p key={idx} className="text-slate-600 leading-relaxed text-[15px]">
              {highlightText(line, query)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 font-sans">
      <div className="p-6 md:px-10 md:py-8 border-b border-slate-200 bg-white flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Buku Panduan Penggunaan</h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">Langkah Demi Langkah Menguasai Aplikasi</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={expandAll}
            className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            Buka Semua
          </button>
          <button 
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Tutup Semua
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Search Bar */}
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex items-center sticky top-0 z-10 transition-shadow focus-within:shadow-md focus-within:border-indigo-300">
            <div className="pl-3 pr-2 text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if(e.target.value.length > 2) expandAll(); // auto expand when searching
              }}
              placeholder="Cari fitur, menu, atau kata kunci..."
              className="w-full py-2.5 px-2 bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors mr-1"
              >
                <span className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors">Clear</span>
              </button>
            )}
          </div>

          {/* Results */}
          <div className="space-y-4 pt-2">
            {filteredSections.length === 0 ? (
              <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center shadow-sm">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">Pencarian untuk "<span className="font-bold text-slate-800">{searchQuery}</span>" tidak ditemukan di panduan.</p>
                <button 
                  onClick={() => setSearchQuery('')}
                  className="mt-6 px-5 py-2.5 text-sm font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
                >
                  Bersihkan Pencarian
                </button>
              </div>
            ) : (
              filteredSections.map((section, idx) => {
                const isExpanded = expandedSections[section.id] !== undefined 
                  ? expandedSections[section.id] 
                  : (idx === 0 && !searchQuery); // auto expand first item if no search

                return (
                  <div key={section.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:border-indigo-100 transition-colors">
                    <button 
                      onClick={() => toggleSection(section.id)}
                      className="w-full text-left p-6 md:px-8 flex items-center justify-between gap-4 focus:outline-none focus:bg-slate-50/50"
                    >
                      <h3 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-4">
                        <div className="p-2.5 bg-indigo-50/80 rounded-xl shrink-0">
                          {section.icon}
                        </div>
                        {highlightText(section.title, searchQuery)}
                      </h3>
                      <div className="p-2 text-slate-400 shrink-0">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="px-6 pb-6 md:px-8 md:pb-8 pt-2 border-t border-slate-50">
                        {formatContent(section.content, searchQuery)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
