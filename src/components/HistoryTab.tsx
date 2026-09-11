'use client';

import React, { useState, useEffect } from 'react';
import { History, Sparkles, Scissors, Trash2, RefreshCw, Eye, Search, AlertCircle, Download, Copy, Check, MessageSquare, Image as ImageIcon, HardDrive } from 'lucide-react';
import type { ApiHitRecord } from '@/lib/db';
import DetailModal from './DetailModal';
import { showToast, showError, showConfirm, showSuccess } from '@/lib/swal';
import { formatSafeDate } from '@/lib/models';

interface StorageStatsInfo {
  totalFiles: number;
  totalSizeBytes: number;
  activeFiles: number;
  activeSizeBytes: number;
  orphanedFiles: number;
  orphanedSizeBytes: number;
  formattedTotalSize: string;
  formattedActiveSize: string;
  formattedOrphanedSize: string;
}

interface HistoryTabProps {
  onSelectPrompt: (prompt: string, model: string, type: 'generation' | 'edit') => void;
  onReuseEditSession?: (prompt: string, primaryUrl: string, additionalUrls: string[]) => void;
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
  const [selectedItem, setSelectedItem] = useState<ApiHitRecord | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [redownloadingId, setRedownloadingId] = useState<number | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStatsInfo | null>(null);
  const [cleaningStorage, setCleaningStorage] = useState(false);

  const handleCopyPrompt = (promptText: string, id: number) => {
    navigator.clipboard.writeText(promptText);
    setCopiedId(id);
    showToast('Prompt berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRedownload = async (id: number) => {
    setRedownloadingId(id);
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.resultImageUrl) {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, result_image_url: data.resultImageUrl } : it))
        );
        if (selectedItem?.id === id) {
          setSelectedItem((prev) => prev ? { ...prev, result_image_url: data.resultImageUrl } : null);
        }
        showToast('Gambar berhasil diambil ulang dan disimpan ke lokal!', 'success');
      } else {
        showError('Gagal Mengambil Gambar', data.error || 'Gagal mengambil ulang gambar dari response payload');
      }
    } catch {
      showError('Koneksi Gagal', 'Koneksi ke server gagal');
    } finally {
      setRedownloadingId(null);
    }
  };

  const fetchStorageStats = async () => {
    try {
      const res = await fetch('/api/storage');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.stats) {
          setStorageStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to fetch storage stats:', err);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const url = filterType === 'all' ? '/api/history?limit=100' : `/api/history?type=${filterType}&limit=100`;
      const [res] = await Promise.all([fetch(url), fetchStorageStats()]);
      const data = await res.json();
      setItems(data.items || []);
      if (data.summaryCounts) {
        setSummaryCounts(data.summaryCounts);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [filterType, refreshTrigger]);

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
        setItems((prev) => prev.filter((it) => it.id !== id));
        showToast(`Riwayat #${id} dan file gambarnya berhasil dihapus`, 'success');
        onUpdateHistory?.();
        fetchHistory();
        fetchStorageStats();
      } else {
        showError('Gagal Menghapus', 'Gagal menghapus riwayat dari database');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showError('Koneksi Gagal', 'Koneksi ke server gagal');
    }
  };

  const handleClearAll = async () => {
    const label = filterType === 'all' ? 'semua riwayat' : `semua riwayat ${filterType}`;
    const confirmed = await showConfirm({
      title: 'Hapus Semua Riwayat?',
      text: `Yakin ingin menghapus ${label}? Seluruh file gambar terkait pada penyimpanan disk juga akan dibersihkan otomatis. Tindakan ini tidak dapat dibatalkan.`,
      confirmButtonText: 'Ya, Hapus Semua',
      cancelButtonText: 'Batal',
      isDanger: true,
    });
    if (!confirmed) return;

    try {
      const url = filterType === 'all' ? '/api/history' : `/api/history?type=${filterType}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        setItems([]);
        showToast('Semua riwayat dan file gambarnya berhasil dibersihkan', 'success');
        onUpdateHistory?.();
        fetchHistory();
        fetchStorageStats();
      } else {
        showError('Gagal Menghapus', 'Gagal membersihkan riwayat');
      }
    } catch (err) {
      console.error('Clear error:', err);
      showError('Koneksi Gagal', 'Koneksi ke server gagal');
    }
  };

  const handleManageStorage = async () => {
    if (!storageStats) {
      await fetchStorageStats();
      return;
    }

    if (storageStats.orphanedFiles > 0) {
      const confirmed = await showConfirm({
        title: 'Bersihkan File Sampah?',
        text: `Terdeteksi ${storageStats.orphanedFiles} file sampah / orphaned (${storageStats.formattedOrphanedSize}) dari total kapasitas ${storageStats.formattedTotalSize} (${storageStats.totalFiles} file). Ingin membersihkan file tak terpakai ini sekarang?`,
        confirmButtonText: 'Bersihkan File Sampah',
        cancelButtonText: 'Batal',
        isDanger: false,
      });
      if (!confirmed) return;

      setCleaningStorage(true);
      try {
        const res = await fetch('/api/storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clean_orphaned' }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(data.message, 'success');
          fetchStorageStats();
        } else {
          showError('Gagal', data.error || 'Gagal membersihkan file sampah');
        }
      } catch {
        showError('Koneksi Gagal', 'Koneksi ke server gagal');
      } finally {
        setCleaningStorage(false);
      }
    } else {
      await showSuccess(
        'Penyimpanan Disk Bersih',
        `Total kapasitas: ${storageStats.formattedTotalSize} (${storageStats.totalFiles} file). Seluruh file terhubung aktif dengan riwayat Anda dan tidak ada file sampah tersisa.`
      );
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

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.prompt.toLowerCase().includes(query) ||
      item.model.toLowerCase().includes(query) ||
      item.endpoint.toLowerCase().includes(query) ||
      (item.source_image_name && item.source_image_name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Filter and Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
        {/* Type Filter Pills */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto w-full lg:w-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`flex-1 lg:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({summaryCounts.all})
          </button>
          <button
            onClick={() => setFilterType('generation')}
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
            onClick={() => setFilterType('edit')}
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
            {storageStats && (
              <button
                type="button"
                onClick={handleManageStorage}
                disabled={cleaningStorage}
                className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border shadow-2xs cursor-pointer ${
                  storageStats.orphanedFiles > 0
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title="Klik untuk melihat detail kapasitas disk dan membersihkan file sampah"
              >
                <HardDrive className={`w-3.5 h-3.5 shrink-0 ${storageStats.orphanedFiles > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-500'}`} />
                <span>Disk: {storageStats.formattedTotalSize}</span>
                {storageStats.orphanedFiles > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded-md text-[10px] font-bold">
                    {storageStats.orphanedFiles} sampah
                  </span>
                )}
              </button>
            )}

            <button
              onClick={fetchHistory}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 transition-colors shrink-0 cursor-pointer"
              title="Muat Ulang"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {items.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                title="Bersihkan Semua"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Bersihkan</span>
              </button>
            )}
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
          <p className="text-base font-semibold text-slate-800">Belum Ada Riwayat HIT API</p>
          <p className="text-xs text-slate-500 max-w-sm">
            Setiap request yang Anda kirimkan melalui menu Image Generations atau Image Edits akan otomatis tercatat di sini.
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
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Hapus baris ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                        return genImgUrl ? (
                          <div className="w-full max-w-[160px] flex flex-col items-center">
                            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group shadow-xs">
                              <img
                                src={genImgUrl}
                                alt="Generated Image"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setSelectedItem(item)}
                                  className="p-1.5 bg-white/80 hover:bg-white rounded-lg text-slate-800 shadow-sm"
                                  title="Lihat detail"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <a
                                  href={genImgUrl}
                                  download={`ai_gen_${item.id}.png`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white shadow-sm"
                                  title="Unduh"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-500 mt-1.5 font-medium">Hasil Generation</span>
                          </div>
                        ) : (
                          <div className="w-full aspect-square max-w-[160px] rounded-xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 p-2.5 text-center space-y-1.5 shadow-2xs">
                            <ImageIcon className="w-5 h-5 text-slate-400" />
                            <span className="text-[10px] font-medium text-slate-500">Tidak ada gambar</span>
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

                        return (
                          <div className="w-full flex items-center justify-center gap-3">
                            {sourceUrls.length > 0 && (
                              <div className="flex-1 flex flex-col items-center">
                                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs group">
                                  <img
                                    src={sourceUrls[0]}
                                    alt="Source Input"
                                    className="w-full h-full object-cover"
                                  />
                                  {sourceUrls.length > 1 && (
                                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-slate-900/80 text-white rounded text-[10px] font-mono font-bold">
                                      {sourceUrls.length} file
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-600 mt-1 truncate max-w-[80px] font-medium">
                                  {sourceUrls.length > 1 ? `${sourceUrls.length} Asli` : 'Asli'}
                                </span>
                              </div>
                            )}

                            {resultUrls.length > 0 ? (
                              <div className="flex-1 flex flex-col items-center">
                                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group shadow-xs">
                                  <img
                                    src={resultUrls[0]}
                                    alt="Edited Result"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  {resultUrls.length > 1 && (
                                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-emerald-700/90 text-white rounded text-[10px] font-mono font-bold">
                                      {resultUrls.length} hasil
                                    </span>
                                  )}
                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                      onClick={() => setSelectedItem(item)}
                                      className="p-1.5 bg-white/80 hover:bg-white rounded-lg text-slate-800 shadow-sm cursor-pointer"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                <span className="text-[10px] text-emerald-700 mt-1 truncate max-w-[80px] font-semibold">
                                  {resultUrls.length > 1 ? `${resultUrls.length} Edit` : 'Hasil Edit'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex-1 aspect-square max-w-[130px] rounded-xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 p-2 text-center space-y-1 shadow-2xs">
                                <span className="text-[10px] font-medium text-slate-500">Hasil belum ada</span>
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

                {/* Footer Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  {isGen ? (
                    <button
                      onClick={() => onSelectPrompt(item.prompt, item.model, 'generation')}
                      className="px-3.5 py-2 sm:py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl sm:rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-purple-200 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      Gunakan Ulang Prompt
                    </button>
                  ) : onReuseEditSession ? (
                    <button
                      onClick={() => {
                        const sourceUrls = parseUrls(item.source_image_url);
                        onReuseEditSession(item.prompt, sourceUrls[0] || '', sourceUrls.slice(1));
                      }}
                      className="px-3.5 py-2 sm:py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl sm:rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-purple-200 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      Gunakan Ulang Prompt dan Gambar
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    onClick={() => {
                      const resultUrls = parseUrls(item.result_image_url);
                      const sourceUrls = parseUrls(item.source_image_url);
                      const imgUrl = resultUrls[0] || sourceUrls[0] || '';
                      if (onUseAsEditBase && imgUrl) {
                        onUseAsEditBase(imgUrl);
                      }
                    }}
                    className="px-3.5 py-2 sm:py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl sm:rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-emerald-200 cursor-pointer sm:ml-auto"
                  >
                    <Scissors className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Edit Gambar
                  </button>
                </div>
              </div>
            );
          })}
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
        onReusePrompt={(p, m, t) => {
          onSelectPrompt(p, m, t);
          setSelectedItem(null);
        }}
        onReuseEditSession={(p, prim, adds) => {
          if (onReuseEditSession) onReuseEditSession(p, prim, adds);
          setSelectedItem(null);
        }}
        onUseAsEditBase={(img) => {
          if (onUseAsEditBase) onUseAsEditBase(img);
          setSelectedItem(null);
        }}
      />
    </div>
  );
}
