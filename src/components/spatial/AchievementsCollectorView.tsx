import React, { useState } from 'react';
import {
  Trophy,
  PackagePlus,
  Check,
  Sparkles,
  Lock,
  Unlock,
  Shield,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { GlassCard } from './GlassCard';

export interface AchievementItem {
  id: string;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  unlocked: boolean;
  rarity: string;
}

export interface CollectorGameItem {
  appId: number;
  title: string;
  genre: string;
  claimed: boolean;
}

interface AchievementsCollectorViewProps {
  animKey: number;
  onClaimAll?: () => void;
}

export const AchievementsCollectorView: React.FC<AchievementsCollectorViewProps> = ({
  animKey,
  onClaimAll,
}) => {
  const [activeFilter, setActiveFilter] = useState<number>(0); // 0: All, 1: Locked
  const [naturalInterval, setNaturalInterval] = useState(true);
  const [overlayNotifications, setOverlayNotifications] = useState(true);

  const [achievements, setAchievements] = useState<AchievementItem[]>([
    { id: 'ACH_01', titleRu: 'Первая кровь', titleEn: 'First Blood', descRu: 'Одержите первую победу в ранговом матче протокола.', descEn: 'Win your first match.', unlocked: true, rarity: '84.2%' },
    { id: 'ACH_02', titleRu: 'Безупречный тактик', titleEn: 'Flawless Tactician', descRu: 'Завершите раунд без потери единицы здоровья отряда.', descEn: 'Zero squad damage.', unlocked: true, rarity: '31.6%' },
    { id: 'ACH_03', titleRu: 'Снайперский рубеж', titleEn: 'Marksman Frontier', descRu: 'Поразите 100 целей на дистанции свыше 250 метров.', descEn: '100 long range kills.', unlocked: true, rarity: '18.9%' },
    { id: 'ACH_04', titleRu: 'Корона Вознесения', titleEn: 'Crown of Ascension', descRu: 'Достигните высшего дивизиона в соревновательном сезоне.', descEn: 'Reach apex tier.', unlocked: false, rarity: '4.1%' },
    { id: 'ACH_05', titleRu: 'Хранитель реликвий', titleEn: 'Relic Archivist', descRu: 'Соберите все 50 секретных артефактов древнего мира.', descEn: 'Collect 50 artifacts.', unlocked: false, rarity: '9.4%' },
    { id: 'ACH_06', titleRu: 'Повелитель стихий', titleEn: 'Elemental Sovereign', descRu: 'Нанесите 1,000,000 ед. чистого урона за одну сессию.', descEn: '1M damage.', unlocked: true, rarity: '22.8%' },
  ]);

  const [collectorGames, setCollectorGames] = useState<CollectorGameItem[]>([
    { appId: 2073850, title: 'THE FINALS', genre: 'Arena Shooter', claimed: true },
    { appId: 1085660, title: 'Destiny 2', genre: 'Sci-Fi MMO', claimed: true },
    { appId: 230410, title: 'Warframe', genre: 'Action Looter', claimed: false },
    { appId: 238960, title: 'Path of Exile', genre: 'Dark ARPG', claimed: false },
    { appId: 440, title: 'Team Fortress 2', genre: 'Class Shooter', claimed: true },
    { appId: 1962663, title: 'Call of Duty: Warzone', genre: 'Battle Royale', claimed: false },
  ]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const progressPct = Math.round((unlockedCount / achievements.length) * 100);

  const toggleAchievement = (id: string) => {
    setAchievements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, unlocked: !a.unlocked } : a))
    );
  };

  const toggleClaim = (appId: number) => {
    setCollectorGames((prev) =>
      prev.map((g) => (g.appId === appId ? { ...g, claimed: !g.claimed } : g))
    );
  };

  const handleClaimAllFree = () => {
    setCollectorGames((prev) => prev.map((g) => ({ ...g, claimed: true })));
    if (onClaimAll) onClaimAll();
  };

  const filteredAchievements = activeFilter === 1
    ? achievements.filter((a) => !a.unlocked)
    : achievements;

  return (
    <div className="flex flex-col h-full gap-3.5 select-none text-white">
      {/* Window Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">
              Менеджер достижений и Коллекционер
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md bg-white/15 border border-white/20 text-white/90">
              ACHIEVEMENTS & DLC
            </span>
          </div>
          <p className="text-xs text-white/60 font-mono">
            Синхронизация ачивок Steam и активация бесплатных лицензий/DLC
          </p>
        </div>

        <div className="flex items-center gap-2">
          {['Все ачивки', 'Не открытые'].map((tab, idx) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(idx)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-all ${
                activeFilter === idx
                  ? 'bg-white/30 text-white font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* TOP GRID ROW (12 Columns: 4 + 4 + 4) */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 1. Left Progress Card */}
        <GlassCard animKey={animKey} delay={40} className="col-span-4 p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Прогресс достижений
            </span>
            <div className="px-2.5 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/35 flex items-center gap-1">
              <span className="text-[11px] font-mono text-emerald-300 font-bold">
                {progressPct}% РАЗБЛОКИРОВАНО
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white drop-shadow">
              {unlockedCount} <span className="text-base font-normal text-white/70">/ {achievements.length} ачивок</span>
            </div>
            <div className="text-xs text-white/60 font-mono">
              Средняя редкость: <span className="text-white font-medium">32.1%</span>
            </div>
          </div>

          {/* Progress Bar Track */}
          <div className="space-y-2">
            <div className="w-full h-2.5 rounded-full bg-white/20 overflow-hidden p-[1px]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000 shadow-sm"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white/50">Готово к синхронизации</span>
              <span className="text-amber-300 font-semibold">{progressPct}%</span>
            </div>
          </div>
        </GlassCard>

        {/* 2. Center Collector Stats */}
        <GlassCard animKey={animKey} delay={110} className="col-span-4 p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-white/90">Коллекционер лицензий</span>
            <span className="text-[11px] text-white/50 font-mono">FREE SUBIDS</span>
          </div>

          <div className="space-y-1">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white drop-shadow">
              {collectorGames.filter((g) => g.claimed).length}{' '}
              <span className="text-base font-normal text-white/70">получено</span>
            </div>
            <div className="text-xs text-white/60 font-mono">
              Доступно к клейму: <span className="text-white font-medium">{collectorGames.filter((g) => !g.claimed).length} игр</span>
            </div>
          </div>

          <button
            onClick={handleClaimAllFree}
            className="w-full h-9 rounded-xl bg-slate-900/85 hover:bg-slate-900 border border-white/20 flex items-center justify-center gap-2 text-xs font-mono font-medium text-white transition-all hover:scale-[1.02] active:scale-95 shadow-md"
          >
            <PackagePlus className="w-3.5 h-3.5 text-white/90" />
            <span>Активировать все лицензии</span>
          </button>
        </GlassCard>

        {/* 3. Right Security & Interval Toggles */}
        <GlassCard animKey={animKey} delay={170} className="col-span-4 p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between shrink-0 mb-2">
            <span className="text-xs font-semibold text-white/90">Безопасность анлокера</span>
            <div className="w-6 h-6 rounded-full bg-white/15 border border-white/25 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white/80" />
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3 flex-1 min-h-0">
            {[
              {
                active: naturalInterval,
                toggle: () => setNaturalInterval(!naturalInterval),
                title: 'Естественный интервал (15-45с)',
                sub: 'Защита от подозрительных всплесков'
              },
              {
                active: overlayNotifications,
                toggle: () => setOverlayNotifications(!overlayNotifications),
                title: 'Уведомления в оверлее',
                sub: 'Всплывающие окна Steam'
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
                    item.active ? 'bg-emerald-400/85 justify-end' : 'bg-slate-900/50 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* BOTTOM GRID ROW (2 Columns: 6 Achievements List + 6 Collector Games) */}
      <div className="grid grid-cols-12 gap-4 flex-[1.15] min-h-0">
        {/* Achievements List */}
        <GlassCard animKey={animKey} delay={240} className="col-span-6 p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between shrink-0 mb-2">
            <span className="text-xs font-semibold text-white/90">Список достижений</span>
            <span className="text-[10px] font-mono text-white/50">AppID: 730 / 1091500</span>
          </div>

          <div className="flex flex-col justify-between flex-1 gap-2 min-h-0 overflow-y-auto pr-1">
            {filteredAchievements.map((ach) => (
              <div
                key={ach.id}
                onClick={() => toggleAchievement(ach.id)}
                className="flex-1 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-2 flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                    ach.unlocked ? 'bg-amber-400/20 border-amber-300/40 text-amber-300' : 'bg-white/10 border-white/15 text-white/40'
                  }`}>
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 truncate">
                    <div className="text-xs font-bold text-white truncate">
                      {ach.titleRu}
                    </div>
                    <div className="text-[10px] font-mono text-white/50 truncate">
                      {ach.descRu}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-mono text-amber-300/90 font-semibold">
                    {ach.rarity}
                  </span>
                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                    ach.unlocked ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-300' : 'bg-white/10 border-white/20 text-white/40'
                  }`}>
                    {ach.unlocked ? <Check className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Collector Games List */}
        <GlassCard animKey={animKey} delay={300} className="col-span-6 p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between shrink-0 mb-2">
            <span className="text-xs font-semibold text-white/90">Бесплатные игры и DLC</span>
            <span className="text-[10px] font-mono text-white/50">Free Licenses</span>
          </div>

          <div className="flex flex-col justify-between flex-1 gap-2 min-h-0 overflow-y-auto pr-1">
            {collectorGames.map((game) => (
              <div
                key={game.appId}
                className="flex-1 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-2 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0 font-bold font-mono text-xs text-white">
                    {game.title.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-0.5 truncate">
                    <div className="text-xs font-bold text-white truncate">
                      {game.title}
                    </div>
                    <div className="text-[10px] font-mono text-white/50">
                      AppID: {game.appId} | {game.genre}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => toggleClaim(game.appId)}
                  className={`px-3 py-1 rounded-xl text-xs font-mono font-medium border transition-all ${
                    game.claimed
                      ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-300'
                      : 'bg-white/15 hover:bg-white/25 border-white/25 text-white'
                  }`}
                >
                  {game.claimed ? 'Получено' : 'Получить'}
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
