import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, verifyPassword, hashPassword } from '@/lib/auth';
import { getUserById, updateUserProfile, deleteUserSessions } from '@/lib/db';
import { getClientIp, checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rateLimiter';
import { NO_CACHE_HEADERS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { error: 'Harap login terlebih dahulu untuk mengubah profil.' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { displayName, currentPassword, newPassword } = body;

    // Ambil data lengkap user termasuk password_hash dan salt
    const fullUser = getUserById(authUser.id);
    if (!fullUser) {
      return NextResponse.json(
        { error: 'Data user tidak ditemukan di database.' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    const updates: { display_name?: string; password_hash?: string; salt?: string } = {};
    const messages: string[] = [];

    // 1. Validasi dan pembaruan nama tampilan
    if (displayName !== undefined) {
      const cleanDisplayName = String(displayName).trim();
      if (cleanDisplayName.length > 50) {
        return NextResponse.json(
          { error: 'Nama tampilan maksimal 50 karakter.' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      updates.display_name = cleanDisplayName || fullUser.username;
      messages.push('Nama tampilan berhasil diperbarui');
    }

    // 2. Validasi dan pembaruan password jika ada permintaan ganti password
    if (newPassword !== undefined && String(newPassword).length > 0) {
      const cleanNewPassword = String(newPassword);
      const clientIp = getClientIp(req);
      const userKey = `profile:pwd:user:${authUser.id}`;
      const ipKey = clientIp ? `profile:pwd:ip:${clientIp}` : null;

      // Periksa rate limit percobaan ubah password (maks 5 kali salah per 5 menit)
      const userLimit = checkRateLimit(userKey, 5, 5 * 60 * 1000);
      const ipLimit = checkRateLimit(ipKey, 5, 5 * 60 * 1000);
      if (!userLimit.allowed || !ipLimit.allowed) {
        const retryAfter = Math.max(userLimit.retryAfterSeconds ?? 60, ipLimit.retryAfterSeconds ?? 60);
        return NextResponse.json(
          {
            error: `Terlalu banyak percobaan ganti password yang salah. Fitur ini dikunci sementara demi keamanan. Silakan coba lagi dalam ${retryAfter} detik.`,
          },
          { status: 429, headers: { ...NO_CACHE_HEADERS, 'Retry-After': String(retryAfter) } }
        );
      }

      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Password saat ini wajib diisi untuk mengubah password.' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const isValidPassword = await verifyPassword(String(currentPassword), fullUser.password_hash, fullUser.salt);
      if (!isValidPassword) {
        recordFailedAttempt(userKey, 5, 5 * 60 * 1000, 5 * 60 * 1000);
        recordFailedAttempt(ipKey, 5, 5 * 60 * 1000, 5 * 60 * 1000);
        return NextResponse.json(
          { error: 'Password saat ini tidak sesuai. Silakan periksa kembali.' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      // Password saat ini valid, reset rate limit
      resetRateLimit(userKey);
      resetRateLimit(ipKey);

      if (cleanNewPassword.length < 4) {
        return NextResponse.json(
          { error: 'Password baru minimal 4 karakter.' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const { hash, salt } = await hashPassword(cleanNewPassword);
      updates.password_hash = hash;
      updates.salt = salt;
      messages.push('Password berhasil diperbarui');
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada data yang diubah.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const updated = updateUserProfile(authUser.id, updates);
    if (!updated) {
      return NextResponse.json(
        { error: 'Gagal memperbarui profil di database.' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // Jika password berubah, invalidate semua sesi lain (force re-login)
    if (updates.password_hash || updates.salt) {
      deleteUserSessions(authUser.id);
    }

    return NextResponse.json(
      {
        success: true,
        message: messages.join(' dan ') + '.',
        user: {
          id: updated.id,
          username: updated.username,
          display_name: updated.display_name,
          created_at: updated.created_at,
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    console.error('[auth/profile] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
