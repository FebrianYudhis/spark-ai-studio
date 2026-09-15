import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserByUsername, createSession } from '@/lib/db';
import { verifyPassword, generateSessionId, SESSION_COOKIE_NAME, SESSION_DURATION_DAYS } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password wajib diisi.' },
        { status: 400 }
      );
    }

    const user = getUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: 'Username atau password salah.' },
        { status: 401 }
      );
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Username atau password salah.' },
        { status: 401 }
      );
    }

    // Buat token sesi baru
    const sessionId = generateSessionId();
    createSession(sessionId, user.id, SESSION_DURATION_DAYS);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
    console.error('[auth/login] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memproses login.' },
      { status: 500 }
    );
  }
}
