'use client';

import React, { useState } from 'react';
import { Sparkles, Send, Download, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Maximize2, Settings, RotateCcw } from 'lucide-react';
import { showToast } from '@/lib/swal';

interface GenerationsTabProps {
  defaultModel: string;
  baseUrl: string;
  isConfigured: boolean;
  onSuccess: () => void;
  presetPrompt?: string;
  presetPromptKey?: number;
  onLoadingChange?: (loading: boolean) => void;
  onOpenSettings?: () => void;
}

const SAMPLE_PROMPTS = [
  "Futuristic cyberpunk city street at night with neon lights and flying cars in heavy rain",
  "Oil painting of a calm mountain lake during sunset with vibrant orange and purple sky reflections",
  "Minimalist isometric 3D illustration of a cozy modern coffee shop interior with plants",
];

const PRESET_SIZES = [
  { label: '1024x1024 (1:1 Persegi)', value: '1024x1024' },
  { label: '1792x1024 (16:9 Lanskap)', value: '1792x1024' },
  { label: '1024x1792 (9:16 Potret)', value: '1024x1792' },
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
}: GenerationsTabProps) {
  // Model selalu diambil dari .env dan tidak bisa diubah
  const model = defaultModel || 'dall-e-3';
  const [prompt, setPrompt] = useState(presetPrompt || '');
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState<'standard' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto'>('auto');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    resultImageUrl?: string;
    statusCode: number;
    requestPayload: Record<string, unknown>;
    response: Record<string, unknown>;
    historyId?: number;
  } | null>(null);

  const [showJson, setShowJson] = useState(false);

  const handleReset = () => {
    setPrompt('');
    setSize('1024x1024');
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
      setSize('1024x1024');
      setQuality('auto');
      setPrompt(presetPrompt);
    }
  }, [presetPrompt, presetPromptKey]);

  // Scaler multiplier: 2x or 0.5x
  const handleScale = (factor: number) => {
    const match = size.trim().match(/^(\d+)x(\d+)$/i);
    if (match) {
      const w = Math.round(Number(match[1]) * factor);
      const h = Math.round(Number(match[2]) * factor);
      setSize(`${w}x${h}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.trim(),
          prompt: prompt.trim(),
          size: size.trim(),
          quality,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.errorMessage || data.error || `HTTP ${res.status}: Gagal memproses request`;
        setError(msg);
        showToast(msg, 'error');
      } else {
        showToast('Gambar berhasil di-generate!', 'success');
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
            {/* Model Display */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-purple-600" />
                  Model AI
                </label>
                <span className="text-[11px] text-slate-500 font-mono">Default Pengaturan</span>
              </div>
              <div className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 font-mono font-semibold flex items-center justify-between">
                <span>{model}</span>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="text-xs font-sans font-medium px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Settings className="w-3 h-3 text-purple-600" />
                    Ubah
                  </button>
                )}
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Prompt Teks
                </label>
                <span className="text-[11px] text-slate-500">{prompt.length} karakter</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
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

            {/* Size Configuration: Manual + 3 Presets + (x2) & (:2) */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-purple-600" />
                  Ukuran Gambar (Size)
                </label>
                <span className="text-[11px] text-slate-500">Bisa isi manual atau pilih preset</span>
              </div>

              {/* Manual Input with (x2) and (:2) Buttons */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="misal: 1024x1024, 1920x1080, dll."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all"
                    required
                  />
                </div>

                {/* Button (x2) */}
                <button
                  type="button"
                  onClick={() => handleScale(2)}
                  className="px-3.5 py-2.5 bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer"
                  title="Kalikan resolusi 2x (x2)"
                >
                  (x2)
                </button>

                {/* Button (:2) */}
                <button
                  type="button"
                  onClick={() => handleScale(0.5)}
                  className="px-3.5 py-2.5 bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer"
                  title="Bagi resolusi 2 (:2)"
                >
                  (:2)
                </button>
              </div>

              {/* 3 Quick Presets Chips */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-slate-500 font-medium">3 Preset Utama:</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SIZES.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setSize(preset.value)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-mono font-medium ${
                        size === preset.value
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quality Configuration */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-0.5">
                  Kualitas Output (Quality)
                </label>
                <span className="text-[11px] text-slate-500">Pilih tingkat kualitas output gambar AI</span>
              </div>
              <div className="w-full sm:w-64">
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as typeof quality)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 cursor-pointer shadow-2xs"
                >
                  <option value="auto">auto (Default)</option>
                  <option value="standard">standard</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="xhigh">xhigh</option>
                  <option value="max">max</option>
                </select>
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
              <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800">
                <AlertTriangle className="w-10 h-10 text-rose-600" />
                <p className="text-sm font-semibold">Gagal Menghasilkan Gambar</p>
                <p className="text-xs text-rose-700 max-w-sm">{error}</p>
              </div>
            ) : result?.resultImageUrl ? (
              <div className="flex-1 flex flex-col space-y-4">
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center group">
                  <img
                    src={result.resultImageUrl}
                    alt="AI Generated result"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={result.resultImageUrl}
                    download={`ai_gen_${Date.now()}.png`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Download className="w-4 h-4" /> Unduh Gambar
                  </a>
                  <a
                    href={result.resultImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs transition-colors border border-slate-200"
                    title="Buka tab baru"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
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
                <span>Lihat Raw JSON Request & Response</span>
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
    </div>
  );
}
