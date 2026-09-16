'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Smartphone,
  Monitor,
  Share2,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  X,
  Sparkles,
  Zap,
} from 'lucide-react';
import { showToast } from '@/lib/swal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Cek apakah aplikasi sudah berjalan dalam mode PWA standalone
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Deteksi sistem operasi / peramban untuk tab default yang paling relevan
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    const isAndroidDevice = /android/.test(ua);

    if (isIosDevice) {
      setActiveTab('ios');
    } else if (isAndroidDevice) {
      setActiveTab('android');
    } else {
      setActiveTab('desktop');
    }

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
      setShowModal(false);
      showToast('Spark AI Studio berhasil dipasang di perangkat Anda!', 'success');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Tutup modal dengan tombol Escape
  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    // Jika prompt bawaan browser sudah siap, langsung picu native prompt
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          showToast('Memasang Spark AI Studio...', 'info');
        }
        setDeferredPrompt(null);
        return;
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }

    // Tampilkan modal panduan instalasi
    setShowModal(true);
  };

  const triggerNativePrompt = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        showToast('Memasang Spark AI Studio...', 'info');
      }
      setDeferredPrompt(null);
      setShowModal(false);
    } catch (err) {
      console.warn('Install prompt trigger error:', err);
    }
  };

  const modalContent = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowModal(false);
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      style={{ minHeight: '100dvh' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 text-slate-800 flex flex-col max-h-[85dvh] overflow-hidden my-auto animate-in zoom-in-95 duration-150"
      >
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-indigo-50/30 to-purple-50/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                Pasang Spark AI Studio
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengalaman aplikasi penuh tanpa bilah browser
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Banner Opsi Cepat Jika Browser Mendukung Native Prompt */}
          {deferredPrompt && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-teal-500/10 border border-indigo-200/80 flex items-center justify-between gap-3 shadow-xs">
              <div className="text-xs text-slate-800">
                <p className="font-semibold flex items-center gap-1.5 text-indigo-900">
                  <Zap className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600" />
                  Browser siap memasang!
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">Pasang 1-klik langsung ke perangkat Anda.</p>
              </div>
              <button
                type="button"
                onClick={triggerNativePrompt}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer shadow-xs transition-all hover:shadow-md"
              >
                Pasang Sekarang
              </button>
            </div>
          )}

          {/* Tab Pemilihan Perangkat */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'android'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'ios'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>iPhone / iPad</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('desktop')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'desktop'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Komputer</span>
            </button>
          </div>

          {/* Instruksi Tab: Android / Chrome */}
          {activeTab === 'android' && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-600">
                Gunakan browser <strong>Google Chrome</strong> di perangkat Android:
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px] shadow-xs">
                    1
                  </span>
                  <div className="flex-1 text-slate-700 leading-relaxed">
                    Ketuk tombol menu <strong>Titik Tiga</strong> (<MoreVertical className="w-3.5 h-3.5 inline text-slate-700 -mt-0.5" />) di sudut kanan atas browser.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px] shadow-xs">
                    2
                  </span>
                  <div className="flex-1 text-slate-700 leading-relaxed">
                    Pilih menu <strong>&quot;Tambahkan ke Layar Utama&quot;</strong> atau <strong>&quot;Instal Aplikasi&quot;</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px] shadow-xs">
                    3
                  </span>
                  <div className="flex-1 text-slate-700 leading-relaxed">
                    Ketuk <strong>&quot;Instal&quot;</strong> untuk konfirmasi. Ikon Spark AI Studio akan muncul di layar utama Anda.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instruksi Tab: iPhone / iPad (Safari) */}
          {activeTab === 'ios' && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-600">
                Buka website ini menggunakan browser bawaan <strong>Safari</strong>:
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px] shadow-xs">
                    1
                  </span>
                  <div className="flex-1 text-slate-700 leading-relaxed">
                    Ketuk tombol <strong>Bagikan (Share)</strong> (<Share2 className="w-3.5 h-3.5 inline text-indigo-600 -mt-0.5" />) pada bilah navigasi bawah Safari.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px] shadow-xs">
                    2
                  </span>
                  <div className="flex-1 text-slate-700 leading-relaxed">
                    Gulir opsi menu ke bawah, lalu pilih <strong>&quot;Tambahkan ke Layar Utama&quot;</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-slate-700 -mt-0.5" />).
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px] shadow-xs">
                    3
                  </span>
                  <div className="flex-1 text-slate-700 leading-relaxed">
                    Ketuk <strong>&quot;Tambah&quot; (Add)</strong> di pojok kanan atas. Aplikasi selesai dipasang!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instruksi Tab: Desktop / Komputer */}
          {activeTab === 'desktop' && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-600">
                Gunakan Chrome, Microsoft Edge, atau browser berbasis Chromium:
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px] shadow-xs">
                    1
                  </span>
                  <div className="flex-1 text-slate-700 leading-relaxed">
                    Lihat sisi kanan <strong>Bilah Alamat (URL bar)</strong> di bagian atas browser.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px] shadow-xs">
                    2
                  </span>
                  <div className="flex-1 text-slate-700 leading-relaxed">
                    Klik ikon <strong>Pasang Aplikasi</strong> (simbol monitor / panah ke bawah).
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px] shadow-xs">
                    3
                  </span>
                  <div className="flex-1 text-slate-700 leading-relaxed">
                    Atau via menu (<strong>⋮</strong>) &rarr; <strong>&quot;Simpan dan bagikan&quot;</strong> &rarr; <strong>&quot;Pasang Spark AI Studio&quot;</strong>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Keuntungan Memasang Aplikasi */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Keuntungan Menggunakan PWA:
            </p>
            <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Layar penuh (tanpa URL bar)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Akses instan dari homescreen</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Pemuatan cache lebih cepat</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Bebas gangguan tab browser</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer text-center shadow-xs"
          >
            Mengerti &amp; Tutup
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Tombol Install di Navbar: Icon Only di Mobile, Icon + Text di Layar Lebih Besar */}
      <button
        type="button"
        onClick={handleInstallClick}
        className="p-2 sm:px-3 sm:py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer hover:shadow-md shrink-0"
        title="Pasang aplikasi di layar utama (Install PWA)"
        aria-label="Pasang Aplikasi Spark AI Studio"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {/* Render Modal via React Portal langsung ke document.body agar 100% berada di tengah layar */}
      {mounted && showModal && createPortal(modalContent, document.body)}
    </>
  );
}
