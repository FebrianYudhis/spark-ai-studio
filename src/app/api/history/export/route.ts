import { NextRequest, NextResponse } from 'next/server';
import { getApiHitById } from '@/lib/db';
import { convertImageToBase64DataUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

function parseUrls(urlData: string | null | undefined): string[] {
  if (!urlData) return [];
  try {
    const parsed = JSON.parse(urlData);
    if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  } catch {}
  return [urlData].filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const format = (searchParams.get('format') || 'json').toLowerCase();

    if (!idParam || isNaN(Number(idParam))) {
      return NextResponse.json({ error: 'Parameter id riwayat wajib disertakan' }, { status: 400 });
    }

    const record = getApiHitById(Number(idParam));
    if (!record) {
      return NextResponse.json({ error: 'Data riwayat tidak ditemukan' }, { status: 404 });
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

    // 3. Format CSV
    if (format === 'csv') {
      const csvData: Record<string, unknown> = {
        id: record.id,
        type: record.type,
        endpoint: record.endpoint,
        model: record.model,
        prompt: record.prompt,
        size: record.size || '',
        status_code: record.status_code,
        created_at: record.created_at,
        error_message: record.error_message || '',
      };

      // Tambahkan URL lokal gambar sumber & hasil ke kolom CSV
      sourceUrls.forEach((url, i) => {
        csvData[`image_${i + 1}_url`] = url;
      });
      resultUrls.forEach((url, i) => {
        const colName = resultUrls.length === 1 ? 'result_image_url' : `result_image_${i + 1}_url`;
        csvData[colName] = url;
      });

      // Tambahkan Base64 dengan proteksi batas 32.767 karakter sel spreadsheet (Excel/Calc)
      const MAX_CSV_CELL_LENGTH = 32000;
      Object.entries(sourceImagesBase64).forEach(([layerKey, b64]) => {
        const colName = layerKey.replace(' ', '_') + '_base64';
        csvData[colName] = b64.length <= MAX_CSV_CELL_LENGTH
          ? b64
          : `[Base64 melebihi batas 32KB sel Excel (${(b64.length / 1024).toFixed(1)} KB) - gunakan ekspor format JSON untuk Base64 penuh]`;
      });

      Object.entries(resultImagesBase64).forEach(([resultKey, b64]) => {
        const colName = resultKey.replace(' ', '_') + '_base64';
        csvData[colName] = b64.length <= MAX_CSV_CELL_LENGTH
          ? b64
          : `[Base64 melebihi batas 32KB sel Excel (${(b64.length / 1024).toFixed(1)} KB) - gunakan ekspor format JSON untuk Base64 penuh]`;
      });

      csvData['request_payload'] = parsedRequest;
      csvData['response_payload'] = parsedResponse;

      const headers = Object.keys(csvData);
      const row = headers.map((key) => escapeCsvCell(csvData[key]));

      const csvContent = '\uFEFF' + headers.map((h) => `"${h}"`).join(',') + '\r\n' + row.join(',') + '\r\n';

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filenameBase}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 4. Format JSON (default)
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
      request_payload: parsedRequest,
      response_payload: parsedResponse,
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
      { status: 500 }
    );
  }
}
