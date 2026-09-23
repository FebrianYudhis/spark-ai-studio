'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Wand2, Loader2, Send, Download, RefreshCw, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Maximize2, Settings, RotateCcw, Scissors, MoreVertical, FileText } from 'lucide-react';
import { showToast } from '@/lib/swal';
import { triggerDownload } from '@/lib/imageHelper';
import ErrorDetailModal, { ErrorDetailData } from './ErrorDetailModal';
import {
  AVAILABLE_MODELS,
  AvailableModel,
  DEFAULT_MODEL,
  isValidModel,
  validateImageSize,
  SIZE_PRESET_OPTIONS,
  getPresetIdFromSize,
  scaleImageDimensions,
  ImageQuality,
  getAvailableQualities,
  modelSupportsUltraQuality,
  validateImageQuality,
} from '@/lib/models';

interface GenerationsTabProps {
  defaultModel: string;
  baseUrl: string;
  isConfigured: boolean;
  onSuccess: () => void;
  presetPrompt?: string;
  presetPromptKey?: number;
  onLoadingChange?: (loading: boolean) => void;
  onOpenSettings?: () => void;
  onModelChange?: (model: AvailableModel) => void;
  onUseAsEditBase?: (imageUrl?: string) => void;
}

const SAMPLE_PROMPTS = [
  "Futuristic cyberpunk city street at night with neon lights and flying cars in heavy rain",
  "Oil painting of a calm mountain lake during sunset with vibrant orange and purple sky reflections",
  "Minimalist isometric 3D illustration of a cozy modern coffee shop interior with plants",
];

export default function GenerationsTab({
  defaultModel,
  baseUrl,
  isConfigured,
  onSuccess,
  presetPrompt,
  presetPromptKey,
  onLoadingChange,
  onOpenSettings,
  onModelChange,
  onUseAsEditBase,
}: GenerationsTabProps) {
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
  const [quality, setQuality] = useState<ImageQuality>('auto');

  const handlePresetChange = (presetId: string) => {
    setSizePreset(presetId);
    const found = SIZE_PRESET_OPTIONS.find((p) => p.id === presetId);
    if (found && !found.isCustom) {
      setSize(found.value);
    }
  };

  // Fallback otomatis kualitas jika model yang dipilih tidak mendukung xhigh / max
  useEffect(() => {
    if (!modelSupportsUltraQuality(model) && (quality === 'xhigh' || quality === 'max')) {
      setQuality('auto');
    }
  }, [model, quality]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<ErrorDetailData | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [result, setResult] = useState<{
    resultImageUrl?: string;
    statusCode: number;
    requestPayload: Record<string, unknown>;
    response: Record<string, unknown>;
    historyId?: number;
  } | null>(null);

  const [showJson, setShowJson] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isRedownloading, setIsRedownloading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Menutup menu aksi saat klik di luar menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.gen-action-menu')) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  /** Buka gambar hasil di tab baru. */
  const openImageInNewTab = (url?: string) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRedownload = async () => {
    if (!result?.historyId) return;
    setIsRedownloading(true);
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: result.historyId }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.resultImageUrl) {
        setResult((prev) => (prev ? { ...prev, resultImageUrl: data.resultImageUrl } : null));
        showToast('Gambar berhasil diambil ulang dan disimpan ke lokal!', 'success');
        onSuccess?.();
      } else {
        showToast(data.error || 'Gagal mengambil ulang gambar dari response payload', 'error');
      }
    } catch {
      showToast('Koneksi ke server gagal saat mengambil ulang gambar', 'error');
    } finally {
      setIsRedownloading(false);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) {
      showToast('Masukkan prompt teks terlebih dahulu untuk di-enhance', 'warning');
      return;
    }
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.enhancedPrompt) {
        setPrompt(data.enhancedPrompt);
        showToast('Prompt berhasil di-enhance dengan AI!', 'success');
      } else {
        showToast(data.error || 'Gagal mengoptimalkan prompt', 'error');
      }
    } catch {
      showToast('Koneksi ke server gagal saat meng-enhance prompt', 'error');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleReset = () => {
    setPrompt('');
    setSize('auto');
    setSizePreset('auto');
    setQuality('auto');
    setError(null);
    setResult(null);
    setShowJson(false);
    showToast('Form Generations berhasil di-reset', 'info');
  };

  // Sync loading state to parent
  React.useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  // Sync if preset prompt changes (dari tombol "Gunakan Ulang Prompt" di riwayat)
  React.useEffect(() => {
    if (presetPrompt !== undefined && presetPrompt !== '') {
      // Bersihkan form terlebih dahulu sebelum memuat prompt riwayat
      setError(null);
      setResult(null);
      setShowJson(false);
      setSize('auto');
      setSizePreset('auto');
      setQuality('auto');
      setPrompt(presetPrompt);
    }
  }, [presetPrompt, presetPromptKey]);

  // Scaler multiplier: 2x or 0.5x dengan batas edge limits OpenAI (maxDim <= 3840, minDim <= 2160)
  const handleScale = (factor: number) => {
    const newSize = scaleImageDimensions(size, factor);
    setSize(newSize);
    setSizePreset(getPresetIdFromSize(newSize) || 'custom');
  };

  const sizeValidation = validateImageSize(size);
  const availableQualities = getAvailableQualities(model);
  const supportsUltra = modelSupportsUltraQuality(model);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

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
    setErrorDetail(null);
    setShowErrorModal(false);
    setResult(null);
    setIsMenuOpen(false);

    const forwardPayload = {
      model: model.trim(),
      prompt: prompt.trim(),
      size: size.trim(),
      quality,
      output_format: 'png',
    };

    let rawText = '';
    let currentStatusCode = 0;

    try {
      const res = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forwardPayload),
      });

      currentStatusCode = res.status;
      rawText = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        let fallbackMsg = `HTTP ${res.status}: Gagal memproses request pembuatan gambar`;
        if (res.status === 502 || res.status === 504 || res.status === 524) {
          fallbackMsg = `Koneksi ke gateway AI mengalami timeout/gangguan (HTTP ${res.status}). Silakan coba lagi sesaat lagi.`;
        } else {
          const titleMatch = rawText.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            fallbackMsg = `Server error (${titleMatch[1].trim()})`;
          }
        }
        setError(fallbackMsg);
        setErrorDetail({
          title: 'Gagal Menghasilkan Gambar',
          statusCode: res.status,
          errorMessage: fallbackMsg,
          endpoint: '/api/generations',
          requestPayload: forwardPayload,
          rawResponseText: rawText,
        });
        showToast(fallbackMsg, 'error');
        return;
      }

      if (!res.ok || !data.success) {
        const msg = (data.error as string) || `HTTP ${res.status}: Gagal memproses request`;
        setError(msg);
        setErrorDetail({
          title: 'Gagal Menghasilkan Gambar',
          statusCode: (data.statusCode as number) || res.status,
          errorMessage: msg,
          endpoint: (data.targetUrl as string) || '/api/generations',
          requestPayload: (data.requestPayload as unknown) || forwardPayload,
          responsePayload: data.response || data,
          rawResponseText: rawText,
          historyId: data.historyId as number | undefined,
        });
        showToast(msg, 'error');
        if (data.historyId) {
          setResult({
            resultImageUrl: (data.resultImageUrl as string) || (data.imageUrl as string),
            statusCode: res.status,
            requestPayload: (data.requestPayload as Record<string, unknown>) || {},
            response: (data.response as Record<string, unknown>) || (data.rawResponse as Record<string, unknown>) || data,
            historyId: data.historyId as number | undefined,
          });
        }
        return;
      }

      showToast('Gambar berhasil di-generate!', 'success');
      setResult({
        resultImageUrl: (data.resultImageUrl as string) || (data.imageUrl as string),
        statusCode: res.status,
        requestPayload: (data.requestPayload as Record<string, unknown>) || {},
        response: (data.response as Record<string, unknown>) || (data.rawResponse as Record<string, unknown>) || data,
        historyId: data.historyId as number | undefined,
      });

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan jaringan saat menghubungi server lokal';
      setError(msg);
      setErrorDetail({
        title: 'Kesalahan Jaringan / Server',
        statusCode: currentStatusCode || undefined,
        errorMessage: msg,
        endpoint: '/api/generations',
        requestPayload: forwardPayload,
        rawResponseText: rawText || (err instanceof Error ? err.stack || err.message : String(err)),
      });
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
                Silakan atur API Token dan Base URL di menu Pengaturan agar request dapat diproses.
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
                <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
                Image Generation API
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 break-all">
                Mengirimkan JSON ke <span className="font-mono text-indigo-600">{baseUrl.replace(/\/+$/, '')}/images/generations</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Model Selection Dropdown */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="gen-model-select" className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Model AI
                </label>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="text-xs font-sans font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Settings className="w-3 h-3" />
                    Setelan
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  id="gen-model-select"
                  value={model}
                  onChange={(e) => {
                    const next = e.target.value as AvailableModel;
                    setModel(next);
                    onModelChange?.(next);
                  }}
                  className="w-full appearance-none px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 cursor-pointer pr-10 transition-all shadow-2xs"
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

            {/* Prompt Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Prompt Teks
                  </label>
                  <button
                    type="button"
                    onClick={handleEnhancePrompt}
                    disabled={isEnhancing}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                    title="Optimalkan prompt menggunakan AI Chat Completions"
                  >
                    {isEnhancing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                        <span>Enhancing...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5 text-purple-600" />
                        <span>Sempurnakan Instruksi</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-300 rounded text-slate-500 shadow-2xs" title="Tekan Ctrl + Enter untuk membuat gambar langsung">
                    Ctrl + Enter
                  </kbd>
                  <span>{prompt.length} karakter</span>
                </div>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (!loading && prompt.trim()) {
                      handleSubmit(e);
                    }
                  }
                }}
                rows={4}
                placeholder="Deskripsikan gambar yang ingin Anda buat sedetail mungkin..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all resize-y leading-relaxed"
                required
              />

              {/* Quick sample prompt chips */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-slate-500 py-0.5">Contoh:</span>
                {SAMPLE_PROMPTS.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(sample)}
                    className="text-[11px] text-slate-600 hover:text-purple-700 hover:bg-purple-50 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 transition-colors text-left truncate max-w-[200px]"
                    title={sample}
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Size Configuration: Preset Select + Custom Option */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-0.5">
                    <Maximize2 className="w-3.5 h-3.5 text-purple-600" />
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
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 cursor-pointer shadow-2xs"
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
                      <span className="px-2.5 py-1 bg-purple-100/80 text-purple-900 border border-purple-200 rounded-md font-mono font-bold text-xs">
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
                          className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-700 hover:text-purple-800 border border-purple-300 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shadow-2xs hover:border-purple-400 active:scale-95"
                          title="Kalikan resolusi 2x (kelipatan 16)"
                        >
                          (x2)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleScale(0.5)}
                          className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-700 hover:text-purple-800 border border-purple-300 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shadow-2xs hover:border-purple-400 active:scale-95"
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
                            : 'border-slate-300 focus:border-purple-600 focus:ring-1 focus:ring-purple-600'
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
                      <div className="flex items-center gap-1.5 text-xs text-purple-800 bg-purple-50/70 border border-purple-200 p-2 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-purple-600" />
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
                      Peringatan &amp; Aturan Resolusi Kustom OpenAI Images:
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
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 cursor-pointer shadow-2xs"
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
                title="Reset seluruh input form"
              >
                <RotateCcw className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="hidden sm:inline">Reset Form</span>
                <span className="sm:hidden">Reset</span>
              </button>

              <button
                type="submit"
                disabled={loading || !prompt.trim() || !size.trim()}
                className="flex-1 py-2.5 sm:py-3 px-3 sm:px-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md shadow-purple-500/20 flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                    <span className="hidden sm:inline">Sedang Mengeksekusi HIT API...</span>
                    <span className="sm:hidden">Memproses...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Kirim Request ke /images/generations</span>
                    <span className="sm:hidden">Generate Gambar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Output / Result Panel */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                Hasil Output Gambar
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

            {/* Content Display */}
            {loading ? (
              <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
                  <Sparkles className="w-6 h-6 text-purple-600 absolute inset-0 m-auto" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Menghubungi AI Image Generator...</p>
                  <p className="text-xs text-slate-500 mt-1">Mengirim payload JSON dan menunggu response API</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-rose-800 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shadow-xs">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-md">
                  <p className="text-sm font-bold text-rose-900">Gagal Menghasilkan Gambar</p>
                  <p className="text-xs text-rose-700 leading-relaxed break-words">{error}</p>
                </div>
                {errorDetail && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowErrorModal(true)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md cursor-pointer"
                      title="Lihat detail respons mentah dari server AI"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Lihat Detail Respons</span>
                    </button>
                  </div>
                )}
              </div>
            ) : result?.resultImageUrl ? (
              <div className="flex-1 flex flex-col space-y-4">
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs flex flex-col">
                  <div className="relative aspect-square w-full bg-slate-100 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => openImageInNewTab(result.resultImageUrl)}
                      className="w-full h-full flex items-center justify-center p-2 group cursor-pointer relative"
                      title="Klik untuk membuka gambar di tab baru"
                    >
                      <img
                        src={result.resultImageUrl}
                        alt="AI Generated result"
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                        <div className="p-2 bg-white/90 rounded-full text-slate-800 shadow-md transform scale-90 group-hover:scale-100 transition-transform">
                          <Maximize2 className="w-4 h-4 text-slate-700" />
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-600 truncate">
                      Hasil Generasi AI
                    </span>

                    <div className="relative gen-action-menu">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen((prev) => !prev);
                        }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer border ${
                          isMenuOpen
                            ? 'bg-purple-100 text-purple-800 border-purple-300 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 border-slate-200 bg-white shadow-2xs'
                        }`}
                        title="Menu Aksi Gambar"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 bottom-full mb-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              setIsMenuOpen(false);
                              openImageInNewTab(result.resultImageUrl);
                            }}
                            className="w-full px-3 py-2 text-left text-slate-700 hover:text-purple-700 hover:bg-purple-50 font-medium flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span>Lihat Pratinjau</span>
                          </button>

                          {onUseAsEditBase && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsMenuOpen(false);
                                onUseAsEditBase(result.resultImageUrl);
                              }}
                              className="w-full px-3 py-2 text-left text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 font-medium flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Scissors className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Edit Gambar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setIsMenuOpen(false);
                              if (result.resultImageUrl) {
                                triggerDownload(result.resultImageUrl, `ai_gen_${result?.historyId || 'result'}.png`);
                              }
                            }}
                            className="w-full px-3 py-2 text-left text-slate-700 hover:text-purple-700 hover:bg-purple-50 font-medium flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span>Unduh</span>
                          </button>

                          {result.historyId && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsMenuOpen(false);
                                handleRedownload();
                              }}
                              disabled={isRedownloading}
                              className="w-full px-3 py-2 text-left text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 font-medium flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-100 disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 shrink-0 ${isRedownloading ? 'animate-spin' : ''}`} />
                              <span>{isRedownloading ? 'Mengambil...' : 'Ambil Ulang'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Request berhasil dan telah tersimpan otomatis ke Riwayat.</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-2 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                <Sparkles className="w-10 h-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">Belum Ada Gambar yang Dibuat</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Masukkan prompt dan klik tombol kirim untuk melakukan HIT ke endpoint AI.
                </p>
              </div>
            )}
          </div>

          {/* JSON Inspector Collapsible */}
          {result && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <button
                onClick={() => setShowJson(!showJson)}
                className="w-full px-5 py-3 flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span>Lihat Raw JSON Request &amp; Response</span>
                {showJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showJson && (
                <div className="p-4 bg-slate-900 text-slate-100 border-t border-slate-200 space-y-3">
                  <div>
                    <span className="text-[11px] font-mono text-purple-300">Request Sent:</span>
                    <pre className="mt-1 p-2.5 bg-slate-950 rounded-lg text-[11px] font-mono text-slate-200 overflow-x-auto max-h-40">
                      {JSON.stringify(result.requestPayload, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-emerald-300">Response Received:</span>
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

      {/* Modal Detail Respons Error */}
      <ErrorDetailModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        data={errorDetail}
      />
    </div>
  );
}
