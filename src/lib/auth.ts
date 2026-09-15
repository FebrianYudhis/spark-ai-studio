import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb, UserRecord } from './db';

export const SESSION_COOKIE_NAME = 'spark_session';
export const SESSION_DURATION_DAYS = 30;

/**
 * Hash password menggunakan node:crypto scrypt
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

/**
 * Verifikasi password menggunakan timingSafeEqual
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const calculatedHash = crypto.scryptSync(password, salt, 64).toString('hex');
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
 * Ambil data user yang sedang login dari cookie sesi di Server Component / Route Handler
 */
export async function getAuthUser(): Promise<Omit<UserRecord, 'password_hash' | 'salt'> | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionId) return null;

    const db = getDb();
    const row = db.prepare(`
      SELECT 
        u.id, 
        u.username, 
        u.display_name, 
        u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > datetime('now', 'localtime')
    `).get(sessionId) as Omit<UserRecord, 'password_hash' | 'salt'> | undefined;

    return row ?? null;
  } catch {
    return null;
  }
}
