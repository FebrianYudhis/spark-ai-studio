import { isTrustProxyEnabled } from './utils';

interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  blockedUntil: number;
}

// In-memory rate limit store
const attemptsStore = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attemptsStore.entries()) {
    if (record.blockedUntil <= now && now - record.firstAttemptAt > 15 * 60 * 1000) {
      attemptsStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

export interface RateLimitStatus {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

/**
 * Memeriksa status rate limit untuk key (IP atau username).
 * Key bernilai null berarti identitas tidak dapat ditentukan (mis. IP client
 * tidak diketahui) sehingga pengecekan dilewati, bukan memakai satu keranjang global.
 * @param key Identifier (misal 'ip:192.168.1.5' atau 'user:admin')
 * @param maxAttempts Maksimal percobaan gagal sebelum diblokir (default: 5)
 * @param windowMs Jendela waktu percobaan dalam milidetik (default: 5 menit)
 */
export function checkRateLimit(
  key: string | null,
  maxAttempts: number = 5,
  windowMs: number = 5 * 60 * 1000
): RateLimitStatus {
  if (!key) {
    return { allowed: true, remainingAttempts: maxAttempts };
  }

  const now = Date.now();
  const record = attemptsStore.get(key);

  if (!record) {
    return { allowed: true, remainingAttempts: maxAttempts };
  }

  // Jika sedang dalam masa blokir
  if (record.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  // Jika jendela waktu percobaan sudah terlewat, reset
  if (now - record.firstAttemptAt > windowMs) {
    attemptsStore.delete(key);
    return { allowed: true, remainingAttempts: maxAttempts };
  }

  const remaining = Math.max(0, maxAttempts - record.attempts);
  return {
    allowed: remaining > 0,
    remainingAttempts: remaining,
  };
}

/**
 * Mencatat percobaan gagal
 */
export function recordFailedAttempt(
  key: string | null,
  maxAttempts: number = 5,
  windowMs: number = 5 * 60 * 1000,
  blockDurationMs: number = 5 * 60 * 1000
): RateLimitStatus {
  if (!key) {
    return { allowed: true, remainingAttempts: maxAttempts };
  }

  const now = Date.now();
  let record = attemptsStore.get(key);

  if (!record || now - record.firstAttemptAt > windowMs) {
    record = {
      attempts: 1,
      firstAttemptAt: now,
      blockedUntil: 0,
    };
  } else {
    record.attempts += 1;
  }

  if (record.attempts >= maxAttempts) {
    record.blockedUntil = now + blockDurationMs;
  }

  attemptsStore.set(key, record);

  if (record.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, maxAttempts - record.attempts),
  };
}

/**
 * Mereset percobaan setelah berhasil login
 */
export function resetRateLimit(key: string | null): void {
  if (!key) return;
  attemptsStore.delete(key);
}

/**
 * Helper untuk mengambil IP client dari HTTP request.
 *
 * - Hanya bila TRUST_PROXY aktif, header proxy (X-Forwarded-For / X-Real-IP /
 *   CF-Connecting-IP) dipercaya. Aktifkan ini HANYA saat server berada di
 *   belakang reverse-proxy yang menimpa header tersebut.
 * - Bila TRUST_PROXY nonaktif, IP tidak dapat ditentukan dengan aman: klien bisa
 *   menyuntik X-Forwarded-For sendiri (Next.js hanya mengisi header ini bila belum
 *   ada), sehingga mengembalikan null agar rate limit per-IP dilewati alih-alih
 *   memakai nilai yang dapat dipalsukan. Rate limit per-akun (username/user id)
 *   tetap berjalan dan tidak terpengaruh.
 */
export function getClientIp(req: Request): string | null {
  if (!isTrustProxyEnabled()) {
    return null;
  }

  const readHeader = (name: string, firstOnly: boolean): string | null => {
    const raw = req.headers.get(name);
    if (!raw) return null;
    const value = firstOnly ? raw.split(',')[0].trim() : raw.trim();
    return value || null;
  };

  return (
    readHeader('x-forwarded-for', true) ||
    readHeader('x-real-ip', false) ||
    readHeader('cf-connecting-ip', false)
  );
}
