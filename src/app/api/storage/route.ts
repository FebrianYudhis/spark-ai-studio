import { NextRequest, NextResponse } from 'next/server';
import { getAllActiveImageUrls, cleanExpiredSessions, cleanStoredPayloads } from '@/lib/db';
import { applyRetentionPolicy } from '@/lib/retention';
import { getStorageStats, cleanupOrphanedFiles } from '@/lib/storage';
import { getAuthUser } from '@/lib/auth';
import { formatBytes, NO_CACHE_HEADERS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Harap login terlebih dahulu.' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const activeUrls = getAllActiveImageUrls();
    const stats = getStorageStats(activeUrls);

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        formattedTotalSize: formatBytes(stats.totalSizeBytes),
        formattedActiveSize: formatBytes(stats.activeSizeBytes),
        formattedOrphanedSize: formatBytes(stats.orphanedSizeBytes),
      },
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Gagal mengambil statistik penyimpanan: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Harap login terlebih dahulu.' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'clean_orphaned';

    if (action === 'clean_orphaned') {
      const activeUrls = getAllActiveImageUrls();
      const result = cleanupOrphanedFiles(activeUrls);
      const cleanedSessionsCount = cleanExpiredSessions();
      const payloadCleanResult = cleanStoredPayloads();

      const details: string[] = [];
      if (result.deletedCount > 0) {
        details.push(`${result.deletedCount} file sampah disk (${formatBytes(result.freedBytes)})`);
      }
      if (cleanedSessionsCount > 0) {
        details.push(`${cleanedSessionsCount} sesi kadaluarsa`);
      }
      if (payloadCleanResult.cleanedCount > 0) {
        details.push(`${payloadCleanResult.cleanedCount} payload Base64 riwayat (${formatBytes(payloadCleanResult.freedBytes)})`);
      }

      return NextResponse.json({
        success: true,
        action: 'clean_orphaned',
        deletedCount: result.deletedCount,
        freedBytes: result.freedBytes + payloadCleanResult.freedBytes,
        formattedFreedSize: formatBytes(result.freedBytes + payloadCleanResult.freedBytes),
        deletedFiles: result.deletedFiles,
        cleanedSessionsCount,
        cleanedPayloadsCount: payloadCleanResult.cleanedCount,
        message: details.length > 0
          ? `Berhasil membersihkan: ${details.join(', ')}.`
          : 'Penyimpanan dan database sudah bersih. Tidak ditemukan file sampah atau data redundan.',
      }, { headers: NO_CACHE_HEADERS });
    }

    if (action === 'apply_retention') {
      const retentionRes = applyRetentionPolicy(user.id);
      return NextResponse.json({
        success: true,
        action: 'apply_retention',
        deletedCount: retentionRes.deletedHits,
        freedBytes: retentionRes.freedBytes,
        formattedFreedSize: formatBytes(retentionRes.freedBytes),
        deletedFiles: retentionRes.deletedFiles,
        message: retentionRes.message,
      }, { headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json({ error: `Aksi tidak dikenal: ${action}` }, { status: 400, headers: NO_CACHE_HEADERS });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Gagal membersihkan penyimpanan: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
