'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Settings,
  Key,
  Globe,
  Sparkles,
  Scissors,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  Wand2,
  Image as ImageIcon,
  RotateCcw,
  Download,
  Upload,
} from 'lucide-react';
import { showToast, showError, showConfirm } from '@/lib/swal';
import { AVAILABLE_MODELS, AvailableModel, DEFAULT_MODEL, isValidModel, DEFAULT_ENHANCER_PROMPT } from '@/lib/models';

export interface AppConfigData {
  baseUrl: string;
  isConfigured: boolean;
  maskedToken: string;
  rawToken?: string;
  defaultGenerationsModel: string;
  defaultEditsModel: string;
  enhancerBaseUrl?: string;
  enhancerToken?: string;
  isEnhancerConfigured?: boolean;
  maskedEnhancerToken?: string;
  enhancerModel?: string;
  enhancerPrompt?: string;
  updatedAt?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (updatedConfig?: AppConfigData) => void;
  currentConfig?: {
    baseUrl: string;
    rawToken?: string;
    defaultGenerationsModel: string;
    defaultEditsModel: string;
    enhancerBaseUrl?: string;
    enhancerToken?: string;
    enhancerModel?: string;
    enhancerPrompt?: string;
    updatedAt?: string;
  } | null;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onSaveSuccess,
  currentConfig,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'enhancer'>('image');

  // Image Studio Settings State
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [token, setToken] = useState('');
  const [generationsModel, setGenerationsModel] = useState<AvailableModel>(DEFAULT_MODEL);
  const [editsModel, setEditsModel] = useState<AvailableModel>(DEFAULT_MODEL);
  const [showToken, setShowToken] = useState(false);

  // Prompt Enhancer Settings State
  const [enhancerBaseUrl, setEnhancerBaseUrl] = useState('https://api.openai.com/v1');
  const [enhancerToken, setEnhancerToken] = useState('');
  const [enhancerModel, setEnhancerModel] = useState('gpt-4o-mini');
  const [enhancerPrompt, setEnhancerPrompt] = useState(DEFAULT_ENHANCER_PROMPT);
  const [showEnhancerToken, setShowEnhancerToken] = useState(false);

  const [saving, setSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (currentConfig) {
        setBaseUrl(currentConfig.baseUrl || 'https://api.openai.com/v1');
        setToken(currentConfig.rawToken || '');
        setGenerationsModel(
          currentConfig.defaultGenerationsModel && isValidModel(currentConfig.defaultGenerationsModel)
            ? currentConfig.defaultGenerationsModel
            : DEFAULT_MODEL
        );
        setEditsModel(
          currentConfig.defaultEditsModel && isValidModel(currentConfig.defaultEditsModel)
            ? currentConfig.defaultEditsModel
            : DEFAULT_MODEL
        );
        setEnhancerBaseUrl(currentConfig.enhancerBaseUrl || 'https://api.openai.com/v1');
        setEnhancerToken(currentConfig.enhancerToken || '');
        setEnhancerModel(currentConfig.enhancerModel || 'gpt-4o-mini');
        setEnhancerPrompt(
          currentConfig.enhancerPrompt !== undefined && currentConfig.enhancerPrompt !== null
            ? currentConfig.enhancerPrompt
            : DEFAULT_ENHANCER_PROMPT
        );
      } else {
        // Fetch if not provided
        fetch(`/api/config?t=${Date.now()}`, { cache: 'no-store' })
          .then((res) => res.json())
          .then((data) => {
            if (data) {
              setBaseUrl(data.baseUrl || 'https://api.openai.com/v1');
              setToken(data.rawToken || '');
              setGenerationsModel(
                data.defaultGenerationsModel && isValidModel(data.defaultGenerationsModel)
                  ? data.defaultGenerationsModel
                  : DEFAULT_MODEL
              );
              setEditsModel(
                data.defaultEditsModel && isValidModel(data.defaultEditsModel)
                  ? data.defaultEditsModel
                  : DEFAULT_MODEL
              );
              setEnhancerBaseUrl(data.enhancerBaseUrl || 'https://api.openai.com/v1');
              setEnhancerToken(data.enhancerToken || '');
              setEnhancerModel(data.enhancerModel || 'gpt-4o-mini');
              setEnhancerPrompt(
                data.enhancerPrompt !== undefined && data.enhancerPrompt !== null
                  ? data.enhancerPrompt
                  : DEFAULT_ENHANCER_PROMPT
              );
            }
          })
          .catch(console.error);
      }
    }
  }, [isOpen, currentConfig]);

  // Menutup modal dengan tombol Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          token: token.trim(),
          generationsModel: generationsModel.trim(),
          editsModel: editsModel.trim(),
          enhancerBaseUrl: enhancerBaseUrl.trim(),
          enhancerToken: enhancerToken.trim(),
          enhancerModel: enhancerModel.trim(),
          enhancerPrompt: enhancerPrompt.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Pengaturan berhasil disimpan!', 'success');
        onSaveSuccess(data.config);
        onClose();
      } else {
        showError('Gagal Menyimpan', data.error || 'Gagal menyimpan pengaturan ke database');
      }
    } catch {
      showError('Koneksi Gagal', 'Koneksi ke server gagal');
    } finally {
      setSaving(false);
    }
  };

  const handleExportSettings = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/config?export=download&t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Gagal mengambil data pengaturan`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spark_ai_studio_settings_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('Pengaturan berhasil diekspor ke berkas JSON!', 'success');
    } catch (err: unknown) {
      showError('Gagal Ekspor Pengaturan', err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSettings = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input agar berkas yang sama bisa dipilih ulang jika diperlukan
    e.target.value = '';

    setIsImporting(true);
    try {
      const text = await file.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('Berkas yang diunggah tidak berformat JSON yang valid.');
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Format isi berkas pengaturan tidak sesuai.');
      }

      // Ambil objek data pengaturan (baik dalam wrapper { settings: { ... } } maupun format datar)
      const settingsData = (parsed.settings && typeof parsed.settings === 'object')
        ? (parsed.settings as Record<string, unknown>)
        : parsed;

      // Ekstrak HANYA field pengaturan (tidak menyentuh riwayat atau data lain)
      const importedBaseUrl = typeof (settingsData.base_url ?? settingsData.baseUrl) === 'string'
        ? String(settingsData.base_url ?? settingsData.baseUrl).trim()
        : baseUrl;
      const importedToken = typeof (settingsData.api_token ?? settingsData.token ?? settingsData.rawToken) === 'string'
        ? String(settingsData.api_token ?? settingsData.token ?? settingsData.rawToken).trim()
        : token;
      const importedGenModel = typeof (settingsData.generations_model ?? settingsData.generationsModel) === 'string'
        ? String(settingsData.generations_model ?? settingsData.generationsModel).trim()
        : generationsModel;
      const importedEditModel = typeof (settingsData.edits_model ?? settingsData.editsModel) === 'string'
        ? String(settingsData.edits_model ?? settingsData.editsModel).trim()
        : editsModel;
      const importedEnhancerBaseUrl = typeof (settingsData.enhancer_base_url ?? settingsData.enhancerBaseUrl) === 'string'
        ? String(settingsData.enhancer_base_url ?? settingsData.enhancerBaseUrl).trim()
        : enhancerBaseUrl;
      const importedEnhancerToken = typeof (settingsData.enhancer_api_token ?? settingsData.enhancerToken) === 'string'
        ? String(settingsData.enhancer_api_token ?? settingsData.enhancerToken).trim()
        : enhancerToken;
      const importedEnhancerModel = typeof (settingsData.enhancer_model ?? settingsData.enhancerModel) === 'string'
        ? String(settingsData.enhancer_model ?? settingsData.enhancerModel).trim()
        : enhancerModel;
      const importedEnhancerPrompt = typeof (settingsData.enhancer_prompt ?? settingsData.enhancerPrompt) === 'string'
        ? String(settingsData.enhancer_prompt ?? settingsData.enhancerPrompt).trim()
        : enhancerPrompt;

      // Konfirmasi keamanan SweetAlert2 sebelum menerapkan
      const confirmed = await showConfirm({
        title: 'Impor Pengaturan?',
        text: `Ditemukan pengaturan dari berkas "${file.name}". Pengaturan saat ini akan digantikan dengan data dari berkas ini. Riwayat dan gambar tidak akan terpengaruh. Lanjutkan?`,
        confirmButtonText: 'Ya, Terapkan Pengaturan',
        cancelButtonText: 'Batal',
        isDanger: false,
      });

      if (!confirmed) return;

      // Kirim dan simpan ke backend /api/config
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: importedBaseUrl,
          token: importedToken,
          generationsModel: importedGenModel,
          editsModel: importedEditModel,
          enhancerBaseUrl: importedEnhancerBaseUrl,
          enhancerToken: importedEnhancerToken,
          enhancerModel: importedEnhancerModel,
          enhancerPrompt: importedEnhancerPrompt,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan pengaturan yang diimpor.');
      }

      // Perbarui form state di modal
      setBaseUrl(importedBaseUrl);
      setToken(importedToken);
      if (isValidModel(importedGenModel)) setGenerationsModel(importedGenModel);
      if (isValidModel(importedEditModel)) setEditsModel(importedEditModel);
      setEnhancerBaseUrl(importedEnhancerBaseUrl);
      setEnhancerToken(importedEnhancerToken);
      setEnhancerModel(importedEnhancerModel);
      setEnhancerPrompt(importedEnhancerPrompt);

      // Sinkronkan state konfigurasi aplikasi parent
      onSaveSuccess(data.config);

      showToast('Pengaturan berhasil diimpor dan disimpan!', 'success');
    } catch (err: unknown) {
      showError('Gagal Impor Pengaturan', err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-2 sm:p-4 overflow-hidden"
    >
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] flex flex-col text-slate-900">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Pengaturan API AI
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 pt-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={`pb-2.5 px-3.5 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'image'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Image</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enhancer')}
            className={`pb-2.5 px-3.5 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'enhancer'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wand2 className="w-4 h-4 text-purple-600" />
            <span>Enhancer</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 min-h-0 text-sm overscroll-contain">
          
          {/* TAB 1: Image */}
          {activeTab === 'image' && (
            <div className="space-y-5">
              {/* Base URL Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
                    Target Base URL Image API
                  </label>
                  <button
                    type="button"
                    onClick={() => setBaseUrl('https://api.openai.com/v1')}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer"
                  >
                    Reset ke Default OpenAI
                  </button>
                </div>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1 atau proxy gateway"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                  required
                />
                <p className="text-[11px] text-slate-500">
                  Endpoint yang dituju: <code className="font-mono text-slate-700 font-semibold">{baseUrl.replace(/\/+$/, '')}/images/generations</code> &amp; <code className="font-mono text-slate-700 font-semibold">/images/edits</code>
                </p>
              </div>

              {/* API Token Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    API Token / Bearer Key (Image Studio)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {token ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Token Tersedia
                      </span>
                    ) : (
                      <span className="text-rose-600 font-medium">Belum Diatur</span>
                    )}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title={showToken ? 'Sembunyikan Token' : 'Lihat Token'}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Token disimpan dengan aman dan dikirimkan sebagai <code className="font-mono">Bearer Token</code> untuk request gambar.
                </p>
              </div>

              {/* Model Generations Dropdown */}
              <div className="space-y-2 p-3.5 bg-purple-50/50 border border-purple-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <label htmlFor="generations-model-select" className="text-xs font-semibold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Model Default Image Generations
                  </label>
                  <span className="text-[10px] font-mono text-purple-700 font-bold bg-purple-100 px-1.5 py-0.5 rounded">
                    Generations
                  </span>
                </div>
                <div className="relative">
                  <select
                    id="generations-model-select"
                    value={generationsModel}
                    onChange={(e) => setGenerationsModel(e.target.value as AvailableModel)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-white border border-purple-300 rounded-xl text-xs sm:text-sm font-mono font-semibold text-purple-950 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 cursor-pointer pr-10 transition-all shadow-2xs"
                    required
                  >
                    {AVAILABLE_MODELS.map((m) => (
                      <option key={m} value={m} className="font-mono py-1 text-slate-800">
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-purple-700">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Pilih model AI default untuk pembuatan gambar dari teks (Generations).
                </p>
              </div>

              {/* Model Edits Dropdown */}
              <div className="space-y-2 p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <label htmlFor="edits-model-select" className="text-xs font-semibold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-emerald-600" />
                    Model Default Image Edits
                  </label>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                    Edits
                  </span>
                </div>
                <div className="relative">
                  <select
                    id="edits-model-select"
                    value={editsModel}
                    onChange={(e) => setEditsModel(e.target.value as AvailableModel)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs sm:text-sm font-mono font-semibold text-emerald-950 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer pr-10 transition-all shadow-2xs"
                    required
                  >
                    {AVAILABLE_MODELS.map((m) => (
                      <option key={m} value={m} className="font-mono py-1 text-slate-800">
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-700">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Pilih model AI default untuk pengeditan gambar (Edits).
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Enhancer */}
          {activeTab === 'enhancer' && (
            <div className="space-y-5">
              {/* Enhancer Base URL Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-purple-600" />
                    Base URL Enhancer
                  </label>
                  <button
                    type="button"
                    onClick={() => setEnhancerBaseUrl('https://api.openai.com/v1')}
                    className="text-[11px] text-purple-600 hover:text-purple-800 font-medium hover:underline cursor-pointer"
                  >
                    Reset ke Default OpenAI
                  </button>
                </div>
                <input
                  type="url"
                  value={enhancerBaseUrl}
                  onChange={(e) => setEnhancerBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all"
                  required
                />
                <p className="text-[11px] text-slate-500">
                  Endpoint Chat Completions: <code className="font-mono text-slate-700 font-semibold">{enhancerBaseUrl.replace(/\/+$/, '')}/chat/completions</code>
                </p>
              </div>

              {/* Enhancer API Token Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    API Token Enhancer <span className="text-rose-600">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {enhancerToken ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Token Tersedia
                      </span>
                    ) : (
                      <span className="text-rose-600 font-medium">Wajib Diisi</span>
                    )}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showEnhancerToken ? 'text' : 'password'}
                    value={enhancerToken}
                    onChange={(e) => setEnhancerToken(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEnhancerToken((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title={showEnhancerToken ? 'Sembunyikan Token' : 'Lihat Token'}
                  >
                    {showEnhancerToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Token khusus untuk fitur Prompt Enhancer (wajib diisi agar tombol <span className="font-semibold text-purple-700">Enhance Prompt</span> berfungsi).
                </p>
              </div>

              {/* Enhancer Model Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-purple-600" />
                    Model Chat Completions
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400">Pilihan cepat:</span>
                    <button
                      type="button"
                      onClick={() => setEnhancerModel('gpt-4o-mini')}
                      className="px-1.5 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer"
                    >
                      gpt-4o-mini
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnhancerModel('gpt-4o')}
                      className="px-1.5 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer"
                    >
                      gpt-4o
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={enhancerModel}
                  onChange={(e) => setEnhancerModel(e.target.value)}
                  placeholder="misal: gpt-4o-mini, gpt-4o, dsb"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all"
                  required
                />
                <p className="text-[11px] text-slate-500">
                  Model LLM yang digunakan untuk merewrite dan memperkaya prompt teks menjadi lebih deskriptif visual.
                </p>
              </div>

              {/* Enhancer System / Template Prompt */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Instruksi Prompt Enhancer (System Prompt)
                  </label>
                  <button
                    type="button"
                    onClick={() => setEnhancerPrompt(DEFAULT_ENHANCER_PROMPT)}
                    className="text-[11px] text-purple-600 hover:text-purple-800 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset ke Template Bawaan
                  </button>
                </div>
                <textarea
                  value={enhancerPrompt}
                  onChange={(e) => setEnhancerPrompt(e.target.value)}
                  rows={6}
                  placeholder="Instruksi sistem untuk memandu AI dalam merewrite prompt..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all resize-y leading-relaxed"
                  required
                />
                <p className="text-[11px] text-slate-500">
                  Instruksi panduan bagi model AI dalam memperkaya prompt pengguna (misal: mempertajam lighting, detail tekstur, komposisi artistik, dll).
                </p>
              </div>
            </div>
          )}

          </div>

          {/* Footer / Action Buttons (Pinned at Bottom) */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            {/* Left: Export & Import buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportSettings}
                disabled={isExporting || isImporting || saving}
                className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                title="Unduh seluruh konfigurasi pengaturan saat ini ke berkas JSON"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isExporting ? 'Mengekspor...' : 'Ekspor Pengaturan'}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExporting || isImporting || saving}
                className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                title="Muat konfigurasi pengaturan dari berkas JSON"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isImporting ? 'Mengimpor...' : 'Impor Pengaturan'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportSettings}
                className="hidden"
              />
            </div>

            {/* Right: Batal & Simpan Pengaturan */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg sm:rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || !baseUrl.trim() || !generationsModel.trim() || !editsModel.trim()}
                className="px-4 sm:px-5 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Pengaturan</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
