/**
 * Utilitas umum yang dipakai bersama oleh server (route handler) dan client (komponen).
 * Tidak boleh mengimpor modul Node.js apa pun agar aman di-bundle ke browser.
 */

/**
 * Mengurai kolom database yang menyimpan satu URL atau JSON array URL.
 * Mengembalikan array string yang sudah dibersihkan dari nilai kosong.
 */
export function parseUrls(val?: string | null): string[] {
  if (!val) return [];
  if (val.startsWith('[')) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
      }
    } catch {}
  }
  return [val].filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
}

/** Format ukuran byte menjadi teks yang mudah dibaca (B/KB/MB/GB/TB). */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Memformat timestamp tanggal (termasuk format SQLite `YYYY-MM-DD HH:MM:SS`)
 * secara aman agar tidak memicu "Invalid Date" di browser Safari / iOS (WebKit)
 * dan tidak melompat zona waktu karena penambahan 'Z' yang tidak perlu.
 */
export function formatSafeDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const trimmed = dateStr.trim();
    const safeIso = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
    const date = new Date(safeIso);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleString('id-ID');
  } catch {
    return dateStr;
  }
}

/** Memeriksa apakah token API benar-benar sudah diisi (bukan placeholder/dummy). */
export function isTokenConfigured(token?: string | null): boolean {
  return Boolean(token && token !== 'your_api_token_here' && !token.includes('dummy'));
}

/** Menyamarkan token API untuk ditampilkan kembali ke UI. */
export function maskToken(token?: string | null): string {
  if (!isTokenConfigured(token)) return 'Belum diatur';
  const value = token as string;
  return value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : '••••••••';
}

/** Header anti-cache untuk respons API yang bersifat privat per pengguna. */
export const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
} as const;
