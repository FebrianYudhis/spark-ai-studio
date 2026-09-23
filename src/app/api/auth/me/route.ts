import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { NO_CACHE_HEADERS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getAuthUser();
    return NextResponse.json(
      {
        user: user
          ? {
              id: user.id,
              username: user.username,
              display_name: user.display_name,
              created_at: user.created_at,
            }
          : null,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    console.error('[auth/me] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengambil data user.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
