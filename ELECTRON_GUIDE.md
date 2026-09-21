# Panduan Pembuatan Aplikasi Desktop (.EXE) - 100% Siap Compile!

Seluruh konfigurasi Electron (`main.js`, `package.json`, `electron`, `electron-builder`) **sudah disiapkan 100% di dalam proyek ini**. Anda tidak perlu mengedit file kode atau file konfigurasi apa pun lagi!

---

## 🚀 Cara 1-Langkah Membuat File .EXE di VS Code (Paling Praktis)

### Langkah 1: Buka Proyek di VS Code
1. Download / Export proyek ini ke komputer Anda.
2. Buka folder proyek di VS Code (`File > Open Folder...`).

### Langkah 2: Buka Terminal di VS Code
Buka Terminal VS Code dengan menekan tombol `Ctrl + ~` (atau menu `Terminal > New Terminal`).

### Langkah 3: Jalankan Perintah Instalasi & Build
Ketik 2 perintah sederhana ini berturut-turut:

```bash
npm install
npm run build:exe
```

---

### 🎉 Hasil Akhir:
Setelah proses selesai, akan otomatis muncul folder baru bernama **`dist_electron/`** di dalam proyek Anda. 
Di dalamnya terdapat file installer:
- **`PAUD Ceria Setup 1.0.0.exe`**

File `.exe` tersebut siap diinstal dan dijalankan di komputer Windows mana pun!

---

## ⚡ Cara Alternatif Instan (Tanpa Install Electron) - Via Nativefier

Jika Anda sudah mendeploy aplikasi ini ke server/cloud (misal Cloud Run / Supabase / Vercel), Anda bisa membuat file `.exe` instan dalam 1 detik:

1. Buka Terminal VS Code.
2. Jalankan perintah ini (ganti URL dengan link web Anda):
   ```bash
   npx nativefier --name "PAUD Ceria" "https://url-aplikasi-anda.com"
   ```
3. File `.exe` siap pakai akan langsung dibuat otomatis.
