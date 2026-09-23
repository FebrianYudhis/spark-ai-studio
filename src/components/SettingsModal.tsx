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
  User,
  LogOut,
  Lock,
  HardDrive,
  Trash2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { showToast, showError, showConfirm, showSuccess } from '@/lib/swal';
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
  retentionDays?: number;
  retentionMaxItems?: number;
  updatedAt?: string;
}

export interface UserProfileData {
  id: number;
  username: string;
  display_name?: string | null;
  created_at?: string;
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
    retentionDays?: number;
    retentionMaxItems?: number;
    updatedAt?: string;
  } | null;
  currentUser?: UserProfileData | null;
  onUserProfileUpdated?: (user: UserProfileData) => void;
  onLogout?: () => void;
  initialTab?: 'image' | 'enhancer' | 'profile' | 'storage';
}

export default function SettingsModal({
  isOpen,
  onClose,
  onSaveSuccess,
  currentConfig,
  currentUser,
  onUserProfileUpdated,
  onLogout,
  initialTab = 'image',
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'enhancer' | 'profile' | 'storage'>(initialTab);

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

  // Storage & Retention State
  const [retentionDays, setRetentionDays] = useState(0);
  const [retentionMaxItems, setRetentionMaxItems] = useState(0);
  const [storageStats, setStorageStats] = useState<{
    totalFiles: number;
    totalSizeBytes: number;
    activeFiles: number;
    activeSizeBytes: number;
    orphanedFiles: number;
    orphanedSizeBytes: number;
    formattedTotalSize: string;
    formattedActiveSize: string;
    formattedOrphanedSize: string;
  } | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [applyingRetention, setApplyingRetention] = useState(false);
  const [cleaningOrphaned, setCleaningOrphaned] = useState(false);

  // Profile Management State
  const [profileDisplayName, setProfileDisplayName] = useState(currentUser?.display_name || currentUser?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStorageStats = async () => {
    try {
      setLoadingStorage(true);
      const res = await fetch(`/api/storage?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.stats) {
        setStorageStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch storage stats:', err);
    } finally {
      setLoadingStorage(false);
    }
  };

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
        setRetentionDays(currentConfig.retentionDays ?? 0);
        setRetentionMaxItems(currentConfig.retentionMaxItems ?? 0);
      } else {
        // Fetch if not provided
        fetch(`/api/config?t=${Date.now()}`, { cache: 'no-store' })
          .then((res) => res.json())
          .then((data) => {
            if (data) {
        setBaseUrl(data.baseUrl || 'https://api.openai.com/v1');
        setToken('');
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
              setRetentionDays(data.retentionDays ?? 0);
              setRetentionMaxItems(data.retentionMaxItems ?? 0);
            }
          })
          .catch(console.error);
      }
      fetchStorageStats();
    }
  }, [isOpen, currentConfig]);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Menutup modal dengan tombol Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Sinkronisasi data profil pengguna saat user berganti atau modal dibuka
  useEffect(() => {
    if (currentUser) {
      setProfileDisplayName(currentUser.display_name || currentUser.username || '');
    }
  }, [currentUser, isOpen]);

  const handleUpdateDisplayName = async () => {
    if (!profileDisplayName.trim()) {
      showToast('Nama tampilan tidak boleh kosong', 'warning');
      return;
    }
    setSavingDisplayName(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: profileDisplayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengubah nama tampilan');
      }
      showToast(data.message || 'Nama tampilan berhasil disimpan!', 'success');
      if (data.user && onUserProfileUpdated) {
        onUserProfileUpdated(data.user);
      }
    } catch (err: unknown) {
      showError('Gagal Mengubah Profil', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSavingDisplayName(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      showToast('Masukkan password saat ini', 'warning');
      return;
    }
    if (!newPassword) {
      showToast('Masukkan password baru', 'warning');
      return;
    }
    if (newPassword.length < 4) {
      showToast('Password baru minimal 4 karakter', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi password baru tidak cocok', 'warning');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengubah password');
      }
      showToast(data.message || 'Password berhasil diperbarui!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (data.user && onUserProfileUpdated) {
        onUserProfileUpdated(data.user);
      }
    } catch (err: unknown) {
      showError('Gagal Mengubah Password', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    onLogout?.();
  };

  const handleApplyRetention = async () => {
    const desc = retentionDays > 0 || retentionMaxItems > 0
      ? `Sistem akan menghapus riwayat yang lebih tua dari ${retentionDays > 0 ? `${retentionDays} hari` : 'waktu'} atau melampaui ${retentionMaxItems > 0 ? `${retentionMaxItems} item` : 'kuota'} sesuai aturan yang Anda tetapkan.`
      : 'Aturan retensi saat ini diset ke "Selamanya" dan "Tanpa Batas".';

    if (retentionDays <= 0 && retentionMaxItems <= 0) {
      showToast('Kebijakan retensi diset Simpan Selamanya. Ubah batas hari atau jumlah item untuk menerapkan pembersihan.', 'info');
      return;
    }

    const confirmed = await showConfirm({
      title: 'Terapkan Retensi Sekarang?',
      text: `${desc} File gambar fisik yang sudah tidak dipakai juga akan dihapus. Lanjutkan?`,
      confirmButtonText: 'Ya, Terapkan',
      cancelButtonText: 'Batal',
    });
    if (!confirmed) return;

    try {
      setApplyingRetention(true);
      const res = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply_retention' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess('Retensi Berhasil', data.message || 'Kebijakan retensi berhasil diterapkan.');
        fetchStorageStats();
      } else {
        showError('Gagal Menerapkan Retensi', data.error || 'Terjadi kesalahan sistem.');
      }
    } catch (err) {
      showError('Gagal Menerapkan Retensi', err instanceof Error ? err.message : String(err));
    } finally {
      setApplyingRetention(false);
    }
  };

  const handleCleanOrphaned = async () => {
    const confirmed = await showConfirm({
      title: 'Bersihkan File Sampah?',
      text: 'Sistem akan memindai folder uploads dan menghapus file gambar yatim (orphaned) yang tidak lagi terhubung ke riwayat manapun (dengan proteksi grace period 15 menit).',
      confirmButtonText: 'Bersihkan Sekarang',
      cancelButtonText: 'Batal',
      isDanger: true,
    });
    if (!confirmed) return;

    try {
      setCleaningOrphaned(true);
      const res = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clean_orphaned' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess('Pembersihan Selesai', data.message || 'File sampah berhasil dibersihkan.');
        fetchStorageStats();
      } else {
        showError('Gagal Membersihkan', data.error || 'Terjadi kesalahan');
      }
    } catch (err) {
      showError('Gagal Membersihkan', err instanceof Error ? err.message : String(err));
    } finally {
      setCleaningOrphaned(false);
    }
  };

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
          retentionDays,
          retentionMaxItems,
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
      const importedToken = typeof (settingsData.maskedToken ?? settingsData.maskedToken) === 'string'
        ? String(settingsData.maskedToken ?? settingsData.maskedToken).trim()
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
      const importedEnhancerToken = typeof (settingsData.maskedEnhancerToken) === 'string'
        ? String(settingsData.maskedEnhancerToken).trim()
        : enhancerToken;
      const importedEnhancerModel = typeof (settingsData.enhancer_model ?? settingsData.enhancerModel) === 'string'
        ? String(settingsData.enhancer_model ?? settingsData.enhancerModel).trim()
        : enhancerModel;
      const importedEnhancerPrompt = typeof (settingsData.enhancer_prompt ?? settingsData.enhancerPrompt) === 'string'
        ? String(settingsData.enhancer_prompt ?? settingsData.enhancerPrompt).trim()
        : enhancerPrompt;
      const importedRetentionDays = settingsData.retention_days !== undefined
        ? Number(settingsData.retention_days)
        : (settingsData.retentionDays !== undefined ? Number(settingsData.retentionDays) : retentionDays);
      const importedRetentionMaxItems = settingsData.retention_max_items !== undefined
        ? Number(settingsData.retention_max_items)
        : (settingsData.retentionMaxItems !== undefined ? Number(settingsData.retentionMaxItems) : retentionMaxItems);

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
          retentionDays: importedRetentionDays,
          retentionMaxItems: importedRetentionMaxItems,
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
      setRetentionDays(importedRetentionDays);
      setRetentionMaxItems(importedRetentionMaxItems);

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
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-3.5 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4 text-indigo-600" />
            <span>Profile</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('storage');
              fetchStorageStats();
            }}
            className={`pb-2.5 px-3.5 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'storage'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDrive className="w-4 h-4 text-emerald-600" />
            <span>Penyimpanan</span>
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

          {/* TAB 3: Profile */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {currentUser ? (
                <div className="space-y-4">
                  {/* User Profile Card */}
                  <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50/80 via-slate-50 to-purple-50/70 rounded-2xl border border-indigo-100 shadow-xs flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-teal-500 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-indigo-500/20 shrink-0 select-none uppercase">
                      {currentUser.username.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 truncate">
                          {currentUser.display_name || currentUser.username}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Aktif
                        </span>
                      </div>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">@{currentUser.username}</p>
                      {currentUser.created_at && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Terdaftar sejak {new Date(currentUser.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Section 1: Ganti Nama Tampilan */}
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-600" />
                        Nama Tampilan (Display Name)
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Nama yang ditampilkan di header studio dan watermark unduhan.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={profileDisplayName}
                        onChange={(e) => setProfileDisplayName(e.target.value)}
                        placeholder="Masukkan nama tampilan Anda"
                        maxLength={50}
                        className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                      />
                      <button
                        type="button"
                        onClick={handleUpdateDisplayName}
                        disabled={savingDisplayName || !profileDisplayName.trim() || profileDisplayName === (currentUser.display_name || currentUser.username)}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer shrink-0"
                      >
                        {savingDisplayName ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Simpan Nama</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Ubah Password */}
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-indigo-600" />
                        Ubah Password Akun
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Ganti password login studio Anda (minimal 4 karakter).
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Password Saat Ini
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Masukkan password saat ini"
                            className="w-full pl-3.5 pr-10 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Password Baru
                          </label>
                          <div className="relative">
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Minimal 4 karakter"
                              className="w-full pl-3.5 pr-10 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Konfirmasi Password Baru
                          </label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Ulangi password baru"
                              className="w-full pl-3.5 pr-10 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {newPassword && confirmPassword && (
                        <p className={`text-[11px] font-medium ${newPassword === confirmPassword ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {newPassword === confirmPassword ? '✓ Konfirmasi password cocok' : '✗ Konfirmasi password belum cocok'}
                        </p>
                      )}

                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={handleUpdatePassword}
                          disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 4}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                        >
                          {savingPassword ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Memproses...</span>
                            </>
                          ) : (
                            <>
                              <Key className="w-3.5 h-3.5" />
                              <span>Perbarui Password</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Keluar dari Sesi */}
                  <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-100 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-rose-900">Keluar dari Sesi</p>
                      <p className="text-[11px] text-rose-600">Akhiri sesi Private Studio pada perangkat ini.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                  <User className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-800">Sesi Akun Belum Aktif</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Silakan masuk atau daftar akun baru terlebih dahulu untuk mengakses studio.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Storage & Retensi */}
          {activeTab === 'storage' && (
            <div className="space-y-6">
              {/* Box 1: Info & Statistik Penggunaan Disk */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800">Kapasitas Penyimpanan Disk</h3>
                  </div>
                  <button
                    type="button"
                    onClick={fetchStorageStats}
                    disabled={loadingStorage}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    title="Muat ulang statistik penyimpanan"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingStorage ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Terpakai</p>
                    <p className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                      {storageStats?.formattedTotalSize || '0 B'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{storageStats?.totalFiles ?? 0} berkas gambar</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Gambar Aktif</p>
                    <p className="text-base sm:text-lg font-bold text-emerald-700 mt-0.5">
                      {storageStats?.formattedActiveSize || '0 B'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{storageStats?.activeFiles ?? 0} terhubung riwayat</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">File Sampah (Orphan)</p>
                    <p className="text-base sm:text-lg font-bold text-amber-700 mt-0.5">
                      {storageStats?.formattedOrphanedSize || '0 B'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{storageStats?.orphanedFiles ?? 0} tidak bertuan</p>
                  </div>
                </div>

                {(storageStats?.orphanedFiles ?? 0) > 0 && (
                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-200">
                    <p className="text-xs text-slate-600">
                      Terdapat <strong className="text-slate-800">{storageStats?.orphanedFiles} file sampah</strong> ({storageStats?.formattedOrphanedSize}) yang tidak lagi tercatat di riwayat.
                    </p>
                    <button
                      type="button"
                      onClick={handleCleanOrphaned}
                      disabled={cleaningOrphaned}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{cleaningOrphaned ? 'Membersihkan...' : 'Bersihkan Sampah'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Box 2: Aturan Kebijakan Retensi Otomatis */}
              <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">Kebijakan Retensi Riwayat Otomatis</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Pilihan Masa Simpan Hari */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>Masa Simpan (Umur Maksimal)</span>
                    </label>
                    <select
                      value={retentionDays}
                      onChange={(e) => setRetentionDays(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all cursor-pointer"
                    >
                      <option value={0}>Simpan Selamanya (Nonaktif)</option>
                      <option value={7}>7 Hari</option>
                      <option value={14}>14 Hari</option>
                      <option value={30}>30 Hari (Disarankan)</option>
                      <option value={60}>60 Hari</option>
                      <option value={90}>90 Hari</option>
                    </select>
                    <p className="text-[10px] text-slate-500">
                      Riwayat yang lebih tua dari batas hari ini akan otomatis dibersihkan.
                    </p>
                  </div>

                  {/* Pilihan Batas Kuota Jumlah Item */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>Batas Maksimal Jumlah Item</span>
                    </label>
                    <select
                      value={retentionMaxItems}
                      onChange={(e) => setRetentionMaxItems(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all cursor-pointer"
                    >
                      <option value={0}>Tanpa Batas Kuota (Nonaktif)</option>
                      <option value={50}>Maksimal 50 Item Terbaru</option>
                      <option value={100}>Maksimal 100 Item Terbaru (Disarankan)</option>
                      <option value={250}>Maksimal 250 Item Terbaru</option>
                      <option value={500}>Maksimal 500 Item Terbaru</option>
                    </select>
                    <p className="text-[10px] text-slate-500">
                      Jika jumlah riwayat melebihi kuota ini, item yang paling lama akan dihapus.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 p-4 sm:p-5 rounded-b-xl sm:rounded-b-2xl">
                  <div className="flex items-center gap-2 text-slate-600 text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Aturan retensi otomatis dieksekusi di background saat Anda login.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyRetention}
                    disabled={applyingRetention || (retentionDays === 0 && retentionMaxItems === 0)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${applyingRetention ? 'animate-spin' : ''}`} />
                    <span>{applyingRetention ? 'Menerapkan...' : 'Terapkan Retensi Sekarang'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          </div>

          {/* Footer / Action Buttons (Pinned at Bottom) */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            {/* Left: Export & Import buttons (Seragam di semua tab) */}
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

            {/* Right: Action Buttons */}
            {activeTab === 'profile' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg sm:rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            ) : (
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
            )}
          </div>

        </form>
      </div>
    </div>
  );
}
