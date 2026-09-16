import { NextRequest, NextResponse } from 'next/server';
import { getAllActiveImageUrls, cleanExpiredSessions, cleanStoredPayloads, applyRetentionPolicy } from '@/lib/db';
import { getStorageStats, cleanupOrphanedFiles, cleanupAllUploadFiles } from '@/lib/storage';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Harap login terlebih dahulu.' }, { status: 401 });
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
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Gagal mengambil statistik penyimpanan: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Harap login terlebih dahulu.' }, { status: 401 });
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
      });
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
      });
    }

    if (action === 'clean_all') {
      if (user.id !== 1) {
        return NextResponse.json(
          { error: 'Hanya administrator (user utama) yang memiliki izin mengosongkan seluruh penyimpanan.' },
          { status: 403 }
        );
      }

      const result = cleanupAllUploadFiles();

      return NextResponse.json({
        success: true,
        action: 'clean_all',
        deletedCount: result.deletedCount,
        freedBytes: result.freedBytes,
        formattedFreedSize: formatBytes(result.freedBytes),
        message: `Berhasil mengosongkan seluruh file upload (${result.deletedCount} file, ${formatBytes(result.freedBytes)})`,
      });
    }

    return NextResponse.json({ error: `Aksi tidak dikenal: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Gagal membersihkan penyimpanan: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
