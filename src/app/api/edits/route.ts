import { NextRequest, NextResponse } from 'next/server';
import { saveApiHit, getAppSettings } from '@/lib/db';
import { saveUploadedFile, saveRemoteOrBase64Image, extractImageStrings } from '@/lib/storage';
import { validateImageSize, validateImageQuality } from '@/lib/models';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const settings = getAppSettings();
  const baseUrl = settings.base_url || 'https://api.openai.com/v1';
  const token = settings.api_token || '';
  const defaultModel = settings.edits_model || 'gpt-image-2.5';

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'Gagal memproses form data: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 400 }
    );
  }

  const prompt = (formData.get('prompt') as string)?.trim();
  // Model diambil dari form atau default settings SQLite
  const model = (formData.get('model') as string)?.trim() || defaultModel;
  const size = (formData.get('size') as string)?.trim() || 'auto';
  const quality = (formData.get('quality') as string)?.trim() || 'auto';
  const outputFormat = (formData.get('output_format') as string)?.trim() || 'png';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt wajib diisi' }, { status: 400 });
  }

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

  // 1. Ambil file Primary Image
  let primaryFile = formData.get('primaryImage') as File | null;
  
  // 2. Ambil file Additional Images
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
    return NextResponse.json({ error: 'File gambar dasar (primary) wajib diunggah' }, { status: 400 });
  }

  const targetUrl = `${baseUrl.replace(/\/+$/, '')}/images/edits`;

  // Simpan file ke disk lokal untuk preview riwayat
  const savedPrimary = await saveUploadedFile(primaryFile, 'primary');
  const savedAdditionals = await Promise.all(
    additionalFiles.map((file, idx) => saveUploadedFile(file, `additional_${idx + 1}`))
  );

  const allSavedSources = [savedPrimary, ...savedAdditionals];
  const totalSize = allSavedSources.reduce((acc, s) => acc + s.size, 0);

  // Format penamaan file:
  const getExt = (filename: string) => path.extname(filename) || '.png';
  const primarySentName = `primary${getExt(savedPrimary.filename)}`;
  const additionalSentNames = savedAdditionals.map((s, idx) =>
    `image ${idx + 1}${getExt(s.filename)}`
  );

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
    let responseData: Record<string, unknown>;
    try {
      responseData = await apiResponse.json();
    } catch {
      responseData = { rawText: await apiResponse.text() };
    }

    const savedResultUrls: string[] = [];
    let errorMessage: string | undefined = undefined;

    if (apiResponse.ok) {
      // Ekstrak otomatis seluruh gambar hasil (baik berupa url maupun base64 b64_json)
      const rawImages = extractImageStrings(responseData);
      for (let i = 0; i < rawImages.length; i++) {
        const cached = await saveRemoteOrBase64Image(rawImages[i], `edit_result_${i + 1}`);
        if (cached) {
          savedResultUrls.push(cached);
        }
      }
    } else {
      errorMessage = (responseData?.error as { message?: string })?.message || JSON.stringify(responseData);
    }

    const primaryResultImageUrl = savedResultUrls.length > 0 ? savedResultUrls[0] : undefined;

    // Nama-nama sumber gabungan untuk disimpan di kolom tabel
    const sourceNamesSummary = `[primary: ${savedPrimary.filename}]` +
      (savedAdditionals.length > 0 ? `, tambahan: ${savedAdditionals.map((s, idx) => `[image ${idx + 1}: ${s.filename}]`).join(', ')}` : '');

    // Simpan ke database SQLite
    const historyId = saveApiHit({
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
        ...responseData,
        savedResultUrls,
      },
      result_image_url: savedResultUrls.length > 1 ? JSON.stringify(savedResultUrls) : primaryResultImageUrl,
      error_message: errorMessage,
    });

    return NextResponse.json({
      success: apiResponse.ok,
      historyId,
      statusCode,
      targetUrl,
      requestSummary,
      sourceImageUrls: allSavedSources.map((s) => s.url),
      sourceImageUrl: savedPrimary.url,
      resultImageUrl: primaryResultImageUrl,
      resultImageUrls: savedResultUrls,
      response: responseData,
      errorMessage,
    }, { status: statusCode >= 200 && statusCode < 300 ? 200 : statusCode });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const historyId = saveApiHit({
      type: 'edit',
      endpoint: targetUrl,
      model,
      prompt,
      source_image_name: `[primary: ${savedPrimary.filename}]`,
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
      errorMessage: message,
    }, { status: 500 });
  }
}
