import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserByUsername, createSession } from '@/lib/db';
import { applyRetentionPolicy } from '@/lib/retention';
import { verifyPassword, generateSessionId, SESSION_COOKIE_NAME, SESSION_DURATION_DAYS, isRequestSecure } from '@/lib/auth';
import { getClientIp, checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rateLimiter';
import { NO_CACHE_HEADERS, toClientErrorMessage } from '@/lib/utils';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const ipKey = clientIp ? `login:ip:${clientIp}` : null;

    // 1. Cek rate limit berdasarkan IP (maksimal 5 percobaan gagal per 5 menit)
    const ipLimit = checkRateLimit(ipKey, 5, 5 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan login gagal dari perangkat/jaringan ini. Silakan coba lagi dalam ${ipLimit.retryAfterSeconds ?? 60} detik.`,
        },
        {
          status: 429,
          headers: { ...NO_CACHE_HEADERS, 'Retry-After': String(ipLimit.retryAfterSeconds ?? 60) },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password wajib diisi.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const userKey = `login:user:${username}`;
    // 2. Cek rate limit spesifik per target akun username
    const userLimit = checkRateLimit(userKey, 5, 5 * 60 * 1000);
    if (!userLimit.allowed) {
      return NextResponse.json(
        {
          error: `Akun ini terkunci sementara akibat terlalu banyak percobaan login yang salah. Silakan coba lagi dalam ${userLimit.retryAfterSeconds ?? 60} detik.`,
        },
        {
          status: 429,
          headers: { ...NO_CACHE_HEADERS, 'Retry-After': String(userLimit.retryAfterSeconds ?? 60) },
        }
      );
    }

    const user = getUserByUsername(username);
    if (!user) {
      recordFailedAttempt(ipKey);
      recordFailedAttempt(userKey);
      return NextResponse.json(
        { error: 'Username atau password salah.' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    // Verifikasi password secara non-blocking via threadpool libuv
    const isValid = await verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      recordFailedAttempt(ipKey);
      recordFailedAttempt(userKey);
      return NextResponse.json(
        { error: 'Username atau password salah.' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    // Login sukses: reset status rate limiter
    resetRateLimit(ipKey);
    resetRateLimit(userKey);

    // Jalankan pembersihan retensi otomatis di background
    try {
      applyRetentionPolicy(user.id);
    } catch {}

    // Buat token sesi baru
    const sessionId = generateSessionId();
    createSession(sessionId, user.id, SESSION_DURATION_DAYS);

    const isSecure = isRequestSecure(req);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        created_at: user.created_at,
      },
    }, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    console.error('[auth/login] error:', err);
    return NextResponse.json(
      { error: toClientErrorMessage(err, 'Gagal memproses login') },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
