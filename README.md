# ✨ Spark AI Studio

Aplikasi web modern untuk mengeksekusi, mengelola, dan mendokumentasikan riwayat generasi serta pengeditan gambar menggunakan **OpenAI Images API** (`gpt-image-2`, `gpt-image-2.5`, `gpt-image-2.5-flare`, dan `gpt-image-2.5-sunburst`). 

Dilengkapi dengan penyimpanan SQLite lokal berkinerja tinggi, isolasi multi-pengguna, manajemen kapasitas disk otomatis, serta dukungan Progressive Web App (PWA).

---

## 🚀 Fitur Utama

- **🎨 Image Generations & Edits Terpadu**: Antarmuka visual yang intuitif untuk endpoint `/images/generations` dan `/images/edits` dengan preset rasio aspek (1:1, 3:2, 16:9, dll.), skala proporsional pintar (`x2`, `:2`), serta dukungan multi-layer gambar.
- **✨ AI Prompt Enhancer**: Bantuan AI bawaan untuk menyempurnakan dan memperkaya deskripsi visual prompt sebelum dieksekusi.
- **🔐 Multi-User & Isolasi Data**: Sistem autentikasi mandiri (login/register) dengan isolasi penuh pada pengaturan API Token, Base URL, dan riwayat per pengguna.
- **🗃️ Riwayat API Interaktif**: Pencatatan otomatis setiap hit API ke database SQLite lokal lengkap dengan paginasi, inspeksi detail payload/respons, pemulihan sesi (chain editing), serta ekspor riwayat ke format JSON.
- **🧹 Manajemen Penyimpanan Cerdas**: Pemantauan kapasitas disk, pembersihan file *orphaned* 1-klik dengan masa tenggang (*grace period*), serta kebijakan retensi otomatis (*auto-retention*).
- **📱 PWA & Desain Responsif**: Pengalaman layaknya aplikasi native yang dapat diinstal langsung di desktop maupun ponsel, ramah layar sentuh, dan layout modal adaptif (`dvh`).
- **⚙️ Konfigurasi Mudah via UI**: Seluruh setelan endpoint, token API, dan preferensi model dapat diubah langsung melalui modal antarmuka tanpa perlu restart server.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) 16 (App Router, Turbopack, React 19, TypeScript)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) v4
- **Database:** SQLite bawaan Node 24 (`node:sqlite`) — *Zero external compilation dependencies*
- **Komponen & Ikon:** [Lucide React](https://lucide.dev/) & [SweetAlert2](https://sweetalert2.github.io/)
- **Runtime:** Node.js v24+

---

## 🏁 Memulai Cepat

### 1. Prasyarat
Pastikan Anda telah menginstal **Node.js versi 24 atau lebih tinggi** (untuk dukungan modul bawaan `node:sqlite`).

### 2. Instalasi & Menjalankan

```bash
# Clone repositori
git clone https://github.com/febrianyudhis/spark-ai-studio.git
cd spark-ai-studio

# Install dependensi
npm install

# Jalankan server development
npm run dev
```

Buka peramban di [http://localhost:3000](http://localhost:3000).

### 3. Build untuk Produksi

```bash
npm run build
npm run start
```

---

## ⚙️ Konfigurasi Awal

1. Buat akun pertama Anda melalui antarmuka **Daftar Akun Baru**.
2. Masuk ke aplikasi dan buka menu **Pengaturan** di sudut kanan atas navbar.
3. Masukkan **Base URL** (default: `https://api.openai.com/v1`) dan **API Token** Anda.
4. Pilih model bawaan yang ingin digunakan, lalu klik **Simpan Pengaturan**. Konfigurasi langsung tersimpan dan aktif seketika.

---

## 📁 Struktur Direktori

```
spark-ai-studio/
├── data/                  # Database SQLite lokal (spark_ai_studio.db)
├── public/                # Asset publik, icons, & direktori uploads
├── Release/               # Dokumentasi rilis dan catatan perubahan (Release Notes)
│   └── README.md          # Indeks & rekap riwayat versi rilis
├── src/
│   ├── app/               # Next.js App Router (Halaman & Endpoint API)
│   ├── components/        # Komponen antarmuka (Auth, Tabs, Modals, Navbar)
│   └── lib/               # Database helper, auth, retention, storage & sanitasi
└── package.json
```

---

## 📦 Catatan Rilis (Changelog)

Untuk membaca rincian lengkap perubahan, riwayat fitur, daftar komit, dan dokumentasi versi rilis aplikasi, silakan kunjungi direktori [Release/](./Release/README.md).

---

## 📄 Lisensi

Proyek ini didistribusikan di bawah lisensi [MIT License](LICENSE).

Dibuat dengan ❤️ oleh [Febrian](https://github.com/febrianyudhis).
