'use client';

import React, { useState } from 'react';
import { Sparkles, User, Lock, Eye, EyeOff, LogIn, UserPlus, Loader2 } from 'lucide-react';
import { showToast, showError } from '@/lib/swal';
import type { UserProfileData } from '@/components/SettingsModal';

interface AuthCardProps {
  onAuthSuccess: (user: UserProfileData) => void;
}

export default function AuthCard({ onAuthSuccess }: AuthCardProps) {
  const [tab, setTab] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      showError('Validasi Gagal', 'Username minimal 3 karakter.');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      showError('Validasi Gagal', 'Username hanya boleh huruf, angka, minus (-), dan garis bawah (_).');
      return;
    }

    if (!password || password.length < 4) {
      showError('Validasi Gagal', 'Password minimal 4 karakter.');
      return;
    }

    if (tab === 'register') {
      if (password !== confirmPassword) {
        showError('Validasi Gagal', 'Konfirmasi password tidak cocok dengan password.');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = tab === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = tab === 'register'
        ? { username: cleanUsername, password, displayName: displayName.trim() || cleanUsername }
        : { username: cleanUsername, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showError(tab === 'register' ? 'Pendaftaran Gagal' : 'Login Gagal', data.error || 'Terjadi kesalahan sistem.');
        return;
      }

      showToast(
        tab === 'register'
          ? `Selamat datang, ${data.user.display_name || data.user.username}! Akun berhasil dibuat.`
          : `Selamat datang kembali, ${data.user.display_name || data.user.username}!`,
        'success'
      );

      onAuthSuccess(data.user);
    } catch {
      showError('Koneksi Gagal', 'Gagal menghubungi server lokal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Branding */}
        <div className="p-6 sm:p-8 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 text-center relative overflow-hidden">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-teal-500 shadow-lg shadow-indigo-500/25 text-white mb-3">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Spark AI Studio
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
            Masuk atau daftar untuk mengakses ruang kerja <span className="font-semibold text-indigo-600">Private Studio</span> Anda.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="p-2 mx-6 mt-4 bg-slate-100 rounded-2xl flex items-center text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setTab('register')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'register'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Daftar Akun Baru</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'login'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Masuk (Login)</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="misal: febrian"
                autoComplete="username"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-mono"
                required
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Hanya huruf, angka, minus (-), atau garis bawah (_).</p>
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama Tampilan (Opsional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="misal: Febrian Yudhis"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 4 karakter"
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Konfirmasi Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password"
                  autoComplete="new-password"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                  required
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : tab === 'register' ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Daftar &amp; Masuk ke Studio</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk ke Studio</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
