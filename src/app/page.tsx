'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import GenerationsTab from '@/components/GenerationsTab';
import EditsTab from '@/components/EditsTab';
import HistoryTab from '@/components/HistoryTab';
import SettingsModal, { UserProfileData } from '@/components/SettingsModal';
import AuthCard from '@/components/AuthCard';

import { showConfirm, showToast } from '@/lib/swal';
import { isValidModel, DEFAULT_MODEL, DEFAULT_BASE_URL, type EditSessionData, type AvailableModel } from '@/lib/models';

interface AppConfig {
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

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserProfileData | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'generation' | 'edit' | 'history'>('generation');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'image' | 'enhancer' | 'profile' | 'storage'>('profile');
  const [historyCount, setHistoryCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // States for background processing tracking
  const [isGenerationLoading, setIsGenerationLoading] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const isProcessing = isGenerationLoading || isEditLoading;

  // States for reusing prompts and base images from history
  const [presetPrompt, setPresetPrompt] = useState<string>('');
  const [presetPromptKey, setPresetPromptKey] = useState<number>(0);
  const [presetPrimaryImage, setPresetPrimaryImage] = useState<string>('');
  const [presetPrimaryImageKey, setPresetPrimaryImageKey] = useState<number>(0);
  const [presetEditSession, setPresetEditSession] = useState<(EditSessionData & { key: number }) | null>(null);

  // 1. Prevent accidental window unload / tab close when processing
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isProcessing) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isProcessing]);

  // 2. Intercept F5 and Ctrl+R / Cmd+R with SweetAlert2 confirmation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isProcessing) return;

      const isF5 = e.key === 'F5';
      const isCtrlR = (e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R');

      if (isF5 || isCtrlR) {
        e.preventDefault();
        showConfirm({
          title: 'Proses Sedang Berjalan!',
          text: 'AI sedang memproses gambar Anda. Merefresh halaman dapat membatalkan tampilan hasil saat ini. Tetap ingin me-refresh?',
          confirmButtonText: 'Ya, Tetap Refresh',
          cancelButtonText: 'Batal (Tetap di Sini)',
          isDanger: true,
        }).then((confirmed) => {
          if (confirmed) {
            window.location.reload();
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProcessing]);

  const checkAuthSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/auth/me?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
          return data.user;
        }
      }
      setCurrentUser(null);
      return null;
    } catch (err) {
      console.error('Failed to check auth status:', err);
      setCurrentUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    checkAuthSession();
  }, [checkAuthSession]);

  const fetchConfigAndHistoryCount = useCallback(async () => {
    try {
      const [configRes, historyRes] = await Promise.all([
        fetch(`/api/config?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/history?limit=1&t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      // Sesi tidak valid (kedaluwarsa / sudah dihapus): paksa keluar agar UI tidak menampilkan sesi mati
      if (configRes.status === 401 || historyRes.status === 401) {
        setCurrentUser(null);
        setConfig(null);
        setHistoryCount(0);
        return;
      }

      if (configRes.ok) {
        const configData = await configRes.json().catch(() => null);
        if (configData) setConfig(configData);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json().catch(() => null);
        if (historyData) {
          setHistoryCount(historyData.summaryCounts?.all ?? historyData.total ?? historyData.count ?? 0);
        }
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchConfigAndHistoryCount();
    }
  }, [refreshTrigger, currentUser, fetchConfigAndHistoryCount]);

  // Sinkronisasi live saat window kembali aktif (menangkap perubahan dari device/tab lain atau sesi mati)
  useEffect(() => {
    const handleFocus = async () => {
      if (document.visibilityState !== 'visible') return;
      // checkAuthSession meng-update currentUser, yang otomatis memicu fetchConfigAndHistoryCount
      await checkAuthSession();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [checkAuthSession]);

  const handleLogout = async () => {
    const confirmed = await showConfirm({
      title: 'Keluar dari Akun?',
      text: 'Anda akan keluar dari sesi Private Studio saat ini.',
      confirmButtonText: 'Ya, Keluar',
      cancelButtonText: 'Batal',
      isDanger: true,
    });
    if (!confirmed) return;

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    setCurrentUser(null);
    setConfig(null);
    setHistoryCount(0);
    setIsSettingsOpen(false);
    showToast('Berhasil keluar dari akun', 'success');
  };

  const handleForceLogout = useCallback(() => {
    // Dipakai saat sesi diinvalidasi server (mis. ganti password) tanpa dialog konfirmasi
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setCurrentUser(null);
    setConfig(null);
    setHistoryCount(0);
    setIsSettingsOpen(false);
    showToast('Sesi berakhir. Silakan login kembali.', 'info');
  }, []);

  const handleOpenSettings = (tab: 'image' | 'enhancer' | 'profile' | 'storage' = 'profile') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSettingsSaveSuccess = (updatedConfig?: AppConfig) => {
    if (updatedConfig) {
      setConfig(updatedConfig);
    }
    fetchConfigAndHistoryCount();
  };

  const handleGenerationsModelChange = useCallback(async (newModel: string) => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationsModel: newModel }),
      });
      setConfig((prev) => (prev ? { ...prev, defaultGenerationsModel: newModel } : prev));
    } catch (e) {
      console.error('Failed to sync generations model:', e);
    }
  }, []);

  const handleEditsModelChange = useCallback(async (newModel: string) => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editsModel: newModel }),
      });
      setConfig((prev) => (prev ? { ...prev, defaultEditsModel: newModel } : prev));
    } catch (e) {
      console.error('Failed to sync edits model:', e);
    }
  }, []);

  const handleSelectPromptFromHistory = (prompt: string, historyModel: string, type: 'generation' | 'edit') => {
    setPresetPrompt(prompt);
    setPresetPromptKey(Date.now());
    if (historyModel && isValidModel(historyModel)) {
      if (type === 'generation') {
        handleGenerationsModelChange(historyModel);
      } else {
        handleEditsModelChange(historyModel);
      }
    }
    setActiveTab(type);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReuseEditSession = (session: EditSessionData) => {
    setPresetEditSession({
      ...session,
      key: Date.now(),
    });
    if (session.model && isValidModel(session.model)) {
      handleEditsModelChange(session.model as AvailableModel);
    }
    setActiveTab('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUseAsEditBase = (imageUrl?: string) => {
    setPresetPrompt('');
    if (imageUrl) {
      setPresetPrimaryImage(imageUrl);
      setPresetPrimaryImageKey(Date.now());
    }
    setActiveTab('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (currentUser === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-teal-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 text-white animate-pulse">
            <Sparkles className="w-6 h-6 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Memuat Spark AI Studio...</p>
        </div>
      </div>
    );
  }

  if (currentUser === null) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-purple-500/20 selection:text-purple-900">
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <AuthCard
            onAuthSuccess={(user) => {
              setCurrentUser(user);
              setRefreshTrigger((prev) => prev + 1);
            }}
          />
        </div>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
            <p>
              Made With Love by Febrian{' '}
              <a
                href="https://github.com/febrianyudhis"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition-colors"
              >
                @FebrianYudhis
              </a>
            </p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-purple-500/20 selection:text-purple-900">
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
        }}
        config={config}
        historyCount={historyCount}
        isGenerating={isGenerationLoading}
        isEditing={isEditLoading}
        currentUser={currentUser}
        onOpenSettings={handleOpenSettings}
        onLogout={handleLogout}
      />

      {/* Main Content Area: Persist tabs so switching never resets or cancels requests */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className={activeTab === 'generation' ? 'block' : 'hidden'}>
          <GenerationsTab
            defaultModel={config?.defaultGenerationsModel || DEFAULT_MODEL}
            baseUrl={config?.baseUrl || DEFAULT_BASE_URL}
            isConfigured={Boolean(config?.isConfigured)}
            onSuccess={handleSuccess}
            presetPrompt={presetPrompt}
            presetPromptKey={presetPromptKey}
            onLoadingChange={setIsGenerationLoading}
            onOpenSettings={() => handleOpenSettings('image')}
            onModelChange={handleGenerationsModelChange}
            onUseAsEditBase={handleUseAsEditBase}
          />
        </div>

        <div className={activeTab === 'edit' ? 'block' : 'hidden'}>
          <EditsTab
            defaultModel={config?.defaultEditsModel || DEFAULT_MODEL}
            baseUrl={config?.baseUrl || DEFAULT_BASE_URL}
            isConfigured={Boolean(config?.isConfigured)}
            onSuccess={handleSuccess}
            presetPrompt={presetPrompt}
            presetPromptKey={presetPromptKey}
            presetPrimaryImageUrl={presetPrimaryImage}
            presetPrimaryImageKey={presetPrimaryImageKey}
            presetEditSession={presetEditSession}
            onLoadingChange={setIsEditLoading}
            onOpenSettings={() => handleOpenSettings('image')}
            onModelChange={handleEditsModelChange}
          />
        </div>

        <div className={activeTab === 'history' ? 'block' : 'hidden'}>
          <HistoryTab
            onSelectPrompt={handleSelectPromptFromHistory}
            onReuseEditSession={handleReuseEditSession}
            onUseAsEditBase={handleUseAsEditBase}
            refreshTrigger={refreshTrigger}
            onUpdateHistory={handleSuccess}
          />
        </div>
      </main>

      {/* Settings Modal (SQLite Database configuration) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveSuccess={handleSettingsSaveSuccess}
        currentConfig={config}
        currentUser={currentUser}
        onUserProfileUpdated={(updatedUser) => setCurrentUser(updatedUser)}
        onLogout={handleLogout}
        onForceLogout={handleForceLogout}
        initialTab={settingsTab}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <p>
            Made With Love by Febrian{' '}
            <a
              href="https://github.com/febrianyudhis"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition-colors"
            >
              @FebrianYudhis
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
