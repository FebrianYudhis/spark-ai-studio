import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    if (!filename) {
      return new NextResponse('File Not Found', { status: 404 });
    }

    // Hindari directory traversal attack (../) dan dukung URL-encoded filenames (%20, dsb)
    let decodedFilename = filename;
    try {
      decodedFilename = decodeURIComponent(filename);
    } catch {}

    const safeDecoded = path.basename(decodedFilename);
    const safeRaw = path.basename(filename);

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    let targetPath = path.join(uploadsDir, safeDecoded);
    let chosenFilename = safeDecoded;

    if (!fs.existsSync(targetPath)) {
      const rawPath = path.join(uploadsDir, safeRaw);
      if (fs.existsSync(rawPath)) {
        targetPath = rawPath;
        chosenFilename = safeRaw;
      } else {
        return new NextResponse('File Not Found', { status: 404 });
      }
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isFile()) {
      return new NextResponse('File Not Found', { status: 404 });
    }

    const ext = path.extname(chosenFilename).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileBuffer = fs.readFileSync(targetPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Error serving upload file in production:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
