import { NextRequest, NextResponse } from 'next/server';
import {
  getApiHits,
  deleteApiHit,
  clearApiHits,
  getApiHitById,
  updateApiHitResultImage,
  getHistorySummaryCounts,
  getApiHitsCount,
  getAllActiveImageUrls,
} from '@/lib/db';
import {
  extractImageStrings,
  saveRemoteOrBase64Image,
  deletePhysicalFile,
  cleanupOrphanedFiles,
} from '@/lib/storage';
import { getAuthUser } from '@/lib/auth';
import { parseUrls, NO_CACHE_HEADERS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Harap login terlebih dahulu' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const item = getApiHitById(Number(id), user.id);
      if (!item) {
        return NextResponse.json({ error: 'Data riwayat tidak ditemukan' }, { status: 404, headers: NO_CACHE_HEADERS });
      }
      return NextResponse.json({ item }, { headers: NO_CACHE_HEADERS });
    }

    const type = searchParams.get('type') || 'all';
    const page = Math.max(Number(searchParams.get('page')) || 1, 1);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 3, 1), 100);
    const search = searchParams.get('search')?.trim() || '';
    const offset = searchParams.has('page') ? (page - 1) * limit : Number(searchParams.get('offset')) || 0;

    const items = getApiHits({ userId: user.id, type, limit, offset, search });
    const summaryCounts = getHistorySummaryCounts(user.id);
    const totalCount = getApiHitsCount(type, search, user.id);
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);

    return NextResponse.json({
      items,
      page,
      limit,
      total: totalCount,
      totalPages,
      count: totalCount,
      summaryCounts,
      type,
      search,
    }, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    console.error('[history] GET error:', err);
    return NextResponse.json(
      {
        error: 'Terjadi kesalahan saat memuat riwayat: ' + (err instanceof Error ? err.message : String(err)),
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Harap login terlebih dahulu' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID riwayat wajib disertakan' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const item = getApiHitById(Number(id), user.id);
    if (!item) {
      return NextResponse.json({ error: 'Data riwayat tidak ditemukan' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    // Parse response payload
    let responseData: unknown;
    try {
      responseData = typeof item.response_payload === 'string'
        ? JSON.parse(item.response_payload)
        : item.response_payload;
    } catch {
      responseData = null;
    }

    if (!responseData) {
      return NextResponse.json({ error: 'Response payload kosong atau tidak valid' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const rawImages = extractImageStrings(responseData);
    if (rawImages.length === 0) {
      return NextResponse.json({
        error: 'Tidak ditemukan URL atau data Base64 gambar pada response payload API'
      }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    const prefix = item.type === 'edit' ? 'edit_result' : 'gen';
    const savedResultUrls: string[] = [];

    for (let i = 0; i < rawImages.length; i++) {
      const imgPrefix = rawImages.length > 1 ? `${prefix}_${i + 1}` : prefix;
      const cached = await saveRemoteOrBase64Image(rawImages[i], imgPrefix);
      if (cached) {
        savedResultUrls.push(cached);
      }
    }

    if (savedResultUrls.length === 0) {
      return NextResponse.json({
        error: 'Gagal mengambil gambar. Kemungkinan link eksternal sudah kedaluwarsa atau tidak dapat diakses.'
      }, { status: 502, headers: NO_CACHE_HEADERS });
    }

    const finalResultImageUrl = savedResultUrls.length > 1 ? JSON.stringify(savedResultUrls) : savedResultUrls[0];

    // Update database record
    updateApiHitResultImage(Number(id), finalResultImageUrl);

    return NextResponse.json({
      success: true,
      resultImageUrl: finalResultImageUrl,
      resultImageUrls: savedResultUrls,
      message: `${savedResultUrls.length} gambar berhasil diambil ulang dan disimpan ke lokal!`
    }, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    return NextResponse.json({
      error: 'Terjadi kesalahan: ' + (err instanceof Error ? err.message : String(err))
    }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Harap login terlebih dahulu' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (id) {
      const item = getApiHitById(Number(id), user.id);
      if (!item) {
        return NextResponse.json({ error: 'Gagal menghapus atau data tidak ditemukan' }, { status: 404, headers: NO_CACHE_HEADERS });
      }

      const candidateUrls = [
        ...parseUrls(item.source_image_url),
        ...parseUrls(item.result_image_url),
      ].filter((u) => u.startsWith('/uploads/'));

      const deleted = deleteApiHit(Number(id), user.id);
      if (!deleted) {
        return NextResponse.json({ error: 'Gagal menghapus entri riwayat' }, { status: 500, headers: NO_CACHE_HEADERS });
      }

      // Periksa apakah file fisik masih dipakai oleh entri riwayat lain
      const remainingActiveUrls = new Set(getAllActiveImageUrls());
      for (const url of candidateUrls) {
        if (!remainingActiveUrls.has(url)) {
          deletePhysicalFile(url);
        }
      }

      return NextResponse.json({ success: true, message: `Riwayat #${id} beserta file gambar fisiknya berhasil dihapus` }, { headers: NO_CACHE_HEADERS });
    }

    const count = clearApiHits(type || undefined, user.id);

    // Bersihkan seluruh file orphaned di folder /uploads/ yang tidak lagi tercatat di database
    const activeUrls = getAllActiveImageUrls();
    const cleanupRes = cleanupOrphanedFiles(activeUrls);

    return NextResponse.json({
      success: true,
      message: `${count} item riwayat berhasil dibersihkan (${cleanupRes.deletedCount} file gambar fisik terhapus)`,
    }, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    console.error('[history] DELETE error:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus riwayat: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
