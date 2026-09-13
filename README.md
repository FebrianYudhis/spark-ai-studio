# ✨ Spark AI Studio - OpenAI Images Manager

Aplikasi web modern untuk mengelola, mengeksekusi, dan mencatat riwayat request ke **OpenAI Images API** (**Image Generations** & **Image Edits**) dengan penyimpanan SQLite lokal, pengelolaan disk otomatis, serta konfigurasi terpadu melalui antarmuka web.

> [!IMPORTANT]
> **Khusus & Hanya Support OpenAI Images API**  
> Aplikasi ini dirancang dan dioptimalkan secara eksklusif untuk **OpenAI Images API** (resmi maupun proxy/gateway yang 100% kompatibel dengan format skema OpenAI Images):
>
> - `POST {base_url}/images/generations`
> - `POST {base_url}/images/edits`
>
> Format otentikasi menggunakan header standar `Authorization: Bearer <token>` dan payload JSON.
>
> **4 Model Resmi yang Didukung (Strict Dropdown):**  
> Pemilihan model telah dikunci menggunakan sistem dropdown (tidak ada input teks bebas) untuk memastikan kestabilan dan kompatibilitas:
> 1. **`gpt-image-2`**
> 2. **`gpt-image-2.5`** *(Default)*
> 3. **`gpt-image-2.5-flare`**
> 4. **`gpt-image-2.5-sunburst`**

---

## 🌟 Fitur Utama

### 1. **Image Generations (`{base_url}/images/generations`)**

- **Dropdown Pemilihan Model**: Langsung memilih dari 4 model yang didukung (`gpt-image-2`, `gpt-image-2.5`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`).
- **Payload `application/json` murni**:
  ```json
  {
    "model": "gpt-image-2.5",
    "prompt": "Cyberpunk city street at night in heavy rain...",
    "size": "auto",
    "quality": "auto",
    "output_format": "png"
  }
  ```
- **Parameter `output_format` Otomatis**: Default bernilai `"png"` untuk format gambar lossless berstandar tinggi.
- **Pengaturan Ukuran Gambar (`size`) dengan Select Preset & Mode Custom**:
  - **Dropdown Preset Rasio Standar**: Memilih ukuran instan via dropdown:
    - `auto (Ukuran Otomatis — Default)`: Menyerahkan penentuan ukuran pada model AI secara otomatis.
    - `1:1 (Persegi)`: `1024x1024`
    - `3:2 (Lanskap)`: `1536x1024`
    - `2:3 (Potret)`: `1024x1536`
    - `16:9 (Widescreen)`: `1536x864`
    - `9:16 (Story / Vertikal)`: `864x1536`
  - **Dukungan Pengali Cerdas `(x2)` & `(:2)` untuk Preset & Custom**:
    - Baik resolusi yang dipilih dari preset dropdown (seperti 1:1, 3:2, 16:9, dll.) maupun mode kustom dapat langsung dinaikkan atau diturunkan skalanya secara proporsional.
    - Pembulatan ke kelipatan 16 dan kepatuhan terhadap batas dimensi OpenAI Images (maksimum 3840x2160 untuk lanskap, 2160x3840 untuk potret, dan 2160x2160 untuk persegi 1:1) dihitung secara otomatis.
    - Tersedia tombol **Reset** cepat untuk mengembalikan ke resolusi dasar preset.
  - **Mode Custom (Resolusi Kustom Bebas)**:
    - Pengguna dapat mengetikkan resolusi manual dalam format `WIDTHxHEIGHT`.
    - Menampilkan kotak **Peringatan & Aturan Resolusi OpenAI Images** secara khusus pada mode kustom (keduanya wajib kelipatan 16, rentang aspect ratio 1:3 hingga 3:1, batas maksimum 3840x2160, dan peringatan eksperimental >2560x1440).
    - Status validasi real-time langsung memverifikasi kepatuhan aturan sebelum request dikirimkan.
- **Pilihan Kualitas Output (`quality`)**:
  - `auto` (default): Memilih kualitas terbaik secara otomatis sesuai model yang digunakan.
  - `low`, `medium`, `high`: Didukung pada seluruh model GPT Image (`gpt-image-2`, `gpt-image-2.5`).
  - `xhigh`, `max`: Didukung khusus pada model `gpt-image-2.5-sunburst` dan `gpt-image-2.5-flare` (termasuk snapshot `2026-09-08`).
  - Dropdown dan validasi server-side otomatis menyesuaikan opsi yang tersedia sesuai model aktif, serta melakukan fallback aman jika model diganti.
- **Sample Prompt Inspiratif**: Tombol chip prompt cepat untuk pengujian instan.
- **Preview & Aksi Cepat**: Preview hasil gambar resolusi tinggi, tombol unduh (download), buka tab baru, dan modal inspeksi respons JSON.
- **Tombol Reset Form**: Mengosongkan form dan preview dengan sekali klik.

---

### 2. **Image Edits (`{base_url}/images/edits`)**

- **Dropdown Pemilihan Model**: Memilih model edit langsung melalui dropdown dari 4 model yang didukung (`gpt-image-2`, `gpt-image-2.5`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`).
- **Pengiriman JSON via Base64 Data URLs**:
  - Seluruh file gambar yang diunggah dikonversi otomatis menjadi format **Base64 Data URL** (`data:image/png;base64,...`), sehingga request dikirimkan sebagai payload JSON tanpa kerumitan form-data multipart:
    ```json
    {
      "model": "gpt-image-2.5",
      "prompt": "Tambahkan efek kacamata hitam...",
      "images": [{ "image_url": "data:image/png;base64,..." }],
      "size": "auto",
      "quality": "auto",
      "output_format": "png"
    }
    ```
- **Parameter `output_format` Otomatis**: Default bernilai `"png"` untuk format gambar lossless berkualitas tinggi.
- **Pengaturan Ukuran Gambar (`size`) dengan Select Preset & Mode Custom**:
  - **Dropdown Preset Rasio Standar**: Memilih ukuran instan via dropdown:
    - `auto (Ukuran Otomatis — Default)`: Menyerahkan penentuan ukuran pada model AI secara otomatis.
    - `1:1 (Persegi)`: `1024x1024`
    - `3:2 (Lanskap)`: `1536x1024`
    - `2:3 (Potret)`: `1024x1536`
    - `16:9 (Widescreen)`: `1536x864`
    - `9:16 (Story / Vertikal)`: `864x1536`
  - **Dukungan Pengali Cerdas `(x2)` & `(:2)` untuk Preset & Custom**:
    - Baik resolusi yang dipilih dari preset dropdown (seperti 1:1, 3:2, 16:9, dll.) maupun mode kustom dapat langsung dinaikkan atau diturunkan skalanya secara proporsional.
    - Pembulatan ke kelipatan 16 dan kepatuhan terhadap batas dimensi OpenAI Images (maksimum 3840x2160 untuk lanskap, 2160x3840 untuk potret, dan 2160x2160 untuk persegi 1:1) dihitung secara otomatis.
    - Tersedia tombol **Reset** cepat untuk mengembalikan ke resolusi dasar preset.
  - **Mode Custom (Resolusi Kustom Bebas)**:
    - Pengguna dapat mengetikkan resolusi manual dalam format `WIDTHxHEIGHT`.
    - Menampilkan kotak **Peringatan & Aturan Resolusi OpenAI Images** secara khusus pada mode kustom (keduanya wajib kelipatan 16, rentang aspect ratio 1:3 hingga 3:1, batas maksimum 3840x2160, dan peringatan eksperimental >2560x1440).
    - Status validasi real-time langsung memverifikasi kepatuhan aturan sebelum request dikirimkan.
- **Arsitektur Multi-Layer Gambar**:
  - **Layer 1: Image Dasar (Image 1)**: Gambar utama yang menjadi acuan edit.
  - **Layer 2: Image Tambahan (Additional)**: Multi-upload gambar referensi tambahan opsional (`image 2`, `image 3`, dst.).
- **Pilihan Kualitas Output (`quality`)**:
  - `auto` (default): Memilih kualitas terbaik secara otomatis sesuai model yang digunakan.
  - `low`, `medium`, `high`: Didukung pada seluruh model GPT Image (`gpt-image-2`, `gpt-image-2.5`).
  - `xhigh`, `max`: Didukung khusus pada model `gpt-image-2.5-sunburst` dan `gpt-image-2.5-flare` (termasuk snapshot `2026-09-08`).
  - Dropdown dan validasi server-side otomatis menyesuaikan opsi yang tersedia sesuai model aktif, serta melakukan fallback aman jika model diganti.
- **Tampilan Perbandingan Berdampingan**: Menampilkan gambar sumber asli berdampingan dengan gambar hasil olahan AI.

---

### 3. **Riwayat HIT API Terpadu (History with SQLite)**

- Setiap eksekusi HIT API otomatis tercatat secara permanen ke dalam database SQLite lokal (`data/spark_ai_studio.db`).
- **Pemisahan Tampilan Generations vs Edits**:
  - **Kartu Generations**: Menampilkan prompt rapi (`line-clamp-4`), parameter ukuran, kualitas, dan thumbnail hasil.
  - **Kartu Edits**: Menampilkan prompt instruksi, informasi file sumber asli, serta thumbnail perbandingan gambar asli vs hasil edit.
- **Aksi Cepat pada Riwayat**:
  - **"Gunakan Ulang Prompt"** (Generations): Mengisi ulang prompt ke form Generations dengan pengaturan awal bersih.
  - **"Gunakan Ulang Prompt dan Gambar"** (Edits): Membersihkan form Edits lalu otomatis memuat kembali prompt, gambar dasar asli (`primary`), dan seluruh gambar tambahan asli (`image 1`, `image 2`, dst.) ke layer masing-masing.
  - **"Edit Gambar"**: Mengambil **hasil gambar** (baik dari generasi maupun edit sebelumnya) untuk langsung dijadikan gambar dasar baru pada form Edits guna melanjutkan proses edit bertahap (_chain editing_).
  - **"Ambil Ulang Gambar"**: Mengunduh dan menyimpan ulang file gambar fisik ke disk lokal secara otomatis jika file lokal terhapus atau berasal dari temporary remote URL.
  - **Modal Detail Lengkap**: Inspeksi mendalam mencakup parameter API, status code HTTP, prompt penuh, serta payload request & response mentah (JSON).

---

### 4. **Pengaturan Aplikasi Langsung via UI & SQLite (`app_settings`)**

- **Tanpa Perlu Restart Server atau Edit `.env.local` Manual**:
  - Pengaturan `baseUrl`, `apiToken`, `generationsModel`, dan `editsModel` disimpan langsung di tabel SQLite `app_settings`.
  - **Modal Pengaturan Modern**: Dapat dibuka melalui tombol **Pengaturan** di navbar atau tombol **Setelan** pada form.
  - **Fitur Modal**:
    - Edit Base URL API (dengan tombol _Reset ke Default OpenAI_).
    - Edit API Token dengan toggle intip/sembunyikan (Eye / EyeOff).
    - **Dropdown Pemilihan Model (Tanpa Input Teks)**: Mengunci opsi model ke 4 pilihan resmi (`gpt-image-2`, `gpt-image-2.5`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`) sehingga bebas dari typo atau model yang tidak valid.
    - Simpan instan dengan toast SweetAlert2; perubahan langsung aktif seketika pada request berikutnya.

---

### 5. **Pembersihan & Manajemen Disk (`/public/uploads/`)**

- **Cascade Deletion**: Saat entri riwayat dihapus, file fisik gambar di disk lokal otomatis dibersihkan jika tidak lagi direferensikan oleh data riwayat lain.
- **Pendeteksi File Sampah (Orphaned)**: Endpoint `/api/storage` memindai direktori `/public/uploads/` dan mendeteksi file yang tidak terikat pada database.
- **Badge Kapasitas Disk Real-Time**: Toolbar riwayat menampilkan total ukuran penyimpanan disk (misal `Disk: 12.4 MB`) serta sinyal peringatan jika terdapat file sampah.
- **Pembersihan 1-Klik**: Tombol pembersih orphaned file langsung membebaskan kapasitas disk dengan konfirmasi SweetAlert2.

---

### 6. **Responsif Penuh untuk Mobile & Notifikasi Modern**

- **Mobile-Friendly**: Layout otomatis menyesuaikan ukuran layar, navigasi navbar adaptif ringkas di ponsel, dan kartu formulir ramah layar sentuh.
- **SweetAlert2 Terintegrasi**: Dialog konfirmasi hapus riwayat, peringatan refresh saat proses sedang berjalan, dan toast notifikasi elegan di pojok kanan atas.
- **Proteksi Proses Aktif**: Mencegah penutupan tab atau refresh halaman yang tidak disengaja saat proses AI sedang berjalan.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) 16 (Turbopack, App Router, React 19, TypeScript)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) v4
- **Icons:** [Lucide Icons](https://lucide.dev/)
- **Dialogs & Toast:** [SweetAlert2](https://sweetalert2.github.io/)
- **Database:** SQLite bawaan Node 24 (`node:sqlite`) — _zero external native compilation / zero build dependencies!_
- **Server:** Node.js v24

---

## 🚀 Cara Menjalankan

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/febrianyudhis/spark-ai-studio.git
cd spark-ai-studio
npm install
```

### 2. Jalankan Server Development

```bash
npm run dev
```

Buka browser di `http://localhost:3000`.

### 3. Konfigurasi API Token & Endpoint

Aplikasi secara otomatis menyediakan nilai awal dummy bawaan. Anda dapat langsung mengatur API Token dan Base URL kapan saja melalui **Modal Pengaturan** di antarmuka web (klik tombol **Pengaturan** di navbar kanan atas). Pengaturan langsung disimpan ke database SQLite lokal dan langsung aktif seketika tanpa perlu konfigurasi file `.env` manual.

### 4. Build untuk Production

```bash
npm run build
npm run start
```

---

## 📁 Struktur Direktori Proyek

```
spark-ai-studio/
├── data/
│   └── spark_ai_studio.db       # Database SQLite lokal (app_settings & api_hits)
├── public/
│   └── uploads/                 # Cache & penyimpanan gambar lokal
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── config/route.ts      # GET & POST konfigurasi SQLite
│   │   │   ├── generations/route.ts # Handler proxy POST /images/generations
│   │   │   ├── edits/route.ts       # Handler proxy POST /images/edits (Base64 JSON)
│   │   │   ├── history/route.ts     # Handler GET & DELETE riwayat SQLite
│   │   │   └── storage/route.ts     # Handler status disk & pembersihan file orphaned
│   │   ├── globals.css
│   │   ├── icon.tsx                 # Dynamic favicon Spark AI Studio
│   │   ├── layout.tsx
│   │   └── page.tsx                 # Halaman utama aplikasi
│   ├── components/
│   │   ├── DetailModal.tsx          # Modal detail data & inspeksi payload/response JSON
│   │   ├── EditsTab.tsx             # Form & preview image edits
│   │   ├── GenerationsTab.tsx       # Form & preview image generations
│   │   ├── HistoryTab.tsx           # Tampilan riwayat interaktif & manajemen disk
│   │   ├── Navbar.tsx               # Navigasi tab responsif & tombol pengaturan
│   │   └── SettingsModal.tsx        # Modal manajemen pengaturan SQLite
│   └── lib/
│       ├── db.ts                    # Service SQLite (node:sqlite)
│       ├── models.ts                # Daftar model & validasi model OpenAI Images
│       ├── storage.ts               # Helper penyimpanan file upload & disk cleanup
│       └── swal.ts                  # Wrapper utility SweetAlert2 & toasts
└── package.json
```

---

## 🗄️ Skema Database SQLite

### 1. Tabel `app_settings` (Konfigurasi Aplikasi)

| Kolom               | Tipe                | Keterangan                                                 |
| ------------------- | ------------------- | ---------------------------------------------------------- |
| `id`                | INTEGER PRIMARY KEY | Selalu bernilai `1` (Single row setting)                   |
| `base_url`          | TEXT                | Endpoint dasar AI API (misal: `https://api.openai.com/v1`) |
| `api_token`         | TEXT                | Kunci API (Bearer Token)                                   |
| `generations_model` | TEXT                | Model default untuk generasi gambar                        |
| `edits_model`       | TEXT                | Model default untuk edit gambar                            |
| `updated_at`        | TEXT                | Timestamp terakhir pengaturan diperbarui                   |

### 2. Tabel `api_hits` (Log Riwayat Request)

| Kolom               | Tipe                | Keterangan                                       |
| ------------------- | ------------------- | ------------------------------------------------ |
| `id`                | INTEGER PRIMARY KEY | ID unik riwayat (Auto Increment)                 |
| `type`              | TEXT                | `'generation'` atau `'edit'`                     |
| `endpoint`          | TEXT                | URL Endpoint yang di-hit                         |
| `model`             | TEXT                | Model AI yang digunakan                          |
| `prompt`            | TEXT                | Prompt teks yang dikirimkan                      |
| `size`              | TEXT                | Ukuran gambar (misal: `1024x1024`)               |
| `quality`           | TEXT                | Kualitas gambar (`standard`, `high`, dll.)       |
| `source_image_name` | TEXT                | Nama file gambar sumber asli (khusus edit)       |
| `source_image_size` | INTEGER             | Ukuran file sumber asli dalam bytes              |
| `source_image_url`  | TEXT                | Path lokal gambar sumber asli di `/uploads/`     |
| `request_payload`   | TEXT                | JSON string lengkap dari payload yang dikirimkan |
| `status_code`       | INTEGER             | HTTP status code (200, 400, 500, dll.)           |
| `response_payload`  | TEXT                | JSON string lengkap dari respon server AI        |
| `result_image_url`  | TEXT                | Path lokal gambar hasil di `/uploads/`           |
| `error_message`     | TEXT                | Pesan error jika terjadi kegagalan               |
| `created_at`        | DATETIME            | Waktu request dijalankan                         |

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).

Lisensi MIT dipilih karena:

- **Sangat Permisif & Fleksibel**: Bebas digunakan untuk keperluan personal maupun komersial, dimodifikasi, dan didistribusikan ulang.
- **Standar Ekosistem Web**: Standar lisensi utama pada ekosistem Next.js, React, dan Tailwind CSS.
- **Perlindungan Pencipta**: Menyertakan klausul disclaimer bahwa perangkat lunak disediakan _"as-is"_ tanpa jaminan, menjaga pembuat dari liabilitas terkait pemakaian API pihak ketiga.

Dibuat dengan ❤️ oleh [Febrian](https://github.com/febrianyudhis).
