import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getAuthUser();
    return NextResponse.json({
      user: user
        ? {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            created_at: user.created_at,
          }
        : null,
    });
  } catch (err: unknown) {
    console.error('[auth/me] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengambil data user.' },
      { status: 500 }
    );
  }
}
