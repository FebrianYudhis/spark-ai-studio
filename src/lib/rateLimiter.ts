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
 * Memeriksa status rate limit untuk key (IP atau username)
 * @param key Identifier (misal 'ip:192.168.1.5' atau 'user:admin')
 * @param maxAttempts Maksimal percobaan gagal sebelum diblokir (default: 5)
 * @param windowMs Jendela waktu percobaan dalam milidetik (default: 5 menit)
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 5 * 60 * 1000
): RateLimitStatus {
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
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 5 * 60 * 1000,
  blockDurationMs: number = 5 * 60 * 1000
): RateLimitStatus {
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
export function resetRateLimit(key: string): void {
  attemptsStore.delete(key);
}

/**
 * Helper untuk mengambil IP client dari HTTP request.
 * Header proxy (X-Forwarded-For dll) hanya dipercaya jika TRUST_PROXY=true,
 * karena header tersebut bisa dipalsukan klien untuk melewati rate limit.
 */
export function getClientIp(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';
  if (trustProxy) {
    try {
      const xForwardedFor = req.headers.get('x-forwarded-for');
      if (xForwardedFor) {
        const first = xForwardedFor.split(',')[0].trim();
        if (first) return first;
      }
      const xRealIp = req.headers.get('x-real-ip');
      if (xRealIp) return xRealIp.trim();
      const cfConnectingIp = req.headers.get('cf-connecting-ip');
      if (cfConnectingIp) return cfConnectingIp.trim();
    } catch {}
  }
  return '127.0.0.1';
}
