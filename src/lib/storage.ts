import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export function ensureUploadsDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}
ensureUploadsDir();

export async function saveUploadedFile(file: File, prefix: string = 'edit'): Promise<{
  filename: string;
  size: number;
  url: string;
  buffer: Buffer;
  fileType: string;
}> {
  ensureUploadsDir();
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${prefix}_${timestamp}_${safeName}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  fs.writeFileSync(filePath, buffer);

  return {
    filename: file.name,
    size: buffer.length,
    url: `/uploads/${filename}`,
    buffer,
    fileType: file.type || 'image/png',
  };
}

export function extractImageStrings(responseData: any): string[] {
  if (!responseData) return [];
  const results: string[] = [];

  // 1. Standar OpenAI: data: [ { url: '...' }, { b64_json: '...' } ]
  if (Array.isArray(responseData.data)) {
    for (const item of responseData.data) {
      if (typeof item === 'string') {
        results.push(item);
      } else if (item && typeof item === 'object') {
        const val = item.url || item.b64_json || item.image || item.base64;
        if (val && typeof val === 'string') results.push(val);
      }
    }
  }

  // 2. Format Provider Alternatif: images: [ ... ]
  if (Array.isArray(responseData.images)) {
    for (const item of responseData.images) {
      if (typeof item === 'string') results.push(item);
      else if (item?.url) results.push(item.url);
      else if (item?.b64_json) results.push(item.b64_json);
      else if (item?.image) results.push(item.image);
    }
  }

  // 3. Field tunggal gambar di root: image / url / b64_json
  if (typeof responseData.image === 'string') results.push(responseData.image);
  if (typeof responseData.url === 'string') results.push(responseData.url);
  if (typeof responseData.b64_json === 'string') results.push(responseData.b64_json);

  // 4. Format Output Replicate / AI Gateway lainnya
  if (Array.isArray(responseData.output)) {
    for (const item of responseData.output) {
      if (typeof item === 'string') results.push(item);
    }
  } else if (typeof responseData.output === 'string') {
    results.push(responseData.output);
  }

  return results;
}

/**
 * Mengunduh buffer gambar dari URL remote dengan dukungan redirect dan toleransi SSL proxy
 */
function downloadRemoteBuffer(url: string, maxRedirects = 3): Promise<{ buffer: Buffer; contentType: string } | null> {
  return new Promise((resolve) => {
    if (maxRedirects < 0) {
      console.warn(`[storage] Too many redirects for: ${url}`);
      return resolve(null);
    }

    try {
      const client = url.startsWith('https:') ? https : http;
      const req = client.get(
        url,
        {
          rejectUnauthorized: false,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
          timeout: 45000,
        },
        (res) => {
          // Ikuti redirect 301, 302, 307, 308
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, url).toString();
            return resolve(downloadRemoteBuffer(redirectUrl, maxRedirects - 1));
          }

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            console.warn(`[storage] Failed downloading image HTTP ${res.statusCode}: ${url}`);
            return resolve(null);
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            if (buffer.length === 0) {
              console.warn(`[storage] Downloaded empty 0 bytes for: ${url}`);
              return resolve(null);
            }
            const contentType = (res.headers['content-type'] as string) || 'image/png';
            resolve({ buffer, contentType });
          });
          res.on('error', (err) => {
            console.error('[storage] Stream error downloading image:', err);
            resolve(null);
          });
        }
      );

      req.on('error', (err) => {
        console.error('[storage] Request error downloading image:', err);
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        console.warn(`[storage] Timeout downloading image: ${url}`);
        resolve(null);
      });
    } catch (err) {
      console.error('[storage] Exception in downloadRemoteBuffer:', err);
      resolve(null);
    }
  });
}

/**
 * Menyimpan gambar (baik remote URL maupun base64) ke disk lokal di public/uploads/.
 * HANYA mengembalikan path lokal (contoh: '/uploads/result_123.png') jika berhasil disimpan.
 * Jika gagal disimpan, mengembalikan undefined (link asli tetap aman di response payload).
 */
export async function saveRemoteOrBase64Image(
  urlOrBase64: string,
  prefix: string = 'result'
): Promise<string | undefined> {
  try {
    ensureUploadsDir();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 7);

    // Jika sudah merupakan path lokal uploads, gunakan langsung
    if (urlOrBase64.startsWith('/uploads/')) {
      return urlOrBase64;
    }

    const isDataUri = urlOrBase64.startsWith('data:image/');
    const isHttp = urlOrBase64.startsWith('http://') || urlOrBase64.startsWith('https://');

    // 1. Deteksi BASE64 (baik data URI maupun raw string base64 dari b64_json)
    if (isDataUri || !isHttp) {
      const cleanBase64 = urlOrBase64.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '').trim();
      const buffer = Buffer.from(cleanBase64, 'base64');

      let ext = 'png';
      const match = urlOrBase64.match(/^data:image\/([a-zA-Z+.-]+);base64,/);
      if (match && match[1]) {
        ext = match[1].replace('jpeg', 'jpg');
      }

      const filename = `${prefix}_${timestamp}_${randomSuffix}.${ext}`;
      const filePath = path.join(UPLOAD_DIR, filename);
      fs.writeFileSync(filePath, buffer);
      return `/uploads/${filename}`;
    }

    // 2. Deteksi REMOTE URL (HTTP / HTTPS)
    const downloaded = await downloadRemoteBuffer(urlOrBase64);
    if (!downloaded || downloaded.buffer.length === 0) {
      console.warn(`[storage] Gambar dari URL remote gagal diunduh ke lokal: ${urlOrBase64}`);
      // Jangan kembalikan link asli eksternal!
      return undefined;
    }

    let ext = 'png';
    const ct = downloaded.contentType.toLowerCase();
    if (ct.includes('jpeg') || ct.includes('jpg')) ext = 'jpg';
    else if (ct.includes('webp')) ext = 'webp';
    else if (ct.includes('gif')) ext = 'gif';

    const filename = `${prefix}_${timestamp}_${randomSuffix}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, downloaded.buffer);
    return `/uploads/${filename}`;
  } catch (error) {
    console.error('Failed to cache image locally:', error);
    // Jangan kembalikan link asli eksternal!
    return undefined;
  }
}

export interface StorageStats {
  totalFiles: number;
  totalSizeBytes: number;
  activeFiles: number;
  activeSizeBytes: number;
  orphanedFiles: number;
  orphanedSizeBytes: number;
}

/**
 * Menghapus 1 file fisik dari direktori /public/uploads/ secara aman
 */
export function deletePhysicalFile(urlOrFilename: string): boolean {
  try {
    const filename = path.basename(urlOrFilename);
    if (!filename || filename === '.' || filename === '..') return false;
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[storage] Failed to delete file: ${urlOrFilename}`, err);
    return false;
  }
}

/**
 * Menghitung statistik penggunaan disk pada folder /public/uploads/
 */
export function getStorageStats(activeUrls: string[]): StorageStats {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      return { totalFiles: 0, totalSizeBytes: 0, activeFiles: 0, activeSizeBytes: 0, orphanedFiles: 0, orphanedSizeBytes: 0 };
    }

    const activeBasenames = new Set(
      activeUrls.map((u) => path.basename(u)).filter(Boolean)
    );

    const files = fs.readdirSync(UPLOAD_DIR);
    let totalFiles = 0;
    let totalSizeBytes = 0;
    let activeFiles = 0;
    let activeSizeBytes = 0;
    let orphanedFiles = 0;
    let orphanedSizeBytes = 0;

    for (const file of files) {
      if (file.startsWith('.')) continue;

      const filePath = path.join(UPLOAD_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          totalFiles++;
          totalSizeBytes += stat.size;

          if (activeBasenames.has(file)) {
            activeFiles++;
            activeSizeBytes += stat.size;
          } else {
            orphanedFiles++;
            orphanedSizeBytes += stat.size;
          }
        }
      } catch {}
    }

    return {
      totalFiles,
      totalSizeBytes,
      activeFiles,
      activeSizeBytes,
      orphanedFiles,
      orphanedSizeBytes,
    };
  } catch (err) {
    console.error('[storage] Error getting storage stats:', err);
    return { totalFiles: 0, totalSizeBytes: 0, activeFiles: 0, activeSizeBytes: 0, orphanedFiles: 0, orphanedSizeBytes: 0 };
  }
}

/**
 * Menghapus seluruh file orphaned (file di uploads yang tidak terdaftar di database SQLite)
 */
export function cleanupOrphanedFiles(activeUrls: string[]): { deletedCount: number; freedBytes: number; deletedFiles: string[] } {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      return { deletedCount: 0, freedBytes: 0, deletedFiles: [] };
    }

    const activeBasenames = new Set(
      activeUrls.map((u) => path.basename(u)).filter(Boolean)
    );

    const files = fs.readdirSync(UPLOAD_DIR);
    let deletedCount = 0;
    let freedBytes = 0;
    const deletedFiles: string[] = [];

    for (const file of files) {
      if (file.startsWith('.')) continue;

      if (!activeBasenames.has(file)) {
        const filePath = path.join(UPLOAD_DIR, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            const size = stat.size;
            fs.unlinkSync(filePath);
            deletedCount++;
            freedBytes += size;
            deletedFiles.push(file);
          }
        } catch (e) {
          console.error(`[storage] Failed to delete orphaned file ${file}:`, e);
        }
      }
    }

    return { deletedCount, freedBytes, deletedFiles };
  } catch (err) {
    console.error('[storage] Error cleaning orphaned files:', err);
    return { deletedCount: 0, freedBytes: 0, deletedFiles: [] };
  }
}

/**
 * Menghapus seluruh file di folder /public/uploads/
 */
export function cleanupAllUploadFiles(): { deletedCount: number; freedBytes: number } {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      return { deletedCount: 0, freedBytes: 0 };
    }

    const files = fs.readdirSync(UPLOAD_DIR);
    let deletedCount = 0;
    let freedBytes = 0;

    for (const file of files) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(UPLOAD_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          freedBytes += stat.size;
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch {}
    }

    return { deletedCount, freedBytes };
  } catch (err) {
    console.error('[storage] Error cleaning all upload files:', err);
    return { deletedCount: 0, freedBytes: 0 };
  }
}
