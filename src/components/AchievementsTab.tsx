import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Unlock,
  Lock,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type { SteamGame, Achievement } from '../types';

export interface AchievementsTabProps {
  ownedGames: SteamGame[];
  isLoggedOn: boolean;
}

const API_BASE = '/api';

export function AchievementsTab({ ownedGames, isLoggedOn }: AchievementsTabProps) {
  const { t } = useI18n();

  const [selectedAppId, setSelectedAppId] = useState<number | null>(
    ownedGames[0]?.appid || null
  );
  const [customAppId, setCustomAppId] = useState('');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & selection
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [selectedApiNames, setSelectedApiNames] = useState<string[]>([]);

  // Alphabetically sorted library
  const sortedOwnedGames = useMemo(() => {
    return [...ownedGames].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }, [ownedGames]);

  const activeAppId = selectedAppId || (customAppId ? parseInt(customAppId, 10) : null);

  const fetchAchievements = async (appid: number) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setSelectedApiNames([]);
    try {
      const res = await fetch(`${API_BASE}/achievements/${appid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (Array.isArray(data)) {
        setAchievements(data);
      } else {
        setAchievements([]);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки достижений');
      setAchievements([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGameSelect = (appid: number) => {
    setSelectedAppId(appid);
    fetchAchievements(appid);
  };

  const handleCustomAppIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(customAppId.trim(), 10);
    if (!id || isNaN(id) || id <= 0) return;
    setSelectedAppId(id);
    fetchAchievements(id);
  };

  const toggleSelectAchievement = (apiName: string) => {
    setSelectedApiNames((prev) =>
      prev.includes(apiName) ? prev.filter((a) => a !== apiName) : [...prev, apiName]
    );
  };

  const handleUnlockSelected = async (apiNamesToUnlock: string[]) => {
    if (!activeAppId || apiNamesToUnlock.length === 0) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE}/achievements/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appid: activeAppId,
          achievementNames: apiNamesToUnlock,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка разблокировки');

      // Update local state to unlocked
      setAchievements((prev) =>
        prev.map((ach) =>
          apiNamesToUnlock.includes(ach.apiName) ? { ...ach, unlocked: true } : ach
        )
      );
      setSelectedApiNames([]);
      setSuccessMsg(`Успешно разблокировано: ${apiNamesToUnlock.length} достижений!`);
    } catch (err: any) {
      setError(err.message || 'Не удалось разблокировать достижения');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlockAll = () => {
    const lockedNames = achievements.filter((a) => !a.unlocked).map((a) => a.apiName);
    if (lockedNames.length > 0) {
      handleUnlockSelected(lockedNames);
    }
  };

  const handleResetAll = async () => {
    if (!activeAppId) return;
    if (!confirm('Вы уверены, что хотите сбросить все достижения для этой игры?')) return;

    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE}/achievements/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appid: activeAppId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сброса достижений');

      setAchievements((prev) => prev.map((ach) => ({ ...ach, unlocked: false })));
      setSelectedApiNames([]);
      setSuccessMsg('Все достижения успешно сброшены через ISteamUserStats!');
    } catch (err: any) {
      setError(err.message || 'Не удалось сбросить достижения');
    } finally {
      setActionLoading(false);
    }
  };

  // Stats
  const totalCount = achievements.length;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const completionPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  // Filtered
  const filteredAchievements = useMemo(() => {
    return achievements.filter((ach) => {
      if (filterMode === 'unlocked' && !ach.unlocked) return false;
      if (filterMode === 'locked' && ach.unlocked) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          ach.name.toLowerCase().includes(q) ||
          ach.description.toLowerCase().includes(q) ||
          ach.apiName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [achievements, filterMode, searchQuery]);

  return (
    <div className="w-full h-full overflow-y-auto px-8 py-6 space-y-6">
      {/* Top Banner Card */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-bold text-white">{t('achievements_title')}</h2>
        </div>
        <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
          {t('achievements_desc')}
        </p>

        {/* Game Selector Controls */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Select from owned library */}
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
              {t('pick_game_first')}
            </label>
            <select
              value={selectedAppId || ''}
              onChange={(e) => handleGameSelect(Number(e.target.value))}
              disabled={!isLoggedOn || loading}
              className="w-full bg-[#0b0c10] border border-[#232938] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="" disabled>
                Выберите игру из библиотеки...
              </option>
              {sortedOwnedGames.map((g) => (
                <option key={g.appid} value={g.appid}>
                  {g.name} ({g.appid})
                </option>
              ))}
            </select>
          </div>

          {/* Custom AppID form */}
          <form onSubmit={handleCustomAppIdSubmit}>
            <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
              {t('enter_custom_appid')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Например: 730, 440..."
                value={customAppId}
                onChange={(e) => setCustomAppId(e.target.value)}
                className="flex-1 bg-[#0b0c10] border border-[#232938] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={!customAppId.trim() || loading}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all disabled:opacity-50"
              >
                {t('load_achievements_btn')}
              </button>
            </div>
          </form>
        </div>

        {/* Feedback messages */}
        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Stats & Mass actions bar */}
        {totalCount > 0 && (
          <div className="mt-6 pt-6 border-t border-[#1f2535] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-gray-400 block font-medium">
                  {t('completion_rate')}: {unlockedCount} / {totalCount} ({completionPercent}%)
                </span>
                <div className="w-48 h-2 bg-[#0b0c10] rounded-full overflow-hidden mt-1.5 border border-[#232938]">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full transition-all duration-300"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Mass Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedApiNames.length > 0 && (
                <button
                  onClick={() => handleUnlockSelected(selectedApiNames)}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-950/20"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>{t('unlock_selected')} ({selectedApiNames.length})</span>
                </button>
              )}

              <button
                onClick={handleUnlockAll}
                disabled={actionLoading || unlockedCount === totalCount}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 text-xs font-bold transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('unlock_all')}</span>
              </button>

              <button
                onClick={handleResetAll}
                disabled={actionLoading || unlockedCount === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('lock_all')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-[#131722] p-1 rounded-xl border border-[#232938]">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterMode === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('all')} ({totalCount})
            </button>
            <button
              onClick={() => setFilterMode('unlocked')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterMode === 'unlocked'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('filter_unlocked')} ({unlockedCount})
            </button>
            <button
              onClick={() => setFilterMode('locked')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterMode === 'locked'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('filter_locked')} ({totalCount - unlockedCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t('search_achievements')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131722] border border-[#232938] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      )}

      {/* Achievement Cards Grid */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-16 bg-[#131722] rounded-2xl border border-[#232938]">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-3" />
          <span className="text-xs text-gray-400 font-medium">{t('loading_achievements')}</span>
        </div>
      )}

      {!loading && totalCount === 0 && (
        <div className="flex flex-col items-center justify-center p-16 text-center bg-[#131722] rounded-2xl border border-[#232938]">
          <Trophy className="w-12 h-12 text-gray-600 mb-3" />
          <p className="text-sm font-semibold text-gray-300">
            {t('no_achievements_found')}
          </p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">
            Выберите другую игру из библиотеки выше или укажите ее AppID для загрузки списка достижений.
          </p>
        </div>
      )}

      {!loading && totalCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredAchievements.map((ach) => {
            const isSelected = selectedApiNames.includes(ach.apiName);
            const iconUrl = ach.unlocked ? ach.iconOpen : ach.iconClosed;

            return (
              <div
                key={ach.apiName}
                onClick={() => !ach.unlocked && toggleSelectAchievement(ach.apiName)}
                className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all cursor-pointer ${
                  ach.unlocked
                    ? 'bg-purple-500/5 border-purple-500/25'
                    : isSelected
                    ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md shadow-cyan-500/5'
                    : 'bg-[#131722] border-[#232938] hover:border-[#2f3950]'
                }`}
              >
                {/* Icon */}
                <div className="relative flex-shrink-0">
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt={ach.name}
                      className="w-12 h-12 rounded-lg object-cover border border-[#232938]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#0b0c10] border border-[#232938] flex items-center justify-center text-gray-500">
                      <Trophy className="w-6 h-6" />
                    </div>
                  )}
                  {ach.unlocked && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center border-2 border-[#131722]">
                      <CheckCircle2 className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-white truncate">
                      {ach.name || ach.apiName}
                    </h4>
                    {ach.unlocked ? (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex-shrink-0">
                        {t('unlocked_status')}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-500/10 px-1.5 py-0.5 rounded border border-gray-500/20 flex-shrink-0">
                        {t('locked_status')}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                    {ach.description || 'Скрытое достижение'}
                  </p>

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#1d2333]">
                    <span className="text-[9px] text-gray-600 font-mono truncate max-w-[120px]">
                      {ach.apiName}
                    </span>

                    {/* Single action button */}
                    {!ach.unlocked && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnlockSelected([ach.apiName]);
                        }}
                        className="text-[10px] font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1 rounded-md border border-purple-500/30 transition-all flex items-center gap-1"
                      >
                        <Unlock className="w-3 h-3" />
                        <span>Открыть</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AchievementsTab;
