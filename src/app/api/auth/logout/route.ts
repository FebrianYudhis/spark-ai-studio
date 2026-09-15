import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSession } from '@/lib/db';
import { SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (sessionId) {
      deleteSession(sessionId);
    }

    cookieStore.delete(SESSION_COOKIE_NAME);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[auth/logout] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memproses logout.' },
      { status: 500 }
    );
  }
}
