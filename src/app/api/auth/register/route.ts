import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createUser, getUserByUsername, createSession } from '@/lib/db';
import { hashPassword, generateSessionId, SESSION_COOKIE_NAME, SESSION_DURATION_DAYS, isRequestSecure } from '@/lib/auth';
import { getClientIp, checkRateLimit, recordFailedAttempt } from '@/lib/rateLimiter';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const ipKey = `register:ip:${clientIp}`;

    // Batasi registrasi maksimal 10 akun per 15 menit per IP untuk mencegah bot
    const ipLimit = checkRateLimit(ipKey, 10, 15 * 60 * 1000, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan pendaftaran dari jaringan Anda. Silakan coba lagi dalam ${ipLimit.retryAfterSeconds ?? 60} detik.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds ?? 60) },
        }
      );
    }

    const body = await req.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const displayName = String(body.displayName || body.display_name || '').trim();

    if (!username || username.length < 3) {
      return NextResponse.json(
        { error: 'Username minimal 3 karakter.' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return NextResponse.json(
        { error: 'Username hanya boleh huruf, angka, tanda minus (-), atau garis bawah (_).' },
        { status: 400 }
      );
    }

    if (!password || password.length < 4) {
      return NextResponse.json(
        { error: 'Password minimal 4 karakter.' },
        { status: 400 }
      );
    }

    const existing = getUserByUsername(username);
    if (existing) {
      return NextResponse.json(
        { error: 'Username ini sudah digunakan, silakan pilih username lain.' },
        { status: 400 }
      );
    }

    const { hash, salt } = await hashPassword(password);
    const user = createUser({
      username,
      display_name: displayName || username,
      password_hash: hash,
      salt,
    });

    // Otomatis buat sesi & login
    const sessionId = generateSessionId();
    const cookieStore = await cookies();
    createSession(sessionId, user.id, SESSION_DURATION_DAYS);

    cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: isRequestSecure(req),
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
    });
  } catch (err: unknown) {
    console.error('[auth/register] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mendaftar akun baru.' },
      { status: 500 }
    );
  }
}
