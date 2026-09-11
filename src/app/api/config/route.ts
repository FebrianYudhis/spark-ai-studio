import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings, updateAppSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET() {
  const settings = getAppSettings();
  const token = settings.api_token || '';

  const isConfigured = Boolean(
    token &&
    token !== 'your_api_token_here' &&
    !token.includes('dummy')
  );
  const maskedToken = isConfigured
    ? (token.length > 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : '••••••••')
    : 'Belum diatur';

  return NextResponse.json(
    {
      baseUrl: settings.base_url,
      isConfigured,
      maskedToken,
      rawToken: token,
      defaultGenerationsModel: settings.generations_model,
      defaultEditsModel: settings.edits_model,
      updatedAt: settings.updated_at,
    },
    { headers: NO_CACHE_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { baseUrl, token, generationsModel, editsModel } = body;

    const updated = updateAppSettings({
      base_url: baseUrl,
      api_token: token,
      generations_model: generationsModel,
      edits_model: editsModel,
    });

    const isConfigured = Boolean(
      updated.api_token &&
      updated.api_token !== 'your_api_token_here' &&
      !updated.api_token.includes('dummy')
    );
    const maskedToken = isConfigured
      ? (updated.api_token.length > 8 ? `${updated.api_token.slice(0, 4)}...${updated.api_token.slice(-4)}` : '••••••••')
      : 'Belum diatur';

    return NextResponse.json(
      {
        success: true,
        message: 'Pengaturan berhasil disimpan ke database SQLite!',
        config: {
          baseUrl: updated.base_url,
          isConfigured,
          maskedToken,
          rawToken: updated.api_token,
          defaultGenerationsModel: updated.generations_model,
          defaultEditsModel: updated.edits_model,
          updatedAt: updated.updated_at,
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Gagal menyimpan pengaturan: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
