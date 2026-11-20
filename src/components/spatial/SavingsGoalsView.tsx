import React, { useState } from 'react';
import {
  Sparkles,
  Target,
  Play,
  Square,
  CheckCircle2,
  Layers,
  Flame,
  ArrowUpRight
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { GameItem } from './HomeView';

interface SavingsGoalsViewProps {
  animKey: number;
  games: GameItem[];
  isFarmingCards: boolean;
  farmedCardDrops: number;
  remainingCardDrops: number;
  onToggleCardIdler: () => void;
  onPrioritizeGame?: (appId: number) => void;
}

export const SavingsGoalsView: React.FC<SavingsGoalsViewProps> = ({
  animKey,
  games,
  isFarmingCards,
  farmedCardDrops,
  remainingCardDrops,
  onToggleCardIdler,
  onPrioritizeGame,
}) => {
  const [skipZeroDrops, setSkipZeroDrops] = useState(true);
  const [autoSwitchNext, setAutoSwitchNext] = useState(true);

  // Filter games with card drops or fallback to defaults
  const cardGames = React.useMemo(() => {
    const list = games.filter((g) => g.hasCards && (g.cardsRemaining ?? 0) > 0);
    if (list.length >= 4) return list.slice(0, 4);
    return [
      { appId: 1091500, title: 'Cyberpunk 2077', hours: 264.8, genre: 'Action RPG', hasCards: true, cardsRemaining: 2, cardsTotal: 6 },
      { appId: 1245620, title: 'ELDEN RING', hours: 418.2, genre: 'Souls-like', hasCards: true, cardsRemaining: 2, cardsTotal: 7 },
      { appId: 1145360, title: 'Hades', hours: 128.0, genre: 'Roguelike', hasCards: true, cardsRemaining: 3, cardsTotal: 6 },
      { appId: 1086940, title: "Baldur's Gate 3", hours: 312.4, genre: 'RPG', hasCards: true, cardsRemaining: 5, cardsTotal: 8 },
    ];
  }, [games]);

  const totalCalculated = Math.max(1, farmedCardDrops + remainingCardDrops);
  const totalPct = Math.min(100, Math.round((farmedCardDrops / totalCalculated) * 100));

  const hourlyPillars = [
    { label: '12:00', h: 45, drops: '2 шт' },
    { label: '13:00', h: 62, drops: '4 шт' },
    { label: '14:00', h: 52, drops: '3 шт' },
    { label: '15:00', h: 78, drops: '5 шт' },
    { label: '16:00', h: 68, drops: '4 шт' },
    { label: '17:00', h: 92, drops: '6 шт' },
  ];

  return (
    <div className="flex flex-col h-full gap-3.5 select-none text-white">
      {/* Window Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">
              Менеджер карточек и дропов Steam
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md bg-white/15 border border-white/20 text-white/90">
              CARD IDLER
            </span>
          </div>
          <p className="text-xs text-white/60 font-mono">
            Автоматический фарм коллекционных карточек через эмуляцию процессов Steam
          </p>
        </div>

        <button
          onClick={onToggleCardIdler}
          className={`h-9 px-4 rounded-full border flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 ${
            isFarmingCards
              ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/40 text-rose-200'
              : 'bg-slate-900/85 hover:bg-slate-900 border-white/20 text-white'
          }`}
        >
          {isFarmingCards ? (
            <>
              <Square className="w-3.5 h-3.5 text-rose-300" />
              <span className="text-xs font-semibold font-mono tracking-wide">
                Остановить фарм
              </span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold font-mono tracking-wide">
                Запустить Idler
              </span>
            </>
          )}
        </button>
      </div>

      {/* TOP GRID ROW (3 Equal Columns: 4 + 4 + 4) */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 1. Left Total Savings Card */}
        <GlassCard animKey={animKey} delay={40} className="col-span-4 p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Суммарный прогресс дропов
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white drop-shadow">
              {farmedCardDrops} <span className="text-base font-normal text-white/70">карт получено</span>
            </div>
            <div className="text-xs text-white/60 font-mono">
              Осталось собрать: <span className="text-white font-medium">{remainingCardDrops} шт.</span>
            </div>
          </div>

          {/* Progress Bar Track */}
          <div className="space-y-2">
            <div className="w-full h-2.5 rounded-full bg-white/20 overflow-hidden p-[1px]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 shadow-sm"
                style={{ width: `${totalPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white/50">Прогресс пула: {totalPct}%</span>
              <span className="text-emerald-300 font-semibold">{farmedCardDrops} / {totalCalculated}</span>
            </div>
          </div>
        </GlassCard>

        {/* 2. Center Monthly Savings Pillars Card */}
        <GlassCard animKey={animKey} delay={110} className="col-span-4 p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-white/90">Динамика дропов по часам</span>
            <span className="text-[11px] text-white/50 font-mono">Карт / час</span>
          </div>

          <div className="flex items-end justify-between gap-2.5 flex-1 pt-4 min-h-0">
            {hourlyPillars.map((p, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5 group/pillar relative cursor-pointer">
                <div
                  style={{ height: `${p.h}%` }}
                  className={`w-full rounded-xl border transition-all duration-300 group-hover/pillar:scale-105 ${
                    i === 5
                      ? 'bg-white/40 border-white/55 shadow-md'
                      : 'bg-white/20 hover:bg-white/30 border-white/25'
                  }`}
                  title={`${p.label}: ${p.drops}`}
                />
                <span className="text-[10px] font-mono text-white/60 shrink-0">
                  {p.label}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* 3. Right Auto-Save Rules Card with Toggles */}
        <GlassCard animKey={animKey} delay={170} className="col-span-4 p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between shrink-0 mb-2">
            <span className="text-xs font-semibold text-white/90">Правила автоматизации</span>
            <div className="w-6 h-6 rounded-full bg-white/15 border border-white/25 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white/80" />
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3 flex-1 min-h-0">
            {[
              {
                active: skipZeroDrops,
                toggle: () => setSkipZeroDrops(!skipZeroDrops),
                title: 'Пропускать игры без дропов',
                sub: 'Не тратить время на пустые слоты'
              },
              {
                active: autoSwitchNext,
                toggle: () => setAutoSwitchNext(!autoSwitchNext),
                title: 'Авто-переключение на след. игру',
                sub: 'При исчерпании дропов текущей'
              },
            ].map((item, idx) => (
              <div
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  item.toggle();
                }}
                className="flex-1 rounded-2xl bg-white/14 hover:bg-white/22 border border-white/20 px-4 flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-white">
                    {item.title}
                  </div>
                  <div className="text-[10px] font-mono text-white/50">
                    {item.sub}
                  </div>
                </div>
                <div
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
                    item.active ? 'bg-orange-400/85 justify-end' : 'bg-slate-900/50 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* BOTTOM GRID ROW (4 Equal Circular Ring Goal Cards) */}
      <div className="grid grid-cols-4 gap-4 flex-[1.15] min-h-0">
        {cardGames.map((game, idx) => {
          const total = game.cardsTotal || 6;
          const remaining = game.cardsRemaining || 2;
          const farmed = Math.max(0, total - remaining);
          const pct = Math.round((farmed / total) * 100);

          const radius = 36;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (pct / 100) * circumference;

          return (
            <GlassCard
              key={game.appId || idx}
              animKey={animKey}
              delay={240 + idx * 60}
              className="p-5 flex flex-col items-center justify-between h-full"
            >
              {/* Top Row */}
              <div className="w-full flex items-center justify-between shrink-0">
                <div className="truncate pr-2">
                  <span className="text-xs font-bold text-white truncate block">
                    {game.title}
                  </span>
                  <span className="text-[10px] font-mono text-white/50">
                    AppID: {game.appId}
                  </span>
                </div>
                <div className="w-6 h-6 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                  <Target className="w-3 h-3 text-white/80" />
                </div>
              </div>

              {/* Center Circular Progress Ring */}
              <div className="relative w-28 h-28 flex items-center justify-center my-1 group-hover:scale-105 transition-transform duration-300">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
                  <circle
                    cx="44"
                    cy="44"
                    r={radius}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.18)"
                    strokeWidth="7.5"
                  />
                  <circle
                    cx="44"
                    cy="44"
                    r={radius}
                    fill="none"
                    stroke="#e06d53"
                    strokeWidth="7.5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                  <span className="text-base font-extrabold font-mono text-white">
                    {pct}%
                  </span>
                  <span className="text-[9px] font-mono text-white/60">
                    {farmed}/{total}
                  </span>
                </div>
              </div>

              {/* Bottom Footer */}
              <div className="w-full space-y-2 shrink-0">
                <div className="w-full flex items-center justify-between text-[11px] font-mono">
                  <span className="text-white/50">Осталось:</span>
                  <span className="text-amber-300 font-semibold">{remaining} карты</span>
                </div>
                <button
                  onClick={() => onPrioritizeGame && onPrioritizeGame(game.appId)}
                  className="w-full h-7 rounded-xl bg-white/12 hover:bg-white/22 border border-white/20 flex items-center justify-center text-xs font-mono font-medium text-white transition-all hover:scale-[1.02] active:scale-95"
                >
                  Приоритет в очереди
                </button>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
};
