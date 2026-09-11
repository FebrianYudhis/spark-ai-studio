'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Scissors, UploadCloud, Plus, Image as ImageIcon, Send, Download, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, X, ChevronDown, ChevronUp, Settings, Layers, RotateCcw, Maximize2 } from 'lucide-react';
import { showToast } from '@/lib/swal';
import {
  AVAILABLE_MODELS,
  AvailableModel,
  DEFAULT_MODEL,
  isValidModel,
  STANDARD_IMAGE_SIZES,
  validateImageSize,
  SIZE_PRESET_OPTIONS,
  scaleImageDimensions,
  ImageQuality,
  getAvailableQualities,
  validateImageQuality,
  modelSupportsUltraQuality,
} from '@/lib/models';

interface EditsTabProps {
  defaultModel: string;
  baseUrl: string;
  isConfigured: boolean;
  onSuccess: () => void;
  presetPrompt?: string;
  presetPrimaryImageUrl?: string;
  presetPrimaryImageKey?: number;
  presetEditSession?: {
    prompt: string;
    primaryUrl: string;
    additionalUrls: string[];
    key: number;
  } | null;
  onLoadingChange?: (loading: boolean) => void;
  onOpenSettings?: () => void;
  onModelChange?: (model: AvailableModel) => void;
}

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
}

export default function EditsTab({
  defaultModel,
  baseUrl,
  isConfigured,
  onSuccess,
  presetPrompt,
  presetPrimaryImageUrl,
  presetPrimaryImageKey,
  presetEditSession,
  onLoadingChange,
  onOpenSettings,
  onModelChange,
}: EditsTabProps) {
  const [model, setModel] = useState<AvailableModel>(
    defaultModel && isValidModel(defaultModel) ? defaultModel : DEFAULT_MODEL
  );

  useEffect(() => {
    if (defaultModel && isValidModel(defaultModel)) {
      setModel(defaultModel);
    }
  }, [defaultModel]);
  const [prompt, setPrompt] = useState(presetPrompt || '');
  const [size, setSize] = useState('auto');
  const [sizePreset, setSizePreset] = useState<string>('auto');

  const handlePresetChange = (presetId: string) => {
    setSizePreset(presetId);
    const found = SIZE_PRESET_OPTIONS.find((p) => p.id === presetId);
    if (found && !found.isCustom) {
      setSize(found.value);
    }
  };
  
  // 1. Image Dasar (Primary Image) - Single file
  const [primaryImage, setPrimaryImage] = useState<ImageItem | null>(null);

  // 2. Image Tambahan (Additional Images) - Array of files
  const [additionalImages, setAdditionalImages] = useState<ImageItem[]>([]);

  // Opsi quality (default: 'auto')
  const [quality, setQuality] = useState<ImageQuality>('auto');

  // Fallback quality jika model saat ini tidak mendukung xhigh/max
  useEffect(() => {
    if (!modelSupportsUltraQuality(model) && (quality === 'xhigh' || quality === 'max')) {
      setQuality('auto');
    }
  }, [model, quality]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    sourceImageUrls?: string[];
    resultImageUrl?: string;
    resultImageUrls?: string[];
    statusCode: number;
    requestSummary: Record<string, unknown>;
    response: Record<string, unknown>;
    historyId?: number;
  } | null>(null);

  const [showJson, setShowJson] = useState(false);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const additionalInputRef = useRef<HTMLInputElement>(null);

  // Sync loading state to parent
  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  // Sync preset prompt
  useEffect(() => {
    if (presetPrompt !== undefined) setPrompt(presetPrompt);
  }, [presetPrompt]);

  // Handle Primary Image Change
  const handlePrimaryChange = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (primaryImage) {
      URL.revokeObjectURL(primaryImage.previewUrl);
    }
    setPrimaryImage({
      id: `primary_${Date.now()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    });
  };

  const clearPrimaryImage = () => {
    if (primaryImage) {
      URL.revokeObjectURL(primaryImage.previewUrl);
      setPrimaryImage(null);
    }
    if (primaryInputRef.current) {
      primaryInputRef.current.value = '';
    }
  };

  // Handle Additional Images Change
  const addAdditionalFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    const newItems: ImageItem[] = fileArray.map((file) => ({
      id: `add_${file.name}_${Date.now()}_${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setAdditionalImages((prev) => [...prev, ...newItems]);
  };

  const removeAdditionalImage = (id: string) => {
    setAdditionalImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearAllAdditionalImages = () => {
    additionalImages.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setAdditionalImages([]);
    if (additionalInputRef.current) {
      additionalInputRef.current.value = '';
    }
  };

  // Sync preset primary image (dari tombol "Edit Gambar" di riwayat)
  useEffect(() => {
    if (!presetPrimaryImageUrl) return;

    // 1. Kosongkan seluruh form terlebih dahulu sebelum memasukkan gambar baru
    setPrompt('');
    setSize('1024x1024');
    setQuality('auto');
    setError(null);
    setResult(null);
    setShowJson(false);
    clearPrimaryImage();
    clearAllAdditionalImages();

    // 2. Barulah masukkan gambar yang dipilih ke layer Image Dasar (Primary)
    let isMounted = true;
    async function loadPreset() {
      try {
        const res = await fetch(presetPrimaryImageUrl!);
        if (!res.ok) return;
        const blob = await res.blob();
        const ext = blob.type.split('/')[1] || 'png';
        const filename = `dasar_${Date.now()}.${ext}`;
        const file = new File([blob], filename, { type: blob.type || 'image/png' });

        if (isMounted) {
          setPrimaryImage({
            id: `primary_${Date.now()}`,
            file,
            previewUrl: URL.createObjectURL(file),
          });
          showToast('Gambar berhasil dimuat ke Image Dasar', 'success');
        }
      } catch (err) {
        console.error('Failed to load preset primary image:', err);
      }
    }

    loadPreset();
    return () => {
      isMounted = false;
    };
  }, [presetPrimaryImageUrl, presetPrimaryImageKey]);

  // Helper untuk mendapatkan nama file asli dari URL upload
  const getCleanFilename = (url: string, fallback: string) => {
    try {
      const raw = url.split('/').pop() || fallback;
      const cleaned = raw.replace(/^(primary|additional_\d+)_\d+_/, '');
      return cleaned || raw;
    } catch {
      return fallback;
    }
  };

  // Sync preset edit session (dari tombol "Gunakan Ulang Prompt dan Gambar" di riwayat)
  useEffect(() => {
    if (!presetEditSession) return;

    // 1. Kosongkan seluruh form terlebih dahulu
    setPrompt(presetEditSession.prompt || '');
    setSize('1024x1024');
    setQuality('auto');
    setError(null);
    setResult(null);
    setShowJson(false);
    clearPrimaryImage();
    clearAllAdditionalImages();

    let isMounted = true;

    async function loadSession() {
      try {
        // 2. Muat Primary Image asli jika ada
        if (presetEditSession?.primaryUrl) {
          try {
            const res = await fetch(presetEditSession.primaryUrl);
            if (res.ok) {
              const blob = await res.blob();
              const ext = blob.type.split('/')[1] || 'png';
              const cleanName = getCleanFilename(presetEditSession.primaryUrl, `primary_${Date.now()}.${ext}`);
              const file = new File([blob], cleanName, { type: blob.type || 'image/png' });

              if (isMounted) {
                setPrimaryImage({
                  id: `primary_${Date.now()}`,
                  file,
                  previewUrl: URL.createObjectURL(file),
                });
              }
            }
          } catch (e) {
            console.error('Failed to load primary image for session:', e);
          }
        }

        // 3. Muat Additional Images asli jika ada
        if (presetEditSession?.additionalUrls && presetEditSession.additionalUrls.length > 0) {
          const loadedAdditionals: ImageItem[] = [];
          for (let i = 0; i < presetEditSession.additionalUrls.length; i++) {
            const url = presetEditSession.additionalUrls[i];
            try {
              const res = await fetch(url);
              if (res.ok) {
                const blob = await res.blob();
                const ext = blob.type.split('/')[1] || 'png';
                const cleanName = getCleanFilename(url, `image_${i + 1}_${Date.now()}.${ext}`);
                const file = new File([blob], cleanName, { type: blob.type || 'image/png' });
                loadedAdditionals.push({
                  id: `add_${cleanName}_${Date.now()}_${i}`,
                  file,
                  previewUrl: URL.createObjectURL(file),
                });
              }
            } catch (e) {
              console.error(`Failed to load additional image ${i + 1}:`, e);
            }
          }

          if (isMounted && loadedAdditionals.length > 0) {
            setAdditionalImages(loadedAdditionals);
          }
        }

        if (isMounted) {
          showToast('Sesi edit (prompt & seluruh gambar) berhasil dimuat', 'success');
        }
      } catch (err) {
        console.error('Error loading preset edit session:', err);
      }
    }

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [presetEditSession]);

  // Scaler multiplier: 2x or 0.5x dengan batas edge limits OpenAI (maxDim <= 3840, minDim <= 2160)
  const handleScale = (factor: number) => {
    const newSize = scaleImageDimensions(size, factor);
    setSize(newSize);
  };

  const sizeValidation = validateImageSize(size);
  const availableQualities = getAvailableQualities(model);
  const supportsUltra = modelSupportsUltraQuality(model);

  const handleReset = () => {
    setPrompt('');
    setSize('auto');
    setSizePreset('auto');
    clearPrimaryImage();
    clearAllAdditionalImages();
    setQuality('auto');
    setError(null);
    setResult(null);
    setShowJson(false);
    showToast('Form Edits berhasil di-reset', 'info');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const totalBytes =
    (primaryImage ? primaryImage.file.size : 0) +
    additionalImages.reduce((acc, it) => acc + it.file.size, 0);

  const totalImageCount = (primaryImage ? 1 : 0) + additionalImages.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !primaryImage) return;

    if (!sizeValidation.valid) {
      const errMsg = sizeValidation.error || 'Ukuran gambar tidak valid';
      setError(errMsg);
      showToast(errMsg, 'error');
      return;
    }

    const qualityValidation = validateImageQuality(quality, model);
    if (!qualityValidation.valid) {
      const errMsg = qualityValidation.error || 'Kualitas gambar tidak valid';
      setError(errMsg);
      showToast(errMsg, 'error');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('model', model.trim());
      formData.append('prompt', prompt.trim());
      formData.append('size', size.trim());
      formData.append('quality', quality);
      formData.append('output_format', 'png');

      // 1. Primary Image dikirimkan terpisah agar backend bisa menandai sebagai "primary"
      formData.append('primaryImage', primaryImage.file, primaryImage.file.name);

      // 2. Additional Images dikirimkan secara berurutan agar backend menandai "image 1", "image 2", dst.
      additionalImages.forEach((item) => {
        formData.append('additionalImages', item.file, item.file.name);
      });

      const res = await fetch('/api/edits', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.errorMessage || data.error || `HTTP ${res.status}: Gagal memproses edit gambar`;
        setError(msg);
        showToast(msg, 'error');
      } else {
        showToast('Gambar berhasil diedit!', 'success');
      }

      setResult(data);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Koneksi ke server gagal';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!isConfigured && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Perhatian: Kunci API Belum Dikonfigurasi!</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Silakan atur API Token dan Base URL di menu Pengaturan agar request edit dapat diproses.
              </p>
            </div>
          </div>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Settings className="w-3.5 h-3.5" />
              Atur Sekarang
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Panel */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5 sm:space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 sm:pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-emerald-600 shrink-0" />
                Image Edit API
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 break-all">
                Mengirimkan JSON ke <span className="font-mono text-emerald-700">{baseUrl.replace(/\/+$/, '')}/images/edits</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Model Selection Dropdown */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="edit-model-select" className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-emerald-600" />
                  Model AI
                </label>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="text-xs font-sans font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Settings className="w-3 h-3" />
                    Setelan
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  id="edit-model-select"
                  value={model}
                  onChange={(e) => {
                    const next = e.target.value as AvailableModel;
                    setModel(next);
                    onModelChange?.(next);
                  }}
                  className="w-full appearance-none px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer pr-10 transition-all shadow-2xs"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m} value={m} className="font-mono py-1">
                      {m}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* SEKSI 1: IMAGE DASAR (PRIMARY) */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Image Dasar (Primary)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Dikirimkan ke field <code className="font-mono text-emerald-700 font-semibold">image</code> dengan nama: <strong className="font-mono text-emerald-800 bg-emerald-100/70 px-1 py-0.5 rounded">primary</strong>
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-100/60 px-2 py-0.5 rounded border border-emerald-200">
                  Wajib (1 Gambar)
                </span>
              </div>

              <input
                ref={primaryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handlePrimaryChange(e.target.files[0]);
                  e.target.value = '';
                }}
              />

              {!primaryImage ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handlePrimaryChange(e.dataTransfer.files[0]);
                  }}
                  onClick={() => primaryInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all group"
                >
                  <UploadCloud className="w-7 h-7 text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-slate-800">
                    Pilih atau geser Image Dasar ke sini
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Mendukung semua format gambar tanpa batas ukuran
                  </p>
                </div>
              ) : (
                <div className="relative p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3.5 shadow-xs">
                  <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    <img
                      src={primaryImage.previewUrl}
                      alt="Primary Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        primary
                      </span>
                      <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Terpilih
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 truncate mt-1">{primaryImage.file.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {formatFileSize(primaryImage.file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearPrimaryImage}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors mr-1 cursor-pointer"
                    title="Ganti gambar dasar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* SEKSI 2: IMAGE TAMBAHAN (ADDITIONAL IMAGES) */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Image Tambahan ({additionalImages.length} gambar)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Dikirimkan ke field <code className="font-mono text-indigo-700 font-semibold">image</code> urut: <strong className="font-mono text-indigo-800 bg-indigo-100/70 px-1 py-0.5 rounded">image 1</strong>, <strong className="font-mono text-indigo-800 bg-indigo-100/70 px-1 py-0.5 rounded">image 2</strong>, dst.
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-600 font-medium bg-slate-200/80 px-2 py-0.5 rounded">
                  Opsional (Bisa Banyak)
                </span>
              </div>

              <input
                ref={additionalInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addAdditionalFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              {/* Drag and Drop Zone Tambahan */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) addAdditionalFiles(e.dataTransfer.files);
                }}
                onClick={() => additionalInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/20 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs">
                  <Plus className="w-4 h-4" />
                  <span>Klik atau seret file Image Tambahan ke sini (Bisa pilih banyak)</span>
                </div>
              </div>

              {/* Gallery List Gambar Tambahan */}
              {additionalImages.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-600 px-0.5">
                    <span className="font-medium">Daftar urutan pengiriman:</span>
                    <button
                      type="button"
                      onClick={clearAllAdditionalImages}
                      className="text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                    >
                      Hapus Semua Tambahan
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-0.5">
                    {additionalImages.map((img, idx) => (
                      <div
                        key={img.id}
                        className="relative group bg-white border border-slate-200 rounded-xl p-2 flex items-center gap-2 overflow-hidden shadow-2xs"
                      >
                        <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          <img
                            src={img.previewUrl}
                            alt={`Preview image ${idx + 1}`}
                            className="max-h-full max-w-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0 pr-4">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            image {idx + 1}
                          </span>
                          <p className="text-[11px] font-medium text-slate-800 truncate mt-0.5" title={img.file.name}>
                            {img.file.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {formatFileSize(img.file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAdditionalImage(img.id)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Hapus gambar ini"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Instruksi Edit (Prompt)
                </label>
                <span className="text-[11px] text-slate-500">{prompt.length} karakter</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="misal: Ambil objek dari image 1 dan letakkan di atas primary dengan gaya latar dari image 2..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all resize-y leading-relaxed"
                required
              />
            </div>

            {/* Size Configuration: Preset Select + Custom Option */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-0.5">
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
                    Ukuran Gambar (Size)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Pilih rasio preset standar atau tentukan resolusi kustom
                  </span>
                </div>
                <div className="w-full sm:w-72">
                  <select
                    value={sizePreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer shadow-2xs"
                  >
                    {SIZE_PRESET_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tampilan Resolusi Saat Preset Standar Aktif */}
              {sizePreset !== 'custom' ? (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 font-medium">Resolusi Aktif:</span>
                      <span className="px-2.5 py-1 bg-emerald-100/80 text-emerald-900 border border-emerald-200 rounded-md font-mono font-bold text-xs">
                        {size === 'auto' ? 'auto (Ukuran Otomatis)' : `${size} (${sizePreset})`}
                      </span>
                    </div>

                    {/* Tombol Pengali Resolusi Preset (x2) dan (:2) */}
                    {size !== 'auto' && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-medium mr-0.5">Ubah Skala:</span>
                        <button
                          type="button"
                          onClick={() => handleScale(2)}
                          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-emerald-300 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shadow-2xs hover:border-emerald-400 active:scale-95"
                          title="Kalikan resolusi 2x (kelipatan 16)"
                        >
                          (x2)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleScale(0.5)}
                          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-emerald-300 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shadow-2xs hover:border-emerald-400 active:scale-95"
                          title="Bagi resolusi 2 (kelipatan 16)"
                        >
                          (:2)
                        </button>
                        {/* Tombol Reset ke resolusi default preset jika sudah diskalakan */}
                        {(() => {
                          const defaultVal = SIZE_PRESET_OPTIONS.find((p) => p.id === sizePreset)?.value;
                          if (defaultVal && size !== defaultVal) {
                            return (
                              <button
                                type="button"
                                onClick={() => setSize(defaultVal)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
                                title="Kembalikan ke resolusi standar preset"
                              >
                                Reset ({defaultVal})
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Peringatan jika resolusi preset hasil scaling melebihi 2560x1440 */}
                  {sizeValidation.isExperimental && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>
                        Resolusi <strong>{sizeValidation.width}x{sizeValidation.height}</strong> di atas 2560x1440 bersifat eksperimental (Maks 3840x2160).
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Mode Custom: Input resolusi manual + pengali + validasi + peringatan aturan */
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Resolusi Kustom (WIDTHxHEIGHT):</span>
                    <span className="text-[11px] text-slate-500 font-mono">Wajib kelipatan 16</span>
                  </div>

                  {/* Manual Input with (x2) and (:2) Buttons */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        placeholder="misal: 1536x864, 1280x720, 1024x1024, auto"
                        className={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm font-mono text-slate-800 font-semibold placeholder-slate-400 focus:outline-none transition-all ${
                          !sizeValidation.valid
                            ? 'border-red-400 focus:border-red-600 focus:ring-1 focus:ring-red-600 bg-red-50/20'
                            : sizeValidation.isExperimental
                            ? 'border-amber-400 focus:border-amber-600 focus:ring-1 focus:ring-amber-600'
                            : 'border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
                        }`}
                        required
                      />
                    </div>

                    {/* Button (x2) */}
                    <button
                      type="button"
                      onClick={() => handleScale(2)}
                      className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Kalikan resolusi 2x (kelipatan 16)"
                      disabled={size.trim().toLowerCase() === 'auto'}
                    >
                      (x2)
                    </button>

                    {/* Button (:2) */}
                    <button
                      type="button"
                      onClick={() => handleScale(0.5)}
                      className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Bagi resolusi 2 (kelipatan 16)"
                      disabled={size.trim().toLowerCase() === 'auto'}
                    >
                      (:2)
                    </button>
                  </div>

                  {/* Status Validasi Ukuran Real-Time */}
                  <div>
                    {!sizeValidation.valid ? (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium bg-red-50 border border-red-200 p-2 rounded-lg">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                        <span>{sizeValidation.error}</span>
                      </div>
                    ) : sizeValidation.isAuto ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50/70 border border-emerald-200 p-2 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>Mode <strong>auto</strong>: Model akan menentukan ukuran dan rasio secara otomatis.</span>
                      </div>
                    ) : sizeValidation.isExperimental ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>
                          Resolusi <strong>{sizeValidation.width}x{sizeValidation.height}</strong> di atas 2560x1440 bersifat eksperimental (Maks 3840x2160).
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50/70 border border-emerald-200 p-2 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>
                          Resolusi valid ({sizeValidation.width}x{sizeValidation.height}) • Kelipatan 16 • Rasio {(sizeValidation.width! / sizeValidation.height!).toFixed(2)}:1
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Peringatan & Aturan Resolusi OpenAI Images (Hanya tampil pada mode custom) */}
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-[11px] text-amber-900 space-y-1 leading-relaxed">
                    <p className="font-semibold flex items-center gap-1 text-amber-950">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      Peringatan & Aturan Resolusi Kustom OpenAI Images:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-800/90 pl-1">
                      <li>Format string wajib <code className="font-mono bg-amber-100/70 px-1 py-0.5 rounded text-amber-950">WIDTHxHEIGHT</code> (misal <code className="font-mono bg-amber-100/70 px-1 py-0.5 rounded text-amber-950">1536x864</code>) atau <code className="font-mono bg-amber-100/70 px-1 py-0.5 rounded text-amber-950">auto</code>.</li>
                      <li>Lebar dan tinggi keduanya <strong>wajib habis dibagi 16</strong>.</li>
                      <li>Aspect ratio wajib berada di rentang <strong>1:3</strong> hingga <strong>3:1</strong>.</li>
                      <li>Resolusi di atas 2560x1440 bersifat eksperimental (Batas maksimum absolut: <strong>3840x2160</strong>).</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Quality Configuration */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-0.5">
                    Kualitas Output (Quality)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {supportsUltra
                      ? 'Didukung: auto, low, medium, high, xhigh, max'
                      : 'Didukung: auto, low, medium, high'}
                  </span>
                </div>
                <div className="w-full sm:w-72">
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as ImageQuality)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer shadow-2xs"
                  >
                    {availableQualities.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Submit & Reset Buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="py-2.5 sm:py-3 px-3 sm:px-5 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer border border-slate-300 hover:border-rose-300 shadow-xs shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reset seluruh input gambar dan prompt"
              >
                <RotateCcw className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="hidden sm:inline">Reset Form</span>
                <span className="sm:hidden">Reset</span>
              </button>

              <button
                type="submit"
                disabled={loading || !prompt.trim() || !primaryImage || !size.trim() || !sizeValidation.valid}
                className="flex-1 py-2.5 sm:py-3 px-3 sm:px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                    <span className="hidden sm:inline">Sedang Mengunggah ({totalImageCount} Gambar) &amp; Memproses Edit...</span>
                    <span className="sm:hidden">Memproses Edit...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Kirim {totalImageCount > 0 ? `(${totalImageCount} File) ` : ''}ke /images/edits</span>
                    <span className="sm:hidden">Kirim Edit Gambar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Output Panel: Comparison */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Hasil Edit Gambar
              </h3>
              {result?.statusCode && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-medium ${
                    result.statusCode >= 200 && result.statusCode < 300
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  Status {result.statusCode}
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
                  <Scissors className="w-6 h-6 text-emerald-600 absolute inset-0 m-auto" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Memproses Edit Gambar...</p>
                  <p className="text-xs text-slate-500 mt-1">Mengunggah primary + {additionalImages.length} tambahan dan menjalankan AI model</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800">
                <AlertTriangle className="w-10 h-10 text-rose-600" />
                <p className="text-sm font-semibold">Gagal Mengedit Gambar</p>
                <p className="text-xs text-rose-700 max-w-sm">{error}</p>
              </div>
            ) : result?.resultImageUrl || (result?.resultImageUrls && result.resultImageUrls.length > 0) ? (
              <div className="flex-1 flex flex-col space-y-4">
                
                {/* Visual Comparison Grid */}
                <div className="space-y-3">
                  {/* Source Images Grid */}
                  <div>
                    <span className="text-xs text-slate-600 font-semibold uppercase tracking-wider block mb-2">
                      Gambar Sumber ({result.sourceImageUrls?.length || 1} file)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {(result.sourceImageUrls || [result.requestSummary?.sourceImageUrl as string || '']).map((url, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-xs flex items-center justify-center">
                            <img src={url} alt={`Source ${idx + 1}`} className="max-h-full max-w-full object-contain" />
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 text-center block">
                            {idx === 0 ? 'primary' : `image ${idx}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Result Images Grid */}
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider block mb-2">
                      Hasil Edit AI ({(result.resultImageUrls?.length || (result.resultImageUrl ? 1 : 0))} file)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(result.resultImageUrls && result.resultImageUrls.length > 0
                        ? result.resultImageUrls
                        : [result.resultImageUrl as string]
                      ).map((url, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-xs flex items-center justify-center group">
                            <img src={url} alt={`Edited ${idx + 1}`} className="max-h-full max-w-full object-contain" />
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={url}
                              download={`ai_edit_${result?.historyId || 'result'}_${idx + 1}.png`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-2xs"
                            >
                              <Download className="w-3.5 h-3.5" /> Unduh
                            </a>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors border border-slate-200"
                              title="Buka tab baru"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Request edit berhasil dan telah disimpan ke Riwayat.</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-2 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                <Scissors className="w-10 h-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">Belum Ada Edit Gambar</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Unggah Image Dasar dan Image Tambahan, lalu masukkan instruksi edit untuk melihat hasilnya.
                </p>
              </div>
            )}
          </div>

          {/* JSON Inspector */}
          {result && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <button
                onClick={() => setShowJson(!showJson)}
                className="w-full px-5 py-3 flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span>Lihat Raw Request Summary &amp; Response JSON</span>
                {showJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showJson && (
                <div className="p-4 bg-slate-900 text-slate-100 border-t border-slate-200 space-y-3">
                  <div>
                    <span className="text-[11px] font-mono text-emerald-300">Request Sent:</span>
                    <pre className="mt-1 p-2.5 bg-slate-950 rounded-lg text-[11px] font-mono text-slate-200 overflow-x-auto max-h-40">
                      {JSON.stringify(result.requestSummary, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-teal-300">Response Received:</span>
                    <pre className="mt-1 p-2.5 bg-slate-950 rounded-lg text-[11px] font-mono text-slate-200 overflow-x-auto max-h-40">
                      {JSON.stringify(result.response, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
