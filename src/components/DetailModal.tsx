'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Download, FileText, AlertCircle, MessageSquare, Sparkles, Scissors, RefreshCw } from 'lucide-react';
import type { ApiHitRecord } from '@/lib/db';
import { showToast, showError } from '@/lib/swal';

interface DetailModalProps {
  item: ApiHitRecord | null;
  onClose: () => void;
  onItemUpdated?: (updatedItem: ApiHitRecord) => void;
  onReusePrompt?: (prompt: string, model: string, type: 'generation' | 'edit') => void;
  onReuseEditSession?: (prompt: string, primaryUrl: string, additionalUrls: string[]) => void;
  onUseAsEditBase?: (imageUrl?: string) => void;
}

export default function DetailModal({
  item,
  onClose,
  onItemUpdated,
  onReusePrompt,
  onReuseEditSession,
  onUseAsEditBase,
}: DetailModalProps) {
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [redownloading, setRedownloading] = useState(false);
  const [localResultImageUrl, setLocalResultImageUrl] = useState<string | null>(null);

  // Reset cache gambar lokal saat item yang dipilih berganti
  useEffect(() => {
    setLocalResultImageUrl(null);
  }, [item?.id]);

  if (!item) return null;

  const currentResultImageUrl = localResultImageUrl ?? item.result_image_url;

  const handleRedownload = async () => {
    if (!item) return;
    setRedownloading(true);
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.resultImageUrl) {
        setLocalResultImageUrl(data.resultImageUrl);
        if (onItemUpdated) {
          onItemUpdated({ ...item, result_image_url: data.resultImageUrl });
        }
        showToast('Gambar berhasil diambil ulang dan disimpan ke lokal!', 'success');
      } else {
        showError('Gagal Mengambil Gambar', data.error || 'Gagal mengambil ulang gambar dari response payload');
      }
    } catch {
      showError('Koneksi Gagal', 'Koneksi ke server gagal');
    } finally {
      setRedownloading(false);
    }
  };

  const copyPromptToClipboard = () => {
    navigator.clipboard.writeText(item.prompt);
    setCopiedPrompt(true);
    showToast('Prompt berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const copyToClipboard = (text: string, type: 'payload' | 'response') => {
    navigator.clipboard.writeText(text);
    showToast(`JSON ${type === 'payload' ? 'Request' : 'Response'} berhasil disalin!`, 'success');
    if (type === 'payload') {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } else {
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    }
  };

  const formattedRequestPayload = item.request_payload
    ? (() => {
        try {
          return JSON.stringify(JSON.parse(item.request_payload), null, 2);
        } catch {
          return item.request_payload;
        }
      })()
    : '{}';

  const formattedResponsePayload = item.response_payload
    ? (() => {
        try {
          return JSON.stringify(JSON.parse(item.response_payload), null, 2);
        } catch {
          return item.response_payload;
        }
      })()
    : '{}';

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const parseUrls = (val?: string | null): string[] => {
    if (!val) return [];
    if (val.startsWith('[')) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [val];
  };

  const sourceUrls = parseUrls(item.source_image_url);
  const resultUrls = parseUrls(currentResultImageUrl);

  let parsedPayload: Record<string, unknown> | null = null;
  try {
    if (item.request_payload) parsedPayload = JSON.parse(item.request_payload);
  } catch {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden my-2 sm:my-8 max-h-[95vh] sm:max-h-[90vh] flex flex-col text-slate-900">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-slate-50 gap-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
            <span
              className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold uppercase tracking-wider ${
                item.type === 'generation'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {item.type === 'generation' ? 'Image Generation' : 'Image Edit'}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] sm:text-xs font-mono font-medium ${
                item.status_code >= 200 && item.status_code < 300
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              HTTP {item.status_code}
            </span>
            <span className="text-[11px] sm:text-xs text-slate-500 font-mono">ID #{item.id}</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-sm">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Target Endpoint</p>
              <p className="text-xs font-mono text-indigo-700 mt-1 break-all select-all font-medium">{item.endpoint}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Waktu Eksekusi</p>
              <p className="text-xs text-slate-800 mt-1">{new Date(item.created_at).toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Model</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">{item.model}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Ukuran Gambar (Size)</p>
              <p className={`text-sm mt-1 font-mono font-semibold ${item.type === 'generation' ? 'text-purple-700' : 'text-emerald-700'}`}>
                {item.size || String(parsedPayload?.size || 'Default')}
              </p>
            </div>
            {item.type === 'edit' && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">File Gambar Sumber</p>
                <p className="text-sm text-emerald-700 font-medium mt-1 truncate" title={item.source_image_name || ''}>
                  {sourceUrls.length > 1 ? `${sourceUrls.length} file gambar: ` : ''}{item.source_image_name || '-'} ({formatBytes(item.source_image_size)})
                </p>
              </div>
            )}
            {Boolean(parsedPayload?.quality) && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Kualitas (Quality)</p>
                <p className="text-sm text-slate-800 mt-1 font-mono font-medium">{String(parsedPayload?.quality)}</p>
              </div>
            )}
          </div>

          {/* Images Section (Card Gambar) */}
          <div className="space-y-4">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              {item.type === 'edit' ? 'Perbandingan Gambar (Sumber vs Hasil)' : 'Hasil Gambar AI'}
            </label>
            
            {/* If Edit: Show Source Images Gallery */}
            {item.type === 'edit' && sourceUrls.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs text-slate-700 font-bold uppercase tracking-wider">
                  Gambar Sumber ({sourceUrls.length} file diunggah)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {sourceUrls.map((url, idx) => (
                    <div key={idx} className="relative aspect-square bg-white rounded-lg overflow-hidden border border-slate-200 shadow-2xs flex items-center justify-center">
                      <img src={url} alt={`Source ${idx + 1}`} className="max-h-full max-w-full object-contain" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result Images */}
            {resultUrls.length > 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider">
                  Gambar Hasil AI ({resultUrls.length} file)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {resultUrls.map((url, idx) => (
                    <div key={idx} className="space-y-2 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                      <div className="relative aspect-square rounded-lg overflow-hidden flex items-center justify-center bg-slate-50">
                        <img src={url} alt={`Result ${idx + 1}`} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <a
                          href={url}
                          download={`ai_${item.type}_${item.id}_${idx + 1}.png`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5" /> Unduh
                        </a>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors border border-slate-200"
                          title="Buka di tab baru"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-amber-600" />
                <div>
                  <p className="text-xs text-slate-800 font-semibold">Tidak ada file gambar lokal yang tersimpan</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm">
                    {item.error_message || 'File gambar belum tersimpan atau tidak ada di disk lokal'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRedownload}
                  disabled={redownloading}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${redownloading ? 'animate-spin' : ''}`} />
                  {redownloading ? 'Sedang Mengambil Ulang...' : 'Ambil Ulang Gambar'}
                </button>
              </div>
            )}
          </div>

          {/* Prompt Section (Card Prompt) */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Prompt yang Dikirimkan
              </label>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={copyPromptToClipboard}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer font-medium"
                  title="Salin prompt"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-medium">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Salin Prompt</span>
                    </>
                  )}
                </button>
                {onReusePrompt && item.type === 'generation' && (
                  <button
                    onClick={() => onReusePrompt(item.prompt, item.model, item.type)}
                    className="text-xs text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    Gunakan Ulang Prompt
                  </button>
                )}
                {onReuseEditSession && item.type === 'edit' && (
                  <button
                    onClick={() => {
                      onReuseEditSession(item.prompt, sourceUrls[0] || '', sourceUrls.slice(1));
                    }}
                    className="text-xs text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    Gunakan Ulang Prompt dan Gambar
                  </button>
                )}
                {onUseAsEditBase && (
                  <button
                    onClick={() => {
                      const img = resultUrls[0] || sourceUrls[0] || '';
                      onUseAsEditBase(img);
                    }}
                    className="text-xs text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Scissors className="w-3 h-3 text-emerald-600" />
                    Edit Gambar
                  </button>
                )}
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 whitespace-pre-wrap leading-relaxed select-all font-normal">
              {item.prompt}
            </div>
          </div>

          {/* Raw Request Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Request Payload (Input Dikirim)
                </label>
              </div>
              <button
                onClick={() => copyToClipboard(formattedRequestPayload, 'payload')}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer font-medium"
              >
                {copiedPayload ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedPayload ? 'Tersalin' : 'Salin JSON'}
              </button>
            </div>
            <pre className="p-3.5 bg-slate-900 rounded-xl text-xs font-mono text-slate-100 overflow-x-auto max-h-48">
              {formattedRequestPayload}
            </pre>
          </div>

          {/* Raw Response Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Response Payload dari API
                </label>
              </div>
              <button
                onClick={() => copyToClipboard(formattedResponsePayload, 'response')}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer font-medium"
              >
                {copiedResponse ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedResponse ? 'Tersalin' : 'Salin JSON'}
              </button>
            </div>
            <pre className="p-3.5 bg-slate-900 rounded-xl text-xs font-mono text-slate-100 overflow-x-auto max-h-48">
              {formattedResponsePayload}
            </pre>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
