'use client';

import React, { useState, useEffect } from 'react';
import { X, Settings, Key, Globe, Sparkles, Scissors, Eye, EyeOff, Save, RefreshCw, CheckCircle2, ChevronDown } from 'lucide-react';
import { showToast, showError } from '@/lib/swal';
import { AVAILABLE_MODELS, AvailableModel, DEFAULT_MODEL, isValidModel } from '@/lib/models';

export interface AppConfigData {
  baseUrl: string;
  isConfigured: boolean;
  maskedToken: string;
  rawToken?: string;
  defaultGenerationsModel: string;
  defaultEditsModel: string;
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
    updatedAt?: string;
  } | null;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onSaveSuccess,
  currentConfig,
}: SettingsModalProps) {
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [token, setToken] = useState('');
  const [generationsModel, setGenerationsModel] = useState<AvailableModel>(DEFAULT_MODEL);
  const [editsModel, setEditsModel] = useState<AvailableModel>(DEFAULT_MODEL);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

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
            }
          })
          .catch(console.error);
      }
    }
  }, [isOpen, currentConfig]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-4 sm:my-8 max-h-[95vh] flex flex-col text-slate-900">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-sm">
          
          {/* Base URL Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-600" />
                Target Base URL
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
                API Token / Bearer Key
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
              Token disimpan dengan aman dan dikirimkan sebagai <code className="font-mono">Bearer Token</code>.
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

          {/* Footer / Submit Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || !baseUrl.trim() || !generationsModel.trim() || !editsModel.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
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

        </form>
      </div>
    </div>
  );
}
