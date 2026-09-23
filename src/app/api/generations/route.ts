import { NextRequest, NextResponse } from 'next/server';
import { saveApiHit, getUserSettings } from '@/lib/db';
import { saveRemoteOrBase64Image, extractImageStrings } from '@/lib/storage';
import { parseAndSanitizeApiResponse } from '@/lib/responseCleaner';
import { sanitizeResponsePayloadAfterSave } from '@/lib/payloadSanitizer';
import { validateImageSize, validateImageQuality, DEFAULT_MODEL, DEFAULT_BASE_URL } from '@/lib/models';
import { getAuthUser } from '@/lib/auth';
import { isTokenConfigured, NO_CACHE_HEADERS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Harap login terlebih dahulu untuk membuat gambar.' },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const settings = getUserSettings(user.id);
  const baseUrl = settings.base_url || DEFAULT_BASE_URL;
  const token = settings.api_token || '';
  const defaultModel = settings.generations_model || DEFAULT_MODEL;

  if (!isTokenConfigured(token)) {
    return NextResponse.json(
      {
        error:
          'API Token belum diatur. Silakan buka menu Pengaturan (Settings) -> tab "Image" dan masukkan API Token Anda.',
      },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

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
      { error: 'Body JSON tidak valid' },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json(
      { error: 'Prompt wajib diisi' },
      { status: 400, headers: NO_CACHE_HEADERS }
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
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  // Validasi kualitas gambar (quality) sesuai model
  const qualityValidation = validateImageQuality(quality, model);
  if (!qualityValidation.valid) {
    return NextResponse.json(
      { error: qualityValidation.error || 'Kualitas gambar tidak valid' },
      { status: 400, headers: NO_CACHE_HEADERS }
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
    });

    const statusCode = apiResponse.status;
    const rawText = await apiResponse.text();
    const sanitized = parseAndSanitizeApiResponse(rawText, statusCode, 'Gateway Generations AI');
    const responseData = sanitized.data;

    let resultImageUrl: string | undefined = undefined;
    let errorMessage: string | undefined = undefined;

    if (apiResponse.ok) {
      // Ekstrak otomatis gambar hasil (baik berupa url maupun base64 b64_json)
      const rawImages = extractImageStrings(responseData);
      if (rawImages.length > 0) {
        resultImageUrl = await saveRemoteOrBase64Image(rawImages[0], 'gen');
        if (!resultImageUrl) {
          if (rawImages[0].startsWith('http://') || rawImages[0].startsWith('https://') || rawImages[0].startsWith('data:image/')) {
            resultImageUrl = rawImages[0];
          } else {
            errorMessage = 'Gagal mengunduh atau menyimpan gambar hasil ke disk lokal.';
          }
        }
      } else {
        const errObj = responseData?.error as { message?: string } | undefined;
        errorMessage = errObj?.message || sanitized.errorMessage || 'Tidak ditemukan URL atau data Base64 gambar pada response payload API.';
      }
    } else {
      errorMessage = sanitized.errorMessage || (responseData?.error as { message?: string })?.message || `HTTP ${statusCode}: Gagal memproses generasi gambar`;
    }

    // Sanitasi payload response HANYA jika file gambar lokal telah dipastikan berhasil disimpan di disk
    const sanitizedResponsePayload = (resultImageUrl && resultImageUrl.startsWith('/uploads/'))
      ? sanitizeResponsePayloadAfterSave(responseData, [resultImageUrl])
      : responseData;

    // Save hit to SQLite
    const historyId = saveApiHit({
      user_id: user.id,
      type: 'generation',
      endpoint: targetUrl,
      model,
      prompt,
      size,
      request_payload: requestPayload,
      status_code: statusCode,
      response_payload: sanitizedResponsePayload,
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
      response: sanitizedResponsePayload,
      errorMessage,
    }, { status: isSuccess ? 200 : (statusCode >= 400 ? statusCode : 400), headers: NO_CACHE_HEADERS });

  } catch (err: unknown) {
    let message = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      message = 'Koneksi ke gateway AI terputus atau dibatalkan sebelum proses selesai merespons.';
    }
    const historyId = saveApiHit({
      user_id: user.id,
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
    }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
