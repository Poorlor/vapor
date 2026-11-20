// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  Square,
  Plus,
  X,
  Sparkles,
  Zap,
  Search,
  Check,
  Gamepad2,
  Sliders,
  ShieldCheck,
  Layers,
  RotateCcw
} from 'lucide-react';
import { GlassCard } from '../spatial/GlassCard';
import { api, post } from '../../lib/api';

interface DiscordHoursTabProps {
  animKey?: number;
  theme?: any;
  lang?: 'ru' | 'en';
  discordStatus?: any;
  status?: any;
  mode?: 'process' | 'rpc';
  onStartFarm?: (gameIds: string[], durationMinutes: number | null, mode?: 'process' | 'rpc') => Promise<any>;
  onStopFarm?: () => Promise<any>;
  fetchDiscordStatus?: () => void;
  addLog: (level: string, message: string) => void;
}

export const DiscordHoursTab: React.FC<DiscordHoursTabProps> = ({
  animKey = 0,
  discordStatus,
  status,
  mode: propMode,
  onStartFarm,
  onStopFarm,
  fetchDiscordStatus,
  addLog,
}) => {
  const [selectedGames, setSelectedGames] = useState<any[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogGames, setCatalogGames] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const currentStatus = discordStatus || status || {};
  const activeMode = propMode || currentStatus?.mode || currentStatus?.farm?.mode || 'process';
  const farmState = currentStatus.farm || {};
  const isRunning = Boolean(farmState.isRunning);
  const elapsedSeconds = farmState.elapsedSeconds || 0;
  const multiplier = isRunning ? (farmState.activeGames?.length || 0) : selectedGames.length;

  // Format HH:MM:SS
  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const totalFarmHours = ((elapsedSeconds * multiplier) / 3600).toFixed(2);

  // Search the full catalog; abort obsolete requests when typing.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
    api(`/api/discord/games?pageSize=60&q=${encodeURIComponent(searchQuery)}`, { signal: controller.signal })
      .then((d) => {
        if (d && Array.isArray(d.games)) {
          setCatalogGames(d.games);
        }
      })
      .catch(() => {});
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchQuery]);

  // Synchronize active games from farmState if farm is running
  useEffect(() => {
    if (farmState.activeGames && Array.isArray(farmState.activeGames) && farmState.activeGames.length > 0) {
      setSelectedGames(farmState.activeGames);
    }
  }, [farmState.activeGames]);

  const handleToggleGame = (game: any) => {
    if (isRunning) return;
    const exists = selectedGames.some((g) => g.id === game.id);
    if (exists) {
      setSelectedGames((prev) => prev.filter((g) => g.id !== game.id));
    } else {
      if (selectedGames.length >= 20) {
        addLog('WARN', 'Максимальное количество параллельных игр для Discord — 20.');
        return;
      }
      setSelectedGames((prev) => [...prev, game]);
    }
  };

  const handleQuickFill = () => {
    if (isRunning) return;
    setSelectedGames(catalogGames.slice(0, 20));
      addLog('INFO', 'Выбраны игры для эмуляции. Зачисление времени проверяйте в Discord.');
  };

  const handleClearSlots = () => {
    if (isRunning) return;
    setSelectedGames([]);
  };

  const handleStart = async () => {
    if (selectedGames.length === 0) {
      addLog('WARN', 'Выберите хотя бы 1 игру для запуска бустера.');
      return;
    }
    setIsLoading(true);
    try {
      const gameIds = selectedGames.map((g) => g.id);
      if (onStartFarm) {
        const result = await onStartFarm(gameIds, durationMinutes, activeMode);
        if (result?.success === false) return;
      } else {
        await post('/api/discord/farm/start', { gameIds, durationMinutes, mode: activeMode });
      }
      fetchDiscordStatus?.();
      addLog('INFO', `Эмуляция запущена для ${selectedGames.length} игр. Начисление часов Discord не подтверждено.`);
    } catch (e: any) {
      addLog('ERROR', 'Ошибка старта буста: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      if (onStopFarm) {
        const result = await onStopFarm();
        if (result?.success === false) return;
      } else {
        await post('/api/discord/farm/stop');
      }
      fetchDiscordStatus?.();
      addLog('WARN', 'Буст часов Discord остановлен пользователем.');
    } catch (e: any) {
      addLog('ERROR', 'Ошибка остановки: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCatalog = catalogGames.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       (g.exeName || g.exe || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/35 flex items-center justify-center text-sky-300 shadow-lg shrink-0">
            <Clock className="w-5 h-5 text-sky-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                Фарм часов Discord
              </h2>
              <span className="px-2 py-0.2 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10px] font-mono font-semibold text-sky-300">
                BOOSTER CORE 20X
              </span>
            </div>
            <p className="text-xs text-white/55 font-mono truncate">
              Эмуляция активности до 20 игр; Discord может не учитывать параллельное время
            </p>
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleQuickFill}
            disabled={isRunning}
            className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-xs font-mono font-semibold text-sky-200 transition-all cursor-pointer disabled:opacity-40"
            title="Автоматически заполнить все 20 слотов популярными играми"
          >
            Заполнить 20 слотов
          </button>

          <button
            onClick={handleClearSlots}
            disabled={isRunning || selectedGames.length === 0}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white/80 hover:text-white transition-all cursor-pointer disabled:opacity-40"
            title="Очистить выбранные слоты"
          >
            Очистить
          </button>
        </div>
      </GlassCard>

      {/* ====================================================================
          ROW 2: TELEMETRY & CONTROLS BENTO (3 Cards, 12 Columns)
      ==================================================================== */}
      <div className="grid grid-cols-12 gap-3 shrink-0">
        {/* Card 1: Active Timer & Multiplier (4 cols) */}
        <GlassCard delay={40} animKey={animKey} hoverLift={true} className="col-span-4 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-white/70">Активный таймер буста</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-400/30 font-bold">
              {multiplier}x МУЛЬТИПЛИКАТОР
            </span>
          </div>

          <div className="my-2 flex items-baseline justify-between">
            <div className="text-3xl font-mono font-bold text-white tracking-tight">
              {isRunning ? formatTimer(elapsedSeconds) : '00:00:00'}
            </div>
            <div className="text-xs font-mono text-sky-300 font-semibold flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-white/30'}`} />
              <span>{isRunning ? 'Сессия активна' : 'Ожидание'}</span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-white/45">
            Каждая секунда реального времени дает +{multiplier} сек. в Discord
          </div>
        </GlassCard>

        {/* Card 2: Farmed Hours & Slots (5 cols) */}
        <GlassCard delay={60} animKey={animKey} hoverLift={true} className="col-span-5 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-white/70">Суммарно нафармлено часов</span>
            <div className="text-xs font-mono text-emerald-300 font-bold">
              {selectedGames.length} / 20 слотов
            </div>
          </div>

          <div className="my-2 flex items-baseline justify-between">
            <div className="text-2xl font-mono font-bold text-emerald-300 tracking-tight">
              +{totalFarmHours} <span className="text-xs font-normal text-white/60">ч. общего стажа</span>
            </div>
            <span className="text-xs font-mono text-white/50">
              {((selectedGames.length / 20) * 100).toFixed(0)}% слотов
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${(selectedGames.length / 20) * 100}%` }}
              />
            </div>
            <div className="text-[11px] font-mono text-white/40 flex justify-between">
              <span>Слот-лимит: 20 игр</span>
              <span>Режим: {activeMode === 'rpc' ? 'IPC RPC' : 'Win32 Process'}</span>
            </div>
          </div>
        </GlassCard>

        {/* Card 3: Master Control Action (3 cols) */}
        <GlassCard delay={80} animKey={animKey} hoverLift={true} className="col-span-3 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-white/70">Управление сессией</span>
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
                <span>Остановить буст</span>
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={isLoading || selectedGames.length === 0}
                className="w-full py-2.5 rounded-xl bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/40 text-sky-200 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Запустить {selectedGames.length} игр</span>
              </button>
            )}
          </div>

          <div className="text-[11px] font-mono text-white/40 text-center">
            {isRunning ? 'Все 20 процессов запущены' : 'Выберите игры из каталога ниже'}
          </div>
        </GlassCard>
      </div>

      {/* ====================================================================
          ROW 3: 20 PARALLEL SLOTS GRID & CATALOG PICKER
      ==================================================================== */}
      <GlassCard delay={100} animKey={animKey} hoverLift={true} className="p-3.5 px-4 flex-1 min-h-0 flex flex-col justify-between">
        {/* Controls Bar */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-300" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Выбранные игры для буста ({selectedGames.length} из 20 слотов)
            </h3>
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по базе 25,176 игр..."
              className="w-full pl-8 pr-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/15 text-xs text-white placeholder-white/40 focus:border-sky-400/50 focus:outline-none transition-all font-mono"
            />
          </div>
        </div>

        {/* 20 Slots Grid */}
        <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {Array.from({ length: 20 }).map((_, idx) => {
              const game = selectedGames[idx];

              if (game) {
                return (
                  <div
                    key={game.id || idx}
                    className="p-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 hover:border-white/30 flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0 font-mono text-[10px] font-bold">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{game.name}</div>
                        <div className="text-[10px] font-mono text-white/45 truncate">{game.exeName}</div>
                      </div>
                    </div>

                    {!isRunning && (
                      <button
                        onClick={() => handleToggleGame(game)}
                        className="p-1 rounded-lg text-white/40 hover:text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer opacity-60 group-hover:opacity-100"
                        title="Убрать игру из слота"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={`empty-${idx}`}
                  className="p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-dashed border-white/10 hover:border-white/20 flex items-center gap-2.5 text-white/30 hover:text-white/50 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/20 font-mono text-[10px]">
                    {idx + 1}
                  </div>
                  <span className="text-xs font-mono text-white/30">Свободный слот</span>
                </div>
              );
            })}
          </div>

          {/* Quick Catalog Picker below */}
          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="text-xs font-mono text-white/50 mb-2">
              Кликните по игре ниже, чтобы добавить или убрать её из активных слотов:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filteredCatalog.slice(0, 24).map((game) => {
                const isSelected = selectedGames.some((g) => g.id === game.id);

                return (
                  <button
                    key={game.id}
                    onClick={() => handleToggleGame(game)}
                    disabled={isRunning}
                    className={`p-2 rounded-xl text-left font-mono text-xs flex items-center justify-between border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm cursor-pointer disabled:opacity-50 ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-400/40 text-sky-200'
                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white/70 hover:border-white/25'
                    }`}
                  >
                    <span className="truncate">{game.name}</span>
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-sky-300 shrink-0 ml-1" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-white/30 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Sub-bar */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Мультипликатор активен: до 20x одновременного стажа в Discord</span>
          </div>
          <span>Vapor Booster • Build 2026.11</span>
        </div>
      </GlassCard>
    </div>
  );
};
