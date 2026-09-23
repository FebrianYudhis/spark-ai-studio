'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  X,
  Copy,
  Check,
  Globe,
  FileCode,
  Database,
  Terminal,
} from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { showToast } from '@/lib/swal';

export interface ErrorDetailData {
  title?: string;
  statusCode?: number;
  errorMessage: string;
  endpoint?: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  rawResponseText?: string;
  historyId?: number;
  timestamp?: string;
}

interface ErrorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ErrorDetailData | null;
}

export default function ErrorDetailModal({
  isOpen,
  onClose,
  data,
}: ErrorDetailModalProps) {
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [mounted, setMounted] = useState(false);
  const copyTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      copyTimersRef.current.forEach(clearTimeout);
      copyTimersRef.current = [];
    };
  }, []);

  /** Reset label "tersalin" setelah 2 detik; timer dibersihkan saat unmount. */
  const scheduleCopyReset = (reset: () => void) => {
    const timer = setTimeout(reset, 2000);
    copyTimersRef.current.push(timer);
  };

  // Tangani tombol Escape untuk menutup modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  // Sanitasi payload request agar base64 gambar yang sangat panjang tidak membekukan UI
  const formatPayload = (payload: unknown): string => {
    if (!payload) return '{}';
    try {
      const sanitized = JSON.parse(
        JSON.stringify(payload, (key, value) => {
          if (typeof value === 'string' && value.startsWith('data:image/')) {
            const prefix = value.slice(0, 30);
            return `${prefix}... [Base64 Data Truncated, panjang: ${value.length.toLocaleString()} karakter]`;
          }
          return value;
        })
      );
      return JSON.stringify(sanitized, null, 2);
    } catch {
      return String(payload);
    }
  };

  // Format respons server, baik berupa JSON maupun teks mentah HTML
  const formatResponse = (): { text: string; isHtml: boolean } => {
    if (data.responsePayload && typeof data.responsePayload === 'object') {
      try {
        return {
          text: JSON.stringify(data.responsePayload, null, 2),
          isHtml: false,
        };
      } catch {}
    }

    if (data.rawResponseText && data.rawResponseText.trim()) {
      const trimmed = data.rawResponseText.trim();
      const isHtml = trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype');
      return { text: trimmed, isHtml };
    }

    return {
      text: typeof data.responsePayload === 'string'
        ? data.responsePayload
        : data.errorMessage || 'Tidak ada konten respons diterima.',
      isHtml: false,
    };
  };

  const responseInfo = formatResponse();
  const formattedRequest = formatPayload(data.requestPayload);

  const handleCopy = async (text: string, type: 'response' | 'payload') => {
    const success = await copyToClipboard(text);
    if (success) {
      if (type === 'response') {
        setCopiedResponse(true);
        scheduleCopyReset(() => setCopiedResponse(false));
      } else {
        setCopiedPayload(true);
        scheduleCopyReset(() => setCopiedPayload(false));
      }
      showToast(`${type === 'response' ? 'Respons' : 'Payload'} berhasil disalin ke clipboard!`, 'success');
    }
  };

  const modalContent = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
      style={{ minHeight: '100dvh' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 text-slate-800 flex flex-col max-h-[90dvh] overflow-hidden my-auto animate-in zoom-in-95 duration-150"
      >
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-200 bg-rose-50/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                  {data.title || 'Detail Respons Error API'}
                </h3>
                {data.statusCode !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                      data.statusCode >= 500
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : data.statusCode >= 400
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    HTTP {data.statusCode}
                  </span>
                )}
                {data.historyId && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono border border-slate-200 flex items-center gap-1">
                    <Database className="w-3 h-3 text-slate-500" />
                    ID #{data.historyId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                Inspeksi respons dari server gateway / OpenAI API
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {/* Pesan Kesalahan Utama */}
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Pesan Kesalahan:
            </span>
            <p className="text-xs font-semibold text-rose-900 leading-relaxed break-words">
              {data.errorMessage}
            </p>
          </div>

          {/* Target Endpoint URL */}
          {Boolean(data.endpoint) && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 font-mono text-[11px] text-slate-700 break-all">
              <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-slate-500 shrink-0">Endpoint:</span>
              <span className="font-semibold text-indigo-900">{data.endpoint}</span>
            </div>
          )}

          {/* Respons yang Diterima dari Server */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Terminal className="w-3.5 h-3.5 text-slate-600" />
                <span>Respons dari Server {responseInfo.isHtml ? '(HTML Error Page)' : '(JSON Response)'}:</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(responseInfo.text, 'response')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                title="Salin isi respons ke clipboard"
              >
                {copiedResponse ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Salin Respons</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <pre className="p-3.5 bg-slate-950 text-emerald-400 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-56 select-text border border-slate-800">
                {responseInfo.text}
              </pre>
            </div>
          </div>

          {/* Request Payload yang Dikirimkan */}
          {Boolean(data.requestPayload) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <FileCode className="w-3.5 h-3.5 text-slate-600" />
                  <span>Payload Request yang Dikirimkan:</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(formattedRequest, 'payload')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                  title="Salin request payload ke clipboard"
                >
                  {copiedPayload ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin Payload</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-3.5 bg-slate-900 text-purple-300 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-48 select-text border border-slate-800">
                  {formattedRequest}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            {data.historyId ? 'Log request ini telah tersimpan di tab Riwayat.' : 'Log tidak dapat disimpan ke riwayat.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );

  return mounted && isOpen ? createPortal(modalContent, document.body) : null;
}
