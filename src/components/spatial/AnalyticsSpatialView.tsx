// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Crown,
  Trophy,
  ShieldCheck,
  Award,
  Search,
  Clock,
  Gamepad2,
  RefreshCw,
  ExternalLink,
  Flame,
  CheckCircle2,
  Layers,
  X
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import type { GameItem } from './HomeView';

export interface PlaytimeGame {
  appId: number;
  appid?: number;
  title: string;
  name?: string;
  hours: number;
  pct: number;
  lastPlayed?: number;
}

export interface SteamBadgeItem {
  id: string;
  name: string;
  level: number;
  xp: number;
  icon?: string;
  iconName?: string;
}

export interface ProfileAnalyticsData {
  accountAgeYears: string;
  accountAgeYearsEn?: string;
  memberSince?: string;
  vacBanned: boolean;
  vacStatus: string;
  vacStatusEn?: string;
  tradeBanState?: string;
  isLimitedAccount?: boolean;
  perfectGamesCount: number | null;
  avgCompletionRate: number | null;
  averageAchievementPct?: number | null;
  achievementsSampledGames?: number;
  unlockedAchievements: number;
  totalAchievements: number;
  totalHours: number;
  level: number;
  currentXp: number | null;
  nextLevelXp: number | null;
  xpPercentage: number | null;
  recent2WeeksHours?: number;
  topGenre?: string;
  playtimeDistribution: PlaytimeGame[];
  badges: SteamBadgeItem[];
}

export interface AnalyticsSpatialViewProps {
  animKey: number;
  games?: GameItem[];
  userProfile?: {
    name: string;
    steamId: string;
    level?: number;
  };
}

export const AnalyticsSpatialView: React.FC<AnalyticsSpatialViewProps> = ({
  animKey,
  games = [],
  userProfile
}) => {
  const [analytics, setAnalytics] = useState<ProfileAnalyticsData>({
    accountAgeYears: '—',
    memberSince: '—',
    vacBanned: false,
    vacStatus: '—',
    tradeBanState: '—',
    isLimitedAccount: false,
    perfectGamesCount: null,
    avgCompletionRate: null,
    averageAchievementPct: null,
    achievementsSampledGames: 0,
    unlockedAchievements: 0,
    totalAchievements: 0,
    totalHours: 0,
    level: userProfile?.level ?? 0,
    currentXp: null,
    nextLevelXp: null,
    xpPercentage: null,
    recent2WeeksHours: 0,
    topGenre: '—',
    playtimeDistribution: [],
    badges: []
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterLimit, setFilterLimit] = useState<'all' | 'played' | 'top10' | 'top25'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/analytics/profile');
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
      setAnalytics((prev) => ({ ...prev, ...data }));
      return data;
    } catch (e) {
      setFeedback('Не удалось загрузить аналитику Steam. Проверьте подключение и повторите попытку.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [animKey]);

  // Handle live refresh
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setFeedback('Обновление аналитики профиля...');
    try {
      const refreshed = await fetch('/api/refresh', { method: 'POST' });
      if (!refreshed.ok || !(await refreshed.json()).success) throw new Error('Steam не ответил');
      if (!await fetchAnalytics()) throw new Error('Аналитика недоступна');
      setFeedback('Аналитика успешно синхронизирована с профилем');
    } catch (e) {
      setFeedback('Не удалось обновить данные Steam. Проверьте подключение.');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleScanAchievements = async () => {
    const appIds = allPlaytimeList.filter((game) => game.hours > 0 && game.appId > 0).slice(0, 5).map((game) => game.appId);
    if (!userProfile?.steamId || appIds.length === 0) {
      setFeedback('Нет доступных игр для проверки достижений Steam.');
      return;
    }
    setIsRefreshing(true);
    setFeedback('Проверяем достижения пяти последних игр с наибольшим временем...');
    try {
      const res = await fetch(`/api/achievements/summary?appids=${appIds.join(',')}`);
      if (!res.ok) throw new Error('Steam не ответил');
      const data = await fetchAnalytics();
      if (!data) throw new Error('Steam не вернул аналитику');
      setFeedback(data.achievementsSampledGames
        ? `Проверено игр с персональной статистикой: ${data.achievementsSampledGames} из ${appIds.length}.`
        : 'Steam не вернул персональные достижения этих игр. Для закрытого профиля статистика может быть недоступна.');
    } catch (e: any) {
      setFeedback(`Не удалось проверить достижения: ${e.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Compile playtime distribution list from games or analytics
  const allPlaytimeList = useMemo(() => {
    let source: PlaytimeGame[] = [];
    if (Array.isArray(analytics.playtimeDistribution) && analytics.playtimeDistribution.length > 0) {
      source = analytics.playtimeDistribution.map((g) => ({
        appId: g.appId || g.appid || 0,
        title: g.title || g.name || 'Steam Game',
        hours: typeof g.hours === 'number' ? g.hours : 0,
        pct: g.pct || 0
      }));
    } else if (Array.isArray(games) && games.length > 0) {
      const totalH = games.reduce((acc, g) => acc + (g.hours || 0), 0) || 1;
      source = games.map((g) => ({
        appId: g.appId,
        title: g.title,
        hours: g.hours || 0,
        pct: Number((((g.hours || 0) / totalH) * 100).toFixed(1))
      }));
    }

    source.sort((a, b) => (b.hours || 0) - (a.hours || 0));
    const grandTotal = source.reduce((sum, it) => sum + (it.hours || 0), 0) || 1;
    return source.map((it) => ({
      ...it,
      pct: it.pct > 0 ? it.pct : Number(((it.hours / grandTotal) * 100).toFixed(1))
    }));
  }, [analytics.playtimeDistribution, games]);

  const totalCalculatedHours = useMemo(() => {
    const sum = allPlaytimeList.reduce((acc, g) => acc + (g.hours || 0), 0);
    return sum > 0 ? Math.round(sum) : analytics.totalHours ?? 0;
  }, [allPlaytimeList, analytics.totalHours]);

  const playedGamesCount = useMemo(() => {
    return allPlaytimeList.filter((g) => g.hours > 0).length;
  }, [allPlaytimeList]);

  // Filtered games for the list
  const displayedGames = useMemo(() => {
    let list = allPlaytimeList;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((g) =>
        (g.title && g.title.toLowerCase().includes(q)) || String(g.appId).includes(q)
      );
    }

    if (filterLimit === 'top10') {
      return list.slice(0, 10);
    } else if (filterLimit === 'top25') {
      return list.slice(0, 25);
    } else if (filterLimit === 'played') {
      return list.filter((g) => g.hours > 0);
    }
    return list;
  }, [allPlaytimeList, searchQuery, filterLimit]);

  return (
    <div className="flex flex-col h-full gap-3 select-none text-white">
      {/* ====================================================================
          ROW 1: HEADER PLAQUE & TELEMETRY PILLS
      ==================================================================== */}
      <GlassCard delay={20} animKey={animKey} className="p-3.5 px-4 shrink-0 flex items-center justify-between gap-4">
        {/* Left: Icon, Title & Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/35 flex items-center justify-center text-indigo-300 shadow-lg shrink-0">
            <BarChart3 className="w-5 h-5 text-indigo-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                Аналитика профиля Steam
              </h2>
              <span className="px-2 py-0.2 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-[10px] font-mono font-semibold text-indigo-300">
                PROFILE & LIBRARY STATS
              </span>
            </div>
            <p className="text-xs text-white/55 font-mono truncate">
              Глубокая статистика игрового времени, выслуги лет, ачивок и значков профиля Steam
            </p>
          </div>
        </div>

        {/* Right: Telemetry Pills & Refresh Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          {analytics.recent2WeeksHours != null && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.07] border border-white/15 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-cyan-300" />
              <span className="text-white/60">За 2 нед:</span>
              <span className="text-cyan-200 font-bold">{analytics.recent2WeeksHours} ч.</span>
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-2 transition-all duration-200 cursor-pointer ${
              isRefreshing
                ? 'bg-indigo-500/25 border-indigo-400/40 text-indigo-200 opacity-80 cursor-wait'
                : 'bg-white/12 hover:bg-white/20 border-white/20 text-white shadow-sm'
            }`}
            title="Синхронизировать аналитику профиля"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-300' : 'text-white/80'}`} />
            <span>{isRefreshing ? 'Синхронизация...' : 'Синхронизировать'}</span>
          </button>
        </div>
      </GlassCard>

      {/* Feedback Alert */}
      {feedback && (
        <div className="shrink-0 px-4 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-400/30 text-indigo-200 text-xs font-mono flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-white/50 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ====================================================================
          ROW 2: 4 CORE BENTO CARDS (Account Age, Perfect Games, Avg %, VAC)
      ==================================================================== */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {/* Bento 1: Account Age */}
        <GlassCard delay={40} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">Возраст аккаунта</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10px] font-mono text-sky-300">
              SERVICE
            </span>
          </div>

          <div className="my-1.5">
            <div className="text-2xl font-bold font-mono tracking-tight text-white">
              {analytics.accountAgeYears}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
            <span className="truncate max-w-[150px]">{analytics.memberSince || '—'}</span>
            <span className="text-emerald-400">{analytics.memberSince && analytics.memberSince !== '—' ? 'Профиль Steam' : 'Нет данных'}</span>
          </div>
        </GlassCard>

        {/* Bento 2: Perfect Games */}
        <GlassCard delay={60} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                <Crown className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">Идеальные игры</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-mono text-amber-300">
              100% PLATINUM
            </span>
          </div>

          <div className="my-1.5">
            <div className="text-2xl font-bold font-mono tracking-tight text-amber-200">
              {analytics.perfectGamesCount == null ? '—' : `${analytics.perfectGamesCount} игр`}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
            <span>Из проверенных игр</span>
            <span className="text-amber-300 font-semibold">{analytics.achievementsSampledGames || 0} проверено</span>
          </div>
        </GlassCard>

        {/* Bento 3: Average Achievement % */}
        <GlassCard delay={80} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                <Trophy className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">Средний % ачивок</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-[10px] font-mono text-purple-300">
              ACHIEVEMENTS
            </span>
          </div>

          <div className="my-1.5">
            <div className="text-2xl font-bold font-mono tracking-tight text-purple-200">
              {analytics.avgCompletionRate == null ? '—' : `${analytics.avgCompletionRate}%`}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
            <span>{analytics.achievementsSampledGames ? `${analytics.unlockedAchievements} из ${analytics.totalAchievements}` : 'Нет проверенных достижений'}</span>
            <button onClick={handleScanAchievements} disabled={isRefreshing} className="text-purple-300 font-semibold hover:text-white disabled:opacity-50">Проверить</button>
          </div>
        </GlassCard>

        {/* Bento 4: VAC Status */}
        <GlassCard delay={100} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">Статус VAC и Trust</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-mono text-emerald-300">
              {analytics.vacBanned == null ? 'НЕИЗВЕСТНО' : analytics.vacBanned ? 'BAN' : 'OK'}
            </span>
          </div>

          <div className="my-1.5">
            <div className="text-2xl font-bold font-mono tracking-tight text-emerald-300">
              {analytics.vacStatus || '—'}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
            <span>Трейд: {analytics.tradeBanState || '—'}</span>
            <span className="text-emerald-400 font-semibold">{analytics.vacBanned == null ? 'Нет данных' : analytics.vacBanned ? 'Есть блокировка' : 'Нет VAC блокировки'}</span>
          </div>
        </GlassCard>
      </div>

      {/* ====================================================================
          ROW 3: PLAYTIME DISTRIBUTION (8 COLS) + LEVEL, XP & BADGES (4 COLS)
      ==================================================================== */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* LEFT COLUMN: PLAYTIME DISTRIBUTION LIST (8 COLS) */}
        <GlassCard delay={120} animKey={animKey} className="col-span-8 p-3.5 px-4 flex flex-col justify-between h-full min-h-0">
          {/* Header & Controls Toolbar */}
          <div className="space-y-2.5 shrink-0 mb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white/80">
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight leading-tight">
                    Распределение игрового времени
                  </h3>
                  <p className="text-[11px] font-mono text-white/50 leading-tight">
                    Полная библиотека игр аккаунта • Всего {totalCalculatedHours.toLocaleString('ru-RU')} ч.
                  </p>
                </div>
              </div>

              {/* Total Hours Badge */}
              <div className="px-3 py-1 rounded-xl bg-white/10 border border-white/15 text-xs font-mono font-semibold text-cyan-200">
                {totalCalculatedHours.toLocaleString('ru-RU')} ч. в библиотеке
              </div>
            </div>

            {/* Search Input & Filter Chips Sub-Row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Поиск игры по названию или AppID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/15 focus:border-cyan-400/50 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none font-mono"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Quick Filter Chips */}
              <div className="flex items-center gap-1 shrink-0">
                {[
                  { id: 'all', label: `Все (${allPlaytimeList.length})` },
                  { id: 'played', label: `Сыгранные (${playedGamesCount})` },
                  { id: 'top10', label: 'Топ-10' },
                  { id: 'top25', label: 'Топ-25' },
                ].map((f) => {
                  const isSelected = filterLimit === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilterLimit(f.id as any)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-mono whitespace-nowrap transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 font-semibold shadow-sm'
                          : 'bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scrollable Playtime Rows */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-white/50">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-300" />
                <span className="text-xs font-mono">Загрузка игровой библиотеки...</span>
              </div>
            ) : displayedGames.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-white/40">
                <Gamepad2 className="w-8 h-8 opacity-40" />
                <span className="text-xs font-mono">Игры не найдены</span>
              </div>
            ) : (
              displayedGames.map((game, idx) => (
                <div
                  key={`${game.appId}-${idx}`}
                  className="p-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.10] border border-white/10 hover:border-white/20 transition-all duration-150 space-y-1.5 group"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-white/35 font-bold w-6 text-right shrink-0">{idx + 1}.</span>
                      <span className="font-bold text-white truncate max-w-[260px] sm:max-w-md group-hover:text-cyan-200 transition-colors">
                        {game.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/10 text-white/50 shrink-0">
                        AppID: {game.appId}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="font-bold text-white/90">
                        {game.hours > 0 ? `${game.hours.toLocaleString('ru-RU')} ч.` : '0 ч.'}
                      </span>
                      <span className="text-[11px] font-semibold text-cyan-300 w-12 text-right">
                        {game.pct > 0 ? `${game.pct}%` : '0%'}
                      </span>
                    </div>
                  </div>

                  {/* Proportional visual progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${Math.max(game.pct > 0 ? game.pct : 0, game.hours > 0 ? 0.8 : 0)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* RIGHT COLUMN: STEAM LEVEL & BADGES DECK (4 COLS) */}
        <div className="col-span-4 flex flex-col gap-3 h-full min-h-0">
          {/* Steam Level & XP Plaque */}
          <GlassCard delay={140} animKey={animKey} className="p-3.5 px-4 shrink-0 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-md shrink-0">
                  <Award className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight leading-tight">
                      Уровень профиля Steam
                    </h3>
                    <span className="px-2 py-0.2 rounded-full bg-purple-500/20 border border-purple-400/35 text-[10px] font-mono font-bold text-purple-200">
                      LVL {userProfile?.level || analytics.level}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-white/50 leading-tight mt-0.5">
                     {analytics.currentXp == null ? 'XP недоступен' : `${analytics.currentXp.toLocaleString('ru-RU')} / ${analytics.nextLevelXp?.toLocaleString('ru-RU')} XP`}
                  </p>
                </div>
              </div>
            </div>

            {/* Level XP Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-white/40">
                <span>Прогресс до след. уровня</span>
                 <span className="text-purple-300 font-semibold">{analytics.xpPercentage == null ? '—' : `${analytics.xpPercentage}%`}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden p-[1px]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400 transition-all duration-700 shadow-sm"
                   style={{ width: `${analytics.xpPercentage ?? 0}%` }}
                />
              </div>
            </div>
          </GlassCard>

          {/* Featured Badges Deck */}
          <GlassCard delay={160} animKey={animKey} className="p-3.5 px-4 flex flex-col justify-between flex-1 min-h-0">
            <div className="flex items-center justify-between shrink-0 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight leading-tight">
                    Коллекционные значки
                  </h3>
                  <p className="text-[10px] font-mono text-white/50 leading-tight">
                    Получено в аккаунте ({analytics.badges?.length || 0} шт.)
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-amber-300">
                STEAM BADGES
              </span>
            </div>

            {/* Badges Scrollable List */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {analytics.badges && analytics.badges.length > 0 ? (
                analytics.badges.map((b) => (
                  <div
                    key={b.id}
                    className="p-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/5 hover:border-white/15 flex items-center gap-2.5 transition-all duration-150"
                  >
                    <div className="w-9 h-9 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                      {b.icon ? (
                        <img
                          src={b.icon}
                          alt={b.name}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <Trophy className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate" title={b.name}>
                        {b.name}
                      </div>
                      <div className="text-[10px] font-mono text-white/40 mt-0.5">
                        +{b.xp} XP • Уровень {b.level}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-white/40 text-[11px] font-mono">
                  Значки загружаются...
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
