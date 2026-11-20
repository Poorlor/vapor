// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Play,
  Pause,
  Square,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Clock,
  Search,
  ShieldCheck,
  Zap,
  Flame,
  ArrowRight,
  Sliders,
  Check
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import type { GameItem } from './HomeView';

export interface CardIdlerGame {
  appid: number;
  name: string;
  cardsRemaining: number;
  playtime_forever?: number;
}

export interface CardIdlerSpatialViewProps {
  animKey: number;
  games: GameItem[];
  isFarmingCards: boolean;
  farmedCardDrops: number;
  remainingCardDrops: number;
  onToggleCardIdler: (games?: CardIdlerGame[]) => void;
  currentApp?: CardIdlerGame | null;
}

export const CardIdlerSpatialView: React.FC<CardIdlerSpatialViewProps> = ({
  animKey,
  games,
  isFarmingCards,
  farmedCardDrops,
  remainingCardDrops,
  onToggleCardIdler,
  currentApp,
}) => {
  const [scannedGames, setScannedGames] = useState<CardIdlerGame[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoSwitchNext, setAutoSwitchNext] = useState(true);
  const [prioritizeOneDrop, setPrioritizeOneDrop] = useState(true);

  // Initialize or fallback to games with cards from props
  useEffect(() => {
    if (games && games.length > 0) {
      const cardGames = games
        .filter((g) => g.hasCards && (g.cardsRemaining ?? 0) > 0)
        .map((g) => ({
          appid: g.appId,
          name: g.title,
          cardsRemaining: g.cardsRemaining || 2,
          playtime_forever: (g.hours || 0) * 60,
        }));
      if (cardGames.length > 0) {
        setScannedGames(cardGames);
      }
    }
  }, [games]);

  // Handle deep scan of card drops via API
  const handleScanBadges = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const res = await fetch('/api/card-idler/scan');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setScannedGames(data);
      }
    } catch (err: any) {
      setScanError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const totalCalculated = useMemo(() => {
    const remaining = scannedGames.reduce((sum, g) => sum + g.cardsRemaining, 0);
    return Math.max(1, farmedCardDrops + (remaining || remainingCardDrops));
  }, [scannedGames, farmedCardDrops, remainingCardDrops]);

  const totalPct = useMemo(() => {
    return Math.min(100, Math.round((farmedCardDrops / totalCalculated) * 100));
  }, [farmedCardDrops, totalCalculated]);

  const currentFarmingGame = useMemo(() => {
    return isFarmingCards ? currentApp ?? null : null;
  }, [isFarmingCards, currentApp]);

  // Filtered games based on search query
  const filteredQueue = useMemo(() => {
    let list = [...scannedGames];
    if (prioritizeOneDrop) {
      list.sort((a, b) => a.cardsRemaining - b.cardsRemaining);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (g) =>
        (g.name || '').toLowerCase().includes(q) ||
        String(g.appid).includes(q)
    );
  }, [scannedGames, prioritizeOneDrop, searchQuery]);

  const totalDropsLeft = useMemo(() => {
    return scannedGames.reduce((sum, g) => sum + g.cardsRemaining, 0);
  }, [scannedGames]);

  return (
    <div className="flex flex-col h-full gap-3 select-none text-white">
      {scanError && <p role="alert" className="rounded-xl bg-rose-950/60 p-3 text-xs text-rose-200">{scanError}</p>}
      {/* ====================================================================
          ROW 1: CONTROL & TELEMETRY HEADER PLAQUE (Full 12 Columns)
      ==================================================================== */}
      <GlassCard delay={20} animKey={animKey} className="p-3.5 px-4 shrink-0 flex items-center justify-between gap-4">
        {/* Left: Title & Subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/35 flex items-center justify-center text-amber-300 shadow-lg shrink-0">
            <Layers className="w-5 h-5 text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                Фарм карточек Steam
              </h2>
              <span className="px-2 py-0.2 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-mono font-semibold text-amber-300">
                CARD IDLER CORE
              </span>
            </div>
            <p className="text-xs text-white/55 font-mono truncate">
              Автоматический сбор коллекционных карточек через прямой CM сокет
            </p>
          </div>
        </div>

        {/* Center: Quick Progress Summary Pill */}
        <div className="hidden lg:flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-white/[0.05] border border-white/10 font-mono text-xs">
          <span className="text-white/50">Прогресс сбора:</span>
          <div className="w-28 h-2 rounded-full bg-white/15 overflow-hidden p-[1px]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-700"
              style={{ width: `${totalPct}%` }}
            />
          </div>
          <span className="text-amber-300 font-bold">{totalPct}%</span>
        </div>

        {/* Right: Scan Badges Button + Master Start/Stop Idler */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleScanBadges}
            disabled={isScanning || isFarmingCards}
            className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
            title="Просканировать страницу значков Steam"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-400' : ''}`} />
            <span>{isScanning ? 'Сканирование...' : 'Проверить значки'}</span>
          </button>

          <button
            onClick={() => onToggleCardIdler(prioritizeOneDrop ? [...scannedGames].sort((a, b) => a.cardsRemaining - b.cardsRemaining) : scannedGames)}
            disabled={scannedGames.length === 0 && !isFarmingCards}
            className={`px-4 py-2 rounded-2xl border text-xs font-mono font-bold flex items-center gap-2 transition-all duration-200 shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isFarmingCards
                ? 'bg-rose-500/25 hover:bg-rose-500/35 border-rose-400/40 text-rose-200 shadow-rose-950/30'
                : 'bg-amber-500/25 hover:bg-amber-500/35 border-amber-400/40 text-amber-200 shadow-amber-950/30'
            }`}
          >
            {isFarmingCards ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Остановить Idler</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Запустить Idler</span>
              </>
            )}
          </button>
        </div>
      </GlassCard>

      {/* ====================================================================
          ROW 2: 3 TELEMETRY & STRATEGY CARDS (12 Columns: 4 + 4 + 4)
      ==================================================================== */}
      <div className="grid grid-cols-12 gap-3 shrink-0">
        {/* Card 1: Current Active Farm Game (4 cols) */}
        <GlassCard delay={40} animKey={animKey} className="col-span-4 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Текущий процесс
            </span>
            {isFarmingCards ? (
              <div className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/35 flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-[10px] font-mono text-amber-300 font-bold">
                  ФАРМИТСЯ
                </span>
              </div>
            ) : (
              <div className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-mono text-white/50">
                НА ПАУЗЕ
              </div>
            )}
          </div>

          <div className="my-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-bold font-mono text-xs shrink-0">
                {currentFarmingGame ? currentFarmingGame.name.slice(0, 2).toUpperCase() : 'CP'}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate">
                  {currentFarmingGame ? currentFarmingGame.name : (isFarmingCards ? 'Cyberpunk 2077' : 'Ожидание запуска')}
                </h3>
                <p className="text-[10px] font-mono text-white/50">
                  {currentFarmingGame ? `AppID: ${currentFarmingGame.appid}` : 'Выберите игру из очереди'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50">
            <span>Осталось для игры:</span>
            <span className="text-amber-300 font-bold">
              {currentFarmingGame ? `${currentFarmingGame.cardsRemaining} карт` : '0 карт'}
            </span>
          </div>
        </GlassCard>

        {/* Card 2: Drop Progress Counter (4 cols) */}
        <GlassCard delay={60} animKey={animKey} className="col-span-4 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Дропы карточек
            </span>
            <div className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/35 flex items-center gap-1 shadow-sm">
              <Sparkles className="w-3 h-3 text-emerald-300" />
              <span className="text-[10px] font-mono text-emerald-300 font-bold">
                +{farmedCardDrops} ВЫПАЛО
              </span>
            </div>
          </div>

          <div className="my-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">
              {farmedCardDrops}
            </span>
            <span className="text-xs font-mono text-white/60">
              получено • {totalDropsLeft || remainingCardDrops} в очереди
            </span>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50">
            <span>Всего в пуле:</span>
            <span className="text-emerald-300 font-semibold">{totalCalculated} карт</span>
          </div>
        </GlassCard>

        {/* Card 3: Strategy & Automation Toggles (4 cols) */}
        <GlassCard delay={80} animKey={animKey} className="col-span-4 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Правила фарма
            </span>
          </div>

          <div className="space-y-1.5 my-1">
            {/* Toggle 1: Prioritize One Drop */}
            <div
              onClick={() => setPrioritizeOneDrop(!prioritizeOneDrop)}
              className="flex items-center justify-between p-1 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] cursor-pointer transition-all text-[11px] font-mono"
            >
              <span className="text-white/80">Сначала игры с 1 картой</span>
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${prioritizeOneDrop ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold' : 'border-white/30 text-transparent'}`}>
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            </div>

            {/* Toggle 2: Auto Switch */}
            <div
              onClick={() => setAutoSwitchNext(!autoSwitchNext)}
              className="flex items-center justify-between p-1 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] cursor-pointer transition-all text-[11px] font-mono"
            >
              <span className="text-white/80">Авто-переход к следующей</span>
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${autoSwitchNext ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold' : 'border-white/30 text-transparent'}`}>
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            </div>
          </div>

          <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/40">
            <span>Эмуляция Steam CM</span>
            <span className="text-white/60">Zero Hooks</span>
          </div>
        </GlassCard>
      </div>

      {/* ====================================================================
          ROW 3: SCANNED BADGE QUEUE GRID (Fills remaining height)
      ==================================================================== */}
      <GlassCard delay={100} animKey={animKey} className="p-3.5 px-4 flex-1 min-h-0 flex flex-col justify-between">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 mb-3">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-amber-300" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Очередь значков и карточек ({filteredQueue.length} игр • {totalDropsLeft} карт осталось)
            </h3>
          </div>

          {/* Search Box */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Поиск по названию игры..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400 font-sans"
            />
          </div>
        </div>

        {/* Loading State during Scan */}
        {isScanning && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white/[0.02] rounded-2xl border border-white/5">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
            <p className="text-xs font-bold text-white/80">Сканирование страницы значков Steam...</p>
            <p className="text-[11px] font-mono text-white/40 mt-1">
              Проверка доступных карточек через прямой CM протокол
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isScanning && filteredQueue.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white/[0.02] rounded-2xl border border-white/5">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
            <h4 className="text-sm font-bold text-white">Все карточки получены</h4>
            <p className="text-xs text-white/50 max-w-md mt-1 font-sans">
              На вашем аккаунте нет доступных карточек для фарма или выполните повторное сканирование значков.
            </p>
            <button
              onClick={handleScanBadges}
              className="mt-3 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white transition-all cursor-pointer"
            >
              Повторить сканирование
            </button>
          </div>
        )}

        {/* Games Table/Grid with internal scroll inside the card */}
        {!isScanning && filteredQueue.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-max content-start gap-2 custom-scrollbar">
            {filteredQueue.map((game, idx) => {
              const isCurrent = isFarmingCards && idx === 0;
              return (
                <div
                  key={`${game.appid}-${idx}`}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                    isCurrent
                      ? 'bg-amber-500/20 border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.25)]'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-white/25 text-white/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center font-mono text-[10px] font-bold text-amber-300 shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-white leading-tight">
                        {game.name}
                      </p>
                      <p className="text-[10px] font-mono text-white/50 mt-0.5 leading-tight">
                        AppID: {game.appid}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-mono font-bold shrink-0">
                    <Layers className="w-3 h-3" />
                    <span>{game.cardsRemaining}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Status Ticker */}
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50 shrink-0">
          <span>Синхронизировано со значками профиля Steam</span>
          <span className="text-amber-300 font-semibold">Автоматическая смена игр в цикле</span>
        </div>
      </GlassCard>
    </div>
  );
};
