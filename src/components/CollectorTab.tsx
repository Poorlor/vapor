import React, { useState, useEffect, useMemo } from 'react';
import {
  PackagePlus,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  Award,
  Layers,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type { FreeGame } from '../types';

export interface CollectorTabProps {
  isLoggedOn: boolean;
}

const API_BASE = '/api';

export function CollectorTab({ isLoggedOn }: CollectorTabProps) {
  const { t } = useI18n();

  const [games, setGames] = useState<FreeGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unowned' | 'owned'>('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/collector/list`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setGames(data);
      }
    } catch (err) {
      console.error('Failed to fetch free games:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, [isLoggedOn]);

  const handleClaim = async (batchSize: number) => {
    if (!isLoggedOn) return;
    setClaimLoading(true);
    setNotification(null);
    try {
      const res = await fetch(`${API_BASE}/collector/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка активации лицензий');

      setNotification({
        type: 'success',
        message: `Успешно активировано ${data.grantedCount || 0} новых бесплатных игр в библиотеку Steam!`,
      });

      // Refresh catalog list
      await fetchGames();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Не удалось активировать бесплатные лицензии',
      });
    } finally {
      setClaimLoading(false);
    }
  };

  const totalCount = games.length;
  const ownedCount = games.filter((g) => g.isOwned).length;
  const availableCount = totalCount - ownedCount;

  // Badge tier calculation
  const getBadgeTier = (count: number) => {
    if (count >= 1000) return { name: '1000+ Игр (Легенда)', current: count, target: 1000, nextTier: 'Max' };
    if (count >= 500) return { name: '500+ Игр (Мастер)', current: count, target: 1000, nextTier: '1000+' };
    if (count >= 100) return { name: '100+ Игр (Коллекционер)', current: count, target: 500, nextTier: '500+' };
    if (count >= 50) return { name: '50+ Игр (Любитель)', current: count, target: 100, nextTier: '100+' };
    return { name: 'Новичок', current: count, target: 50, nextTier: '50+' };
  };

  const badgeInfo = getBadgeTier(ownedCount);
  const badgeProgressPercent = Math.min(Math.round((badgeInfo.current / badgeInfo.target) * 100), 100);

  const filteredGames = useMemo(() => {
    return games
      .filter((game) => {
        if (filterMode === 'unowned' && game.isOwned) return false;
        if (filterMode === 'owned' && !game.isOwned) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return game.name.toLowerCase().includes(q) || String(game.appid).includes(q);
        }
        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [games, filterMode, searchQuery]);

  return (
    <div className="w-full h-full overflow-y-auto px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PackagePlus className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl font-bold text-white">{t('collector_title')}</h2>
            </div>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              {t('collector_desc')}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleClaim(25)}
              disabled={availableCount === 0 || !isLoggedOn || claimLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {claimLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{t('claim_batch_btn')}</span>
            </button>

            <button
              onClick={() => handleClaim(50)}
              disabled={availableCount === 0 || !isLoggedOn || claimLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 font-bold text-xs transition-all disabled:opacity-50"
            >
              <span>{t('claim_batch_50_btn')}</span>
            </button>
          </div>
        </div>

        {/* Notification feedback */}
        {notification && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <PackagePlus className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Stats Row */}
        <div className="mt-6 pt-6 border-t border-[#1f2535] grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#0b0c10] border border-[#1d2333] p-4 rounded-xl flex items-center gap-3">
            <Award className="w-5 h-5 text-amber-400" />
            <div className="flex-1 min-w-0">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider block font-medium">
                Текущий значок
              </span>
              <span className="text-sm font-bold text-white block truncate">
                {badgeInfo.name}
              </span>
              <div className="w-full h-1.5 bg-[#1a1f2e] rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                  style={{ width: `${badgeProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-[#0b0c10] border border-[#1d2333] p-4 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="text-[11px] text-gray-400 uppercase tracking-wider block font-medium">
                {t('already_owned')}
              </span>
              <span className="text-lg font-bold font-mono text-emerald-300">
                {ownedCount} / {totalCount}
              </span>
            </div>
          </div>

          <div className="bg-[#0b0c10] border border-[#1d2333] p-4 rounded-xl flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="text-[11px] text-gray-400 uppercase tracking-wider block font-medium">
                {t('available_to_claim')}
              </span>
              <span className="text-lg font-bold font-mono text-cyan-300">
                {availableCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-[#131722] p-1 rounded-xl border border-[#232938]">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterMode === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Все ({totalCount})
          </button>
          <button
            onClick={() => setFilterMode('unowned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterMode === 'unowned'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Доступные ({availableCount})
          </button>
          <button
            onClick={() => setFilterMode('owned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterMode === 'owned'
                ? 'bg-emerald-600/50 text-emerald-200 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Получено ({ownedCount})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#131722] border border-[#232938] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Free Games List */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredGames.map((game) => (
            <div
              key={game.appid}
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                game.isOwned
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-[#0b0c10] border-[#1d2333] hover:border-emerald-500/40'
              }`}
            >
              <div className="min-w-0">
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 inline-block mb-1">
                  {game.type}
                </span>
                <p className="text-xs font-semibold truncate text-white">
                  {game.name}
                </p>
                <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                  AppID: {game.appid}
                </p>
              </div>

              {game.isOwned ? (
                <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Есть</span>
                </div>
              ) : (
                <span className="text-[11px] text-gray-500 font-medium flex-shrink-0">
                  Доступно
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CollectorTab;
