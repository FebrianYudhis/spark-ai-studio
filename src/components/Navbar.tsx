'use client';

import React from 'react';
import { Sparkles, Scissors, History, RefreshCw, Settings, User, LogOut } from 'lucide-react';

interface NavbarProps {
  activeTab: 'generation' | 'edit' | 'history';
  setActiveTab: (tab: 'generation' | 'edit' | 'history') => void;
  config?: {
    baseUrl: string;
    isConfigured: boolean;
    maskedToken: string;
    defaultGenerationsModel: string;
    defaultEditsModel: string;
  } | null;
  historyCount: number;
  isGenerating?: boolean;
  isEditing?: boolean;
  currentUser?: {
    id: number;
    username: string;
    display_name?: string | null;
  } | null;
  onOpenSettings?: (tab?: 'image' | 'enhancer' | 'profile') => void;
  onLogout?: () => void;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  config,
  historyCount,
  isGenerating,
  isEditing,
  currentUser,
  onOpenSettings,
  onLogout,
}: NavbarProps) {
  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          
          {/* App Brand */}
          <div className="flex items-center gap-2 sm:gap-3 select-none shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-teal-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white transition-transform hover:scale-105">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none">
                Spark AI<span className="hidden sm:inline"> Studio</span>
              </h1>
              <p className="hidden md:block text-[11px] text-slate-500 mt-0.5">Image Generations, Edits &amp; History</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100/90 rounded-xl sm:rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveTab('generation')}
              className={`px-2.5 sm:px-3.5 md:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                activeTab === 'generation'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Image Generations"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Image Generations</span>
              <span className="hidden sm:inline md:hidden">Generations</span>
              <span className="sm:hidden">Gen</span>
              {isGenerating && (
                <span title="Memproses generation di background...">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-300" />
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('edit')}
              className={`px-2.5 sm:px-3.5 md:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                activeTab === 'edit'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Image Edits"
            >
              <Scissors className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Image Edits</span>
              <span className="hidden sm:inline md:hidden">Edits</span>
              <span className="sm:hidden">Edit</span>
              {isEditing && (
                <span title="Memproses edit di background...">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-300" />
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-2.5 sm:px-3.5 md:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Riwayat HIT API"
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Riwayat</span>
              {historyCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'history' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {historyCount}
                </span>
              )}
            </button>

            {onOpenSettings && (
              <button
                onClick={() => onOpenSettings()}
                className="px-2 sm:px-3 md:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer relative"
                title={config?.isConfigured ? 'Pengaturan API (Terkonfigurasi)' : 'Buka Pengaturan API (Kunci API Belum Diatur)'}
              >
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Pengaturan</span>
                {config && !config.isConfigured && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Kunci API belum diisi" />
                )}
              </button>
            )}

            {/* Profile / Account Badge & Quick Logout (Desktop only agar navbar mobile tetap ringkas dan lega) */}
            {currentUser && (
              <div className="hidden md:flex items-center gap-1 pl-1 border-l border-slate-200">
                <button
                  type="button"
                  onClick={() => onOpenSettings?.('profile')}
                  className="px-2.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                  title="Buka Profil Pengguna"
                >
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span className="max-w-[120px] truncate">
                    {currentUser.display_name || currentUser.username}
                  </span>
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Keluar dari akun (Logout)"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </nav>

        </div>
      </div>
    </header>
  );
}
