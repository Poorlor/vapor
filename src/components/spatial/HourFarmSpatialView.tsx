// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  Play,
  Pause,
  Square,
  Search,
  Plus,
  Zap,
  Check,
  HardDrive,
  RefreshCw,
  X,
  Trash2,
  Layers,
  Sparkles,
  Gamepad2,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import type { GameItem } from './HomeView';

export interface HourFarmSpatialViewProps {
  animKey: number;
  userProfile: {
    name: string;
    steamId: string;
    level: number;
    wallet: string;
    status: string;
    avatarUrl: string | null;
  };
  games: GameItem[];
  slots: Array<GameItem | null>;
  isFarmingHours: boolean;
  farmElapsedSeconds: number;
  activeSlotsCount: number;
  isScanningPc: boolean;
  onToggleFarmHours: (durationMinutes?: number | null) => void;
  onScanPc: () => void;
  onAddGameToFarm: (game: GameItem) => void;
  onRemoveGameFromFarm: (appId: number) => void;
  onClearAllSlots: () => void;
}

const DURATION_PRESETS = [
  { label: 'Без лимита', value: null },
  { label: '1 ч', value: 60 },
  { label: '3 ч', value: 180 },
  { label: '8 ч', value: 480 },
  { label: '24 ч', value: 1440 },
] as const;

const MAX_SLOTS = 32;

function formatSeconds(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const HourFarmSpatialView: React.FC<HourFarmSpatialViewProps> = ({
  animKey,
  userProfile,
  games,
  slots,
  isFarmingHours,
  farmElapsedSeconds,
  activeSlotsCount,
  isScanningPc,
  onToggleFarmHours,
  onScanPc,
  onAddGameToFarm,
  onRemoveGameFromFarm,
  onClearAllSlots,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [targetDuration, setTargetDuration] = useState<number | null>(null);
  const [customAppIdInput, setCustomAppIdInput] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'cards' | 'selected'>('all');

  const currentElapsed = farmElapsedSeconds;

  // Total hours across all owned games
  const totalPlaytimeHours = useMemo(() => {
    return games.reduce((sum, g) => sum + (g.hours || 0), 0).toFixed(1);
  }, [games]);

  // Set of AppIDs currently placed in slots
  const selectedAppIdSet = useMemo(() => {
    return new Set(slots.filter(Boolean).map((s) => s!.appId));
  }, [slots]);

  // Filtered library games based on search and tab filter
  const filteredGames = useMemo(() => {
    let result = games;

    if (libraryFilter === 'cards') {
      result = result.filter((g) => g.hasCards && (g.cardsRemaining ?? 0) > 0);
    } else if (libraryFilter === 'selected') {
      result = result.filter((g) => selectedAppIdSet.has(g.appId));
    }

    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(
      (g) =>
        (g.title || '').toLowerCase().includes(q) ||
        String(g.appId).includes(q) ||
        (g.genre || '').toLowerCase().includes(q)
    );
  }, [games, libraryFilter, searchQuery, selectedAppIdSet]);

  const handleAddCustomAppId = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(customAppIdInput.trim(), 10);
    if (!id || isNaN(id) || id <= 0) return;

    if (selectedAppIdSet.has(id)) {
      setCustomAppIdInput('');
      return;
    }

    const existing = games.find((g) => g.appId === id);
    const itemToAdd: GameItem = existing || {
      appId: id,
      title: `AppID ${id}`,
      hours: 0,
      genre: 'Steam Game',
      hasCards: false,
      cardsRemaining: 0,
      cardsTotal: 0
    };

    onAddGameToFarm(itemToAdd);
    setCustomAppIdInput('');
  };

  const toggleGameSlot = (game: GameItem) => {
    if (selectedAppIdSet.has(game.appId)) {
      onRemoveGameFromFarm(game.appId);
    } else {
      onAddGameToFarm(game);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 select-none text-white">
      {/* ====================================================================
          ROW 1: CONTROL & TELEMETRY HEADER PLAQUE (Full 12 Columns)
      ==================================================================== */}
      <GlassCard delay={20} animKey={animKey} className="p-3.5 px-4 shrink-0 flex items-center justify-between gap-4">
        {/* Left: Title & Subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/35 flex items-center justify-center text-cyan-300 shadow-lg shrink-0">
            <Zap className="w-5 h-5 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                Фарм часов Steam
              </h2>
            </div>
            <p className="text-xs text-white/55 font-mono truncate">
              Эмуляция до 32 игр параллельно через Direct Steam CM сокет • 1 час = 32 часа
            </p>
          </div>
        </div>

        {/* Center: Target Duration Presets */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-2xl bg-white/[0.05] border border-white/10">
          <span className="text-[11px] font-mono text-white/50 px-1">Лимит:</span>
          {DURATION_PRESETS.map((p) => {
            const isSelected = targetDuration === p.value;
            return (
              <button
                key={p.label}
                onClick={() => setTargetDuration(p.value)}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 font-semibold shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Right: Telemetry & Master Play/Stop Button */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Live Timer Pill */}
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.07] border border-white/15 flex items-center gap-2 font-mono text-xs">
            <Clock className="w-3.5 h-3.5 text-cyan-300" />
            <span className={isFarmingHours ? 'text-cyan-200 font-bold' : 'text-white/50'}>
              {isFarmingHours ? formatSeconds(currentElapsed) : '00:00:00'}
            </span>
          </div>

          {/* Master Start/Stop Farming Button */}
          <button
            onClick={() => onToggleFarmHours(targetDuration)}
            disabled={activeSlotsCount === 0 && !isFarmingHours}
            className={`px-4 py-2 rounded-2xl border text-xs font-mono font-bold flex items-center gap-2 transition-all duration-200 shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isFarmingHours
                ? 'bg-rose-500/25 hover:bg-rose-500/35 border-rose-400/40 text-rose-200 shadow-rose-950/30'
                : 'bg-emerald-500/25 hover:bg-emerald-500/35 border-emerald-400/40 text-emerald-200 shadow-emerald-950/30'
            }`}
          >
            {isFarmingHours ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Остановить фарм ({activeSlotsCount}/32)</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Запустить фарм ({activeSlotsCount}/32)</span>
              </>
            )}
          </button>
        </div>
      </GlassCard>

      {/* ====================================================================
          ROW 2: THE 32 VIRTUAL SLOTS MATRIX (Visual Hardware-Style Slots)
      ==================================================================== */}
      <GlassCard delay={40} animKey={animKey} className="p-3.5 px-4 shrink-0 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-white/90">
                Слоты эмуляции:
              </span>
              <span className="text-xs font-mono font-bold text-cyan-300">
                {activeSlotsCount} / {MAX_SLOTS}
              </span>
            </div>

            {activeSlotsCount > 0 && (
              <button
                onClick={onClearAllSlots}
                disabled={isFarmingHours}
                className="text-[11px] font-mono text-rose-300/80 hover:text-rose-200 hover:underline flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Очистить все слоты"
              >
                <Trash2 className="w-3 h-3" />
                <span>Очистить все</span>
              </button>
            )}
          </div>

          {/* Quick Custom AppID Adder Form */}
          <form onSubmit={handleAddCustomAppId} className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Добавить AppID вручную..."
              value={customAppIdInput}
              onChange={(e) => setCustomAppIdInput(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-2.5 py-1 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 font-mono w-48"
            />
            <button
              type="submit"
              disabled={!customAppIdInput.trim() || activeSlotsCount >= MAX_SLOTS}
              className="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-mono flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
              title="Добавить AppID в слот"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить</span>
            </button>
          </form>
        </div>

        {/* 32 Interactive Slots Matrix Grid: 16 columns x 2 rows */}
        <div className="grid grid-cols-8 md:grid-cols-16 gap-1.5">
          {Array.from({ length: MAX_SLOTS }).map((_, idx) => {
            const slotItem = slots[idx];

            if (slotItem) {
              return (
                <div
                  key={`${slotItem.appId}-${idx}`}
                  onClick={() => !isFarmingHours && onRemoveGameFromFarm(slotItem.appId)}
                  className={`group relative p-1.5 rounded-xl border flex flex-col items-center justify-between text-center transition-all min-h-[58px] cursor-pointer ${
                    isFarmingHours
                      ? 'bg-cyan-500/20 border-cyan-400/40 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                      : 'bg-white/10 hover:bg-rose-500/20 border-white/20 hover:border-rose-400/40'
                  }`}
                  title={`${slotItem.title} (AppID: ${slotItem.appId})`}
                >
                  <span className="text-[10px] font-mono font-bold text-cyan-300 leading-tight">
                    #{idx + 1}
                  </span>
                  <span className="text-[11px] font-semibold text-white truncate max-w-full leading-tight">
                    {slotItem.title}
                  </span>
                  <span className="text-[9px] font-mono text-white/50 leading-tight truncate">
                    {slotItem.appId}
                  </span>

                  {/* Remove hover badge */}
                  {!isFarmingHours && (
                    <div className="hidden group-hover:flex absolute inset-0 rounded-xl bg-rose-950/90 border border-rose-400/60 items-center justify-center text-[10px] font-mono text-rose-200 font-bold">
                      <X className="w-3.5 h-3.5 text-rose-300" />
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="p-1.5 rounded-xl bg-white/[0.03] border border-dashed border-white/15 flex flex-col items-center justify-center text-center min-h-[58px] text-white/30"
              >
                <span className="text-[10px] font-mono font-bold">
                  #{idx + 1}
                </span>
                <span className="text-[10px] font-mono mt-0.5">
                  Пусто
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* ====================================================================
          ROW 3: LIBRARY GAME PICKER & DEEP SCAN (Fills remaining height)
      ==================================================================== */}
      <GlassCard delay={60} animKey={animKey} className="p-3.5 px-4 flex-1 min-h-0 flex flex-col justify-between">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 mb-3">
          {/* Left: Library Heading & Filter Pills */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Gamepad2 className="w-4 h-4 text-white/80" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Библиотека Steam ({filteredGames.length})
              </h3>
            </div>

            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-xl bg-white/[0.06] border border-white/10">
              <button
                onClick={() => setLibraryFilter('all')}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  libraryFilter === 'all'
                    ? 'bg-white/20 text-white font-semibold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => setLibraryFilter('cards')}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  libraryFilter === 'cards'
                    ? 'bg-white/20 text-white font-semibold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                С карточками
              </button>
              <button
                onClick={() => setLibraryFilter('selected')}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  libraryFilter === 'selected'
                    ? 'bg-white/20 text-white font-semibold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                В пуле ({activeSlotsCount})
              </button>
            </div>
          </div>

          {/* Right: Search Input & Deep Scan Button */}
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Поиск по названию или ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 font-sans"
              />
            </div>

            <button
              onClick={onScanPc}
              disabled={isScanningPc}
              className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/35 text-purple-200 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="Сканировать локальные диски ПК на установленные игры"
            >
              <HardDrive className={`w-3.5 h-3.5 ${isScanningPc ? 'animate-pulse text-purple-300' : ''}`} />
              <span>{isScanningPc ? 'Сканирование...' : 'Сканировать ПК'}</span>
            </button>
          </div>
        </div>

        {/* Games Table/Grid with internal scroll inside the card */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-max content-start gap-2 custom-scrollbar">
          {filteredGames.map((game) => {
            const isSelected = selectedAppIdSet.has(game.appId);
            return (
              <div
                key={game.appId}
                onClick={() => !isFarmingHours && toggleGameSlot(game)}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200 shadow-sm'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-white/25 text-white/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center font-mono text-[10px] font-bold text-white shrink-0">
                    {game.title.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate text-white leading-tight">
                      {game.title}
                    </p>
                    <p className="text-[10px] font-mono text-white/50 mt-0.5 leading-tight">
                      ID: {game.appId} • {(game.hours || 0).toFixed(1)} ч.
                    </p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                    isSelected
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-bold'
                      : 'border-white/20 text-transparent hover:border-white/40'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Status Ticker */}
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50 shrink-0">
          <span>Суммарное наигранное время: {totalPlaytimeHours} ч.</span>
        </div>
      </GlassCard>
    </div>
  );
};
