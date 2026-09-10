import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'manage_image_ai.db');

// Ensure directory exists
function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}
ensureDbDir();

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  ensureDbDir();

  // Jika koneksi sudah ada tetapi file DB dihapus dari disk, reset koneksi
  if (dbInstance && !fs.existsSync(DB_PATH)) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }

  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_hits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt TEXT NOT NULL,
      size TEXT,
      source_image_name TEXT,
      source_image_size INTEGER,
      source_image_url TEXT,
      request_payload TEXT,
      status_code INTEGER,
      response_payload TEXT,
      result_image_url TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_api_hits_type ON api_hits(type);
    CREATE INDEX IF NOT EXISTS idx_api_hits_created_at ON api_hits(created_at DESC);

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
      api_token TEXT NOT NULL DEFAULT '',
      generations_model TEXT NOT NULL DEFAULT 'dall-e-3',
      edits_model TEXT NOT NULL DEFAULT 'dall-e-2',
      updated_at TEXT NOT NULL
    );
  `);

  // Seed default settings langsung dari data bawaan / dummy (tanpa ketergantungan pada file .env)
  try {
    const existing = db.prepare(`SELECT id FROM app_settings WHERE id = 1`).get();
    if (!existing) {
      const initialBaseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
      const initialToken = process.env.AI_API_TOKEN || 'sk-proj-dummyapikey1234567890abcdef';
      const initialGenModel = process.env.AI_GENERATIONS_MODEL || 'gpt-image-2.5';
      const initialEditModel = process.env.AI_EDITS_MODEL || 'gpt-image-2.5';
      db.prepare(`
        INSERT INTO app_settings (id, base_url, api_token, generations_model, edits_model, updated_at)
        VALUES (1, ?, ?, ?, ?, datetime('now', 'localtime'))
      `).run(initialBaseUrl, initialToken, initialGenModel, initialEditModel);
    }
  } catch {}
}

export interface ApiHitRecord {
  id: number;
  type: 'generation' | 'edit';
  endpoint: string;
  model: string;
  prompt: string;
  size?: string | null;
  source_image_name?: string | null;
  source_image_size?: number | null;
  source_image_url?: string | null;
  request_payload?: string | null;
  status_code: number;
  response_payload?: string | null;
  result_image_url?: string | null;
  error_message?: string | null;
  created_at: string;
}

export interface CreateApiHitInput {
  type: 'generation' | 'edit';
  endpoint: string;
  model: string;
  prompt: string;
  size?: string;
  source_image_name?: string;
  source_image_size?: number;
  source_image_url?: string;
  request_payload?: Record<string, unknown> | string;
  status_code: number;
  response_payload?: unknown;
  result_image_url?: string;
  error_message?: string;
}

export function saveApiHit(data: CreateApiHitInput): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO api_hits (
      type, endpoint, model, prompt, size,
      source_image_name, source_image_size, source_image_url,
      request_payload, status_code, response_payload,
      result_image_url, error_message, created_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, datetime('now', 'localtime')
    )
  `);

  const requestPayloadStr = typeof data.request_payload === 'string'
    ? data.request_payload
    : JSON.stringify(data.request_payload ?? {});

  const responsePayloadStr = typeof data.response_payload === 'string'
    ? data.response_payload
    : JSON.stringify(data.response_payload ?? {});

  const result = stmt.run(
    data.type,
    data.endpoint,
    data.model,
    data.prompt,
    data.size ?? null,
    data.source_image_name ?? null,
    data.source_image_size ?? null,
    data.source_image_url ?? null,
    requestPayloadStr,
    data.status_code,
    responsePayloadStr,
    data.result_image_url ?? null,
    data.error_message ?? null
  );

  return Number(result.lastInsertRowid);
}

export function getApiHits(options?: { type?: string; limit?: number; offset?: number }): ApiHitRecord[] {
  const db = getDb();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  if (options?.type && options.type !== 'all') {
    const stmt = db.prepare(`
      SELECT * FROM api_hits
      WHERE type = ?
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(options.type, limit, offset) as unknown as ApiHitRecord[];
  }

  const stmt = db.prepare(`
    SELECT * FROM api_hits
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset) as unknown as ApiHitRecord[];
}

export function getApiHitById(id: number): ApiHitRecord | null {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM api_hits WHERE id = ?`);
  const row = stmt.get(id);
  return (row as unknown as ApiHitRecord) ?? null;
}

export function deleteApiHit(id: number): boolean {
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM api_hits WHERE id = ?`);
  const res = stmt.run(id);
  return res.changes > 0;
}

export function updateApiHitResultImage(id: number, resultImageUrl: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`UPDATE api_hits SET result_image_url = ? WHERE id = ?`);
  const res = stmt.run(resultImageUrl, id);
  return res.changes > 0;
}

export function clearApiHits(type?: string): number {
  const db = getDb();
  if (type && type !== 'all') {
    const stmt = db.prepare(`DELETE FROM api_hits WHERE type = ?`);
    const res = stmt.run(type);
    return Number(res.changes);
  }
  const stmt = db.prepare(`DELETE FROM api_hits`);
  const res = stmt.run();
  return Number(res.changes);
}

export function getApiHitsCount(type?: string): number {
  const db = getDb();
  if (type && type !== 'all') {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM api_hits WHERE type = ?`);
    const row = stmt.get(type) as { count: number } | undefined;
    return Number(row?.count ?? 0);
  }
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM api_hits`);
  const row = stmt.get() as { count: number } | undefined;
  return Number(row?.count ?? 0);
}

export function getHistorySummaryCounts(): { all: number; generation: number; edit: number } {
  const db = getDb();
  const allStmt = db.prepare(`SELECT COUNT(*) as count FROM api_hits`);
  const genStmt = db.prepare(`SELECT COUNT(*) as count FROM api_hits WHERE type = 'generation'`);
  const editStmt = db.prepare(`SELECT COUNT(*) as count FROM api_hits WHERE type = 'edit'`);

  const allRow = allStmt.get() as { count: number } | undefined;
  const genRow = genStmt.get() as { count: number } | undefined;
  const editRow = editStmt.get() as { count: number } | undefined;

  return {
    all: Number(allRow?.count ?? 0),
    generation: Number(genRow?.count ?? 0),
    edit: Number(editRow?.count ?? 0),
  };
}

export function getAllActiveImageUrls(): string[] {
  const db = getDb();
  const stmt = db.prepare(`SELECT source_image_url, result_image_url FROM api_hits`);
  const rows = stmt.all() as Array<{ source_image_url?: string | null; result_image_url?: string | null }>;

  const urls = new Set<string>();

  for (const row of rows) {
    const parseField = (val?: string | null) => {
      if (!val) return;
      if (val.startsWith('[')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (typeof item === 'string' && item.startsWith('/uploads/')) {
                urls.add(item);
              }
            }
            return;
          }
        } catch {}
      }
      if (val.startsWith('/uploads/')) {
        urls.add(val);
      }
    };

    parseField(row.source_image_url);
    parseField(row.result_image_url);
  }

  return Array.from(urls);
}

export interface AppSettings {
  id: number;
  base_url: string;
  api_token: string;
  generations_model: string;
  edits_model: string;
  updated_at: string;
}

export function getAppSettings(): AppSettings {
  const db = getDb();
  let row = db.prepare(`SELECT * FROM app_settings WHERE id = 1`).get() as unknown as AppSettings | undefined;

  if (!row) {
    const initialBaseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    const initialToken = process.env.AI_API_TOKEN || '';
    const initialGenModel = process.env.AI_GENERATIONS_MODEL || 'dall-e-3';
    const initialEditModel = process.env.AI_EDITS_MODEL || 'dall-e-2';

    db.prepare(`
      INSERT INTO app_settings (id, base_url, api_token, generations_model, edits_model, updated_at)
      VALUES (1, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(initialBaseUrl, initialToken, initialGenModel, initialEditModel);

    row = db.prepare(`SELECT * FROM app_settings WHERE id = 1`).get() as unknown as AppSettings;
  }

  return row;
}

export function updateAppSettings(input: {
  base_url?: string;
  api_token?: string;
  generations_model?: string;
  edits_model?: string;
}): AppSettings {
  const current = getAppSettings();
  const nextBaseUrl = input.base_url !== undefined ? input.base_url.trim() : current.base_url;
  const nextApiToken = input.api_token !== undefined ? input.api_token.trim() : current.api_token;
  const nextGenModel = input.generations_model !== undefined ? input.generations_model.trim() : current.generations_model;
  const nextEditModel = input.edits_model !== undefined ? input.edits_model.trim() : current.edits_model;

  const db = getDb();
  db.prepare(`
    UPDATE app_settings
    SET base_url = ?, api_token = ?, generations_model = ?, edits_model = ?, updated_at = datetime('now', 'localtime')
    WHERE id = 1
  `).run(nextBaseUrl, nextApiToken, nextGenModel, nextEditModel);

  return getAppSettings();
}
