'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import GenerationsTab from '@/components/GenerationsTab';
import EditsTab from '@/components/EditsTab';
import HistoryTab from '@/components/HistoryTab';
import SettingsModal from '@/components/SettingsModal';

import { showConfirm } from '@/lib/swal';
import { isValidModel, type EditSessionData, type AvailableModel } from '@/lib/models';

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
  updatedAt?: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'generation' | 'edit' | 'history'>('generation');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  const fetchConfigAndHistoryCount = async () => {
    try {
      const [configRes, historyRes] = await Promise.all([
        fetch(`/api/config?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/history?limit=1&t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistoryCount(historyData.summaryCounts?.all ?? historyData.total ?? historyData.count ?? 0);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    fetchConfigAndHistoryCount();
  }, [refreshTrigger]);

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
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area: Persist tabs so switching never resets or cancels requests */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className={activeTab === 'generation' ? 'block' : 'hidden'}>
          <GenerationsTab
            defaultModel={config?.defaultGenerationsModel || 'gpt-image-2.5'}
            baseUrl={config?.baseUrl || 'https://api.openai.com/v1'}
            isConfigured={Boolean(config?.isConfigured)}
            onSuccess={handleSuccess}
            presetPrompt={presetPrompt}
            presetPromptKey={presetPromptKey}
            onLoadingChange={setIsGenerationLoading}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onModelChange={handleGenerationsModelChange}
          />
        </div>

        <div className={activeTab === 'edit' ? 'block' : 'hidden'}>
          <EditsTab
            defaultModel={config?.defaultEditsModel || 'gpt-image-2.5'}
            baseUrl={config?.baseUrl || 'https://api.openai.com/v1'}
            isConfigured={Boolean(config?.isConfigured)}
            onSuccess={handleSuccess}
            presetPrompt={presetPrompt}
            presetPromptKey={presetPromptKey}
            presetPrimaryImageUrl={presetPrimaryImage}
            presetPrimaryImageKey={presetPrimaryImageKey}
            presetEditSession={presetEditSession}
            onLoadingChange={setIsEditLoading}
            onOpenSettings={() => setIsSettingsOpen(true)}
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
