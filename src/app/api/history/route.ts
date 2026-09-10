import { NextRequest, NextResponse } from 'next/server';
import {
  getApiHits,
  deleteApiHit,
  clearApiHits,
  getApiHitById,
  updateApiHitResultImage,
  getHistorySummaryCounts,
  getAllActiveImageUrls,
} from '@/lib/db';
import {
  extractImageStrings,
  saveRemoteOrBase64Image,
  deletePhysicalFile,
  cleanupOrphanedFiles,
} from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    const item = getApiHitById(Number(id));
    if (!item) {
      return NextResponse.json({ error: 'Data riwayat tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ item });
  }

  const type = searchParams.get('type') || 'all';
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
  const offset = Number(searchParams.get('offset')) || 0;

  const items = getApiHits({ type, limit, offset });
  const summaryCounts = getHistorySummaryCounts();
  const totalCount = type === 'generation' ? summaryCounts.generation : type === 'edit' ? summaryCounts.edit : summaryCounts.all;

  return NextResponse.json({
    items,
    count: totalCount,
    total: totalCount,
    summaryCounts,
    type,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID riwayat wajib disertakan' }, { status: 400 });
    }

    const item = getApiHitById(Number(id));
    if (!item) {
      return NextResponse.json({ error: 'Data riwayat tidak ditemukan' }, { status: 404 });
    }

    // Parse response payload
    let responseData: any;
    try {
      responseData = typeof item.response_payload === 'string'
        ? JSON.parse(item.response_payload)
        : item.response_payload;
    } catch {
      responseData = null;
    }

    if (!responseData) {
      return NextResponse.json({ error: 'Response payload kosong atau tidak valid' }, { status: 400 });
    }

    const rawImages = extractImageStrings(responseData);
    if (rawImages.length === 0) {
      return NextResponse.json({
        error: 'Tidak ditemukan URL atau data Base64 gambar pada response payload API'
      }, { status: 404 });
    }

    const prefix = item.type === 'edit' ? 'edit_result' : 'gen';
    const savedLocalPath = await saveRemoteOrBase64Image(rawImages[0], prefix);

    if (!savedLocalPath) {
      return NextResponse.json({
        error: 'Gagal mengambil gambar. Kemungkinan link eksternal sudah kedaluwarsa atau tidak dapat diakses.'
      }, { status: 502 });
    }

    // Update database record
    updateApiHitResultImage(Number(id), savedLocalPath);

    return NextResponse.json({
      success: true,
      resultImageUrl: savedLocalPath,
      message: 'Gambar berhasil diambil ulang dan disimpan ke lokal!'
    });
  } catch (err: unknown) {
    return NextResponse.json({
      error: 'Terjadi kesalahan: ' + (err instanceof Error ? err.message : String(err))
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type');

  const parseUrls = (val?: string | null): string[] => {
    if (!val) return [];
    if (val.startsWith('[')) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === 'string');
      } catch {}
    }
    return [val];
  };

  if (id) {
    const item = getApiHitById(Number(id));
    if (!item) {
      return NextResponse.json({ error: 'Gagal menghapus atau data tidak ditemukan' }, { status: 404 });
    }

    const candidateUrls = [
      ...parseUrls(item.source_image_url),
      ...parseUrls(item.result_image_url),
    ].filter((u) => u.startsWith('/uploads/'));

    const deleted = deleteApiHit(Number(id));
    if (!deleted) {
      return NextResponse.json({ error: 'Gagal menghapus entri riwayat' }, { status: 500 });
    }

    // Periksa apakah file fisik masih dipakai oleh entri riwayat lain
    const remainingActiveUrls = new Set(getAllActiveImageUrls());
    for (const url of candidateUrls) {
      if (!remainingActiveUrls.has(url)) {
        deletePhysicalFile(url);
      }
    }

    return NextResponse.json({ success: true, message: `Riwayat #${id} beserta file gambar fisiknya berhasil dihapus` });
  }

  const count = clearApiHits(type || undefined);

  // Bersihkan seluruh file orphaned di folder /uploads/ yang tidak lagi tercatat di database
  const activeUrls = getAllActiveImageUrls();
  const cleanupRes = cleanupOrphanedFiles(activeUrls);

  return NextResponse.json({
    success: true,
    message: `${count} item riwayat berhasil dibersihkan (${cleanupRes.deletedCount} file gambar fisik terhapus)`,
  });
}
