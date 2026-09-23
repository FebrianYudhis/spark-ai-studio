import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSession } from '@/lib/db';
import { SESSION_COOKIE_NAME } from '@/lib/auth';
import { NO_CACHE_HEADERS, toClientErrorMessage } from '@/lib/utils';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (sessionId) {
      deleteSession(sessionId);
    }

    cookieStore.delete(SESSION_COOKIE_NAME);

    return NextResponse.json({ success: true }, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    console.error('[auth/logout] error:', err);
    return NextResponse.json(
      { error: toClientErrorMessage(err, 'Gagal memproses logout') },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
