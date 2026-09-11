export const AVAILABLE_MODELS = [
  'gpt-image-2',
  'gpt-image-2.5',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
] as const;

export type AvailableModel = (typeof AVAILABLE_MODELS)[number];

export const DEFAULT_MODEL: AvailableModel = 'gpt-image-2.5';

export function isValidModel(model: string): model is AvailableModel {
  return AVAILABLE_MODELS.includes(model as AvailableModel);
}

export interface SizeValidationResult {
  valid: boolean;
  error?: string;
  isAuto?: boolean;
  isExperimental?: boolean;
  width?: number;
  height?: number;
}

export const STANDARD_IMAGE_SIZES = [
  { label: '1024x1024 (1:1 Standar)', value: '1024x1024' },
  { label: '1536x1024 (3:2 Standar)', value: '1536x1024' },
  { label: '1024x1536 (2:3 Standar)', value: '1024x1536' },
  { label: '1536x864 (16:9 HD)', value: '1536x864' },
  { label: '864x1536 (9:16 Story)', value: '864x1536' },
  { label: 'auto (Ukuran Otomatis)', value: 'auto' },
] as const;

export const DEFAULT_IMAGE_SIZE = 'auto';
export const DEFAULT_SIZE_PRESET = 'auto';

export interface SizePresetOption {
  id: string;
  label: string;
  value: string;
  aspectRatio: string;
  isCustom?: boolean;
}

export const SIZE_PRESET_OPTIONS: SizePresetOption[] = [
  { id: 'auto', label: 'auto (Ukuran Otomatis — Default)', value: 'auto', aspectRatio: 'auto' },
  { id: '1:1', label: '1:1 (Persegi) — 1024x1024', value: '1024x1024', aspectRatio: '1:1' },
  { id: '3:2', label: '3:2 (Lanskap) — 1536x1024', value: '1536x1024', aspectRatio: '3:2' },
  { id: '2:3', label: '2:3 (Potret) — 1024x1536', value: '1024x1536', aspectRatio: '2:3' },
  { id: '16:9', label: '16:9 (Widescreen) — 1536x864', value: '1536x864', aspectRatio: '16:9' },
  { id: '9:16', label: '9:16 (Story / Vertikal) — 864x1536', value: '864x1536', aspectRatio: '9:16' },
  { id: 'custom', label: 'Custom (Resolusi Kustom)', value: 'custom', aspectRatio: 'custom', isCustom: true },
];

export function getPresetIdFromSize(sizeStr: string): string {
  const s = sizeStr.trim().toLowerCase();
  if (s === '1024x1024') return '1:1';
  if (s === '1536x1024') return '3:2';
  if (s === '1024x1536') return '2:3';
  if (s === '1536x864') return '16:9';
  if (s === '864x1536') return '9:16';
  if (s === 'auto') return 'auto';
  return 'custom';
}

/**
 * Menghitung penskalaan dimensi gambar (x2 atau :2) dengan mempertahankan
 * aspect ratio asli, memastikan kelipatan 16, dan mematuhi batas resolusi OpenAI:
 * - Sisi terpanjang (maxDim) <= 3840
 * - Sisi terpendek (minDim) <= 2160
 * - Total piksel <= 3840 * 2160 (8.294.400 px)
 *
 * Contoh:
 * - 1:1 (Persegi) maks adalah 2160x2160 (karena minDim <= 2160), BUKAN 3840x3840.
 * - 16:9 (Lanskap) maks adalah 3840x2160.
 * - 9:16 (Potret) maks adalah 2160x3840.
 */
export function scaleImageDimensions(sizeStr: string, factor: number): string {
  const match = sizeStr.trim().match(/^(\d+)x(\d+)$/i);
  if (!match) return sizeStr;

  const origW = parseInt(match[1], 10);
  const origH = parseInt(match[2], 10);
  if (origW <= 0 || origH <= 0) return sizeStr;

  let targetW = origW * factor;
  let targetH = origH * factor;

  const MAX_LONG_EDGE = 3840;
  const MAX_SHORT_EDGE = 2160;
  const MAX_TOTAL_PIXELS = 3840 * 2160;
  const MIN_EDGE = 256;

  // Batasi sisi terpanjang dan terpendek
  const maxDim = Math.max(targetW, targetH);
  const minDim = Math.min(targetW, targetH);

  let scaleDown = 1;
  if (maxDim > MAX_LONG_EDGE) {
    scaleDown = Math.min(scaleDown, MAX_LONG_EDGE / maxDim);
  }
  if (minDim * scaleDown > MAX_SHORT_EDGE) {
    scaleDown = Math.min(scaleDown, MAX_SHORT_EDGE / (minDim * scaleDown));
  }
  if ((targetW * scaleDown) * (targetH * scaleDown) > MAX_TOTAL_PIXELS) {
    scaleDown = Math.min(scaleDown, Math.sqrt(MAX_TOTAL_PIXELS / ((targetW * scaleDown) * (targetH * scaleDown))));
  }

  targetW *= scaleDown;
  targetH *= scaleDown;

  // Jika diperkecil (:2), jangan sampai sisi terpendek lebih kecil dari batas wajar MIN_EDGE (256px)
  if (factor < 1) {
    const currentMinDim = Math.min(targetW, targetH);
    if (currentMinDim < MIN_EDGE) {
      const scaleUp = MIN_EDGE / currentMinDim;
      targetW *= scaleUp;
      targetH *= scaleUp;
    }
  }

  // Bulatkan ke kelipatan 16 terdekat (minimal kelipatan 16 di atas atau sama dengan MIN_EDGE)
  let w = Math.round(targetW / 16) * 16;
  let h = Math.round(targetH / 16) * 16;

  // Pastikan setelah pembulatan tidak ada sisi yang melanggar batas
  if (Math.max(w, h) > MAX_LONG_EDGE) {
    if (w >= h) w = MAX_LONG_EDGE;
    else h = MAX_LONG_EDGE;
  }
  if (Math.min(w, h) > MAX_SHORT_EDGE) {
    if (w <= h) w = MAX_SHORT_EDGE;
    else h = MAX_SHORT_EDGE;
  }

  return `${w}x${h}`;
}

export function validateImageSize(sizeStr: string): SizeValidationResult {
  const trimmed = sizeStr.trim().toLowerCase();

  if (trimmed === 'auto') {
    return { valid: true, isAuto: true, isExperimental: false };
  }

  const match = trimmed.match(/^(\d+)x(\d+)$/);
  if (!match) {
    return {
      valid: false,
      error: 'Format ukuran tidak valid. Gunakan format LEBARxTINGGI (contoh: 1536x864) atau "auto".',
    };
  }

  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);

  if (width <= 0 || height <= 0) {
    return {
      valid: false,
      error: 'Lebar dan tinggi harus lebih besar dari 0.',
    };
  }

  // 1. Width and height must both be divisible by 16
  if (width % 16 !== 0 || height % 16 !== 0) {
    return {
      valid: false,
      error: `Lebar (${width}) dan tinggi (${height}) keduanya harus habis dibagi 16.`,
    };
  }

  // 2. Aspect ratio must be between 1:3 and 3:1
  const ratio = width / height;
  if (ratio < 1 / 3 - 0.001 || ratio > 3 + 0.001) {
    return {
      valid: false,
      error: `Aspect ratio harus berada di antara 1:3 dan 3:1 (saat ini ${ratio.toFixed(2)}:1).`,
    };
  }

  // 3. Maximum supported resolution is 3840x2160
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);
  if (maxDim > 3840 || minDim > 2160 || width * height > 3840 * 2160) {
    return {
      valid: false,
      error: `Resolusi melebihi batas maksimum 3840x2160 (atau 2160x3840 untuk potret).`,
    };
  }

  // 4. Resolutions above 2560x1440 are experimental
  const isExperimental = maxDim > 2560 || minDim > 1440 || width * height > 2560 * 1440;

  return {
    valid: true,
    width,
    height,
    isAuto: false,
    isExperimental,
  };
}

export type ImageQuality = 'auto' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const DEFAULT_QUALITY: ImageQuality = 'auto';

/**
 * Memeriksa apakah model mendukung kualitas ultra (xhigh dan max).
 * gpt-image-2.5-sunburst dan gpt-image-2.5-flare (termasuk snapshot 2026-09-08) mendukung xhigh dan max.
 */
export function modelSupportsUltraQuality(model?: string): boolean {
  if (!model) return false;
  const m = model.trim().toLowerCase();
  return m.includes('gpt-image-2.5-sunburst') || m.includes('gpt-image-2.5-flare');
}

export interface QualityOption {
  value: ImageQuality;
  label: string;
  description: string;
  isUltra?: boolean;
}

/**
 * Mengembalikan daftar opsi kualitas gambar yang valid untuk model tertentu.
 */
export function getAvailableQualities(model?: string): QualityOption[] {
  const baseQualities: QualityOption[] = [
    {
      value: 'auto',
      label: 'auto (Default)',
      description: 'Otomatis memilih kualitas terbaik untuk model ini',
    },
    {
      value: 'low',
      label: 'low',
      description: 'Kualitas rendah (proses lebih cepat & hemat token)',
    },
    {
      value: 'medium',
      label: 'medium',
      description: 'Kualitas menengah standar',
    },
    {
      value: 'high',
      label: 'high',
      description: 'Kualitas tinggi dengan detail tajam',
    },
  ];

  if (modelSupportsUltraQuality(model)) {
    baseQualities.push(
      {
        value: 'xhigh',
        label: 'xhigh',
        description: 'Kualitas ekstra tinggi (didukung Sunburst & Flare)',
        isUltra: true,
      },
      {
        value: 'max',
        label: 'max',
        description: 'Tingkat detail paling maksimal (didukung Sunburst & Flare)',
        isUltra: true,
      }
    );
  }

  return baseQualities;
}

export interface QualityValidationResult {
  valid: boolean;
  error?: string;
  normalizedQuality: ImageQuality;
}

/**
 * Memvalidasi apakah quality yang dipilih didukung oleh model terkait.
 */
export function validateImageQuality(qualityStr: string, model: string): QualityValidationResult {
  const q = (qualityStr || 'auto').trim().toLowerCase() as ImageQuality;
  const validBaseQualities = ['auto', 'low', 'medium', 'high'];
  const ultraQualities = ['xhigh', 'max'];

  if (validBaseQualities.includes(q)) {
    return { valid: true, normalizedQuality: q };
  }

  if (ultraQualities.includes(q)) {
    if (modelSupportsUltraQuality(model)) {
      return { valid: true, normalizedQuality: q };
    }
    return {
      valid: false,
      normalizedQuality: 'auto',
      error: `Kualitas "${q}" hanya didukung oleh model gpt-image-2.5-sunburst dan gpt-image-2.5-flare (termasuk snapshot 2026-09-08). Untuk model "${model}", gunakan auto, low, medium, atau high.`,
    };
  }

  return {
    valid: false,
    normalizedQuality: 'auto',
    error: `Kualitas "${qualityStr}" tidak didukung. Pilihan yang tersedia: auto, low, medium, high${
      modelSupportsUltraQuality(model) ? ', xhigh, max' : ''
    }.`,
  };
}

/**
 * Memformat string timestamp tanggal (termasuk format SQLite YYYY-MM-DD HH:MM:SS)
 * secara aman agar tidak memicu "Invalid Date" di browser Safari / iOS (WebKit).
 */
export function formatSafeDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const trimmed = dateStr.trim();
    const safeIso = trimmed.includes('T')
      ? (trimmed.endsWith('Z') || trimmed.includes('+') ? trimmed : `${trimmed}Z`)
      : `${trimmed.replace(' ', 'T')}${trimmed.endsWith('Z') || trimmed.includes('+') ? '' : 'Z'}`;
    const date = new Date(safeIso);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleString('id-ID');
  } catch {
    return dateStr;
  }
}

export type InputFidelity = 'auto' | 'high' | 'low';

export const INPUT_FIDELITY_OPTIONS: { label: string; value: InputFidelity; description: string }[] = [
  { label: 'auto (Bawaan API / Default)', value: 'auto', description: 'Gunakan pengaturan bawaan dari model OpenAI' },
  { label: 'high (Presisi Tinggi)', value: 'high', description: 'Pertahankan detail asli gambar input secara ketat' },
  { label: 'low (Fleksibel / Kreatif)', value: 'low', description: 'Model lebih bebas berimprovisasi dengan panduan umum gambar' },
];

export function validateInputFidelity(fidelityStr?: string | null): {
  valid: boolean;
  value?: 'high' | 'low';
  error?: string;
} {
  if (!fidelityStr || fidelityStr.trim() === '' || fidelityStr.trim().toLowerCase() === 'auto') {
    return { valid: true, value: undefined };
  }
  const f = fidelityStr.trim().toLowerCase();
  if (f === 'high' || f === 'low') {
    return { valid: true, value: f };
  }
  return {
    valid: false,
    error: `Nilai input_fidelity "${fidelityStr}" tidak valid. Pilihan yang didukung: auto, high, low.`,
  };
}

export const DEFAULT_ENHANCER_PROMPT = `Kamu adalah seorang Prompt Improver khusus untuk AI image generation dan image editing.
Tugasmu adalah mengubah prompt gambar yang pendek, sederhana, ambigu, atau kurang detail menjadi prompt yang lebih lengkap, jelas, terstruktur, dan optimal untuk model generasi/edit gambar, sambil tetap mempertahankan maksud asli pengguna.

ATURAN UTAMA:
- Pertahankan maksud asli prompt: Jangan mengubah konsep, tujuan, objek utama, atau instruksi penting dari pengguna.
- Kembangkan detail yang tersirat: Jika prompt terlalu pendek, tambahkan detail yang secara logis diperlukan agar AI image generator lebih mudah memahami instruksi, seperti: komposisi, pose dan posisi subjek, perspektif, framing/kamera, pencahayaan, bayangan, warna dan tone, lingkungan/latar belakang, pakaian dan aksesori, tekstur dan material, anatomi, proporsi, integrasi antar elemen, konsistensi visual, tingkat realism, dan detail yang perlu dipertahankan dari gambar referensi.
- Jangan menambahkan elemen kreatif yang tidak diperlukan: Jangan tiba-tiba menambahkan objek, pakaian, latar, gaya seni, ekspresi, atau konsep baru jika pengguna tidak menginginkannya.
- Prioritaskan referensi gambar: Jika pengguna menyebut Gambar 1, Gambar 2, dan seterusnya, jelaskan dengan tegas fungsi masing-masing gambar (contoh: Gambar 1 = referensi utama untuk pose, komposisi, pakaian, pencahayaan, dan latar; Gambar 2 = referensi wajah/identitas). Jangan mencampurkan fungsi referensi kecuali pengguna memang memintanya.
- Untuk image editing atau face swap, tekankan integrasi yang natural: Pastikan elemen yang digabungkan mengikuti bentuk dan sudut kepala, perspektif, pose, proporsi, warna kulit, pencahayaan, arah cahaya, bayangan, depth of field, ketajaman, tone warna, tekstur kulit, dan anatomi wajah. Tujuannya agar hasil akhir terlihat sebagai satu gambar yang kohesif, bukan seperti elemen yang ditempelkan.
- Pertahankan identitas wajah jika pengguna menggunakan referensi wajah: Jangan mengubah karakteristik wajah secara berlebihan. Pertahankan fitur utama seperti bentuk wajah, mata, hidung, bibir, rahang, dan karakteristik visual lainnya sejauh memungkinkan.
- Gunakan bahasa yang konkret dan instruksional: Hindari kalimat yang terlalu umum seperti "buat sebagus mungkin". Lebih baik gunakan instruksi yang menjelaskan apa yang harus dipertahankan dan bagaimana elemen harus menyatu.
- Jangan memberikan penjelasan panjang tentang prosesmu: Output utama harus berupa prompt final yang siap copy-paste tanpa penjelasan pembuka atau penutup.
- Jangan menggunakan negative prompt kecuali memang diperlukan: Jika diperlukan, letakkan di bagian terpisah bernama Negative Prompt.
- Jika prompt pengguna sudah cukup detail, jangan mengubahnya secara berlebihan: Cukup rapikan struktur, hilangkan ambiguitas, dan tambahkan detail yang benar-benar membantu.`;

