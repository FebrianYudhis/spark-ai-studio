import { NextRequest, NextResponse } from 'next/server';
import { saveApiHit, getAppSettings } from '@/lib/db';
import { saveRemoteOrBase64Image, extractImageStrings } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const settings = getAppSettings();
  const baseUrl = settings.base_url || 'https://api.openai.com/v1';
  const token = settings.api_token || '';
  const defaultModel = settings.generations_model || 'dall-e-3';

  let body: {
    model?: string;
    prompt?: string;
    size?: string;
    [key: string]: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json(
      { error: 'Prompt wajib diisi' },
      { status: 400 }
    );
  }

  // Model diambil dari settings SQLite (atau override jika dikirimkan)
  const model = body.model?.trim() || defaultModel;
  const size = body.size?.trim() || '1024x1024';
  const quality = (body.quality as string)?.trim() || 'auto';

  const targetUrl = `${baseUrl.replace(/\/+$/, '')}/images/generations`;

  // Payload yang dicatat ke database/log
  const requestPayload: Record<string, unknown> = {
    model,
    prompt,
    size,
    quality,
  };

  // Payload yang dikirimkan ke target API (abaikan quality jika 'auto' agar tidak memicu error invalid parameter)
  const forwardPayload: Record<string, unknown> = {
    model,
    prompt,
    size,
  };
  if (quality && quality !== 'auto') {
    forwardPayload.quality = quality;
  }

  try {
    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(forwardPayload),
    });

    const statusCode = apiResponse.status;
    let responseData: Record<string, unknown>;
    try {
      responseData = await apiResponse.json();
    } catch {
      responseData = { rawText: await apiResponse.text() };
    }

    let resultImageUrl: string | undefined = undefined;
    let errorMessage: string | undefined = undefined;

    if (apiResponse.ok) {
      // Ekstrak otomatis gambar hasil (baik berupa url maupun base64 b64_json)
      const rawImages = extractImageStrings(responseData);
      if (rawImages.length > 0) {
        resultImageUrl = await saveRemoteOrBase64Image(rawImages[0], 'gen');
      }
    } else {
      errorMessage = (responseData?.error as { message?: string })?.message || JSON.stringify(responseData);
    }

    // Save hit to SQLite
    const historyId = saveApiHit({
      type: 'generation',
      endpoint: targetUrl,
      model,
      prompt,
      size,
      request_payload: requestPayload,
      status_code: statusCode,
      response_payload: responseData,
      result_image_url: resultImageUrl,
      error_message: errorMessage,
    });

    return NextResponse.json({
      success: apiResponse.ok,
      historyId,
      statusCode,
      targetUrl,
      requestPayload,
      resultImageUrl,
      response: responseData,
      errorMessage,
    }, { status: statusCode >= 200 && statusCode < 300 ? 200 : statusCode });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const historyId = saveApiHit({
      type: 'generation',
      endpoint: targetUrl,
      model,
      prompt,
      size,
      request_payload: requestPayload,
      status_code: 500,
      response_payload: { error: message },
      error_message: message,
    });

    return NextResponse.json({
      success: false,
      historyId,
      statusCode: 500,
      targetUrl,
      requestPayload,
      errorMessage: message,
    }, { status: 500 });
  }
}
