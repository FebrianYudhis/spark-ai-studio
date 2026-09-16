/**
 * Helper utilitas client-side untuk Spark AI Studio
 * - Validasi file gambar (dukungan kamera mobile / HEIC / ekstensi file)
 * - Kompresi otomatis berbasis Canvas jika ukuran file > 10MB
 * - Trigger unduhan gambar yang kompatibel dengan cross-origin CDN
 */

const SUPPORTED_EXTENSIONS = /\.(png|jpe?g|webp|gif|bmp|heic|heif|svg|avif)$/i;

/**
 * Memvalidasi apakah file merupakan gambar yang didukung
 * (memeriksa MIME type dan fallback ekstensi file jika browser HP tidak mengisi MIME type)
 */
export function isSupportedImageFile(file: File): boolean {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  return SUPPORTED_EXTENSIONS.test(file.name);
}

/**
 * Kompresi dan optimasi gambar HANYA jika ukurannya melebihi 10MB (10 * 1024 * 1024 bytes).
 * Jika file <= 10MB, mengembalikan file asli secara utuh tanpa modifikasi apapun.
 */
export async function compressImageIfOver10MB(
  file: File,
  onCompressNotice?: (originalSizeMb: number, compressedSizeMb: number) => void
): Promise<File> {
  const TEN_MB = 10 * 1024 * 1024;
  if (file.size <= TEN_MB) {
    return file;
  }

  // Jika SVG atau animasi GIF, jangan di-compress via Canvas karena bisa menghilangkan vektor/frame
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg') || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          const maxDim = 2560; // Batas dimensi proporsional resolusi tinggi

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(file);
          }

          const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

          // Gambar latar putih HANYA untuk format yang tidak mendukung alpha (JPEG)
          if (!isPng) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Jika PNG, gunakan WebP untuk menjaga transparansi (alpha channel) dengan kompresi optimal
          const exportMime = isPng ? 'image/webp' : 'image/jpeg';
          const exportExt = isPng ? '_opt.webp' : '_opt.jpg';

          canvas.toBlob(
            (blob) => {
              if (blob && blob.size < file.size) {
                const originalExt = file.name.substring(file.name.lastIndexOf('.'));
                const baseName = file.name.replace(originalExt, '');
                const compressedFile = new File([blob], `${baseName}${exportExt}`, {
                  type: exportMime,
                  lastModified: Date.now(),
                });

                if (onCompressNotice) {
                  onCompressNotice(
                    Number((file.size / (1024 * 1024)).toFixed(1)),
                    Number((compressedFile.size / (1024 * 1024)).toFixed(1))
                  );
                }
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            exportMime,
            0.88
          );
        };

        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };

      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    } catch {
      resolve(file);
    }
  });
}

/**
 * Memicu unduhan gambar ke perangkat pengguna secara aman.
 * Menangani URL lokal (/uploads/...), Data URL, Blob URL, dan remote URL cross-origin CDN
 * sehingga atribut download pada browser mobile tetap berfungsi menyimpan file.
 */
export async function triggerDownload(url: string, filename: string): Promise<void> {
  if (!url) return;

  const isLocal = url.startsWith('/uploads/') || url.startsWith('uploads/');
  const isDataOrBlob = url.startsWith('data:') || url.startsWith('blob:');

  if (isLocal || isDataOrBlob) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // Cross-origin URL (misal remote CDN OpenAI, A6API, Replicate)
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(objectUrl);
    document.body.removeChild(a);
  } catch {
    // Fallback jika CORS membatasi fetch: buka di tab baru
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
