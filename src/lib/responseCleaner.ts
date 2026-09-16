/**
 * Utility untuk mem-parsing dan membersihkan respon dari gateway/upstream AI.
 * Jika respon berupa halaman HTML (misal Cloudflare/Nginx 413, 502, 504, 524),
 * respon akan dirapikan menjadi struktur JSON yang bersih dan bebas dari tag HTML.
 */

export interface SanitizedApiResponse {
  data: Record<string, unknown>;
  errorMessage?: string;
  isHtml: boolean;
  statusCode: number;
}

const KNOWN_HTTP_MESSAGES: Record<number, string> = {
  400: 'Permintaan tidak valid (HTTP 400 Bad Request). Periksa parameter input atau format gambar.',
  401: 'Autentikasi gagal (HTTP 401 Unauthorized). Kunci API (Token) tidak valid atau telah kedaluwarsa.',
  403: 'Akses ditolak oleh server AI (HTTP 403 Forbidden). Token tidak memiliki izin untuk model ini.',
  404: 'Endpoint API tidak ditemukan (HTTP 404 Not Found). Periksa Base URL di Pengaturan.',
  413: 'Ukuran payload foto terlalu besar (HTTP 413 Request Entity Too Large). Gambar melebihi batas maksimum yang diizinkan oleh gateway AI. Silakan gunakan foto yang lebih kecil atau terkompresi.',
  429: 'Batas kuota/rate limit terlampaui (HTTP 429 Too Many Requests). Silakan tunggu sejenak atau periksa saldo kuota API Anda.',
  500: 'Terjadi kesalahan pada server upstream AI (HTTP 500 Internal Server Error).',
  502: 'Gateway AI mengembalikan Bad Gateway (HTTP 502). Server upstream AI sedang mengalami gangguan.',
  503: 'Layanan AI sedang sibuk atau dalam pemeliharaan (HTTP 503 Service Unavailable).',
  504: 'Gateway AI mengalami Gateway Timeout (HTTP 504). Proses memakan waktu terlalu lama di server upstream.',
  520: 'Server upstream AI mengembalikan respon tidak terduga (Cloudflare Error 520).',
  521: 'Server upstream AI sedang mati atau tidak aktif (Cloudflare Error 521 Web Server Is Down).',
  522: 'Koneksi gateway AI ke server upstream timeout (Cloudflare Error 522 Connection Timed Out).',
  524: 'Koneksi ke gateway AI terputus karena timeout (Cloudflare Error 524 A Timeout Occurred). Proses edit/generasi gambar memakan waktu terlalu lama.',
};

/**
 * Membersihkan string teks dari tag HTML, entitas HTML (&nbsp;, dll), dan spasi berlebih
 */
export function stripHtmlTags(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mengekstrak judul dari dokumen HTML (<title> atau <h1>)
 */
export function extractHtmlTitle(html: string): string | null {
  if (!html || typeof html !== 'string') return null;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const clean = stripHtmlTags(titleMatch[1]);
    if (clean) return clean;
  }

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    const clean = stripHtmlTags(h1Match[1]);
    if (clean) return clean;
  }

  return null;
}

/**
 * Parsing teks respon mentah dari API.
 * Menjamin hasil kembalian selalu berupa objek JSON yang valid dan rapi.
 */
export function parseAndSanitizeApiResponse(
  rawText: string,
  statusCode: number,
  fallbackLabel: string = 'Layanan AI'
): SanitizedApiResponse {
  const trimmed = (rawText || '').trim();

  // 1. Coba parse sebagai JSON terlebih dahulu
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      let extractedMsg: string | undefined;

      if (parsed.error && typeof parsed.error === 'object') {
        extractedMsg = (parsed.error as { message?: string }).message;
      } else if (typeof parsed.error === 'string') {
        extractedMsg = parsed.error;
      } else if (typeof parsed.message === 'string') {
        extractedMsg = parsed.message;
      } else if (typeof parsed.errorMessage === 'string') {
        extractedMsg = parsed.errorMessage;
      }

      // Jika pesan error di dalam JSON masih mengandung tag HTML (misal error proxy tertanam di JSON string)
      if (extractedMsg && /<[a-z][\s\S]*>/i.test(extractedMsg)) {
        const title = extractHtmlTitle(extractedMsg);
        const stripped = stripHtmlTags(extractedMsg);
        extractedMsg = title
          ? `${title}: ${stripped.slice(0, 200)}`
          : (stripped.slice(0, 200) || KNOWN_HTTP_MESSAGES[statusCode] || `HTTP ${statusCode} Error`);
      }

      return {
        data: parsed as Record<string, unknown>,
        errorMessage: extractedMsg,
        isHtml: false,
        statusCode,
      };
    }
  } catch {
    // Bukan JSON valid, lanjutkan ke pembersihan format HTML / Text
  }

  // 2. Deteksi apakah respon berupa HTML
  const isHtml = /<!DOCTYPE|<html|<head|<body|<title/i.test(trimmed);
  const htmlTitle = isHtml ? extractHtmlTitle(trimmed) : null;
  const strippedText = stripHtmlTags(trimmed);

  // Buat pesan error yang informatif dan ramah pengguna
  let cleanErrorMessage: string;
  if (KNOWN_HTTP_MESSAGES[statusCode]) {
    cleanErrorMessage = KNOWN_HTTP_MESSAGES[statusCode];
    if (htmlTitle && !cleanErrorMessage.toLowerCase().includes(htmlTitle.toLowerCase())) {
      cleanErrorMessage = `${cleanErrorMessage} [${htmlTitle}]`;
    }
  } else if (htmlTitle) {
    cleanErrorMessage = `HTTP ${statusCode} (${htmlTitle}): ${fallbackLabel} mengembalikan pesan kesalahan.`;
  } else if (strippedText) {
    cleanErrorMessage = `HTTP ${statusCode}: ${strippedText.slice(0, 180)}`;
  } else {
    cleanErrorMessage = `HTTP ${statusCode}: ${fallbackLabel} mengembalikan respon tidak valid.`;
  }

  // Bentuk objek JSON rapi agar database SQLite dan frontend tetap menerima format objek terstruktur
  const cleanData: Record<string, unknown> = {
    error: {
      message: cleanErrorMessage,
      code: `HTTP_${statusCode}`,
      title: htmlTitle || undefined,
      type: isHtml ? 'upstream_html_response' : 'upstream_non_json_response',
    },
    status: statusCode,
    htmlTitle: htmlTitle || undefined,
    snippet: strippedText ? strippedText.slice(0, 250) : undefined,
  };

  return {
    data: cleanData,
    errorMessage: cleanErrorMessage,
    isHtml,
    statusCode,
  };
}
