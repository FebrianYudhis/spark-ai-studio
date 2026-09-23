import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import {
  getUserSettings, getUserByUsername,
  createConfigShare, getPendingConfigShares,
  acceptConfigShare, rejectConfigShare, deleteConfigShare,
} from '@/lib/db';
import { checkRateLimit, recordFailedAttempt, getClientIp } from '@/lib/rateLimiter';
import { NO_CACHE_HEADERS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function userSafeSettings(settings: ReturnType<typeof getUserSettings>) {
  return {
    base_url: settings.base_url,
    api_token: settings.api_token,
    generations_model: settings.generations_model,
    edits_model: settings.edits_model,
    enhancer_base_url: settings.enhancer_base_url,
    enhancer_api_token: settings.enhancer_api_token,
    enhancer_model: settings.enhancer_model,
    enhancer_prompt: settings.enhancer_prompt,
    retention_days: settings.retention_days ?? 0,
    retention_max_items: settings.retention_max_items ?? 0,
  };
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Harap login terlebih dahulu.' }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  const incoming = getPendingConfigShares(user.id);
  return NextResponse.json({
    success: true,
    pendingRequests: incoming.map((r) => ({
      id: r.id,
      from_username: r.from_username,
      created_at: r.created_at,
    })),
  }, { headers: NO_CACHE_HEADERS });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Harap login terlebih dahulu.' }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  // Rate limit permintaan share per user
  const shareKey = `config_share:user:${user.id}`;
  const clientIp = getClientIp(req);
  const ipKey = clientIp ? `config_share:ip:${clientIp}` : null;
  const userLimit = checkRateLimit(shareKey, 10, 5 * 60 * 1000);
  const ipLimit = checkRateLimit(ipKey, 20, 5 * 60 * 1000);
  if (!userLimit.allowed || !ipLimit.allowed) {
    const retryAfter = Math.max(userLimit.retryAfterSeconds ?? 30, ipLimit.retryAfterSeconds ?? 30);
    return NextResponse.json(
      { error: `Terlalu banyak permintaan. Coba lagi dalam ${retryAfter} detik.` },
      { status: 429, headers: { ...NO_CACHE_HEADERS, 'Retry-After': String(retryAfter) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const toUsername = (body.toUsername || body.to_username || '').trim();

  if (!toUsername || !/^[a-zA-Z0-9_-]+$/.test(toUsername)) {
    recordFailedAttempt(shareKey, 10, 5 * 60 * 1000);
    recordFailedAttempt(ipKey, 20, 5 * 60 * 1000);
    return NextResponse.json({ error: 'Username tujuan tidak valid.' }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  if (toUsername === user.username) {
    return NextResponse.json({ error: 'Tidak dapat mengirim ke akun sendiri.' }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const target = getUserByUsername(toUsername);
  if (!target) {
    recordFailedAttempt(shareKey, 10, 5 * 60 * 1000);
    recordFailedAttempt(ipKey, 20, 5 * 60 * 1000);
    return NextResponse.json({ error: 'Pengguna tujuan tidak ditemukan.' }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  const settings = getUserSettings(user.id);
  const snapshot = JSON.stringify(userSafeSettings(settings));

  const shareId = createConfigShare(user.id, target.id, snapshot);
  return NextResponse.json({
    success: true,
    message: `Permintaan berhasil dikirim ke "${toUsername}".`,
    shareId,
  }, { headers: NO_CACHE_HEADERS });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Harap login terlebih dahulu.' }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  const body = await req.json().catch(() => ({}));
  const shareId = Number(body.id);
  const action = body.action === 'accept' ? 'accept' : 'reject';

  if (!shareId || shareId <= 0) {
    return NextResponse.json({ error: 'ID permintaan tidak valid.' }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  let ok: boolean;
  if (action === 'accept') {
    ok = acceptConfigShare(shareId, user.id);
  } else {
    ok = rejectConfigShare(shareId, user.id);
  }

  if (!ok) {
    return NextResponse.json({ error: 'Permintaan tidak ditemukan atau sudah diproses.' }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  return NextResponse.json({
    success: true,
    message: action === 'accept'
      ? 'Konfigurasi berhasil diterima dan diterapkan.'
      : 'Permintaan ditolak.',
  }, { headers: NO_CACHE_HEADERS });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Harap login terlebih dahulu.' }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  const body = await req.json().catch(() => ({}));
  const shareId = Number(body.id);
  if (!shareId || shareId <= 0) {
    return NextResponse.json({ error: 'ID permintaan tidak valid.' }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const ok = deleteConfigShare(shareId, user.id);
  if (!ok) {
    return NextResponse.json({ error: 'Permintaan tidak ditemukan.' }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  return NextResponse.json({ success: true, message: 'Permintaan dihapus.' }, { headers: NO_CACHE_HEADERS });
}
