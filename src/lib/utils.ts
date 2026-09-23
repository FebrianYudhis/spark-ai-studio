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
 * Zona waktu tampilan tanggal. Default UTC+7 (Asia/Jakarta); dapat diubah via
 * env NEXT_PUBLIC_APP_TIMEZONE (mis. 'UTC' untuk UTC+0).
 */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Asia/Jakarta';

/**
 * Memformat timestamp tanggal secara aman agar tidak memicu "Invalid Date" di
 * browser Safari / iOS (WebKit). Timestamp tanpa penanda zona (format SQLite
 * `YYYY-MM-DD HH:MM:SS`) diperlakukan sebagai UTC, lalu ditampilkan pada APP_TIMEZONE.
 */
export function formatSafeDate(dateStr?: string | null, timeZone: string = APP_TIMEZONE): string {
  if (!dateStr) return '-';
  try {
    const trimmed = dateStr.trim();
    const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed);
    let safeIso = trimmed;
    if (!hasZone) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        safeIso = `${trimmed}T00:00:00Z`;
      } else {
        safeIso = `${trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')}Z`;
      }
    }
    const date = new Date(safeIso);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('id-ID', { timeZone });
  } catch {
    return dateStr;
  }
}

const PLACEHOLDER_TOKENS = new Set([
  'your_api_token_here',
  'your_token_here',
  'your-enhancer-api-token',
  'changeme',
  'dummy',
]);

/** Memeriksa apakah token API benar-benar sudah diisi (bukan placeholder persis). */
export function isTokenConfigured(token?: string | null): boolean {
  if (!token) return false;
  return !PLACEHOLDER_TOKENS.has(token.trim().toLowerCase());
}

/** Menyamarkan token API untuk ditampilkan kembali ke UI. */
export function maskToken(token?: string | null): string {
  if (!isTokenConfigured(token)) return 'Belum diatur';
  const value = token as string;
  return value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : '••••••••';
}

/**
 * Apakah aplikasi berjalan di belakang reverse-proxy tepercaya.
 * Hanya bila aktif, header proxy (X-Forwarded-For / X-Forwarded-Proto) boleh dipercaya;
 * jika tidak, klien dapat memalsukannya sendiri (Next.js hanya mengisi bila belum ada).
 */
export function isTrustProxyEnabled(): boolean {
  return process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';
}

/**
 * Pesan error ramah untuk klien. Detail mentah hanya disertakan bila
 * NODE_ENV != production atau EXPOSE_ERROR_DETAILS=true (opsional untuk debugging).
 */
export function toClientErrorMessage(err: unknown, friendly: string): string {
  const detail = err instanceof Error ? err.message : String(err ?? '');
  const expose = process.env.NODE_ENV !== 'production' || process.env.EXPOSE_ERROR_DETAILS === 'true';
  return expose && detail ? `${friendly} (${detail})` : friendly;
}

/** Header anti-cache untuk respons API yang bersifat privat per pengguna. */
export const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
} as const;
