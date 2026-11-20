import React, { useState, useMemo } from 'react';
import { Clock, Play, Square, Search, Plus, Zap, Check, HardDrive } from 'lucide-react';
import { useI18n } from '../i18n';
import type { SteamGame, HourBoosterState } from '../types';

export interface HourFarmTabProps {
  ownedGames: SteamGame[];
  hourBooster: HourBoosterState;
  isLoggedOn: boolean;
}

const DURATION_OPTIONS = [
  { key: 'target_unlimited', value: null },
  { key: 'target_1h', value: 60 },
  { key: 'target_3h', value: 180 },
  { key: 'target_8h', value: 480 },
  { key: 'target_24h', value: 1440 },
] as const;

const MAX_GAMES = 32;

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatHours(totalSeconds: number): string {
  const hours = (totalSeconds / 3600).toFixed(1);
  return `${hours}h`;
}

export function HourFarmTab({ ownedGames, hourBooster, isLoggedOn }: HourFarmTabProps) {
  const { t } = useI18n();

  const [selectedAppIds, setSelectedAppIds] = useState<number[]>(
    hourBooster.isRunning ? hourBooster.activeAppIds : []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [targetDuration, setTargetDuration] = useState<number | null>(null);
  const [customAppId, setCustomAppId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeepScanning, setIsDeepScanning] = useState(false);

  // Alphabetically sorted library
  const sortedOwnedGames = useMemo(() => {
    return [...ownedGames].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }, [ownedGames]);

  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return sortedOwnedGames;
    const q = searchQuery.toLowerCase();
    return sortedOwnedGames.filter(
      (g) =>
        (g.name || '').toLowerCase().includes(q) ||
        String(g.appid).includes(q)
    );
  }, [sortedOwnedGames, searchQuery]);

  const handleDeepScan = async () => {
    setIsDeepScanning(true);
    try {
      await fetch('/api/library/deep-scan', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setIsDeepScanning(false);
    }
  };

  const toggleGame = (appid: number) => {
    setSelectedAppIds((prev) => {
      if (prev.includes(appid)) return prev.filter((id) => id !== appid);
      if (prev.length >= MAX_GAMES) return prev;
      return [...prev, appid];
    });
  };

  const addCustomAppId = () => {
    const id = parseInt(customAppId.trim(), 10);
    if (!id || isNaN(id) || id <= 0) return;
    if (selectedAppIds.includes(id)) return;
    if (selectedAppIds.length >= MAX_GAMES) return;
    setSelectedAppIds((prev) => [...prev, id]);
    setCustomAppId('');
  };

  const handleStart = async () => {
    if (selectedAppIds.length === 0) return;
    setIsLoading(true);
    try {
      await fetch('/api/hour-booster/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appIds: selectedAppIds,
          targetDurationMinutes: targetDuration,
        }),
      });
    } catch (err) {
      console.error('Failed to start hour booster:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/hour-booster/stop', { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop hour booster:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeAppIds = hourBooster.isRunning
    ? hourBooster.activeAppIds
    : selectedAppIds;

  return (
    <div className="w-full h-full overflow-y-auto px-8 py-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">{t('hour_farm_title')}</h2>
            </div>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              {t('hour_farm_desc')}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {hourBooster.isRunning ? (
              <button
                onClick={handleStop}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 font-semibold text-xs transition-all shadow-md shadow-rose-950/20"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>{t('stop_farming')}</span>
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={selectedAppIds.length === 0 || !isLoggedOn || isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{t('start_farming')} ({selectedAppIds.length}/32)</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Status when running */}
        {hourBooster.isRunning && (
          <div className="mt-6 pt-6 border-t border-[#1f2535] grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0b0c10] border border-[#1d2333] p-4 rounded-xl flex items-center gap-3">
              <Clock className="w-5 h-5 text-cyan-400" />
              <div>
                <span className="text-[11px] text-gray-400 uppercase tracking-wider block font-medium">
                  {t('farmed_time')}
                </span>
                <span className="text-lg font-bold font-mono text-cyan-300">
                  {formatTime(hourBooster.elapsedSeconds)}
                </span>
              </div>
            </div>

            <div className="bg-[#0b0c10] border border-[#1d2333] p-4 rounded-xl flex items-center gap-3">
              <Zap className="w-5 h-5 text-purple-400" />
              <div>
                <span className="text-[11px] text-gray-400 uppercase tracking-wider block font-medium">
                  {t('total_boosted_time')}
                </span>
                <span className="text-lg font-bold font-mono text-purple-300">
                  {formatHours(hourBooster.totalFarmedSeconds)}
                </span>
              </div>
            </div>

            <div className="bg-[#0b0c10] border border-[#1d2333] p-4 rounded-xl flex items-center gap-3">
              <span className="text-base font-black px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                {hourBooster.multiplier}x
              </span>
              <div>
                <span className="text-[11px] text-gray-400 uppercase tracking-wider block font-medium">
                  {t('multiplier_gauge')}
                </span>
                <span className="text-xs text-gray-300">
                  {hourBooster.multiplier} {t('active_games_running', 'игр активно')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timer & Target Duration Selection */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-xs font-semibold text-gray-300">
          {t('target_duration')}:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setTargetDuration(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                targetDuration === opt.value
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-[#181c28] text-gray-400 border border-[#242b3b] hover:text-white'
              }`}
            >
              {t(opt.key)}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Games Slot Grid (Up to 32) */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">
              {t('selected_count')}: {selectedAppIds.length} / 32
            </h3>
            {selectedAppIds.length > 0 && (
              <button
                onClick={() => setSelectedAppIds([])}
                className="text-[11px] text-rose-400 hover:underline ml-2"
              >
                Очистить все
              </button>
            )}
          </div>

          {/* Add custom AppID */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder={t('add_custom_appid')}
              value={customAppId}
              onChange={(e) => setCustomAppId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomAppId()}
              className="bg-[#0b0c10] border border-[#232938] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 w-44"
            />
            <button
              onClick={addCustomAppId}
              className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 32 Slots Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
          {Array.from({ length: MAX_GAMES }).map((_, idx) => {
            const appid = activeAppIds[idx];
            const game = appid ? ownedGames.find((g) => g.appid === appid) : null;

            if (appid) {
              return (
                <div
                  key={idx}
                  onClick={() => !hourBooster.isRunning && toggleGame(appid)}
                  className="group relative bg-[#0b0c10] border border-cyan-500/40 rounded-xl p-2.5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-rose-500/50 transition-all min-h-[72px]"
                  title={game ? `${game.name} (${appid})` : `AppID: ${appid}`}
                >
                  <span className="text-[10px] text-cyan-400 font-mono font-bold">
                    #{idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-white truncate max-w-full mt-1">
                    {game?.name || `App ${appid}`}
                  </span>
                  <span className="text-[9px] text-gray-500 font-mono">
                    ID: {appid}
                  </span>
                  {!hourBooster.isRunning && (
                    <span className="hidden group-hover:block absolute inset-0 bg-rose-950/80 rounded-xl text-rose-300 text-[10px] font-bold pt-6">
                      Удалить
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="bg-[#0b0c10]/40 border border-dashed border-[#232938] rounded-xl p-2.5 flex flex-col items-center justify-center text-center min-h-[72px]"
              >
                <span className="text-[10px] text-gray-600 font-mono">
                  #{idx + 1}
                </span>
                <span className="text-[10px] text-gray-600 mt-1">
                  {t('empty_slot')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Library Game Picker */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-white">
              {t('select_games')} ({filteredGames.length})
            </h3>
            <button
              onClick={handleDeepScan}
              disabled={isDeepScanning}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#181c28] border border-[#242b3b] text-gray-300 hover:text-cyan-400 hover:border-cyan-500/40 text-[11px] font-medium transition-all"
              title="Сканировать локальные диски ПК (Dota 2, CS2 и др.)"
            >
              <HardDrive className={`w-3 h-3 ${isDeepScanning ? 'animate-pulse text-cyan-400' : 'text-cyan-400'}`} />
              <span>{isDeepScanning ? 'Сканирование ПК...' : 'Сканировать ПК'}</span>
            </button>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t('search_library')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0b0c10] border border-[#232938] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Games Table/Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-1">
          {filteredGames.map((game) => {
            const isSelected = selectedAppIds.includes(game.appid);
            return (
              <div
                key={game.appid}
                onClick={() => !hourBooster.isRunning && toggleGame(game.appid)}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                    : 'bg-[#0b0c10] border-[#1d2333] text-gray-300 hover:border-[#2f3950]'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate text-white">
                    {game.name}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    ID: {game.appid} • {(game.playtime_forever / 60).toFixed(1)}ч
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                    isSelected
                      ? 'bg-cyan-500 text-black border-cyan-400'
                      : 'border-[#2a3245] text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default HourFarmTab;
