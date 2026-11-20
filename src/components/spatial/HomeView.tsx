import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Wallet,
  CreditCard,
  Activity,
  Shield,
  Play,
  Pause,
  ArrowUpRight,
  ArrowDownLeft,
  Scan,
  Plus,
  Flame,
  CheckCircle2,
  Square
} from 'lucide-react';
import { GlassCard } from './GlassCard';

export interface GameItem {
  appId: number;
  title: string;
  hours: number;
  genre: string;
  gradient?: string;
  hasCards?: boolean;
  cardsRemaining?: number;
  cardsTotal?: number;
}

interface HomeViewProps {
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
  remainingCardDrops: number;
  farmedCardDrops: number;
  discordStatus: any;
  discordMode: string;
  isScanningPc: boolean;
  onToggleFarmHours: () => void;
  onScanPc: () => void;
  onAddGameToFarm: (game: GameItem) => void;
  onRemoveGameFromFarm: (appId: number) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  animKey,
  userProfile,
  games,
  slots,
  isFarmingHours,
  farmElapsedSeconds,
  activeSlotsCount,
  remainingCardDrops,
  farmedCardDrops,
  discordStatus,
  discordMode,
  isScanningPc,
  onToggleFarmHours,
  onScanPc,
  onAddGameToFarm,
  onRemoveGameFromFarm,
}) => {
  const [activeBarPeriod, setActiveBarPeriod] = useState(0); // 0: Week, 1: Month
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [activeTxFilter, setActiveTxFilter] = useState(0); // 0: All, 1: With Cards
  const [customAppIdInput, setCustomAppIdInput] = useState('');

  // Default display games if library is loading
  const displayGames = useMemo(() => {
    if (games && games.length > 0) return games;
    return [
      { appId: 730, title: 'Counter-Strike 2', hours: 1842.0, genre: 'Shooter', hasCards: true, cardsRemaining: 0, cardsTotal: 5 },
      { appId: 1091500, title: 'Cyberpunk 2077', hours: 264.8, genre: 'Action RPG', hasCards: true, cardsRemaining: 4, cardsTotal: 6 },
      { appId: 1245620, title: 'ELDEN RING', hours: 418.2, genre: 'Souls-like', hasCards: true, cardsRemaining: 5, cardsTotal: 7 },
      { appId: 570, title: 'Dota 2', hours: 940.5, genre: 'MOBA', hasCards: true, cardsRemaining: 2, cardsTotal: 8 },
      { appId: 271590, title: 'Grand Theft Auto V', hours: 310.5, genre: 'Open World', hasCards: false, cardsRemaining: 0, cardsTotal: 0 }
    ];
  }, [games]);

  const filteredGames = useMemo(() => {
    if (activeTxFilter === 1) {
      return displayGames.filter((g) => g.hasCards && (g.cardsRemaining ?? 0) > 0);
    }
    return displayGames;
  }, [displayGames, activeTxFilter]);

  const heroGame = useMemo(() => {
    const fromSlot = slots.find(Boolean);
    if (fromSlot) return fromSlot;
    return displayGames[0];
  }, [slots, displayGames]);

  // Formatted farm time
  const farmHoursFormatted = useMemo(() => {
    const hours = farmElapsedSeconds / 3600;
    return hours >= 10 ? hours.toFixed(1) : hours.toFixed(2);
  }, [farmElapsedSeconds]);

  const sessionDurationFormatted = useMemo(() => {
    const h = Math.floor(farmElapsedSeconds / 3600);
    const m = Math.floor((farmElapsedSeconds % 3600) / 60);
    const s = farmElapsedSeconds % 60;
    return `${h}ч ${m}м ${s}с`;
  }, [farmElapsedSeconds]);

  // 7-day boost activity bar values
  const barDays = [
    { label: 'Пн', h: 54, val: '16.8 ч', type: 'frosted' },
    { label: 'Вт', h: 42, val: '12.4 ч', type: 'frosted' },
    { label: 'Ср', h: 68, val: '21.6 ч', type: 'dark' },
    { label: 'Чт', h: 48, val: '15.0 ч', type: 'frosted' },
    { label: 'Пт', h: 96, val: '31.2 ч', type: 'teal' },
    { label: 'Сб', h: 64, val: '20.5 ч', type: 'dark' },
    { label: 'Вс', h: 80, val: '25.6 ч', type: 'frosted' },
  ];

  const handleAddCustomAppId = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(customAppIdInput.trim(), 10);
    if (!id || isNaN(id)) return;
    const existing = displayGames.find((g) => g.appId === id);
    const itemToAdd = existing || {
      appId: id,
      title: `AppID ${id}`,
      hours: 0,
      genre: 'Steam Game',
      hasCards: true,
      cardsRemaining: 0,
      cardsTotal: 0
    };
    onAddGameToFarm(itemToAdd);
    setCustomAppIdInput('');
  };

  return (
    <div className="flex flex-col h-full gap-3.5 select-none text-white">
      {/* Window Top Header Row */}
      <div className="flex items-center justify-between shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">
              Vapor Steam Core
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md bg-white/15 border border-white/20 text-white/90">
              VPR-OS 2.0
            </span>
          </div>
          <p className="text-xs text-white/60 font-mono">
            Оператор: <span className="text-white font-medium">{userProfile.name}</span>{userProfile.steamId ? ` | SteamID: ${userProfile.steamId}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-1.5 rounded-full bg-white/12 hover:bg-white/20 border border-white/20 flex items-center gap-2 transition-all hover:-translate-y-0.5 shadow-sm">
            <div className={`w-2 h-2 rounded-full ${isFarmingHours ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-xs font-mono font-medium text-white/90">
              {isFarmingHours ? 'ФАРМ АКТИВЕН' : 'ОЖИДАНИЕ СЕССИИ'}
            </span>
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-white/12 hover:bg-white/20 border border-white/20 flex items-center gap-2 transition-all hover:-translate-y-0.5 shadow-sm">
            <span className="text-xs font-mono font-medium text-white/80">
              Слоты: <span className="text-emerald-300 font-bold">{activeSlotsCount}</span> / 32
            </span>
          </div>
        </div>
      </div>

      {/* TOP GRID ROW (12 Columns: 4 Left Balance + 4 Center 2x2 StatCards + 4 Right Bar Chart) */}
      <div className="grid grid-cols-12 gap-4 flex-[1.12] min-h-0">
        {/* 1. Left Total Balance Card */}
        <GlassCard animKey={animKey} delay={30} className="col-span-4 p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Фарм часов Steam
            </span>
          </div>

          <div className="space-y-1 my-1">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white drop-shadow">
              {farmHoursFormatted} <span className="text-lg font-normal text-white/70">ч</span>
            </div>
            <div className="text-xs text-white/60 font-mono">
              Сессия: <span className="text-white/90 font-medium">{sessionDurationFormatted}</span>
            </div>
          </div>

          {/* Middle stat lines */}
          <div className="grid grid-cols-2 gap-2.5 py-2.5 border-y border-white/15">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-white/50">
                Активных слотов
              </span>
              <div className="text-sm font-bold font-mono text-white">
                {activeSlotsCount} / 32 игр
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-white/50">
                Карт в пуле
              </span>
              <div className="text-sm font-bold font-mono text-white">
                {remainingCardDrops} шт.
              </div>
            </div>
          </div>

          {/* Bottom 2 Action Pill Buttons (Dark Left + Frosted Right) */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              onClick={onToggleFarmHours}
              className={`flex-1 h-10 rounded-xl border flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-95 shadow-md ${
                isFarmingHours
                  ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/40 text-rose-200'
                  : 'bg-slate-900/85 hover:bg-slate-900 border-white/15 text-white'
              }`}
            >
              {isFarmingHours ? (
                <>
                  <Square className="w-3.5 h-3.5 text-rose-300" />
                  <span className="text-xs font-semibold tracking-wide">Остановить</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold tracking-wide">Запустить фарм</span>
                </>
              )}
            </button>
            <button
              onClick={onScanPc}
              disabled={isScanningPc}
              className="flex-1 h-10 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-95 text-white disabled:opacity-50"
            >
              <Scan className="w-3.5 h-3.5 text-white/90" />
              <span className="text-xs font-semibold tracking-wide">
                {isScanningPc ? 'Сканирование...' : 'Сканировать ПК'}
              </span>
            </button>
          </div>
        </GlassCard>

        {/* 2. Center 2x2 StatCards Grid */}
        <div className="col-span-4 grid grid-cols-2 grid-rows-2 gap-3.5 h-full min-h-0">
          {/* StatCard 1: Teal Gradient Card */}
          <GlassCard animKey={animKey} delay={80} tint="teal" className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/90">Слоты фарминга</span>
              <div className="w-6 h-6 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5 text-white/95" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-white">
              {activeSlotsCount} <span className="text-sm font-normal text-white/80">/ 32</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-xs font-medium text-emerald-200">Параллельно</span>
            </div>
          </GlassCard>

          {/* StatCard 2: Light Frosted Card */}
          <GlassCard animKey={animKey} delay={130} tint="light" className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/85">Дропы карточек</span>
              <div className="w-6 h-6 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-white/90" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-white">
              {farmedCardDrops} <span className="text-sm font-normal text-white/70">выпало</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/60 font-mono">Осталось: {remainingCardDrops}</span>
            </div>
          </GlassCard>

          {/* StatCard 3: Light Frosted Card with Green Badge */}
          <GlassCard animKey={animKey} delay={180} tint="light" className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/85">Защита VAC</span>
              <div className="w-6 h-6 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-emerald-300" />
              </div>
            </div>
            <div className="text-xl font-extrabold tracking-wide text-white">
              АКТИВНА
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/35 w-fit">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span className="text-[10px] font-mono text-emerald-200 font-bold">Direct Socket</span>
            </div>
          </GlassCard>

          {/* StatCard 4: Light Frosted Card */}
          <GlassCard animKey={animKey} delay={230} tint="light" className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/85">Discord Spoofer</span>
              <div className="w-6 h-6 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white/90" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-white">
              {discordStatus?.isDiscordRunning ? 'ONLINE' : 'STANDBY'}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/60 font-mono uppercase">
                Режим: {discordMode}
              </span>
            </div>
          </GlassCard>
        </div>

        {/* 3. Right Bar Chart Card */}
        <GlassCard animKey={animKey} delay={160} className="col-span-4 p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-white/90">График буста</span>
              <p className="text-[11px] text-white/50 font-mono">Суммарно по дням</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-full bg-white/10 border border-white/20">
              {['Неделя', 'Месяц'].map((label, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveBarPeriod(idx);
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono transition-all ${
                    activeBarPeriod === idx ? 'bg-white/30 text-white font-semibold shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive 7-Bar Vertical Chart */}
          <div className="flex items-end justify-between gap-2.5 flex-1 pt-4 px-1 min-h-0 relative">
            {barDays.map((bar, i) => {
              const adjHeight = activeBarPeriod === 1 ? ((bar.h * 1.25) % 85) + 25 : bar.h;
              const isHovered = hoveredBar === i;
              const barStyle =
                bar.type === 'teal'
                  ? 'bg-gradient-to-t from-teal-800/90 to-teal-500/80 border-teal-300/40'
                  : bar.type === 'dark'
                  ? 'bg-slate-900/80 border-white/20'
                  : 'bg-white/25 border-white/30';

              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                  className="flex-1 flex flex-col items-center justify-end h-full gap-2 group/bar relative cursor-pointer"
                >
                  {/* Tooltip on hover */}
                  {isHovered && (
                    <div className="absolute -top-7 px-2 py-0.5 rounded-md bg-slate-900/90 border border-white/30 text-[10px] font-mono text-white whitespace-nowrap shadow-lg z-20 pointer-events-none">
                      {bar.label}: {bar.val}
                    </div>
                  )}
                  <div
                    style={{ height: `${adjHeight}%` }}
                    className={`w-full rounded-xl border transition-all duration-500 relative ${barStyle} ${
                      isHovered ? 'scale-105 brightness-125 shadow-lg' : ''
                    }`}
                  />
                  <span className="text-[10px] font-mono text-white/60 group-hover/bar:text-white transition-colors shrink-0">
                    {bar.label}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* BOTTOM GRID ROW (12 Columns: 4 Left Dual Cards + 8 Right Recent Activity Rows) */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 1. Bottom-Left Card (2 Vertical Inner Sub-Cards) */}
        <GlassCard animKey={animKey} delay={260} className="col-span-4 p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between shrink-0 mb-2">
            <span className="text-xs font-semibold text-white/90">Быстрый запуск и инъекция</span>
            <span className="text-[11px] text-white/50 font-mono">AppID</span>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
            {/* Left Dark Teal Inner Card */}
            <div className="rounded-2xl bg-gradient-to-br from-teal-900/90 via-slate-900/90 to-slate-950/95 border border-teal-400/30 p-3.5 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-300/30">
                  STEAM IPC
                </span>
                <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              </div>
              <div className="space-y-0.5 my-1">
                <div className="text-xs font-bold text-white truncate" title={heroGame?.title}>
                  {heroGame?.title || 'Counter-Strike 2'}
                </div>
                <div className="text-[11px] font-mono text-white/60">
                  #{heroGame?.appId || 730} | {heroGame?.hours ? `${heroGame.hours} ч` : '16.1h'}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] font-mono text-teal-300">
                <span>ЭМУЛЯЦИЯ</span>
                <span className="text-white/80">АКТИВНА</span>
              </div>
            </div>

            {/* Right Light Frosted Inner Card */}
            <form onSubmit={handleAddCustomAppId} className="rounded-2xl bg-white/15 hover:bg-white/22 border border-white/25 p-3 flex flex-col justify-between transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="w-6 h-6 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5 text-white/90" />
                </div>
                <span className="text-[10px] font-mono text-white/60">Пул 32</span>
              </div>
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="AppID игры..."
                  value={customAppIdInput}
                  onChange={(e) => setCustomAppIdInput(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded-lg bg-black/40 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/50 font-mono"
                />
                <div className="flex items-center gap-1">
                  {[730, 1091500, 570].map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCustomAppIdInput(String(id))}
                      className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-white/10 hover:bg-white/20 text-white/80 border border-white/15"
                    >
                      #{id}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-1 text-xs rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium transition-all"
              >
                + Добавить в пул
              </button>
            </form>
          </div>
        </GlassCard>

        {/* 2. Bottom-Right Recent Activity List Card */}
        <GlassCard animKey={animKey} delay={320} className="col-span-8 p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between shrink-0 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/90">
                Активный пул эмуляции (/api/steam/farm)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-white/70">
                {filteredGames.length} игр
              </span>
            </div>
            <div className="flex items-center gap-2">
              {['Все игры', 'С карточками'].map((tab, idx) => (
                <button
                  key={tab}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTxFilter(idx);
                  }}
                  className={`px-3 py-1 rounded-full border text-xs font-mono transition-all ${
                    activeTxFilter === idx
                      ? 'bg-white/25 border-white/40 text-white font-semibold'
                      : 'bg-white/10 border-white/15 text-white/60 hover:bg-white/18'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* 3 Horizontal Activity Rows */}
          <div className="flex flex-col justify-between flex-1 gap-2 min-h-0">
            {filteredGames.slice(0, 3).map((game) => {
              const isFarmed = slots.some((s) => s && s.appId === game.appId);
              return (
                <div
                  key={game.appId}
                  className="flex-1 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/30 px-4 flex items-center justify-between transition-all duration-200 hover:translate-x-1"
                >
                  <div className="flex items-center gap-3 w-1/3">
                    <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0 font-bold font-mono text-xs text-white">
                      {game.title.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="space-y-0.5 truncate">
                      <div className="text-xs font-bold text-white truncate">
                        {game.title}
                      </div>
                      <div className="text-[10px] font-mono text-white/50">
                        AppID: {game.appId}
                      </div>
                    </div>
                  </div>

                  <div className="px-2.5 py-1 rounded-full bg-white/12 border border-white/20 text-[11px] font-mono text-emerald-300 font-semibold">
                    {game.genre}
                  </div>

                  <div className="text-xs font-mono text-white/60">
                    {game.hasCards ? `${game.cardsRemaining} карт` : 'Без карт'}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold font-mono text-white">
                      {game.hours} ч
                    </span>
                    <button
                      onClick={() => {
                        if (isFarmed) onRemoveGameFromFarm(game.appId);
                        else onAddGameToFarm(game);
                      }}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                        isFarmed
                          ? 'bg-rose-500/30 border-rose-400/50 text-rose-200 hover:bg-rose-500/50'
                          : 'bg-white/15 border-white/25 text-white/80 hover:bg-white/30'
                      }`}
                      title={isFarmed ? 'Убрать из слота' : 'Добавить в слот'}
                    >
                      {isFarmed ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
