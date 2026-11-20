// @ts-nocheck
import React, { useState } from 'react';
import {
  Trophy,
  Play,
  Square,
  Clock,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Infinity as InfinityIcon,
  Sliders,
  Layers,
  Gamepad2,
  RefreshCw
} from 'lucide-react';
import { GlassCard } from '../spatial/GlassCard';

interface DiscordVarietyTabProps {
  animKey?: number;
  theme?: any;
  lang?: 'ru' | 'en';
  discordStatus?: any;
  status?: any;
  mode?: 'process' | 'rpc';
  onStart?: (batchSize: number, holdSeconds: number, mode?: 'process' | 'rpc', loopMode?: boolean) => Promise<any>;
  onStop?: () => Promise<any>;
  onReset?: () => Promise<any>;
  fetchDiscordStatus?: () => void;
  addLog: (level: string, message: string) => void;
}

export const DiscordVarietyTab: React.FC<DiscordVarietyTabProps> = ({
  animKey = 0,
  discordStatus,
  status,
  mode: propMode,
  onStart,
  onStop,
  onReset,
  fetchDiscordStatus,
  addLog,
}) => {
  const currentStatus = discordStatus || status || {};
  const activeMode = propMode || currentStatus?.mode || currentStatus?.variety?.mode || 'process';
  const [batchSize, setBatchSize] = useState<number>(1);
  const [holdSeconds, setHoldSeconds] = useState<number>(15);
  const [loopMode, setLoopMode] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isRunning = Boolean(currentStatus?.variety?.isRunning);
  const currentBatch = currentStatus?.variety?.currentBatch || [];
  const elapsed = currentStatus?.variety?.elapsedBatchSeconds != null ? currentStatus.variety.elapsedBatchSeconds : 0;
  const activeHoldSeconds = currentStatus?.variety?.holdSeconds || holdSeconds || 15;
  const playedCount = currentStatus?.playedCount || 0;
  const totalGames = currentStatus?.totalDetectableGames ?? 0;
  const isDiscordRunning = Boolean(currentStatus?.isDiscordRunning);
  const cycleCount = currentStatus?.variety?.cycleCount || 1;

  // Mythic badge target is ~9,837 games
  const mythicTarget = 9837;
  const mythicProgress = Math.min(100, Math.round((playedCount / mythicTarget) * 100));

  const handleStart = async () => {
    setIsLoading(true);
    try {
      if (onStart) {
        await onStart(batchSize, holdSeconds, activeMode, loopMode);
      } else {
        const res = await fetch('/api/discord/variety/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchSize, holdSeconds, mode: activeMode, loopMode })
        });
        const data = await res.json();
        if (data.success) {
          addLog(
            'SUCCESS',
            `Прокачка значка «Универсал» [${activeMode === 'rpc' ? 'Discord IPC Socket' : 'Win32 Process Spoofer'}] запущена! Батчи по ${batchSize} игр каждые ${holdSeconds}с.`
          );
        }
      }
      fetchDiscordStatus?.();
    } catch (e: any) {
      addLog('ERROR', 'Ошибка запуска: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      if (onStop) {
        await onStop();
      } else {
        const res = await fetch('/api/discord/variety/stop', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          addLog('WARN', 'Прокачка значка «Универсал» остановлена пользователем.');
        }
      }
      fetchDiscordStatus?.();
    } catch (e: any) {
      addLog('ERROR', 'Ошибка остановки: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (isRunning) return;
    setIsLoading(true);
    try {
      if (onReset) {
        await onReset();
      } else {
        const res = await fetch('/api/discord/variety/reset', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          addLog('INFO', 'История прокачки универсала сброшена. Начат новый цикл фарма!');
        }
      }
      fetchDiscordStatus?.();
    } catch (e: any) {
      addLog('ERROR', 'Ошибка сброса: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const batchProgress = isRunning
    ? Math.min(100, Math.max(0, Math.round((elapsed / Math.max(1, activeHoldSeconds)) * 100)))
    : 0;

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
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/35 flex items-center justify-center text-amber-300 shadow-lg shrink-0">
            <Trophy className="w-5 h-5 text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                Прокачка значка «Универсал»
              </h2>
              <span className="px-2 py-0.2 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-mono font-semibold text-amber-300">
                VARIETY ENGINE 25,176
              </span>
            </div>
            <p className="text-xs text-white/55 font-mono truncate">
              Ротация игр в Discord. Локальная история не подтверждает начисление значка.
            </p>
          </div>
        </div>

        {/* Right: Status Pills & Action */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/15 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isDiscordRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-white/80">
              {isDiscordRunning ? 'Discord обнаружен' : 'Discord не запущен'}
            </span>
          </div>

          <button
            onClick={handleReset}
            disabled={isRunning || isLoading}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white/80 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
            title="Сбросить историю сыгранных игр и начать заново"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
            <span>Сброс цикла</span>
          </button>
        </div>
      </GlassCard>

      {/* ====================================================================
          ROW 2: TELEMETRY & CONTROLS BENTO (3 Cards, 12 Columns)
      ==================================================================== */}
      <div className="grid grid-cols-12 gap-3 shrink-0">
        {/* Card 1: Mythic Badge Progress (4 cols) */}
        <GlassCard delay={40} animKey={animKey} hoverLift={true} className="col-span-4 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-white/70">Локальная история ротации</span>
            <div className="flex items-center gap-1.5">
              {cycleCount > 1 && (
                <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-400/30">
                  Круг #{cycleCount}
                </span>
              )}
              <Trophy className="w-4 h-4 text-amber-300" />
            </div>
          </div>

          <div className="my-2 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {playedCount.toLocaleString()}
              <span className="text-xs font-normal text-white/50 ml-1.5">/ {mythicTarget.toLocaleString()}</span>
            </div>
            <span className="text-sm font-mono font-bold text-amber-300">{mythicProgress}%</span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${mythicProgress}%` }}
              />
            </div>
            <div className="text-[11px] font-mono text-white/40 flex justify-between">
              <span>Ориентир: 9 837 игр (не подтверждён Discord)</span>
              <span>База: {totalGames.toLocaleString()} игр</span>
            </div>
          </div>
        </GlassCard>

        {/* Card 2: Batch Config & Parameters (5 cols) */}
        <GlassCard delay={60} animKey={animKey} hoverLift={true} className="col-span-5 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-white/70">Параметры батча и задержка</span>
            <Sliders className="w-3.5 h-3.5 text-amber-300" />
          </div>

          <div className="my-1.5 space-y-2">
            {/* Batch size selector */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60 font-mono">Размер батча:</span>
              <div className="flex items-center gap-1 font-mono text-xs">
                {[1, 2, 4, 8].map((num) => (
                  <button
                    key={num}
                    disabled={isRunning}
                    onClick={() => setBatchSize(num)}
                    className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 ${
                      batchSize === num
                        ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40 font-bold'
                        : 'bg-white/[0.06] hover:bg-white/[0.1] text-white/70 border border-white/10'
                    }`}
                  >
                    {num} игр
                  </button>
                ))}
              </div>
            </div>

            {/* Hold duration selector */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60 font-mono">Время удержания:</span>
              <div className="flex items-center gap-1 font-mono text-xs">
                {[10, 15, 30].map((sec) => (
                  <button
                    key={sec}
                    disabled={isRunning}
                    onClick={() => setHoldSeconds(sec)}
                    className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 ${
                      holdSeconds === sec
                        ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40 font-bold'
                        : 'bg-white/[0.06] hover:bg-white/[0.1] text-white/70 border border-white/10'
                    }`}
                  >
                    {sec} сек
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px] font-mono text-white/50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={loopMode}
                disabled={isRunning}
                onChange={(e) => setLoopMode(e.target.checked)}
                className="rounded accent-amber-400 cursor-pointer"
              />
              <span>Бесконечный цикл (Loop Mode)</span>
            </label>
            <span className="text-amber-300 font-semibold">{batchSize * (60 / holdSeconds)} игр/мин</span>
          </div>
        </GlassCard>

        {/* Card 3: Master Control Action (3 cols) */}
        <GlassCard delay={80} animKey={animKey} hoverLift={true} className="col-span-3 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-white/70">Статус спуфера</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>

          <div className="my-auto">
            {isRunning ? (
              <button
                onClick={handleStop}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Остановить ротацию</span>
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-amber-500/25 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Запустить ротацию</span>
              </button>
            )}
          </div>

          <div className="text-[11px] font-mono text-white/40 text-center">
            {isRunning ? `Батч активен (${elapsed}с / ${holdSeconds}с)` : 'Эмулятор ожидает запуска'}
          </div>
        </GlassCard>
      </div>

      {/* ====================================================================
          ROW 3: ACTIVE BATCH & LIVE RUNNER
      ==================================================================== */}
      <GlassCard delay={100} animKey={animKey} hoverLift={true} className="p-3.5 px-4 flex-1 min-h-0 flex flex-col justify-between">
        {/* Active batch header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-300" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Текущий батч эмуляции ({currentBatch.length || batchSize} параллельных процессов)
            </h3>
          </div>
          {isRunning && (
            <div className="flex items-center gap-2 text-xs font-mono text-amber-300">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Ротация: {elapsed}с / {holdSeconds}с</span>
            </div>
          )}
        </div>

        {/* Batch games list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 custom-scrollbar">
          {isRunning && currentBatch.length > 0 ? (
            currentBatch.map((game: any, idx: number) => (
              <div
                key={game.id || idx}
                className="p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 hover:border-white/30 flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0 shadow-sm">
                    <Gamepad2 className="w-5 h-5 text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">{game.name || 'Game'}</span>
                      <span className="px-2 py-0.2 rounded-md bg-emerald-500/20 border border-emerald-400/30 font-mono text-[10px] text-emerald-300 font-bold">
                        АКТИВЕН
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-white/50 truncate flex items-center gap-2 mt-0.5">
                      <span>{game.exeName || `${game.name}.exe`}</span>
                      <span>•</span>
                      <span>ID: {game.id}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${batchProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-amber-300 font-bold w-12 text-right">
                    {elapsed} / {holdSeconds}с
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 flex flex-col items-center justify-center p-8 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <Trophy className="w-12 h-12 text-amber-300/40 mb-3" />
              <h4 className="text-sm font-semibold text-white/80">Ротация сейчас остановлена</h4>
              <p className="text-xs text-white/40 font-mono mt-1 max-w-md">
                Нажмите «Запустить ротацию», чтобы спуфер начал циклически запускать и регистрировать в Discord игры из базы (25,176 наименований).
              </p>
            </div>
          )}
        </div>

        {/* Bottom Sub-bar */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>База данных Discord: 25,176 игр</span>
            <span className="text-white/20">•</span>
            <span>Режим: {activeMode === 'rpc' ? 'Discord IPC Socket (RPC)' : 'Win32 Process Spoofer'}</span>
          </div>
          <span>Vapor Spoofer Core • Build 2026.11</span>
        </div>
      </GlassCard>
    </div>
  );
};
