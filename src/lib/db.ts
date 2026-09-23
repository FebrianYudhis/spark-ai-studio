import './suppressWarnings';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { cleanStoredPayloadsInDb } from './payloadSanitizer';
import { parseUrls } from './utils';
import { DEFAULT_ENHANCER_PROMPT, DEFAULT_MODEL, DEFAULT_BASE_URL, DEFAULT_ENHANCER_MODEL } from './models';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'spark_ai_studio.db');
const LEGACY_DB_PATH = path.join(DB_DIR, 'manage_image_ai.db');

// Ensure directory exists & migrate legacy DB file if needed
function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Migrasi otomatis dari manage_image_ai.db ke spark_ai_studio.db jika ada
  if (!fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB_PATH)) {
    try {
      fs.renameSync(LEGACY_DB_PATH, DB_PATH);
      console.log(`[db] Migrated legacy database ${LEGACY_DB_PATH} -> ${DB_PATH}`);
    } catch {
      try {
        fs.copyFileSync(LEGACY_DB_PATH, DB_PATH);
        fs.unlinkSync(LEGACY_DB_PATH);
      } catch (err) {
        console.error('[db] Failed to migrate legacy database file:', err);
      }
    }
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
  try {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
    `);
  } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
      api_token TEXT NOT NULL DEFAULT '',
      generations_model TEXT NOT NULL DEFAULT 'gpt-image-2.5',
      edits_model TEXT NOT NULL DEFAULT 'gpt-image-2.5',
      enhancer_base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
      enhancer_api_token TEXT NOT NULL DEFAULT '',
      enhancer_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
      enhancer_prompt TEXT NOT NULL DEFAULT '',
      retention_days INTEGER NOT NULL DEFAULT 0,
      retention_max_items INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_hits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
    CREATE INDEX IF NOT EXISTS idx_api_hits_user ON api_hits(user_id);
     CREATE INDEX IF NOT EXISTS idx_api_hits_created_at ON api_hits(created_at DESC);

    CREATE TABLE IF NOT EXISTS config_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      settings_snapshot TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      responded_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_config_shares_to_user ON config_shares(to_user_id);
  `);

  // Migrasi otomatis kolom user_id pada api_hits jika tabel lama belum memiliki user_id
  let migratedUserIdColumn = false;
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(api_hits)`).all() as Array<{ name: string }>;
    const hasUserId = tableInfo.some((col) => col.name === 'user_id');
    if (!hasUserId) {
      db.exec(`ALTER TABLE api_hits ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
      migratedUserIdColumn = true;
    }
  } catch {}

  // Bersihkan riwayat lama tanpa relasi user HANYA sekali saat migrasi kolom user_id di atas.
  if (migratedUserIdColumn) {
    try {
      db.exec(`DELETE FROM api_hits WHERE user_id IS NULL`);
    } catch {}
  }

  // Migrasi otomatis untuk menambahkan kolom enhancer jika tabel sudah ada sebelumnya
  const alterMigrations = [
    `ALTER TABLE user_settings ADD COLUMN retention_days INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE user_settings ADD COLUMN retention_max_items INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const sql of alterMigrations) {
    try {
      db.exec(sql);
    } catch {}
  }

  // Buang tabel lama yang sudah tidak dipakai lagi (settings global & rate limit di memori)
  try {
    db.exec(`DROP TABLE IF EXISTS app_settings; DROP TABLE IF EXISTS rate_limit_attempts;`);
  } catch {}

  // Migrasi otomatis: sesuaikan format ringkasan nama gambar pada data riwayat lama ke format baru [image 1: ...]
  try {
    const legacyRows = db.prepare(`SELECT id, source_image_name FROM api_hits WHERE source_image_name LIKE '%[primary:%'`).all() as Array<{ id: number; source_image_name: string }>;
    for (const row of legacyRows) {
      if (!row.source_image_name) continue;
      let updated = row.source_image_name;
      if (updated.includes('tambahan:')) {
        const parts = updated.split('tambahan:');
        const primaryPart = parts[0].replace(/\[primary:\s*/g, '[image 1: ');
        const additionalPart = parts[1].replace(/\[image\s+(\d+):/g, (_, n) => `[image ${Number(n) + 1}:`);
        updated = `${primaryPart}tambahan:${additionalPart}`;
      } else {
        updated = updated.replace(/\[primary:\s*/g, '[image 1: ');
      }
      db.prepare(`UPDATE api_hits SET source_image_name = ? WHERE id = ?`).run(updated, row.id);
    }
  } catch {}

  // Pembersihan otomatis sesi-sesi kadaluarsa (orphaned sessions) saat startup database
  try {
    const nowIso = new Date().toISOString();
    db.prepare(`
      DELETE FROM sessions 
      WHERE datetime(expires_at) <= datetime(?)
    `).run(nowIso);
  } catch {}

  // Pembersihan otomatis payload Base64 raksasa pada riwayat lama jika file gambar sudah tersimpan di /uploads/
  try {
    const result = cleanStoredPayloadsInDb(db);
    if (result.cleanedCount > 0) {
      db.exec('VACUUM;');
      console.log(`[db] Berhasil membersihkan Base64 dari ${result.cleanedCount} riwayat lama (${(result.freedBytes / 1024 / 1024).toFixed(2)} MB dibebaskan).`);
    }
  } catch {}
}

export interface ApiHitRecord {
  id: number;
  user_id?: number | null;
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
  user_id?: number | null;
  userId?: number | null;
  type: 'generation' | 'edit';
  endpoint: string;
  model: string;
  prompt: string;
  size?: string;
  source_image_name?: string;
  sourceImageName?: string;
  source_image_size?: number;
  sourceImageSize?: number;
  source_image_url?: string;
  sourceImageUrl?: string;
  request_payload?: Record<string, unknown> | string;
  requestPayload?: Record<string, unknown> | string;
  status_code?: number;
  statusCode?: number;
  response_payload?: unknown;
  responsePayload?: unknown;
  result_image_url?: string;
  resultImageUrl?: string;
  error_message?: string;
  errorMessage?: string;
  created_at?: string;
  createdAt?: string;
}

export function saveApiHit(data: CreateApiHitInput): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO api_hits (
      user_id, type, endpoint, model, prompt, size,
      source_image_name, source_image_size, source_image_url,
      request_payload, status_code, response_payload,
      result_image_url, error_message, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?
    )
  `);

  const reqPayload = data.request_payload ?? data.requestPayload;
  const requestPayloadStr = typeof reqPayload === 'string'
    ? reqPayload
    : JSON.stringify(reqPayload ?? {});

  const resPayload = data.response_payload ?? data.responsePayload;
  const responsePayloadStr = typeof resPayload === 'string'
    ? resPayload
    : JSON.stringify(resPayload ?? {});

  const userId = data.user_id !== undefined ? data.user_id : (data.userId !== undefined ? data.userId : null);
  const statusCode = Number(data.status_code ?? data.statusCode ?? 200);
  const sourceImageName = data.source_image_name ?? data.sourceImageName ?? null;
  const sourceImageSize = data.source_image_size !== undefined ? data.source_image_size : (data.sourceImageSize !== undefined ? data.sourceImageSize : null);
  const sourceImageUrl = data.source_image_url ?? data.sourceImageUrl ?? null;
  const resultImageUrl = data.result_image_url ?? data.resultImageUrl ?? null;
  const errorMessage = data.error_message ?? data.errorMessage ?? null;
  const now = data.created_at ?? data.createdAt ?? new Date().toISOString();

  const result = stmt.run(
    userId,
    data.type || 'generation',
    data.endpoint || '',
    data.model || '',
    data.prompt || '',
    data.size ?? null,
    sourceImageName,
    sourceImageSize,
    sourceImageUrl,
    requestPayloadStr,
    statusCode,
    responsePayloadStr,
    resultImageUrl,
    errorMessage,
    now
  );

  return Number(result.lastInsertRowid);
}

export function getApiHits(options?: {
  userId?: number | null;
  type?: string;
  limit?: number;
  offset?: number;
  search?: string;
}): ApiHitRecord[] {
  const db = getDb();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const search = options?.search?.trim();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options?.userId !== undefined) {
    if (options.userId === null) {
      conditions.push(`user_id IS NULL`);
    } else {
      conditions.push(`user_id = ?`);
      params.push(options.userId);
    }
  }

  if (options?.type && options.type !== 'all') {
    conditions.push(`type = ?`);
    params.push(options.type);
  }

  if (search) {
    conditions.push(`(prompt LIKE ? OR model LIKE ? OR source_image_name LIKE ?)`);
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = db.prepare(`
    SELECT * FROM api_hits
    ${whereClause}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `);

  return stmt.all(...params, limit, offset) as unknown as ApiHitRecord[];
}

export function getApiHitById(id: number, userId?: number | null): ApiHitRecord | null {
  const db = getDb();
  if (userId !== undefined && userId !== null) {
    const stmt = db.prepare(`SELECT * FROM api_hits WHERE id = ? AND user_id = ?`);
    const row = stmt.get(id, userId);
    return (row as unknown as ApiHitRecord) ?? null;
  }
  const stmt = db.prepare(`SELECT * FROM api_hits WHERE id = ?`);
  const row = stmt.get(id);
  return (row as unknown as ApiHitRecord) ?? null;
}

export function deleteApiHit(id: number, userId?: number | null): boolean {
  const db = getDb();
  if (userId !== undefined && userId !== null) {
    const stmt = db.prepare(`DELETE FROM api_hits WHERE id = ? AND user_id = ?`);
    const res = stmt.run(id, userId);
    return res.changes > 0;
  }
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

export function clearApiHits(type?: string, userId?: number | null): number {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (userId !== undefined && userId !== null) {
    conditions.push(`user_id = ?`);
    params.push(userId);
  }

  if (type && type !== 'all') {
    conditions.push(`type = ?`);
    params.push(type);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = db.prepare(`DELETE FROM api_hits ${whereClause}`);
  const res = stmt.run(...params);
  return Number(res.changes);
}

export function getApiHitsCount(type?: string, search?: string, userId?: number | null): number {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (userId !== undefined && userId !== null) {
    conditions.push(`user_id = ?`);
    params.push(userId);
  }

  if (type && type !== 'all') {
    conditions.push(`type = ?`);
    params.push(type);
  }

  if (search && search.trim()) {
    conditions.push(`(prompt LIKE ? OR model LIKE ? OR source_image_name LIKE ?)`);
    const searchPattern = `%${search.trim()}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM api_hits ${whereClause}`);
  const row = stmt.get(...params) as { count: number } | undefined;
  return Number(row?.count ?? 0);
}

export function getHistorySummaryCounts(userId?: number | null): { all: number; generation: number; edit: number } {
  const db = getDb();
  if (userId !== undefined && userId !== null) {
    const allStmt = db.prepare(`SELECT COUNT(*) as count FROM api_hits WHERE user_id = ?`);
    const genStmt = db.prepare(`SELECT COUNT(*) as count FROM api_hits WHERE user_id = ? AND type = 'generation'`);
    const editStmt = db.prepare(`SELECT COUNT(*) as count FROM api_hits WHERE user_id = ? AND type = 'edit'`);

    return {
      all: Number((allStmt.get(userId) as { count: number } | undefined)?.count ?? 0),
      generation: Number((genStmt.get(userId) as { count: number } | undefined)?.count ?? 0),
      edit: Number((editStmt.get(userId) as { count: number } | undefined)?.count ?? 0),
    };
  }

  const allStmt = db.prepare(`SELECT COUNT(*) as count FROM api_hits`);
  const genStmt = db.prepare(`SELECT COUNT(*) as count FROM api_hits WHERE type = 'generation'`);
  const editStmt = db.prepare(`SELECT COUNT(*) as count FROM api_hits WHERE type = 'edit'`);

  return {
    all: Number((allStmt.get() as { count: number } | undefined)?.count ?? 0),
    generation: Number((genStmt.get() as { count: number } | undefined)?.count ?? 0),
    edit: Number((editStmt.get() as { count: number } | undefined)?.count ?? 0),
  };
}

export function getAllActiveImageUrls(): string[] {
  const db = getDb();
  const stmt = db.prepare(`SELECT source_image_url, result_image_url FROM api_hits`);
  const rows = stmt.all() as Array<{ source_image_url?: string | null; result_image_url?: string | null }>;

  const urls = new Set<string>();

  for (const row of rows) {
    for (const val of [row.source_image_url, row.result_image_url]) {
      for (const url of parseUrls(val)) {
        if (url.startsWith('/uploads/')) {
          urls.add(url);
        }
      }
    }
  }

  return Array.from(urls);
}

/**
 * Nilai default untuk user_settings milik akun baru, diambil dari variabel
 * lingkungan (opsional) dengan fallback ke konstanta bawaan. Token API sengaja
 * dikosongkan agar setiap pengguna mengisi kredensialnya sendiri.
 */
function getDefaultUserSettings() {
  return {
    base_url: process.env.AI_BASE_URL || DEFAULT_BASE_URL,
    generations_model: process.env.AI_GENERATIONS_MODEL || DEFAULT_MODEL,
    edits_model: process.env.AI_EDITS_MODEL || DEFAULT_MODEL,
    enhancer_base_url: process.env.AI_ENHANCER_BASE_URL || DEFAULT_BASE_URL,
    enhancer_model: process.env.AI_ENHANCER_MODEL || DEFAULT_ENHANCER_MODEL,
    enhancer_prompt: DEFAULT_ENHANCER_PROMPT,
  };
}

// ==========================================
// USER & AUTHENTICATION FUNCTIONS
// ==========================================

export interface UserRecord {
  id: number;
  username: string;
  display_name?: string | null;
  password_hash: string;
  salt: string;
  created_at: string;
}

export function createUser(input: {
  username: string;
  display_name?: string;
  password_hash: string;
  salt: string;
}): UserRecord {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO users (username, display_name, password_hash, salt, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    input.username.toLowerCase().trim(),
    input.display_name?.trim() || input.username.trim(),
    input.password_hash,
    input.salt,
    now
  );
  const userId = Number(res.lastInsertRowid);

  // Buat default user_settings untuk user baru (Private Studio)
  const defaults = getDefaultUserSettings();
  db.prepare(`
    INSERT INTO user_settings (
      user_id, base_url, api_token, generations_model, edits_model,
      enhancer_base_url, enhancer_api_token, enhancer_model, enhancer_prompt,
      updated_at
    ) VALUES (
      ?, ?, '', ?, ?,
      ?, '', ?, ?,
      ?
    )
  `).run(
    userId,
    defaults.base_url,
    defaults.generations_model,
    defaults.edits_model,
    defaults.enhancer_base_url,
    defaults.enhancer_model,
    defaults.enhancer_prompt,
    now
  );

  return getUserById(userId)!;
}

export function getUserByUsername(username: string): UserRecord | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username.toLowerCase().trim());
  return (row as unknown as UserRecord) ?? null;
}

export function getUserById(id: number): UserRecord | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
  return (row as unknown as UserRecord) ?? null;
}

export function updateUserProfile(
  userId: number,
  input: { display_name?: string; password_hash?: string; salt?: string }
): UserRecord | null {
  const db = getDb();
  const fields: string[] = [];
  const params: (string | number)[] = [];

  if (input.display_name !== undefined) {
    fields.push('display_name = ?');
    params.push(input.display_name.trim());
  }

  if (input.password_hash && input.salt) {
    fields.push('password_hash = ?');
    params.push(input.password_hash);
    fields.push('salt = ?');
    params.push(input.salt);
  }

  if (fields.length === 0) {
    return getUserById(userId);
  }

  params.push(userId);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return getUserById(userId);
}

// ==========================================
// SESSION FUNCTIONS
// ==========================================

/**
 * Membersihkan seluruh sesi kadaluarsa dari database SQLite (mencegah penumpukan data sesi yatim / orphaned).
 * Mengembalikan jumlah record sesi yang berhasil dihapus.
 */
export function cleanExpiredSessions(): number {
  try {
    const db = getDb();
    const nowIso = new Date().toISOString();
    const result = db.prepare(`
      DELETE FROM sessions 
      WHERE datetime(expires_at) <= datetime(?)
    `).run(nowIso);
    return Number(result.changes);
  } catch (err) {
    console.error('[db] Gagal membersihkan sesi kadaluarsa:', err);
    return 0;
  }
}

/**
 * Membersihkan payload Base64 raksasa pada riwayat lama jika file gambar sudah tersimpan di disk.
 */
export function cleanStoredPayloads(): { cleanedCount: number; freedBytes: number } {
  return cleanStoredPayloadsInDb(getDb());
}

export function createSession(sessionId: string, userId: number, daysValid: number = 30): void {
  const db = getDb();

  // Bersihkan sesi kadaluarsa secara berkala
  cleanExpiredSessions();

  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, userId, expiresAt, createdAt);
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
}

export function deleteUserSessions(userId: number): void {
  const db = getDb();
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
}

// ==========================================
// USER SETTINGS (PRIVATE STUDIO)
// ==========================================

export interface UserSettings {
  user_id: number;
  base_url: string;
  api_token: string;
  generations_model: string;
  edits_model: string;
  enhancer_base_url: string;
  enhancer_api_token: string;
  enhancer_model: string;
  enhancer_prompt: string;
  retention_days: number;
  retention_max_items: number;
  updated_at: string;
}

export function getUserSettings(userId: number): UserSettings {
  const db = getDb();
  let row = db.prepare(`SELECT * FROM user_settings WHERE user_id = ?`).get(userId) as unknown as UserSettings | undefined;

  if (!row) {
    const defaults = getDefaultUserSettings();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO user_settings (
        user_id, base_url, api_token, generations_model, edits_model,
        enhancer_base_url, enhancer_api_token, enhancer_model, enhancer_prompt,
        retention_days, retention_max_items,
        updated_at
      ) VALUES (
        ?, ?, '', ?, ?,
        ?, '', ?, ?,
        0, 0,
        ?
      )
    `).run(
      userId,
      defaults.base_url,
      defaults.generations_model,
      defaults.edits_model,
      defaults.enhancer_base_url,
      defaults.enhancer_model,
      defaults.enhancer_prompt,
      now
    );
    row = db.prepare(`SELECT * FROM user_settings WHERE user_id = ?`).get(userId) as unknown as UserSettings;
  }

  return {
    ...row,
    enhancer_base_url: row.enhancer_base_url || DEFAULT_BASE_URL,
    enhancer_api_token: row.enhancer_api_token || '',
    enhancer_model: row.enhancer_model || DEFAULT_ENHANCER_MODEL,
    enhancer_prompt:
      row.enhancer_prompt && row.enhancer_prompt.trim() !== ''
        ? row.enhancer_prompt
        : DEFAULT_ENHANCER_PROMPT,
    retention_days: Number(row.retention_days ?? 0),
    retention_max_items: Number(row.retention_max_items ?? 0),
  };
}

export function updateUserSettings(userId: number, input: {
  base_url?: string;
  api_token?: string;
  generations_model?: string;
  edits_model?: string;
  enhancer_base_url?: string;
  enhancer_api_token?: string;
  enhancer_model?: string;
  enhancer_prompt?: string;
  retention_days?: number;
  retention_max_items?: number;
}): UserSettings {
  const current = getUserSettings(userId);
  const nextBaseUrl = input.base_url !== undefined ? input.base_url.trim() : current.base_url;
  const nextApiToken = input.api_token !== undefined ? input.api_token.trim() : current.api_token;
  const nextGenModel = input.generations_model !== undefined ? input.generations_model.trim() : current.generations_model;
  const nextEditModel = input.edits_model !== undefined ? input.edits_model.trim() : current.edits_model;
  const nextEnhancerBaseUrl = input.enhancer_base_url !== undefined ? input.enhancer_base_url.trim() : current.enhancer_base_url;
  const nextEnhancerApiToken = input.enhancer_api_token !== undefined ? input.enhancer_api_token.trim() : current.enhancer_api_token;
  const nextEnhancerModel = input.enhancer_model !== undefined ? input.enhancer_model.trim() : current.enhancer_model;
  const nextEnhancerPrompt = input.enhancer_prompt !== undefined ? input.enhancer_prompt.trim() : current.enhancer_prompt;
  const nextRetentionDays = input.retention_days !== undefined ? Math.max(0, Number(input.retention_days) || 0) : current.retention_days;
  const nextRetentionMaxItems = input.retention_max_items !== undefined ? Math.max(0, Number(input.retention_max_items) || 0) : current.retention_max_items;

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE user_settings
    SET
      base_url = ?,
      api_token = ?,
      generations_model = ?,
      edits_model = ?,
      enhancer_base_url = ?,
      enhancer_api_token = ?,
      enhancer_model = ?,
      enhancer_prompt = ?,
      retention_days = ?,
      retention_max_items = ?,
      updated_at = ?
    WHERE user_id = ?
  `).run(
    nextBaseUrl,
    nextApiToken,
    nextGenModel,
    nextEditModel,
    nextEnhancerBaseUrl,
    nextEnhancerApiToken,
    nextEnhancerModel,
    nextEnhancerPrompt,
    nextRetentionDays,
    nextRetentionMaxItems,
    now,
    userId
  );

  return getUserSettings(userId);
}

// ==========================================
// CONFIG SHARE (cross-user settings transfer)
// ==========================================

export interface ConfigShareRecord {
  id: number;
  from_user_id: number;
  to_user_id: number;
  settings_snapshot: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  responded_at: string | null;
  from_username?: string;
}

export function createConfigShare(fromUserId: number, toUserId: number, settingsSnapshot: string): number {
  const db = getDb();
  const info = db.prepare(
    'INSERT INTO config_shares(from_user_id, to_user_id, settings_snapshot) VALUES (?,?,?)'
  ).run(fromUserId, toUserId, settingsSnapshot);
  return Number(info.lastInsertRowid);
}

export function getPendingConfigShares(toUserId: number): ConfigShareRecord[] {
  const db = getDb();
  return db.prepare(`
    SELECT cs.*, u.username AS from_username
    FROM config_shares cs
    JOIN users u ON u.id = cs.from_user_id
    WHERE cs.to_user_id = ? AND cs.status = 'pending'
    ORDER BY cs.created_at DESC
  `).all(toUserId) as unknown as ConfigShareRecord[];
}

export function acceptConfigShare(shareId: number, toUserId: number): boolean {
  const db = getDb();
  const share = db.prepare('SELECT settings_snapshot FROM config_shares WHERE id = ? AND to_user_id = ? AND status = ?',).get(shareId, toUserId, 'pending') as
    | { settings_snapshot: string }
    | undefined;

  if (!share) return false;

  try {
    const parsed = JSON.parse(share.settings_snapshot);
    updateUserSettings(toUserId, parsed);
  } catch {
    return false;
  }

  db.prepare(
    'UPDATE config_shares SET status = ?, responded_at = datetime(\'now\') WHERE id = ?'
  ).run('accepted', shareId);
  return true;
}

export function rejectConfigShare(shareId: number, toUserId: number): boolean {
  const db = getDb();
  const info = db.prepare(
    'UPDATE config_shares SET status = ?, responded_at = datetime(\'now\') WHERE id = ? AND to_user_id = ? AND status = \'pending\''
  ).run('rejected', shareId, toUserId);
  return Number(info.changes) > 0;
}

export function deleteConfigShare(shareId: number, userId: number): boolean {
  const db = getDb();
  const info = db.prepare('DELETE FROM config_shares WHERE id = ? AND from_user_id = ?',).run(shareId, userId);
  return Number(info.changes) > 0;
}

