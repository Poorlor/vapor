import React, { useState } from 'react';
import {
  LogIn,
  LogOut,
  RefreshCw,
  Globe,
  Wallet,
  Award,
  Circle,
  HardDrive,
} from 'lucide-react';
import type { SteamUser } from '../types';
import { useI18n } from '../i18n';

interface HeaderProps {
  isLoggedOn: boolean;
  user: SteamUser | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isLoggedOn,
  user,
  onOpenLogin,
  onLogout,
  onRefresh,
  isRefreshing,
}) => {
  const { lang, setLanguage, t } = useI18n();
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const handlePersonaChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newState = Number(e.target.value);
    await fetch('/api/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: newState }),
    });
  };

  const handleDeepScan = async () => {
    setIsDeepScanning(true);
    try {
      await fetch('/api/library/deep-scan', { method: 'POST' });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setIsDeepScanning(false);
    }
  };

  return (
    <header className="h-16 px-8 bg-[#0e1017] border-b border-[#1a1f2e] flex items-center justify-between select-none flex-shrink-0">
      {/* Left Search / Breadcrumb indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="font-semibold text-gray-200">{t('app_title')}</span>
          <span>/</span>
          <span className="text-gray-400">{t('app_subtitle')}</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(lang === 'ru' ? 'en' : 'ru')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141724] border border-[#23293c] text-xs text-gray-300 hover:text-white hover:border-cyan-500/40 transition-colors"
          title="Switch Language"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold uppercase text-[11px]">{lang}</span>
        </button>

        {isLoggedOn && user ? (
          <>
            {/* Deep Scan (Local Steam + F2P) */}
            <button
              onClick={handleDeepScan}
              disabled={isDeepScanning || isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141724] border border-[#23293c] text-xs text-gray-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-all disabled:opacity-50"
              title="Глубокое сканирование библиотеки (диски ПК + F2P игры, включая Dota 2)"
            >
              <HardDrive className={`w-3.5 h-3.5 ${isDeepScanning ? 'animate-pulse text-cyan-400' : 'text-cyan-400'}`} />
              <span className="text-[11px] font-medium hidden sm:inline">
                {isDeepScanning ? 'Сканирование...' : 'Сканировать ПК'}
              </span>
            </button>

            {/* Refresh Library */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing || isDeepScanning}
              className="p-2 rounded-xl bg-[#141724] border border-[#23293c] text-gray-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-all disabled:opacity-50"
              title="Обновить профиль и библиотеку"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center gap-3 pl-3 pr-2 py-1 rounded-xl bg-[#131622] border border-[#22273a]">
              {/* Avatar */}
              <div className="relative">
                {user.avatarUrl && !avatarError ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.personaName}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-8 h-8 rounded-lg object-cover border border-[#2e374f]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center font-bold text-xs text-cyan-300">
                    {user.personaName ? user.personaName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <Circle className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 fill-emerald-500 text-emerald-500 border border-[#131622] rounded-full" />
              </div>

              {/* Name & Stats */}
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-200">{user.personaName}</span>
                  {user.level > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      <Award className="w-2.5 h-2.5" />
                      {user.level}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                  {user.wallet && (
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                      <Wallet className="w-2.5 h-2.5" />
                      {user.wallet} ₽
                    </span>
                  )}
                  {/* Persona Selector */}
                  <select
                    value={user.personaState}
                    onChange={handlePersonaChange}
                    className="bg-transparent text-gray-400 hover:text-gray-200 focus:outline-none cursor-pointer"
                  >
                    <option value={1} className="bg-[#131722] text-gray-200">Online</option>
                    <option value={3} className="bg-[#131722] text-gray-200">Away</option>
                    <option value={2} className="bg-[#131722] text-gray-200">Busy</option>
                    <option value={4} className="bg-[#131722] text-gray-200">Snooze</option>
                    <option value={7} className="bg-[#131722] text-gray-200">Invisible</option>
                  </select>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="ml-2 p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title={t('logout_btn')}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={onOpenLogin}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-all shadow-md shadow-cyan-500/20"
          >
            <LogIn className="w-4 h-4" />
            <span>{t('login_btn')}</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
