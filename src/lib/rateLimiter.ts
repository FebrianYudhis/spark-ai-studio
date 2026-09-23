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
 * - Jika TRUST_PROXY aktif, header proxy (X-Forwarded-For dll) dipercaya penuh
 *   karena server berada di belakang reverse-proxy tepercaya.
 * - Jika TRUST_PROXY nonaktif, nilai X-Forwarded-For yang di-inject otomatis oleh
 *   Next.js dari alamat socket koneksi dipakai sebagai best-effort. Nilai ini
 *   TIDAK dapat dipalsukan selama klien tidak mengirim header tersebut sendiri.
 * - Mengembalikan null bila IP tidak dapat ditentukan, sehingga pemanggil dapat
 *   melewati rate limit berbasis IP alih-alih memakai satu keranjang global.
 *
 * ponytail: best-effort, bukan anti-spoof kuat. Batasnya: klien yang mengirim
 * header X-Forwarded-For sendiri dapat memutar nilai. Upgrade: jalankan di
 * belakang reverse-proxy yang menimpa X-Forwarded-For lalu set TRUST_PROXY=true.
 */
export function getClientIp(req: Request): string | null {
  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';

  const readHeader = (name: string, firstOnly: boolean): string | null => {
    const raw = req.headers.get(name);
    if (!raw) return null;
    const value = firstOnly ? raw.split(',')[0].trim() : raw.trim();
    return value || null;
  };

  if (trustProxy) {
    return (
      readHeader('x-forwarded-for', true) ||
      readHeader('x-real-ip', false) ||
      readHeader('cf-connecting-ip', false)
    );
  }

  // Nilai tunggal hasil injeksi Next.js (tanpa koma = bukan rantai proxy yang dikirim klien)
  const injected = readHeader('x-forwarded-for', false);
  if (injected && !injected.includes(',')) return injected;

  return null;
}
