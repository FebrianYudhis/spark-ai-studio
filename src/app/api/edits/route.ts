import { NextRequest, NextResponse } from 'next/server';
import { saveApiHit, getUserSettings } from '@/lib/db';
import { saveUploadedFile, saveRemoteOrBase64Image, extractImageStrings } from '@/lib/storage';
import { parseAndSanitizeApiResponse } from '@/lib/responseCleaner';
import { sanitizeResponsePayloadAfterSave } from '@/lib/payloadSanitizer';
import { validateImageSize, validateImageQuality, validateInputFidelity, isValidModel, validateOutputFormat, AVAILABLE_MODELS, DEFAULT_MODEL, DEFAULT_BASE_URL } from '@/lib/models';
import { getAuthUser } from '@/lib/auth';
import { isTokenConfigured, NO_CACHE_HEADERS, toClientErrorMessage } from '@/lib/utils';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Harap login terlebih dahulu untuk mengedit gambar.' },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const settings = getUserSettings(user.id);
  const baseUrl = settings.base_url || DEFAULT_BASE_URL;
  const token = settings.api_token || '';
  const defaultModel = settings.edits_model || DEFAULT_MODEL;

  if (!isTokenConfigured(token)) {
    return NextResponse.json(
      {
        error:
          'API Token belum diatur. Silakan buka menu Pengaturan (Settings) -> tab "Image" dan masukkan API Token Anda.',
      },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err: unknown) {
    return NextResponse.json(
      { error: toClientErrorMessage(err, 'Gagal memproses form data') },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const prompt = (formData.get('prompt') as string)?.trim();
  // Model diambil dari form atau default settings SQLite
  const model = (formData.get('model') as string)?.trim() || defaultModel;
  const size = (formData.get('size') as string)?.trim() || 'auto';
  const quality = (formData.get('quality') as string)?.trim() || 'auto';
  const outputFormat = (formData.get('output_format') as string)?.trim() || 'png';
  const rawFidelity = (formData.get('input_fidelity') as string)?.trim() || (formData.get('inputFidelity') as string)?.trim() || 'high';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt wajib diisi' }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  // Validasi model terhadap daftar model yang didukung
  if (!isValidModel(model)) {
    return NextResponse.json(
      { error: `Model "${model}" tidak dikenali. Pilihan yang tersedia: ${AVAILABLE_MODELS.join(', ')}.` },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  // Validasi format output (hanya png)
  const outputFormatValidation = validateOutputFormat(outputFormat);
  if (!outputFormatValidation.valid) {
    return NextResponse.json(
      { error: outputFormatValidation.error || 'Format output tidak valid' },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

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

  // Validasi input_fidelity (auto, high, low)
  const fidelityValidation = validateInputFidelity(rawFidelity);
  if (!fidelityValidation.valid) {
    return NextResponse.json(
      { error: fidelityValidation.error || 'Nilai input_fidelity tidak valid' },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
  const inputFidelity = fidelityValidation.value;

  // 1. Ambil file Image 1 (Gambar Dasar)
  let primaryFile = (formData.get('image1') || formData.get('primaryImage')) as File | null;
  
  // 2. Ambil file Additional Images (Image 2, 3, dst.)
  let additionalFiles = formData.getAll('additionalImages').filter((f): f is File => f instanceof Blob && f.size > 0);

  // Fallback jika dikirimkan melalui field 'image' biasa
  if (!primaryFile) {
    const allImages = [
      ...formData.getAll('image'),
      ...formData.getAll('images'),
      ...formData.getAll('image[]'),
    ].filter((f): f is File => f instanceof Blob && f.size > 0);

    if (allImages.length > 0) {
      primaryFile = allImages[0];
      additionalFiles = allImages.slice(1);
    }
  }

  if (!primaryFile || !(primaryFile instanceof Blob) || primaryFile.size === 0) {
    return NextResponse.json({ error: 'File gambar dasar (image 1) wajib diunggah' }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const targetUrl = `${baseUrl.replace(/\/+$/, '')}/images/edits`;

  // Simpan file ke disk lokal untuk preview riwayat
  let savedPrimary;
  let savedAdditionals;
  try {
    savedPrimary = await saveUploadedFile(primaryFile, 'image_1');
    savedAdditionals = await Promise.all(
      additionalFiles.map((file, idx) => saveUploadedFile(file, `additional_${idx + 2}`))
    );
  } catch (saveErr: unknown) {
    console.error('[edits] Failed to save uploaded files to local disk:', saveErr);
    return NextResponse.json(
      { error: toClientErrorMessage(saveErr, 'Gagal menyimpan file gambar ke disk server') },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  const allSavedSources = [savedPrimary, ...savedAdditionals];
  const totalSize = allSavedSources.reduce((acc, s) => acc + s.size, 0);

  // Format penamaan file:
  const getExt = (filename: string) => path.extname(filename) || '.png';
  const primarySentName = `image 1${getExt(savedPrimary.filename)}`;
  const additionalSentNames = savedAdditionals.map((s, idx) =>
    `image ${idx + 2}${getExt(s.filename)}`
  );

  // Nama-nama sumber gabungan untuk disimpan di kolom tabel api_hits
  const sourceNamesSummary = `[image 1: ${savedPrimary.filename}]` +
    (savedAdditionals.length > 0 ? `, tambahan: ${savedAdditionals.map((s, idx) => `[image ${idx + 2}: ${s.filename}]`).join(', ')}` : '');

  // Konversi buffer gambar lokal ke Data URL Base64
  const toDataUrl = (buffer: Buffer, fileType?: string) =>
    `data:${fileType || 'image/png'};base64,${buffer.toString('base64')}`;

  const primaryDataUrl = toDataUrl(savedPrimary.buffer, savedPrimary.fileType);
  const additionalDataUrls = savedAdditionals.map((s) => toDataUrl(s.buffer, s.fileType));

  // Metadata summary (format skema edits yang rapi dan konsisten)
  const requestSummary: Record<string, unknown> = {
    model,
    prompt,
    images: [
      {
        image_url: `data:${savedPrimary.fileType || 'image/png'};base64,... [${(savedPrimary.size / 1024).toFixed(1)} KB]`,
        name: primarySentName,
        local_url: savedPrimary.url,
        size: savedPrimary.size,
      },
      ...savedAdditionals.map((s, idx) => ({
        image_url: `data:${s.fileType || 'image/png'};base64,... [${(s.size / 1024).toFixed(1)} KB]`,
        name: additionalSentNames[idx],
        local_url: s.url,
        size: s.size,
      })),
    ],
    size,
    quality,
    output_format: outputFormat,
    ...(inputFidelity ? { input_fidelity: inputFidelity } : {}),
  };

  try {
    // Siapkan Payload JSON yang dikirim ke target AI API
    const forwardPayload: Record<string, unknown> = {
      model,
      prompt,
      images: [
        { image_url: primaryDataUrl },
        ...additionalDataUrls.map((dataUrl) => ({ image_url: dataUrl })),
      ],
      size,
      quality,
      output_format: outputFormat,
      ...(inputFidelity ? { input_fidelity: inputFidelity } : {}),
    };

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
    const sanitized = parseAndSanitizeApiResponse(rawText, statusCode, 'Gateway Edits AI');
    const responseData = sanitized.data;

    const savedResultUrls: string[] = [];
    let errorMessage: string | undefined = undefined;

    if (apiResponse.ok) {
      // Ekstrak otomatis seluruh gambar hasil (baik berupa url maupun base64 b64_json)
      const rawImages = extractImageStrings(responseData);
      for (let i = 0; i < rawImages.length; i++) {
        const cached = await saveRemoteOrBase64Image(rawImages[i], `edit_result_${i + 1}`);
        if (cached) {
          savedResultUrls.push(cached);
        } else if (rawImages[i].startsWith('http://') || rawImages[i].startsWith('https://') || rawImages[i].startsWith('data:image/')) {
          savedResultUrls.push(rawImages[i]);
        }
      }
      if (rawImages.length === 0) {
        const errObj = responseData?.error as { message?: string } | undefined;
        errorMessage = errObj?.message || sanitized.errorMessage || 'Tidak ditemukan data gambar pada respons API edits.';
      } else if (savedResultUrls.length === 0) {
        errorMessage = 'Gagal mengunduh atau menyimpan gambar hasil edit ke disk lokal.';
      }
    } else {
      errorMessage = sanitized.errorMessage || (responseData?.error as { message?: string })?.message || `HTTP ${statusCode}: Gagal memproses edit gambar`;
    }

    const primaryResultImageUrl = savedResultUrls.length > 0 ? savedResultUrls[0] : undefined;

    // Sanitasi payload response HANYA jika file gambar lokal telah dipastikan tersimpan di disk
    const hasSavedLocal = savedResultUrls.some((u) => u.startsWith('/uploads/'));
    const sanitizedResponseData = hasSavedLocal
      ? sanitizeResponsePayloadAfterSave(responseData, savedResultUrls)
      : responseData;

    // Simpan ke database SQLite
    const historyId = saveApiHit({
      user_id: user.id,
      type: 'edit',
      endpoint: targetUrl,
      model,
      prompt,
      size,
      source_image_name: sourceNamesSummary,
      source_image_size: totalSize,
      source_image_url: JSON.stringify(allSavedSources.map((s) => s.url)),
      request_payload: requestSummary,
      status_code: statusCode,
      response_payload: {
        ...(typeof sanitizedResponseData === 'object' && sanitizedResponseData !== null ? sanitizedResponseData : {}),
        savedResultUrls,
      },
      result_image_url: savedResultUrls.length > 1 ? JSON.stringify(savedResultUrls) : primaryResultImageUrl,
      error_message: errorMessage,
    });

    const isSuccess = apiResponse.ok && savedResultUrls.length > 0;

    return NextResponse.json({
      success: isSuccess,
      historyId,
      statusCode: isSuccess ? statusCode : (statusCode >= 400 ? statusCode : 400),
      targetUrl,
      requestSummary,
      sourceImageUrls: allSavedSources.map((s) => s.url),
      sourceImageUrl: savedPrimary.url,
      resultImageUrl: primaryResultImageUrl,
      resultImageUrls: savedResultUrls,
      response: sanitizedResponseData,
      error: errorMessage,
    }, { status: isSuccess ? 200 : (statusCode >= 400 ? statusCode : 400), headers: NO_CACHE_HEADERS });

  } catch (err: unknown) {
    console.error('[edits] error:', err);
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    const message = isTimeout
      ? 'Koneksi ke gateway AI terputus atau dibatalkan sebelum proses selesai merespons.'
      : toClientErrorMessage(err, 'Gagal memproses edit gambar');
    const historyId = saveApiHit({
      user_id: user.id,
      type: 'edit',
      endpoint: targetUrl,
      model,
      prompt,
      size,
      source_image_name: sourceNamesSummary,
      source_image_size: totalSize,
      source_image_url: JSON.stringify(allSavedSources.map((s) => s.url)),
      request_payload: requestSummary,
      status_code: 500,
      response_payload: { error: message },
      error_message: message,
    });

    return NextResponse.json({
      success: false,
      historyId,
      statusCode: 500,
      targetUrl,
      requestSummary,
      sourceImageUrls: allSavedSources.map((s) => s.url),
      sourceImageUrl: savedPrimary.url,
      error: message,
    }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
