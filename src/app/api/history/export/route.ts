import { NextRequest, NextResponse } from 'next/server';
import { getApiHitById } from '@/lib/db';
import { convertImageToBase64DataUrl } from '@/lib/storage';
import { getAuthUser } from '@/lib/auth';
import { parseUrls, NO_CACHE_HEADERS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Membersihkan payload JSON dari duplikasi string Base64 yang sangat panjang.
 * Data Base64 gambar asli sudah secara rapi diekspor di bagian 'images' (sumber)
 * dan 'result_images' (hasil AI), sehingga di request/response payload digantikan
 * dengan catatan referensi yang ringkas.
 */
function sanitizePayloadForExport(payload: unknown, fieldType: 'request' | 'response'): unknown {
  if (!payload || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayloadForExport(item, fieldType));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (typeof value === 'string') {
      const lowerKey = key.toLowerCase();
      const isBase64Key = ['b64_json', 'base64', 'image_base64'].includes(lowerKey);
      const isDataUri = value.startsWith('data:image/');
      const isVeryLongBase64 = value.length > 500 && /^[A-Za-z0-9+/=\s]+$/.test(value.slice(0, 100));

      if (isBase64Key || isDataUri || isVeryLongBase64) {
        const targetSection = fieldType === 'response' ? 'result_images' : 'images';
        result[key] = `[Data Base64 dipindahkan ke '${targetSection}' untuk mencegah duplikasi data (${(value.length / 1024).toFixed(1)} KB)]`;
        continue;
      }
    }

    if (typeof value === 'object' && value !== null) {
      result[key] = sanitizePayloadForExport(value, fieldType);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Harap login terlebih dahulu' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');

    if (!idParam || isNaN(Number(idParam))) {
      return NextResponse.json({ error: 'Parameter id riwayat wajib disertakan' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const record = getApiHitById(Number(idParam), user.id);
    if (!record) {
      return NextResponse.json({ error: 'Data riwayat tidak ditemukan' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    // 1. Ekstrak dan konversi source images ke Base64 (image 1, image 2, dst.)
    const sourceUrls = parseUrls(record.source_image_url);
    const sourceImagesBase64: Record<string, string> = {};
    for (let i = 0; i < sourceUrls.length; i++) {
      const b64 = await convertImageToBase64DataUrl(sourceUrls[i]);
      if (b64) {
        sourceImagesBase64[`image ${i + 1}`] = b64;
      }
    }

    // 2. Ekstrak dan konversi result images ke Base64
    const resultUrls = parseUrls(record.result_image_url);
    const resultImagesBase64: Record<string, string> = {};
    for (let i = 0; i < resultUrls.length; i++) {
      const b64 = await convertImageToBase64DataUrl(resultUrls[i]);
      if (b64) {
        const key = resultUrls.length === 1 ? 'result_image' : `result_image ${i + 1}`;
        resultImagesBase64[key] = b64;
      }
    }

    // Parse request & response payloads
    let parsedRequest: unknown = record.request_payload;
    try {
      if (typeof record.request_payload === 'string') {
        parsedRequest = JSON.parse(record.request_payload);
      }
    } catch {}

    let parsedResponse: unknown = record.response_payload;
    try {
      if (typeof record.response_payload === 'string') {
        parsedResponse = JSON.parse(record.response_payload);
      }
    } catch {}

    const filenameBase = `riwayat_${record.id}_${record.type}_${record.model.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Format JSON murni (tanpa duplikasi data Base64 di payload)
    const exportJson = {
      id: record.id,
      type: record.type,
      endpoint: record.endpoint,
      model: record.model,
      prompt: record.prompt,
      size: record.size || null,
      status_code: record.status_code,
      created_at: record.created_at,
      error_message: record.error_message || null,
      source_image_name: record.source_image_name || null,
      source_image_size: record.source_image_size || null,
      images: sourceImagesBase64,
      result_images: resultImagesBase64,
      request_payload: sanitizePayloadForExport(parsedRequest, 'request'),
      response_payload: sanitizePayloadForExport(parsedResponse, 'response'),
    };

    return new NextResponse(JSON.stringify(exportJson, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filenameBase}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    console.error('[export] Failed to export history record:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses ekspor: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
