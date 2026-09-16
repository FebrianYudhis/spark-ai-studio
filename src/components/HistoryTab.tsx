'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { History, Sparkles, Scissors, Trash2, RefreshCw, Search, AlertCircle, Download, Copy, Check, MessageSquare, Image as ImageIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreVertical } from 'lucide-react';
import type { ApiHitRecord } from '@/lib/db';
import DetailModal from './DetailModal';
import { showToast, showError, showConfirm, showSuccess } from '@/lib/swal';
import { formatSafeDate, type EditSessionData, type ImageQuality, type InputFidelity } from '@/lib/models';
import { copyToClipboard } from '@/lib/clipboard';
import { triggerDownload } from '@/lib/imageHelper';

interface HistoryTabProps {
  onSelectPrompt: (prompt: string, model: string, type: 'generation' | 'edit') => void;
  onReuseEditSession?: (session: EditSessionData) => void;
  onUseAsEditBase?: (imageUrl?: string) => void;
  refreshTrigger: number;
  onUpdateHistory?: () => void;
}

export default function HistoryTab({
  onSelectPrompt,
  onReuseEditSession,
  onUseAsEditBase,
  refreshTrigger,
  onUpdateHistory,
}: HistoryTabProps) {
  const [items, setItems] = useState<ApiHitRecord[]>([]);
  const [summaryCounts, setSummaryCounts] = useState({ all: 0, generation: 0, edit: 0 });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'generation' | 'edit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(3);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedItem, setSelectedItem] = useState<ApiHitRecord | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [redownloadingId, setRedownloadingId] = useState<number | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  // Menutup menu aksi riwayat saat klik di luar area menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.history-action-menu')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleExport = async (id: number) => {
    setExportingId(id);
    try {
      const res = await fetch(`/api/history/export?id=${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Gagal mengekspor riwayat' }));
        throw new Error(data.error || 'Gagal mengekspor riwayat');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `riwayat_${id}_base64.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast(`Riwayat #${id} berhasil diekspor ke JSON!`, 'success');
    } catch (err: unknown) {
      showError('Gagal Ekspor', err instanceof Error ? err.message : String(err));
    } finally {
      setExportingId(null);
    }
  };

  // Debounce input pencarian selama 300ms dan reset ke halaman 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCopyPrompt = async (promptText: string, id: number) => {
    const success = await copyToClipboard(promptText);
    if (success) {
      setCopiedId(id);
      showToast('Prompt berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      showError('Gagal Menyalin', 'Tidak dapat menyalin ke clipboard. Silakan salin teks secara manual.');
    }
  };

  const handleRedownload = async (id: number) => {
    setRedownloadingId(id);
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({ success: false, error: 'Respon server tidak valid' }));
      if (res.ok && data.success && data.resultImageUrl) {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, result_image_url: data.resultImageUrl } : it))
        );
        if (selectedItem?.id === id) {
          setSelectedItem((prev) => prev ? { ...prev, result_image_url: data.resultImageUrl } : null);
        }
        showToast('Gambar berhasil diambil ulang dan disimpan ke lokal!', 'success');
        setBrokenImages((prev) => {
          const next = new Set(prev);
          next.delete(data.resultImageUrl);
          return next;
        });
        onUpdateHistory?.();
      } else {
        showError('Gagal Mengambil Gambar', data.error || 'Gagal mengambil ulang gambar dari response payload');
      }
    } catch {
      showError('Koneksi Gagal', 'Koneksi ke server gagal');
    } finally {
      setRedownloadingId(null);
    }
  };

  const fetchHistory = useCallback(async (overridePage?: number) => {
    setLoading(true);
    try {
      const targetPage = overridePage ?? page;
      const params = new URLSearchParams();
      if (filterType !== 'all') params.set('type', filterType);
      params.set('page', String(targetPage));
      params.set('limit', String(limit));
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/history?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        console.error('Failed to fetch history, HTTP status:', res.status, errData);
        setItems([]);
        return;
      }
      const data = await res.json().catch(() => null);
      if (!data) {
        console.error('History response is not valid JSON');
        setItems([]);
        return;
      }
      setItems(data.items || []);
      setTotalCount(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      if (data.summaryCounts) {
        setSummaryCounts(data.summaryCounts);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [filterType, page, limit, debouncedSearch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshTrigger]);

  const handleDeleteItem = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Hapus Riwayat?',
      text: `Apakah Anda yakin ingin menghapus riwayat #${id}? File gambar terkait pada penyimpanan lokal juga akan otomatis dibersihkan.`,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      isDanger: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Riwayat #${id} dan file gambarnya berhasil dihapus`, 'success');
        onUpdateHistory?.();
        if (items.length === 1 && page > 1) {
          setPage((p) => p - 1);
        } else {
          fetchHistory();
        }
      } else {
        showError('Gagal Menghapus', 'Gagal menghapus riwayat dari database');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showError('Koneksi Gagal', 'Koneksi ke server gagal');
    }
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

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter sudah dilakukan di tingkat server-side database (termasuk pagination dan search)
  const filteredItems = items;

  return (
    <div className="space-y-6">
      {/* Top Filter and Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
        {/* Type Filter Pills */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto w-full lg:w-auto">
          <button
            onClick={() => {
              setFilterType('all');
              setPage(1);
            }}
            className={`flex-1 lg:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({summaryCounts.all})
          </button>
          <button
            onClick={() => {
              setFilterType('generation');
              setPage(1);
            }}
            className={`flex-1 lg:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all whitespace-nowrap ${
              filterType === 'generation'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Image </span>Generations ({summaryCounts.generation})
          </button>
          <button
            onClick={() => {
              setFilterType('edit');
              setPage(1);
            }}
            className={`flex-1 lg:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all whitespace-nowrap ${
              filterType === 'edit'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <Scissors className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Image </span>Edits ({summaryCounts.edit})
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-52 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari prompt atau model..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchHistory()}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 transition-colors shrink-0 cursor-pointer shadow-2xs"
              title="Muat Ulang Riwayat"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="p-12 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center space-y-3 shadow-sm">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm text-slate-600 font-medium">Memuat riwayat...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-16 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 shadow-sm">
          <History className="w-12 h-12 text-slate-300" />
          <p className="text-base font-semibold text-slate-800">
            {debouncedSearch.trim() ? 'Tidak Ada Riwayat yang Cocok' : 'Belum Ada Riwayat HIT API'}
          </p>
          <p className="text-xs text-slate-500 max-w-sm">
            {debouncedSearch.trim()
              ? `Tidak ditemukan riwayat yang cocok dengan kata kunci "${debouncedSearch}".`
              : 'Setiap request yang Anda kirimkan melalui menu Image Generations atau Image Edits akan otomatis tercatat di sini.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredItems.map((item) => {
            const isGen = item.type === 'generation';
            const isSuccess = item.status_code >= 200 && item.status_code < 300;

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-sm transition-all space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span
                      className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                        isGen
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isGen ? <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" /> : <Scissors className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      {isGen ? 'Image Generation' : 'Image Edit'}
                    </span>

                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] sm:text-xs font-mono font-medium border border-slate-200">
                      Model: {item.model}
                    </span>

                    {Boolean(item.size) && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] sm:text-xs font-mono border border-slate-200">
                        {item.size}
                      </span>
                    )}

                    <span
                      className={`px-2 py-0.5 rounded text-[11px] sm:text-xs font-mono font-medium ${
                        isSuccess
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      HTTP {item.status_code}
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span className="text-[11px] sm:text-xs text-slate-500">
                      {formatSafeDate(item.created_at)}
                    </span>

                    <div className="relative history-action-menu">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === item.id ? null : item.id);
                        }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer border ${
                          openMenuId === item.id
                            ? isGen
                              ? 'bg-purple-100 text-purple-800 border-purple-300 shadow-xs'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-slate-200 bg-white shadow-2xs'
                        }`}
                        title="Menu Aksi Riwayat"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === item.id && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs font-sans">
                          {isGen ? (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onSelectPrompt(item.prompt, item.model, 'generation');
                              }}
                              className="w-full px-3 py-2 text-left text-slate-700 hover:text-purple-700 hover:bg-purple-50 font-medium flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              <span>Gunakan Ulang Prompt</span>
                            </button>
                          ) : onReuseEditSession ? (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                const sourceUrls = parseUrls(item.source_image_url);
                                let parsedReq: Record<string, unknown> | null = null;
                                try {
                                  if (item.request_payload) parsedReq = JSON.parse(item.request_payload);
                                } catch {}
                                onReuseEditSession({
                                  prompt: item.prompt,
                                  primaryUrl: sourceUrls[0] || '',
                                  additionalUrls: sourceUrls.slice(1),
                                  model: item.model,
                                  size: item.size || (parsedReq?.size as string | undefined),
                                  quality: parsedReq?.quality as ImageQuality | undefined,
                                  inputFidelity: parsedReq?.input_fidelity as InputFidelity | undefined,
                                });
                              }}
                              className="w-full px-3 py-2 text-left text-slate-700 hover:text-purple-700 hover:bg-purple-50 font-medium flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              <span>Ulangi Proses Edit</span>
                            </button>
                          ) : null}

                          {(() => {
                            const resultUrls = parseUrls(item.result_image_url);
                            const sourceUrls = parseUrls(item.source_image_url);
                            const imgUrl = resultUrls[0] || sourceUrls[0] || '';
                            if (!onUseAsEditBase || !imgUrl) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onUseAsEditBase(imgUrl);
                                }}
                                className="w-full px-3 py-2 text-left text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 font-medium flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Scissors className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Edit Gambar</span>
                              </button>
                            );
                          })()}

                          {(() => {
                            const resultUrls = parseUrls(item.result_image_url);
                            const downloadUrl = resultUrls[0];
                            if (!downloadUrl) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  triggerDownload(downloadUrl, `ai_${isGen ? 'gen' : 'edit'}_${item.id}.png`);
                                }}
                                className="w-full px-3 py-2 text-left text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 font-medium flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>Unduh Hasil</span>
                              </button>
                            );
                          })()}

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              handleExport(item.id);
                            }}
                            disabled={exportingId === item.id}
                            className="w-full px-3 py-2 text-left text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 font-medium flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{exportingId === item.id ? 'Mengekspor...' : 'Ekspor JSON'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              handleDeleteItem(item.id);
                            }}
                            className="w-full px-3 py-2 text-left text-rose-600 hover:text-rose-800 hover:bg-rose-50 font-medium flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-100"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>Hapus Riwayat</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main Content: Prompt & Visuals */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  {/* Prompt Dikirimkan (Kiri, dipotong seukuran thumbnail gambar) */}
                  <div className="lg:col-span-8 flex flex-col justify-between space-y-2">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 h-full flex flex-col justify-between transition-all">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                            Prompt yang Dikirimkan
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPrompt(item.prompt, item.id)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-200/70 transition-colors cursor-pointer"
                            title="Salin Prompt"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700 font-medium">Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-400" />
                                <span>Salin</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p
                          className="text-sm text-slate-900 leading-relaxed font-normal line-clamp-4 select-all"
                          title={item.prompt}
                        >
                          {item.prompt}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 mt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                        >
                          Lihat data selengkapnya &rarr;
                        </button>
                      </div>
                    </div>

                    {item.error_message && (
                      <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="truncate">Error: {item.error_message}</span>
                      </div>
                    )}
                  </div>

                  {/* Visual Thumbnails (Kanan) */}
                  <div className="lg:col-span-4 flex items-center justify-center">
                    {isGen ? (
                      /* Generation: Single Image Result */
                      (() => {
                        const genResultUrls = parseUrls(item.result_image_url);
                        const genImgUrl = genResultUrls[0];
                        const isGenBroken = !genImgUrl || brokenImages.has(genImgUrl);
                        return !isGenBroken ? (
                          <div className="w-full max-w-[160px] flex flex-col items-center">
                            <button
                              type="button"
                              onClick={() => setSelectedItem(item)}
                              className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group shadow-xs cursor-pointer block text-left"
                              title="Klik untuk melihat detail lengkap"
                            >
                              <img
                                src={genImgUrl}
                                alt="Generated Image"
                                onError={() => {
                                  if (genImgUrl) setBrokenImages((prev) => new Set(prev).add(genImgUrl));
                                }}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            </button>
                            <span className="text-[11px] text-slate-500 mt-1.5 font-medium">Hasil Generation</span>
                          </div>
                        ) : (
                          <div className="w-full aspect-square max-w-[160px] rounded-xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 p-2.5 text-center space-y-1.5 shadow-2xs">
                            <ImageIcon className="w-5 h-5 text-slate-400" />
                            <span className="text-[10px] font-medium text-slate-500">Gambar belum ada di lokal</span>
                            <button
                              type="button"
                              onClick={() => handleRedownload(item.id)}
                              disabled={redownloadingId === item.id}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                              title="Ambil ulang gambar dari response payload API"
                            >
                              <RefreshCw className={`w-3 h-3 ${redownloadingId === item.id ? 'animate-spin' : ''}`} />
                              {redownloadingId === item.id ? 'Mengambil...' : 'Ambil Ulang Gambar'}
                            </button>
                          </div>
                        );
                      })()
                    ) : (
                      /* Edit: Side-by-side Source vs Result */
                      (() => {
                        const sourceUrls = parseUrls(item.source_image_url);
                        const resultUrls = parseUrls(item.result_image_url);
                        const editResUrl = resultUrls[0];
                        const isEditBroken = !editResUrl || brokenImages.has(editResUrl);

                        return (
                          <div className="w-full flex items-center justify-center gap-3">
                            {sourceUrls.length > 0 && (
                              <div className="flex-1 flex flex-col items-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedItem(item)}
                                  className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs group cursor-pointer block text-left"
                                  title="Klik untuk melihat detail lengkap"
                                >
                                  <img
                                    src={sourceUrls[0]}
                                    alt="Source Input"
                                    onError={() => {
                                      if (sourceUrls[0]) setBrokenImages((prev) => new Set(prev).add(sourceUrls[0]));
                                    }}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  />
                                  {sourceUrls.length > 1 && (
                                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-slate-900/80 text-white rounded text-[10px] font-mono font-bold">
                                      {sourceUrls.length} file
                                    </span>
                                  )}
                                </button>
                                <span className="text-[10px] text-slate-600 mt-1 truncate max-w-[80px] font-medium">
                                  {sourceUrls.length > 1 ? `${sourceUrls.length} Asli` : 'Asli'}
                                </span>
                              </div>
                            )}

                            {!isEditBroken ? (
                              <div className="flex-1 flex flex-col items-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedItem(item)}
                                  className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group shadow-xs cursor-pointer block text-left"
                                  title="Klik untuk melihat detail lengkap"
                                >
                                  <img
                                    src={editResUrl}
                                    alt="Edited Result"
                                    onError={() => {
                                      if (editResUrl) setBrokenImages((prev) => new Set(prev).add(editResUrl));
                                    }}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  />
                                  {resultUrls.length > 1 && (
                                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-emerald-700/90 text-white rounded text-[10px] font-mono font-bold">
                                      {resultUrls.length} hasil
                                    </span>
                                  )}
                                </button>
                                <span className="text-[10px] text-emerald-700 mt-1 truncate max-w-[80px] font-semibold">
                                  {resultUrls.length > 1 ? `${resultUrls.length} Edit` : 'Hasil Edit'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex-1 aspect-square max-w-[130px] rounded-xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 p-2 text-center space-y-1 shadow-2xs">
                                <span className="text-[10px] font-medium text-slate-500">Hasil belum di lokal</span>
                                <button
                                  type="button"
                                  onClick={() => handleRedownload(item.id)}
                                  disabled={redownloadingId === item.id}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                  title="Ambil ulang gambar dari response payload API"
                                >
                                  <RefreshCw className={`w-3 h-3 ${redownloadingId === item.id ? 'animate-spin' : ''}`} />
                                  {redownloadingId === item.id ? '...' : 'Ambil Ulang'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left: Item range & Limit selector */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span>
              Menampilkan{' '}
              <span className="font-semibold text-slate-800">
                {Math.min((page - 1) * limit + 1, totalCount)} - {Math.min(page * limit, totalCount)}
              </span>{' '}
              dari <span className="font-semibold text-slate-800">{totalCount}</span> riwayat
            </span>

            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <span className="text-slate-500">Tampilkan:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-600 cursor-pointer"
              >
                <option value={3}>3 / hal</option>
                <option value={6}>6 / hal</option>
                <option value={9}>9 / hal</option>
                <option value={12}>12 / hal</option>
                <option value={15}>15 / hal</option>
                <option value={30}>30 / hal</option>
              </select>
            </div>
          </div>

          {/* Right: Page navigation */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(1)}
                disabled={page === 1}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 px-1">
                {getPageNumbers().map((pNum, idx) =>
                  pNum === '...' ? (
                    <span key={`dots-${idx}`} className="px-2 py-1 text-xs text-slate-400 select-none">
                      ...
                    </span>
                  ) : (
                    <button
                      key={`page-${pNum}`}
                      type="button"
                      onClick={() => handlePageChange(Number(pNum))}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        page === pNum
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {pNum}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(totalPages)}
                disabled={page === totalPages}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer"
                title="Halaman Terakhir"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Detail */}
      <DetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onItemUpdated={(updated) => {
          setSelectedItem(updated);
          setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
        }}
      />
    </div>
  );
}
