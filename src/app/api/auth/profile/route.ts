import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, verifyPassword, hashPassword } from '@/lib/auth';
import { getUserById, updateUserProfile } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

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
    let messages: string[] = [];

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

      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Password saat ini wajib diisi untuk mengubah password.' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const isValidPassword = verifyPassword(String(currentPassword), fullUser.password_hash, fullUser.salt);
      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Password saat ini tidak sesuai. Silakan periksa kembali.' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      if (cleanNewPassword.length < 4) {
        return NextResponse.json(
          { error: 'Password baru minimal 4 karakter.' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const { hash, salt } = hashPassword(cleanNewPassword);
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
