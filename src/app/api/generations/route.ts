import { NextRequest, NextResponse } from 'next/server';
import { saveApiHit, getAppSettings } from '@/lib/db';
import { saveRemoteOrBase64Image, extractImageStrings } from '@/lib/storage';
import { validateImageSize, validateImageQuality } from '@/lib/models';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const settings = getAppSettings();
  const baseUrl = settings.base_url || 'https://api.openai.com/v1';
  const token = settings.api_token || '';
  const defaultModel = settings.generations_model || 'gpt-image-2.5';

  let body: {
    model?: string;
    prompt?: string;
    size?: string;
    quality?: string;
    output_format?: string;
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
  const size = body.size?.trim() || 'auto';
  const quality = (body.quality as string)?.trim() || 'auto';
  const outputFormat = (body.output_format as string)?.trim() || 'png';

  // Validasi ukuran gambar sesuai spesifikasi OpenAI Images
  const sizeValidation = validateImageSize(size);
  if (!sizeValidation.valid) {
    return NextResponse.json(
      { error: sizeValidation.error || 'Ukuran gambar tidak valid' },
      { status: 400 }
    );
  }

  // Validasi kualitas gambar (quality) sesuai model
  const qualityValidation = validateImageQuality(quality, model);
  if (!qualityValidation.valid) {
    return NextResponse.json(
      { error: qualityValidation.error || 'Kualitas gambar tidak valid' },
      { status: 400 }
    );
  }

  const targetUrl = `${baseUrl.replace(/\/+$/, '')}/images/generations`;

  // Payload yang dicatat ke database/log
  const requestPayload: Record<string, unknown> = {
    model,
    prompt,
    size,
    quality,
    output_format: outputFormat,
  };

  // Payload yang dikirimkan ke target API
  const forwardPayload: Record<string, unknown> = {
    model,
    prompt,
    size,
    quality,
    output_format: outputFormat,
  };

  try {
    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(forwardPayload),
      signal: AbortSignal.timeout(120000),
    });

    const statusCode = apiResponse.status;
    const rawText = await apiResponse.text();
    let responseData: Record<string, unknown>;
    try {
      responseData = JSON.parse(rawText);
    } catch {
      responseData = { rawText };
    }

    let resultImageUrl: string | undefined = undefined;
    let errorMessage: string | undefined = undefined;

    if (apiResponse.ok) {
      // Ekstrak otomatis gambar hasil (baik berupa url maupun base64 b64_json)
      const rawImages = extractImageStrings(responseData);
      if (rawImages.length > 0) {
        resultImageUrl = await saveRemoteOrBase64Image(rawImages[0], 'gen');
        if (!resultImageUrl) {
          errorMessage = 'Gagal mengunduh atau menyimpan gambar hasil ke disk lokal.';
        }
      } else {
        const errObj = responseData?.error as { message?: string } | undefined;
        errorMessage = errObj?.message || 'Tidak ditemukan URL atau data Base64 gambar pada response payload API.';
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

    const isSuccess = apiResponse.ok && Boolean(resultImageUrl);

    return NextResponse.json({
      success: isSuccess,
      historyId,
      statusCode: isSuccess ? statusCode : (statusCode >= 400 ? statusCode : 400),
      targetUrl,
      requestPayload,
      resultImageUrl,
      response: responseData,
      errorMessage,
    }, { status: isSuccess ? 200 : (statusCode >= 400 ? statusCode : 400) });

  } catch (err: unknown) {
    let message = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      message = 'Koneksi ke gateway AI timeout setelah 120 detik. Server remote sedang antre atau lambat merespons.';
    }
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
