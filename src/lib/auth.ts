import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { getDb, UserRecord } from './db';

const scryptAsync = promisify(crypto.scrypt);

export const SESSION_COOKIE_NAME = 'spark_session';
export const SESSION_DURATION_DAYS = 30;

/**
 * Hash password menggunakan node:crypto scrypt asynchronous (non-blocking event loop)
 */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return { hash: derivedKey.toString('hex'), salt };
}

/**
 * Verifikasi password menggunakan timingSafeEqual asynchronous (non-blocking event loop)
 */
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  try {
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const calculatedHash = derivedKey.toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calculatedHash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Buat ID token sesi acak aman
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Memeriksa apakah request berasal dari protokol aman (HTTPS),
 * baik secara langsung maupun melalui reverse-proxy (x-forwarded-proto).
 */
export function isRequestSecure(req: Request): boolean {
  try {
    const proto = req.headers.get('x-forwarded-proto');
    if (proto) {
      return proto.split(',')[0].trim().toLowerCase() === 'https';
    }
    const url = new URL(req.url);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Ambil data user yang sedang login dari cookie sesi di Server Component / Route Handler
 */
export async function getAuthUser(): Promise<Omit<UserRecord, 'password_hash' | 'salt'> | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionId) return null;

    const db = getDb();
    const nowIso = new Date().toISOString();
    const row = db.prepare(`
      SELECT 
        u.id, 
        u.username, 
        u.display_name, 
        u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND (s.expires_at > ? OR s.expires_at > datetime('now', 'localtime'))
    `).get(sessionId, nowIso) as Omit<UserRecord, 'password_hash' | 'salt'> | undefined;

    return row ?? null;
  } catch {
    return null;
  }
}

