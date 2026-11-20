// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  PackagePlus,
  Sparkles,
  Award,
  CheckCircle2,
  Search,
  RefreshCw,
  ShieldCheck,
  Gamepad2,
  Plus,
  Check,
  X
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { COLLECTOR_TIERS } from '../../lib/collectorTiers';

export interface FreePackageItem {
  appid: number;
  name: string;
  type: string;
  isOwned?: boolean;
  subid?: number;
  requiresAppid?: number;
}

export interface CollectorSpatialViewProps {
  animKey: number;
  userProfile?: {
    name: string;
    steamId: string;
  };
}

export const CollectorSpatialView: React.FC<CollectorSpatialViewProps> = ({
  animKey,
  userProfile
}) => {
  const [games, setGames] = useState<FreePackageItem[]>([]);
  const [badgeCount, setBadgeCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [claimLoading, setClaimLoading] = useState<boolean>(false);
  const [claimingAppId, setClaimingAppId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'unowned' | 'owned'>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch free catalog list
  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/collector/list');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.games || [];
      if (Array.isArray(list)) {
        setGames(list);
      }
    } catch (err) {
      // Keep previous list
    } finally {
      setLoading(false);
    }
  };

  const fetchBadgeCount = async () => {
    setBadgeCount(null);
    try {
      const res = await fetch('/api/collector/badge');
      if (!res.ok) return;
      const data = await res.json();
      setBadgeCount(typeof data.count === 'number' ? data.count : null);
    } catch {
      setBadgeCount(null);
    }
  };

  useEffect(() => {
    fetchCatalog();
    fetchBadgeCount();
  }, [animKey]);

  // Handle batch claim
  const handleClaimBatch = async (batchSize: number) => {
    if (claimLoading) return;
    setClaimLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/collector/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize, count: batchSize }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Ошибка активации пакетов');
      }

      const granted = data.grantedCount ?? 0;
      setFeedback({
        type: 'success',
        message: `Steam подтвердил ${granted} бесплатных пакетов. ${data.failedGames?.length ? `Не удалось получить: ${data.failedGames.length} (например, ${data.failedGames[0]}). ` : ''}Прогресс значка проверяйте отдельно.`
      });

      await fetchCatalog();
      await fetchBadgeCount();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Не удалось активировать бесплатные лицензии'
      });
    } finally {
      setClaimLoading(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  // Handle single item claim
  const handleClaimSingle = async (appid: number) => {
    if (claimingAppId || claimLoading) return;
    setClaimingAppId(appid);
    try {
      const res = await fetch('/api/collector/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1, appId: appid, appIds: [appid] }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false && data.grantedCount > 0) {
        setGames((prev) =>
          prev.map((g) => (g.appid === appid ? { ...g, isOwned: true } : g))
        );
        fetchBadgeCount();
        setFeedback({
          type: 'success',
          message: `Steam подтвердил бесплатный пакет для AppID ${appid}. Проверьте счётчик значка.`
        });
      } else {
        throw new Error(data.error || 'Лицензия не получена');
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || `Не удалось добавить игру с AppID ${appid}`
      });
    } finally {
      setClaimingAppId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const totalCount = games.length;
  const ownedCount = games.filter((g) => g.isOwned).length;
  const availableCount = Math.max(0, totalCount - ownedCount);

  const badgeIndex = badgeCount == null ? -1 : COLLECTOR_TIERS.findLastIndex((tier) => badgeCount >= tier.count);
  const badgeInfo = COLLECTOR_TIERS[badgeIndex];
  const nextBadge = COLLECTOR_TIERS[badgeIndex + 1];
  const badgeProgressPercent = badgeCount == null ? 0 : !nextBadge ? 100 : Math.floor((badgeCount / nextBadge.count) * 100);

  // Filtered and searched games
  const filteredGames = useMemo(() => {
    return games
      .filter((game) => {
        if (filterMode === 'unowned' && game.isOwned) return false;
        if (filterMode === 'owned' && !game.isOwned) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = game.name && game.name.toLowerCase().includes(q);
          const matchId = String(game.appid).includes(q);
          if (!matchName && !matchId) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Unowned first, then alphabetical
        if (a.isOwned !== b.isOwned) return a.isOwned ? 1 : -1;
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      });
  }, [games, filterMode, searchQuery]);

  return (
    <div className="flex flex-col h-full gap-3 select-none text-white">
      {/* ====================================================================
          ROW 1: HEADER PLAQUE & ACTION BUTTONS
      ==================================================================== */}
      <GlassCard delay={20} animKey={animKey} className="p-3.5 px-4 shrink-0 flex items-center justify-between gap-4">
        {/* Left: Icon, Title & Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/35 flex items-center justify-center text-teal-300 shadow-lg shrink-0">
            <PackagePlus className="w-5 h-5 text-teal-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                 Коллекционер игр Steam
              </h2>
              <span className="px-2 py-0.2 rounded-full bg-teal-500/15 border border-teal-400/30 text-[10px] font-mono font-semibold text-teal-300">
                 БЕСПЛАТНЫЕ ПАКЕТЫ
              </span>
            </div>
            <p className="text-xs text-white/55 font-mono truncate">
                Подборка бесплатных пакетов, о которых сообщали как о +1. Доступность проверяется при получении.
            </p>
          </div>
        </div>

        {/* Right: Quick Batch Claim Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleClaimBatch(availableCount)}
            disabled={availableCount === 0 || claimLoading}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/30 to-teal-500/30 hover:from-emerald-500/40 hover:to-teal-500/40 border border-emerald-400/45 text-emerald-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Проверить и получить ещё не добавленные бесплатные пакеты"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>Получить не добавленные ({availableCount})</span>
          </button>
        </div>
      </GlassCard>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`shrink-0 px-4 py-1.5 rounded-xl text-xs font-mono flex items-center justify-between animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-200'
              : 'bg-rose-500/15 border border-rose-400/30 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <X className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-white/50 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ====================================================================
          ROW 2: 4 CORE BENTO CARDS (Badge Tier, Owned, Available, VAC Protocol)
      ==================================================================== */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {/* Bento 1: Badge Tier */}
        <GlassCard delay={40} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                <Award className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">Значок коллекционера</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-mono text-amber-300">
               {badgeInfo ? `СТУПЕНЬ ${badgeIndex + 1}` : 'STEAM'}
            </span>
          </div>

          <div className="my-1">
             <div className="text-base font-bold font-mono tracking-tight text-amber-200 truncate" title={badgeInfo?.name || ''}>
               {badgeCount == null ? 'Нет данных Steam' : badgeInfo?.name || 'Значок не получен'}
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${badgeProgressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
             <span>{badgeCount == null ? 'Данные значка недоступны' : `${badgeCount} игр засчитано Steam`}</span>
             <span className="text-amber-300 font-semibold">{nextBadge && badgeCount != null ? `Цель: ${nextBadge.count}` : ''}</span>
          </div>
        </GlassCard>

        {/* Bento 2: Already Owned */}
        <GlassCard delay={60} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">В библиотеке</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-mono text-emerald-300">
              OWNED
            </span>
          </div>

          <div className="my-1">
            <div className="text-2xl font-bold font-mono tracking-tight text-emerald-300">
              {ownedCount} <span className="text-sm font-normal text-white/50">/ {totalCount}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
             <span>Получено из подборки</span>
            <span className="text-emerald-400 font-semibold">{Math.round((ownedCount / Math.max(1, totalCount)) * 100)}% базы</span>
          </div>
        </GlassCard>

        {/* Bento 3: Available to Claim */}
        <GlassCard delay={80} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                <Sparkles className="w-4 h-4" />
              </div>
               <span className="text-xs font-semibold text-white/70">Ещё не получено</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-[10px] font-mono text-cyan-300">
              КАНДИДАТЫ
            </span>
          </div>

          <div className="my-1">
            <div className="text-2xl font-bold font-mono tracking-tight text-cyan-200">
              {availableCount} <span className="text-sm font-normal text-white/50">пакетов</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
             <span>При наличии в вашем регионе</span>
             <span className="text-cyan-300 font-semibold">Steam проверит</span>
          </div>
        </GlassCard>

        {/* Bento 4: Safety & Protocol */}
        <GlassCard delay={100} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                <ShieldCheck className="w-4 h-4" />
              </div>
               <span className="text-xs font-semibold text-white/70">Проверка Steam Store</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-[10px] font-mono text-purple-300">
               STEAM
            </span>
          </div>

          <div className="my-1">
            <div className="text-xl font-bold font-mono tracking-tight text-purple-200">
              Бесплатные пакеты
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
             <span>Результат значка — отдельно</span>
             <span className="text-emerald-400 font-semibold">Без гарантий +1</span>
          </div>
        </GlassCard>
      </div>

      {/* ====================================================================
          ROW 3: FREE CATALOG (8 COLS) + TIERS (4 COLS)
      ==================================================================== */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* LEFT COLUMN: FREE PACKAGES CATALOG (8 COLS) */}
        <GlassCard delay={120} animKey={animKey} className="col-span-8 p-3.5 px-4 flex flex-col justify-between h-full min-h-0">
          {/* Header & Filter Controls Sub-Row */}
          <div className="space-y-2.5 shrink-0 mb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white/80">
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight leading-tight">
                     Игры и пакеты для значка Steam
                  </h3>
                  <p className="text-[11px] font-mono text-white/50 leading-tight">
                     Отображается: {filteredGames.length} из {totalCount} кандидатов
                  </p>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-teal-500/25 border border-teal-400/40 text-teal-200 font-semibold'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Все ({totalCount})
                </button>
                <button
                  onClick={() => setFilterMode('unowned')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    filterMode === 'unowned'
                      ? 'bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 font-semibold'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Не получены ({availableCount})
                </button>
                <button
                  onClick={() => setFilterMode('owned')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    filterMode === 'owned'
                      ? 'bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 font-semibold'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Получено ({ownedCount})
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Поиск по названию игры или AppID..."
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
          </div>

          {/* Scrollable Items Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-white/50">
                <RefreshCw className="w-6 h-6 animate-spin text-teal-300" />
                <span className="text-xs font-mono">Загрузка каталога лицензий...</span>
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-white/40">
                <PackagePlus className="w-8 h-8 opacity-40" />
                <span className="text-xs font-mono">Игры не найдены</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pb-1">
                {filteredGames.map((game) => (
                  <div
                    key={game.appid}
                    className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2.5 transition-all duration-150 group ${
                      game.isOwned
                        ? 'bg-emerald-500/[0.07] border-emerald-400/20'
                        : 'bg-white/[0.05] hover:bg-white/[0.10] border-white/10 hover:border-teal-400/30'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase ${
                          game.type === 'DLC'
                            ? 'bg-purple-500/15 border-purple-400/30 text-purple-300'
                            : 'bg-teal-500/15 border-teal-400/30 text-teal-300'
                        }`}>
                          {game.type || 'Game'}
                        </span>
                        <span className="text-[10px] font-mono text-white/40">
                           AppID: {game.appid} · SubID: {game.subid}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-200 transition-colors" title={game.name}>
                        {game.name}
                      </h4>
                      {game.requiresAppid && <p className="text-[10px] text-amber-300">Нужна базовая игра AppID {game.requiresAppid}</p>}
                    </div>

                    {/* Status / Claim Button */}
                    <div className="shrink-0">
                      {game.isOwned ? (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/25 text-emerald-300 text-[10px] font-mono font-semibold">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Есть</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClaimSingle(game.appid)}
                          disabled={claimingAppId === game.appid}
                          className="px-2.5 py-1 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/35 text-teal-200 text-[10px] font-mono font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                           title="Проверить бесплатный пакет и добавить его в Steam"
                        >
                          {claimingAppId === game.appid ? (
                            <RefreshCw className="w-3 h-3 animate-spin text-teal-300" />
                          ) : (
                            <Plus className="w-3 h-3 text-teal-300" />
                          )}
                          <span>Забрать</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* RIGHT COLUMN: BADGE TIERS (4 COLS) */}
        <div className="col-span-4 flex flex-col gap-3 h-full min-h-0">
          {/* Badge Tiers Roadmap Card */}
          <GlassCard delay={140} animKey={animKey} className="p-3.5 px-4 flex flex-col justify-between flex-1 min-h-0">
            <div className="flex items-center justify-between shrink-0 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight leading-tight">
                    Ступени значка Steam
                  </h3>
                  <p className="text-[10px] font-mono text-white/50 leading-tight">
                    XP и уровни значка «Коллекционер»
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-amber-300">
                ROADMAP
              </span>
            </div>

            {/* Tiers List */}
            <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5 custom-scrollbar">
               {[...COLLECTOR_TIERS].reverse().map((tier) => {
                 const isReached = badgeCount != null && badgeCount >= tier.count;
                 const isCurrent = badgeInfo?.count === tier.count;
                 const level = COLLECTOR_TIERS.indexOf(tier) + 1;

                return (
                  <div
                     key={tier.count}
                    className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-amber-500/15 border-amber-400/40 text-amber-200 shadow-sm'
                        : isReached
                        ? 'bg-emerald-500/[0.08] border-emerald-400/20 text-white/90'
                        : 'bg-white/[0.03] border-white/5 text-white/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold ${
                        isCurrent
                          ? 'bg-amber-500/30 text-amber-300'
                          : isReached
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-white/5 text-white/30'
                      }`}>
                         {level}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold truncate block">{tier.name}</span>
                         <span className="text-[9px] font-mono opacity-60">от {tier.count.toLocaleString('ru-RU')} игр, засчитанных Steam</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                      <span className={isCurrent ? 'text-amber-300 font-bold' : isReached ? 'text-emerald-400' : 'text-white/30'}>
                         от {tier.xp.toLocaleString('ru-RU')} XP
                      </span>
                      {isReached && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

        </div>
      </div>
    </div>
  );
};
