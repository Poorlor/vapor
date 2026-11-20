import React, { useState } from 'react';
import {
  Settings,
  Globe,
  User,
  ShieldCheck,
  Radio,
  LogOut,
  Info,
  Server,
  Zap,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type { SteamUser } from '../types';

export interface SettingsTabProps {
  user: SteamUser | null;
  isLoggedOn: boolean;
}

const API_BASE = '/api';

export function SettingsTab({ user, isLoggedOn }: SettingsTabProps) {
  const { lang, setLanguage, t } = useI18n();

  const [personaState, setPersonaState] = useState<number>(user?.personaState || 1);
  const [isUpdatingPersona, setIsUpdatingPersona] = useState(false);

  const handlePersonaChange = async (newState: number) => {
    setPersonaState(newState);
    setIsUpdatingPersona(true);
    try {
      await fetch(`${API_BASE}/persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState }),
      });
    } catch (err) {
      console.error('Failed to update persona state:', err);
    } finally {
      setIsUpdatingPersona(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/logout`, { method: 'POST' });
    } catch {
      // ignore
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto px-8 py-6 space-y-6">
      {/* Top Banner Card */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">{t('settings_title')}</h2>
        </div>
        <p className="text-xs text-gray-400 max-w-xl">
          {t('settings_desc')}
        </p>
      </div>

      {/* Profile & Persona State */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6 flex flex-col gap-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>{t('persona_state_label')}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { id: 1, label: t('persona_online'), color: 'text-emerald-400' },
            { id: 3, label: t('persona_away'), color: 'text-amber-400' },
            { id: 2, label: t('persona_busy'), color: 'text-rose-400' },
            { id: 4, label: t('persona_snooze'), color: 'text-blue-400' },
            { id: 7, label: t('persona_invisible'), color: 'text-gray-400' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handlePersonaChange(item.id)}
              disabled={!isLoggedOn || isUpdatingPersona}
              className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                personaState === item.id
                  ? 'bg-cyan-500/10 border-cyan-500/50 text-white'
                  : 'bg-[#0b0c10] border-[#1d2333] text-gray-400 hover:text-white'
              }`}
            >
              <span className="text-xs font-semibold">{item.label}</span>
              <span className={`w-2.5 h-2.5 rounded-full bg-current ${item.color}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Language Switcher */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>{t('language_label')}</span>
          </h3>
          <p className="text-xs text-gray-500">
            Выберите язык интерфейса приложения
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#0b0c10] p-1 rounded-xl border border-[#232938]">
          <button
            onClick={() => setLanguage('ru')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              lang === 'ru'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Русский (RU)
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              lang === 'en'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            English (EN)
          </button>
        </div>
      </div>

      {/* Architecture & Independence Info */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6 flex flex-col gap-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <span>{t('connection_mode')}</span>
        </h3>

        <div className="bg-[#0b0c10] border border-cyan-500/20 p-4 rounded-xl flex items-start gap-3.5">
          <ShieldCheck className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-white">
              {t('direct_protocol_mode')}
            </p>
            <p className="text-gray-400 leading-relaxed">
              Приложение подключается напрямую к серверам Steam Connection Manager (CM) по зашифрованному протоколу WebSocket/TCP. Вам не нужно держать открытым официальный клиент Steam. Все 32 игры, таймеры, карточки и лицензии эмулируются сервером приложения в фоновом режиме.
            </p>
          </div>
        </div>
      </div>

      {/* Session Details */}
      {isLoggedOn && user && (
        <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-sm">
              {user.personaName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-white">{user.personaName}</p>
              <p className="text-[11px] text-gray-500 font-mono">SteamID: {user.steamID}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('logout_btn')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default SettingsTab;
