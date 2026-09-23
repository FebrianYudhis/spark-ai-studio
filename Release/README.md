# 📦 Spark AI Studio - Release Notes

Folder ini mendokumentasikan seluruh catatan rilis (*release notes*), perubahan versi, serta detail fitur dan perbaikan yang diterapkan pada **Spark AI Studio**.

## 📑 Daftar Versi

| Versi | Tanggal Rilis | Ringkasan Rilis | File Dokumen |
| :--- | :--- | :--- | :--- |
| **v0.2.0** | 23 September 2026 | Rilis penyempurnaan: hardening keamanan (anti-kebocoran token, SSRF guard, validasi magic bytes, gate `TRUST_PROXY`), berbagi konfigurasi antar pengguna, modal inspeksi error, revamp modal instalasi PWA, dan unifikasi helper/API. | [v0.2.0.md](./v0.2.0.md) |
| **v0.1.0** | 16 September 2026 | Rilis inisial & stabilisasi komprehensif: Integrasi OpenAI Images API, Multi-User Auth, PWA, Auto-Retention, Optimasi Disk, Prompt Enhancer, dan Sistem Riwayat Terpadu. | [v0.1.0.md](./v0.1.0.md) |

---

## 🏷️ Kebijakan Penomoran Versi (Semantic Versioning)
Proyek ini mengikuti format **SemVer (Semantic Versioning)** `MAJOR.MINOR.PATCH`:
- **MAJOR**: Perubahan arsitektur besar atau perubahan yang tidak kompatibel dengan versi sebelumnya (*breaking changes*).
- **MINOR**: Penambahan fitur baru yang kompatibel dengan versi sebelumnya.
- **PATCH**: Perbaikan bug, peningkatan performa, atau pembaruan keamanan minor.
