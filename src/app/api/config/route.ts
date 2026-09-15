import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings, updateAppSettings, getUserSettings, updateUserSettings } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  const settings = user ? getUserSettings(user.id) : getAppSettings();
  const token = settings.api_token || '';
  const enhancerToken = settings.enhancer_api_token || '';

  const { searchParams } = new URL(req.url);
  const isExport = searchParams.get('export') === 'download' || searchParams.get('export') === 'true';

  if (isExport) {
    const exportData = {
      app: 'spark-ai-studio',
      type: 'settings_export',
      version: 1,
      user: user ? { id: user.id, username: user.username } : null,
      exported_at: new Date().toISOString(),
      settings: {
        base_url: settings.base_url,
        api_token: settings.api_token,
        generations_model: settings.generations_model,
        edits_model: settings.edits_model,
        enhancer_base_url: settings.enhancer_base_url,
        enhancer_api_token: settings.enhancer_api_token,
        enhancer_model: settings.enhancer_model,
        enhancer_prompt: settings.enhancer_prompt,
      },
    };
    const userPrefix = user ? `${user.username}_` : '';
    const filename = `spark_ai_studio_settings_${userPrefix}${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const isConfigured = Boolean(
    token &&
    token !== 'your_api_token_here' &&
    !token.includes('dummy')
  );
  const maskedToken = isConfigured
    ? (token.length > 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : '••••••••')
    : 'Belum diatur';

  const isEnhancerConfigured = Boolean(
    enhancerToken &&
    enhancerToken !== 'your_api_token_here' &&
    !enhancerToken.includes('dummy')
  );
  const maskedEnhancerToken = isEnhancerConfigured
    ? (enhancerToken.length > 8 ? `${enhancerToken.slice(0, 4)}...${enhancerToken.slice(-4)}` : '••••••••')
    : 'Belum diatur';

  return NextResponse.json(
    {
      // Image Studio Settings
      baseUrl: settings.base_url,
      isConfigured,
      maskedToken,
      rawToken: token,
      defaultGenerationsModel: settings.generations_model,
      defaultEditsModel: settings.edits_model,

      // Prompt Enhancer Settings
      enhancerBaseUrl: settings.enhancer_base_url,
      enhancerToken: enhancerToken,
      isEnhancerConfigured,
      maskedEnhancerToken,
      enhancerModel: settings.enhancer_model,
      enhancerPrompt: settings.enhancer_prompt,

      updatedAt: settings.updated_at,
    },
    { headers: NO_CACHE_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    const body = await req.json();
    const source = (body && typeof body.settings === 'object' && body.settings !== null)
      ? body.settings
      : (body || {});

    const baseUrl = source.baseUrl ?? source.base_url;
    const token = source.token ?? source.api_token ?? source.rawToken;
    const generationsModel = source.generationsModel ?? source.generations_model;
    const editsModel = source.editsModel ?? source.edits_model;
    const enhancerBaseUrl = source.enhancerBaseUrl ?? source.enhancer_base_url;
    const enhancerToken = source.enhancerToken ?? source.enhancer_api_token;
    const enhancerModel = source.enhancerModel ?? source.enhancer_model;
    const enhancerPrompt = source.enhancerPrompt ?? source.enhancer_prompt;

    const payload = {
      base_url: baseUrl,
      api_token: token,
      generations_model: generationsModel,
      edits_model: editsModel,
      enhancer_base_url: enhancerBaseUrl,
      enhancer_api_token: enhancerToken,
      enhancer_model: enhancerModel,
      enhancer_prompt: enhancerPrompt,
    };

    const updated = user
      ? updateUserSettings(user.id, payload)
      : updateAppSettings(payload);

    const isConfigured = Boolean(
      updated.api_token &&
      updated.api_token !== 'your_api_token_here' &&
      !updated.api_token.includes('dummy')
    );
    const maskedToken = isConfigured
      ? (updated.api_token.length > 8 ? `${updated.api_token.slice(0, 4)}...${updated.api_token.slice(-4)}` : '••••••••')
      : 'Belum diatur';

    const isEnhancerConfigured = Boolean(
      updated.enhancer_api_token &&
      updated.enhancer_api_token !== 'your_api_token_here' &&
      !updated.enhancer_api_token.includes('dummy')
    );
    const maskedEnhancerToken = isEnhancerConfigured
      ? (updated.enhancer_api_token.length > 8 ? `${updated.enhancer_api_token.slice(0, 4)}...${updated.enhancer_api_token.slice(-4)}` : '••••••••')
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

          enhancerBaseUrl: updated.enhancer_base_url,
          enhancerToken: updated.enhancer_api_token,
          isEnhancerConfigured,
          maskedEnhancerToken,
          enhancerModel: updated.enhancer_model,
          enhancerPrompt: updated.enhancer_prompt,

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
