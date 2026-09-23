import type { DatabaseSync } from 'node:sqlite';
import { parseUrls } from './utils';

/**
 * Utilitas untuk membersihkan duplikasi Base64 dan URL mentah berukuran raksasa dari objek payload.
 * Hanya mengganti data Base64 / URL JIKA gambar telah dipastikan berhasil tersimpan di file lokal disk (/uploads/...).
 */

/**
 * Membersihkan objek payload response AI setelah gambar hasil dipastikan tersimpan di disk lokal.
 * @param payload Objek response asli dari upstream AI
 * @param savedResultUrls Daftar path file lokal (/uploads/...png) yang berhasil disimpan
 */
export function sanitizeResponsePayloadAfterSave(
  payload: unknown,
  savedResultUrls: string[]
): unknown {
  if (!payload || typeof payload !== 'object') return payload;

  const validLocalUrls = savedResultUrls.filter((u) => typeof u === 'string' && u.startsWith('/uploads/'));
  if (validLocalUrls.length === 0) {
    // Jika tidak ada gambar yang berhasil disimpan ke lokal, jangan hilangkan data asli
    return payload;
  }

  return sanitizePayloadRecursive(payload, validLocalUrls, 'response');
}

/**
 * Membersihkan objek payload request AI setelah gambar sumber dipastikan tersimpan di disk lokal.
 * @param payload Objek request asli
 * @param savedSourceUrls Daftar path file lokal (/uploads/...png) gambar sumber
 */
function sanitizeRequestPayloadAfterSave(
  payload: unknown,
  savedSourceUrls: string[]
): unknown {
  if (!payload || typeof payload !== 'object') return payload;

  const validLocalUrls = savedSourceUrls.filter((u) => typeof u === 'string' && u.startsWith('/uploads/'));
  if (validLocalUrls.length === 0) {
    return payload;
  }

  return sanitizePayloadRecursive(payload, validLocalUrls, 'request');
}

function sanitizePayloadRecursive(
  node: unknown,
  savedUrls: string[],
  direction: 'request' | 'response',
  indexHint: number = 0
): unknown {
  if (!node || typeof node !== 'object') return node;

  if (Array.isArray(node)) {
    return node.map((item, idx) => sanitizePayloadRecursive(item, savedUrls, direction, idx));
  }

  const result: Record<string, unknown> = {};
  const matchedLocalUrl = savedUrls[indexHint] || savedUrls[0];

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    if (typeof value === 'string') {
      const isBase64Key = ['b64_json', 'base64', 'image_base64'].includes(lowerKey);
      const isDataUri = value.startsWith('data:image/');
      const isHugeBase64 = value.length > 500 && /^[A-Za-z0-9+/=\s]+$/.test(value.slice(0, 100));

      // Jika field berupa Base64 gambar
      if (isBase64Key || isDataUri || isHugeBase64) {
        if (matchedLocalUrl && matchedLocalUrl.startsWith('/uploads/')) {
          result[key] = `[Data gambar Base64 telah dipindahkan menjadi file lokal di: ${matchedLocalUrl}]`;
          continue;
        }
      }

      // Jika field berupa URL upstream eksternal (misal CDN OpenAI yang memiliki batas waktu kadaluarsa)
      const isRemoteUrl = value.startsWith('http://') || value.startsWith('https://');
      if (isRemoteUrl && (lowerKey === 'url' || lowerKey.includes('image_url'))) {
        if (matchedLocalUrl && matchedLocalUrl.startsWith('/uploads/') && matchedLocalUrl !== value) {
          result[key] = `[URL gambar upstream telah diunduh dan dipindahkan menjadi file lokal di: ${matchedLocalUrl}]`;
          continue;
        }
      }
    }

    if (typeof value === 'object' && value !== null) {
      result[key] = sanitizePayloadRecursive(value, savedUrls, direction, indexHint);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Menyisir dan membersihkan baris riwayat lama di SQLite yang masih menyimpan Base64 jutaan karakter,
 * tetapi gambar fisiknya SUDAH tersimpan rapi di disk lokal (/uploads/...).
 * Menghasilkan penghematan ruang database yang masif.
 */
export function cleanStoredPayloadsInDb(db: DatabaseSync): { cleanedCount: number; freedBytes: number } {
  try {
    const rows = db.prepare(`
      SELECT id, result_image_url, response_payload, request_payload 
      FROM api_hits 
      WHERE LENGTH(response_payload) > 3000 OR LENGTH(request_payload) > 3000
    `).all() as Array<{
      id: number;
      result_image_url: string | null;
      response_payload: string | null;
      request_payload: string | null;
    }>;

    let cleanedCount = 0;
    let freedBytes = 0;

    for (const row of rows) {
      const localUrls = parseUrls(row.result_image_url).filter((u) => u.startsWith('/uploads/'));
      if (localUrls.length === 0) continue;

      let nextResponseStr = row.response_payload;
      let nextRequestStr = row.request_payload;
      let modified = false;

      if (row.response_payload && row.response_payload.length > 3000) {
        try {
          const parsed = JSON.parse(row.response_payload);
          const sanitized = sanitizeResponsePayloadAfterSave(parsed, localUrls);
          nextResponseStr = JSON.stringify(sanitized);
          freedBytes += row.response_payload.length - nextResponseStr.length;
          modified = true;
        } catch {}
      }

      if (row.request_payload && row.request_payload.length > 3000) {
        try {
          const parsed = JSON.parse(row.request_payload);
          const sanitized = sanitizeRequestPayloadAfterSave(parsed, localUrls);
          nextRequestStr = JSON.stringify(sanitized);
          freedBytes += row.request_payload.length - nextRequestStr.length;
          modified = true;
        } catch {}
      }

      if (modified) {
        db.prepare(`
          UPDATE api_hits 
          SET response_payload = ?, request_payload = ? 
          WHERE id = ?
        `).run(nextResponseStr, nextRequestStr, row.id);
        cleanedCount++;
      }
    }

    // Jika ada yang dibersihkan, lakukan defragmentasi ringan SQLite
    if (cleanedCount > 0) {
      try {
        db.exec('PRAGMA optimize;');
      } catch {}
    }

    return { cleanedCount, freedBytes };
  } catch (err) {
    console.error('[payloadSanitizer] Gagal membersihkan payload lama di DB:', err);
    return { cleanedCount: 0, freedBytes: 0 };
  }
}
