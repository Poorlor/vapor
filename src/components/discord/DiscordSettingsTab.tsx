// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Shield,
  Trash2,
  RefreshCw,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Zap,
  RotateCcw
} from 'lucide-react';
import { GlassCard } from '../spatial/GlassCard';

interface DiscordSettingsTabProps {
  animKey?: number;
  theme?: any;
  lang?: 'ru' | 'en';
  discordStatus?: any;
  status?: any;
  mode?: 'process' | 'rpc';
  onModeChange?: (mode: 'process' | 'rpc') => void;
  onResetHistory?: () => Promise<any>;
  addLog: (level: string, message: string) => void;
}

export const DiscordSettingsTab: React.FC<DiscordSettingsTabProps> = ({
  animKey = 0,
  discordStatus,
  status,
  mode: propMode,
  onModeChange,
  onResetHistory,
  addLog,
}) => {
  const currentStatus = discordStatus || status || {};
  const initialMode = propMode || currentStatus.mode || currentStatus.variety?.mode || 'process';
  const [mode, setLocalMode] = useState<'process' | 'rpc'>(initialMode);
  const [isResetting, setIsResetting] = useState(false);
  const isDiscordRunning = Boolean(currentStatus?.isDiscordRunning);
  const playedCount = currentStatus.playedCount || 0;

  useEffect(() => {
    if (propMode) {
      setLocalMode(propMode);
    } else if (currentStatus.mode) {
      setLocalMode(currentStatus.mode);
    }
  }, [propMode, currentStatus.mode]);

  const handleSelectMode = async (newMode: 'process' | 'rpc') => {
    if (currentStatus.variety?.isRunning || currentStatus.farm?.isRunning || currentStatus.quest?.isRunning) {
      addLog('ERROR', 'Остановите активность перед сменой режима.');
      return;
    }
    if (onModeChange) {
      await onModeChange(newMode);
      return;
    } else {
      try {
        await fetch('/api/discord/mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: newMode })
        });
      } catch (e) {}
    }
    addLog(
      'INFO',
      `Режим спуфера изменен на: ${newMode === 'rpc' ? 'Discord IPC Socket (RPC)' : 'Win32 Process Spoofer'}`
    );
  };

  const handleResetHistory = async () => {
    setIsResetting(true);
    try {
      if (onResetHistory) {
        await onResetHistory();
      } else {
        const res = await fetch('/api/discord/history/reset', { method: 'POST' });
        const d = await res.json();
        if (d.success) {
          addLog('SUCCESS', 'История сыгранных игр Discord успешно сброшена.');
        }
      }
    } catch (e: any) {
      addLog('ERROR', 'Ошибка сброса: ' + e.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 select-none text-white">
      {/* ====================================================================
          ROW 1: CONTROL & HEADER PLAQUE
      ==================================================================== */}
      <GlassCard
        delay={20}
        animKey={animKey}
        hoverLift={true}
        className="p-3.5 px-4 shrink-0 flex items-center justify-between gap-4"
      >
        {/* Left: Title & Subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-slate-500/20 border border-slate-400/35 flex items-center justify-center text-slate-200 shadow-lg shrink-0">
            <Sliders className="w-5 h-5 text-slate-200" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                Настройки Discord Spoofer
              </h2>
              <span className="px-2 py-0.2 rounded-full bg-white/15 border border-white/20 text-[10px] font-mono font-semibold text-white/90">
                SPOOFER CONFIG
              </span>
            </div>
            <p className="text-xs text-white/55 font-mono truncate">
              Параметры протокола, режимы эмуляции процессов и управление историей
            </p>
          </div>
        </div>

        {/* Right: Discord Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/15 text-xs font-mono shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${
              isDiscordRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="text-white/80">
            {isDiscordRunning ? 'Discord обнаружен' : 'Discord не запущен'}
          </span>
        </div>
      </GlassCard>

      {/* ====================================================================
          ROW 2: SETTINGS ENCLOSING GLASSCARD
      ==================================================================== */}
      <GlassCard delay={40} animKey={animKey} hoverLift={true} className="p-4 px-5 flex-1 min-h-0 flex flex-col justify-between">
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1.5 custom-scrollbar">
          {/* Mode Selector Card */}
          <div className="p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 hover:border-white/30 flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Режим работы спуфера Discord</div>
                <div className="text-[11px] font-mono text-white/50">
                  Win32 Process Spoofer (рекомендуемый для квестов) или Discord IPC Socket (RPC)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/15 font-mono text-xs">
              <button
                onClick={() => handleSelectMode('process')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  mode === 'process'
                    ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 font-bold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Win32 Process
              </button>
              <button
                onClick={() => handleSelectMode('rpc')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  mode === 'rpc'
                    ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 font-bold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Discord IPC RPC
              </button>
            </div>
          </div>

          {/* Dummies Path Card */}
          <div className="p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 hover:border-white/30 flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white/80">
                <FolderOpen className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Каталог исполняемых заглушек (.exe)</div>
                <div className="text-[11px] font-mono text-white/50">
                  Изолированные бинарные заглушки для эмуляции процессов в Windows
                </div>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 font-mono text-xs text-white/80 select-text">
              D:\vapor\data\discord_dummies
            </div>
          </div>

          {/* Played Games History Reset */}
          <div className="p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 hover:border-white/30 flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">История сыгранных игр Discord ({playedCount.toLocaleString()} игр)</div>
                <div className="text-[11px] font-mono text-white/50">
                  Сброс списка ранее эмулированных игр и счетчика для начала нового цикла
                </div>
              </div>
            </div>

            <button
              onClick={handleResetHistory}
              disabled={isResetting}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-mono font-medium transition-all cursor-pointer disabled:opacity-50"
            >
              {isResetting ? 'Сброс...' : 'Сбросить историю'}
            </button>
          </div>
        </div>

        {/* Bottom Sub-bar */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Конфигурация Discord Spoofer активна</span>
            <span className="text-white/20">•</span>
            <span>Автосохранение в discord_settings.json</span>
          </div>
          <span>Vapor Spoofer Core • Build 2026.11</span>
        </div>
      </GlassCard>
    </div>
  );
};
