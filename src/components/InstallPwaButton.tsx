'use client';

import React, { useState, useEffect } from 'react';
import { DownloadCloud, Smartphone, Check, X } from 'lucide-react';
import { showToast } from '@/lib/swal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Cek apakah aplikasi sudah berjalan dalam mode PWA standalone
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Deteksi iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(isIosDevice);

    // Registrasi Service Worker untuk kepatuhan PWA dan memicu event beforeinstallprompt
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      showToast('Spark AI Studio berhasil dipasang di perangkat Anda!', 'success');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const [showDesktopGuide, setShowDesktopGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        showToast('Memasang Spark AI Studio...', 'info');
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      setShowDesktopGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer hover:shadow-md animate-pulse shrink-0"
        title="Pasang aplikasi di layar utama perangkat (Add to Home Screen)"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Install App</span>
        <span className="sm:hidden">Install</span>
      </button>

      {/* Panduan Instalasi Khusus iOS Safari */}
      {showIosGuide && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowIosGuide(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">Pasang di iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="text-xs space-y-2.5 text-slate-600 list-decimal list-inside">
              <li>
                Ketuk ikon <strong>Bagikan (Share)</strong> di bilah bawah browser Safari Anda.
              </li>
              <li>
                Gulir ke bawah dan pilih <strong>&quot;Tambahkan ke Layar Utama&quot; (Add to Home Screen)</strong>.
              </li>
              <li>
                Ketuk <strong>&quot;Tambah&quot; (Add)</strong> di pojok kanan atas.
              </li>
            </ol>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Panduan Instalasi Chrome / Edge / Browser Lain */}
      {showDesktopGuide && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDesktopGuide(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <DownloadCloud className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">Pasang Spark AI Studio</h3>
              </div>
              <button
                onClick={() => setShowDesktopGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Anda dapat memasang aplikasi web ini langsung dari browser untuk pengalaman layar penuh seperti aplikasi native:
            </p>

            <ol className="text-xs space-y-2.5 text-slate-600 list-decimal list-inside bg-slate-50 p-3 rounded-xl border border-slate-200">
              <li>
                <strong>Opsi 1 (Address Bar):</strong> Klik ikon <strong>Install (komputer / panah ke bawah)</strong> di sisi kanan bilah alamat (URL bar) browser Anda.
              </li>
              <li>
                <strong>Opsi 2 (Menu Browser):</strong> Klik menu titik tiga <strong>(⋮)</strong> di pojok kanan atas browser $\rightarrow$ pilih <strong>&quot;Install Spark AI Studio&quot;</strong> atau <strong>&quot;Simpan dan bagikan&quot; &gt; &quot;Pasang aplikasi ini&quot;</strong>.
              </li>
            </ol>

            <button
              onClick={() => setShowDesktopGuide(false)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
