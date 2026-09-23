import fs from 'node:fs';
import path from 'node:path';
import { getDb, getUserSettings, getAllActiveImageUrls } from './db';
import { deletePhysicalFile } from './storage';

export interface RetentionResult {
  deletedHits: number;
  freedBytes: number;
  deletedFiles: string[];
  message: string;
}

function parseUrls(urlData: string | null | undefined): string[] {
  if (!urlData) return [];
  try {
    const parsed = JSON.parse(urlData);
    if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  } catch {}
  return [urlData].filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
}

/**
 * Menerapkan Kebijakan Retensi Otomatis (Auto-Retention Policy) untuk pengguna
 * - Menghapus item riwayat yang lebih tua dari retention_days (jika > 0)
 * - Menghapus item riwayat yang berada di luar kuota retention_max_items (jika > 0)
 * - Menghapus file fisik gambar yang tidak lagi dirujuk oleh riwayat manapun
 */
export function applyRetentionPolicy(userId: number): RetentionResult {
  const db = getDb();
  const settings = getUserSettings(userId);
  const { retention_days, retention_max_items } = settings;

  if (retention_days <= 0 && retention_max_items <= 0) {
    return {
      deletedHits: 0,
      freedBytes: 0,
      deletedFiles: [],
      message: 'Kebijakan retensi otomatis sedang dinonaktifkan (disimpan selamanya).',
    };
  }

  const candidateIds = new Set<number>();

  // 1. Ambil ID riwayat yang lebih tua dari batas retention_days
  if (retention_days > 0) {
    const daysStmt = db.prepare(`
      SELECT id FROM api_hits 
      WHERE user_id = ? AND datetime(created_at) < datetime('now', '-' || ? || ' days')
    `);
    const oldRows = daysStmt.all(userId, retention_days) as Array<{ id: number }>;
    for (const row of oldRows) {
      candidateIds.add(row.id);
    }
  }

  // 2. Ambil ID riwayat yang berada di luar kuota N item terbaru (retention_max_items)
  if (retention_max_items > 0) {
    const quotaStmt = db.prepare(`
      SELECT id FROM api_hits 
      WHERE user_id = ? 
      ORDER BY id DESC 
      LIMIT -1 OFFSET ?
    `);
    const excessRows = quotaStmt.all(userId, retention_max_items) as Array<{ id: number }>;
    for (const row of excessRows) {
      candidateIds.add(row.id);
    }
  }

  if (candidateIds.size === 0) {
    return {
      deletedHits: 0,
      freedBytes: 0,
      deletedFiles: [],
      message: 'Seluruh riwayat masih berada dalam batas kebijakan retensi.',
    };
  }

  const idsArray = Array.from(candidateIds);
  const placeholders = idsArray.map(() => '?').join(',');

  // Ambil URL gambar sebelum baris database dihapus
  const rowsStmt = db.prepare(`
    SELECT source_image_url, result_image_url 
    FROM api_hits 
    WHERE id IN (${placeholders}) AND user_id = ?
  `);
  const candidateRows = rowsStmt.all(...idsArray, userId) as Array<{
    source_image_url: string | null;
    result_image_url: string | null;
  }>;

  const candidateImageUrls = new Set<string>();
  for (const row of candidateRows) {
    for (const u of parseUrls(row.source_image_url)) {
      if (u.startsWith('/uploads/')) candidateImageUrls.add(u);
    }
    for (const u of parseUrls(row.result_image_url)) {
      if (u.startsWith('/uploads/')) candidateImageUrls.add(u);
    }
  }

  // Hapus entri dari tabel api_hits
  const deleteStmt = db.prepare(`
    DELETE FROM api_hits 
    WHERE id IN (${placeholders}) AND user_id = ?
  `);
  const deleteRes = deleteStmt.run(...idsArray, userId);
  const deletedHits = Number(deleteRes.changes);

  // Periksa file gambar yang tidak lagi dirujuk oleh riwayat aktif manapun
  const remainingActiveUrls = new Set(getAllActiveImageUrls());
  let freedBytes = 0;
  const deletedFiles: string[] = [];

  const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

  for (const url of candidateImageUrls) {
    if (!remainingActiveUrls.has(url)) {
      const filename = path.basename(url);
      const filePath = path.join(UPLOAD_DIR, filename);
      try {
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          freedBytes += stat.size;
        }
      } catch {}

      if (deletePhysicalFile(url)) {
        deletedFiles.push(filename);
      }
    }
  }

  return {
    deletedHits,
    freedBytes,
    deletedFiles,
    message: `Kebijakan retensi berhasil diterapkan: ${deletedHits} riwayat lama dibersihkan (${deletedFiles.length} file gambar fisik terhapus).`,
  };
}
