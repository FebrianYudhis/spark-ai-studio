import { NextRequest, NextResponse } from 'next/server';
import { getUserSettings, updateUserSettings } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { isTokenConfigured, maskToken, NO_CACHE_HEADERS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Harap login terlebih dahulu.' },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const settings = getUserSettings(user.id);

  const { searchParams } = new URL(req.url);
  const isExport = searchParams.get('export') === 'download' || searchParams.get('export') === 'true';

  if (isExport) {
    const exportData = {
      app: 'spark-ai-studio',
      type: 'settings_export',
      version: 1,
      user: { id: user.id, username: user.username },
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
        retention_days: settings.retention_days ?? 0,
        retention_max_items: settings.retention_max_items ?? 0,
      },
    };
    const userPrefix = `${user.username}_`;
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

  return NextResponse.json(
    {
      // Image Studio Settings
      baseUrl: settings.base_url,
      isConfigured: isTokenConfigured(settings.api_token),
      maskedToken: maskToken(settings.api_token),
      defaultGenerationsModel: settings.generations_model,
      defaultEditsModel: settings.edits_model,

      // Prompt Enhancer Settings
      enhancerBaseUrl: settings.enhancer_base_url,
      isEnhancerConfigured: isTokenConfigured(settings.enhancer_api_token),
      maskedEnhancerToken: maskToken(settings.enhancer_api_token),
      enhancerModel: settings.enhancer_model,
      enhancerPrompt: settings.enhancer_prompt,

      // Storage & Retention Settings
      retentionDays: settings.retention_days ?? 0,
      retentionMaxItems: settings.retention_max_items ?? 0,

      updatedAt: settings.updated_at,
    },
    { headers: NO_CACHE_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Harap login terlebih dahulu.' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

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
    const retentionDays = source.retentionDays !== undefined ? Number(source.retentionDays) : (source.retention_days !== undefined ? Number(source.retention_days) : undefined);
    const retentionMaxItems = source.retentionMaxItems !== undefined ? Number(source.retentionMaxItems) : (source.retention_max_items !== undefined ? Number(source.retention_max_items) : undefined);

    const payload = {
      base_url: baseUrl,
      api_token: token,
      generations_model: generationsModel,
      edits_model: editsModel,
      enhancer_base_url: enhancerBaseUrl,
      enhancer_api_token: enhancerToken,
      enhancer_model: enhancerModel,
      enhancer_prompt: enhancerPrompt,
      retention_days: retentionDays,
      retention_max_items: retentionMaxItems,
    };

    const updated = updateUserSettings(user.id, payload);

    return NextResponse.json(
      {
        success: true,
        message: 'Pengaturan berhasil disimpan ke database SQLite!',
        config: {
          baseUrl: updated.base_url,
          isConfigured: isTokenConfigured(updated.api_token),
          maskedToken: maskToken(updated.api_token),
          defaultGenerationsModel: updated.generations_model,
          defaultEditsModel: updated.edits_model,

          enhancerBaseUrl: updated.enhancer_base_url,
          isEnhancerConfigured: isTokenConfigured(updated.enhancer_api_token),
          enhancerModel: updated.enhancer_model,
          enhancerPrompt: updated.enhancer_prompt,

          retentionDays: updated.retention_days ?? 0,
          retentionMaxItems: updated.retention_max_items ?? 0,

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
