// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy,
  Unlock,
  Lock,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Check,
  ShieldCheck,
  Gamepad2,
  Sliders,
  ChevronDown,
  X
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import type { GameItem } from './HomeView';

export interface AchievementData {
  apiName: string;
  name: string;
  description: string;
  unlocked: boolean;
  iconUrl?: string;
}

export interface AchievementsSpatialViewProps {
  animKey: number;
  games: GameItem[];
  userProfile?: {
    name: string;
    steamId: string;
  };
}

const DEFAULT_MOCK_ACHIEVEMENTS: AchievementData[] = [
  { apiName: 'TF_PLAY_GAME_EVERY_CLASS', name: 'Мастер на все руки', description: 'Сыграйте по одному раунду каждым из 9 классов.', unlocked: true },
  { apiName: 'TF_GET_HEADSHOTS', name: 'Хладнокровный стрелок', description: 'Совершите 25 убийств выстрелом в голову из снайперской винтовки.', unlocked: true },
  { apiName: 'TF_HEAL_TEAMMATES', name: 'Первая помощь', description: 'Восстановите 100,000 единиц здоровья союзникам медиком.', unlocked: true },
  { apiName: 'TF_CAPTURE_FLAG', name: 'Захват разведданных', description: 'Захватите разведданные врага 10 раз за одну сессию.', unlocked: false },
  { apiName: 'TF_DOMINATE_NEMESIS', name: 'Полное превосходство', description: 'Добейтесь превосходства над 3 игроками одновременно.', unlocked: false },
  { apiName: 'TF_BACKSTAB_ENEMIES', name: 'Удар в спину', description: 'Убейте 50 врагов ударом в спину в роли шпиона.', unlocked: false },
  { apiName: 'TF_DESTROY_BUILDINGS', name: 'Крушитель построек', description: 'Уничтожьте 25 турелей или раздатчиков инженера.', unlocked: true },
  { apiName: 'TF_AIRSHOT_ROCKET', name: 'Воздушный перехват', description: 'Поразите врага в воздухе ракетой солдата.', unlocked: false },
];

export const AchievementsSpatialView: React.FC<AchievementsSpatialViewProps> = ({
  animKey,
  games,
  userProfile,
}) => {
  const [selectedAppId, setSelectedAppId] = useState<number>(() => {
    return games[0]?.appId || 440;
  });
  const [customAppId, setCustomAppId] = useState('');
  const [achievements, setAchievements] = useState<AchievementData[]>([]);
  const loadVersion = useRef(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [selectedApiNames, setSelectedApiNames] = useState<string[]>([]);

  // Custom VisionOS Dropdown State
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [gameSearch, setGameSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const filteredDropdownGames = useMemo(() => {
    if (!gameSearch.trim()) return games;
    const q = gameSearch.toLowerCase();
    return games.filter((g) => g.title.toLowerCase().includes(q) || String(g.appId).includes(q));
  }, [games, gameSearch]);

  // Fetch achievements from API for selected appid
  const loadAchievements = async (appid: number) => {
    const version = ++loadVersion.current;
    setLoading(true);
    setFeedback(null);
    setSelectedApiNames([]);
    try {
      const res = await fetch(`/api/achievements/${appid}`);
      const data = await res.json();
      if (version !== loadVersion.current) return;
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (Array.isArray(data) && data.length > 0) {
        setAchievements(data);
      } else {
        setAchievements([]);
      }
    } catch (err: any) {
      if (version !== loadVersion.current) return;
      setAchievements([]);
      setFeedback({ type: 'error', msg: err.message });
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAppId) {
      loadAchievements(selectedAppId);
    }
  }, [selectedAppId]);

  const activeGame = useMemo(() => {
    return games.find((g) => g.appId === selectedAppId) || {
      appId: selectedAppId,
      title: `AppID ${selectedAppId}`,
      hours: 0,
    };
  }, [games, selectedAppId]);

  const handleCustomAppIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(customAppId.trim(), 10);
    if (!id || isNaN(id) || id <= 0) return;
    setSelectedAppId(id);
    setCustomAppId('');
  };

  const toggleSelectAchievement = (apiName: string) => {
    setSelectedApiNames((prev) =>
      prev.includes(apiName) ? prev.filter((a) => a !== apiName) : [...prev, apiName]
    );
  };

  const handleSelectAllLocked = () => {
    const lockedNames = achievements.filter((a) => !a.unlocked).map((a) => a.apiName);
    setSelectedApiNames(lockedNames);
  };

  const handleUnlockSelected = async (apiNamesToUnlock: string[]) => {
    if (!selectedAppId || apiNamesToUnlock.length === 0) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/achievements/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appid: selectedAppId,
          achievementNames: apiNamesToUnlock,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || 'Ошибка разблокировки');

      // Update local state
      setAchievements((prev) =>
        prev.map((ach) =>
          apiNamesToUnlock.includes(ach.apiName) ? { ...ach, unlocked: true } : ach
        )
      );
      setSelectedApiNames([]);
      setFeedback({ type: 'success', msg: `Успешно разблокировано: ${apiNamesToUnlock.length} достижений!` });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message });
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
    if (!selectedAppId) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/achievements/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appid: selectedAppId }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || 'Ошибка сброса');

      setAchievements((prev) => prev.map((ach) => ({ ...ach, unlocked: false })));
      setSelectedApiNames([]);
      setFeedback({ type: 'success', msg: 'Все достижения игры успешно заблокированы через ISteamUserStats' });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Stats
  const totalCount = achievements.length;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const lockedCount = totalCount - unlockedCount;
  const completionPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  // Filtered
  const filteredAchievements = useMemo(() => {
    return achievements.filter((ach) => {
      if (filterMode === 'unlocked' && !ach.unlocked) return false;
      if (filterMode === 'locked' && ach.unlocked) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (ach.name || '').toLowerCase().includes(q) ||
          (ach.description || '').toLowerCase().includes(q) ||
          (ach.apiName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [achievements, filterMode, searchQuery]);

  return (
    <div className="flex flex-col h-full gap-3 select-none text-white">
      {/* ====================================================================
          ROW 1: CONTROL & GAME SELECTOR HEADER PLAQUE (Full 12 Columns)
      ==================================================================== */}
      <GlassCard
        delay={20}
        animKey={animKey}
        hoverLift={!dropdownOpen}
        tint={dropdownOpen ? 'static' : 'default'}
        className={`p-3.5 px-4 shrink-0 flex items-center justify-between gap-4 transition-all duration-200 ${
          dropdownOpen ? 'relative z-50 shadow-2xl' : 'relative z-20'
        }`}
      >
        {/* Left: Title & Subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/35 flex items-center justify-center text-purple-300 shadow-lg shrink-0">
            <Trophy className="w-5 h-5 text-purple-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                Менеджер достижений Steam
              </h2>
              <span className="px-2 py-0.2 rounded-full bg-purple-500/15 border border-purple-400/30 text-[10px] font-mono font-semibold text-purple-300">
                ISteamUserStats
              </span>
            </div>
            <p className="text-xs text-white/55 font-mono truncate">
              Мгновенная и безопасная разблокировка любых ачивок через прямой CM сокет
            </p>
          </div>
        </div>

        {/* Center: Game Picker Dropdown & Custom AppID */}
        <div className="flex items-center gap-2">
          {/* Custom VisionOS Game Dropdown with Sleek 5px Floating Scrollbar */}
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              disabled={loading || actionLoading}
              className="bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 rounded-xl px-3 py-1.5 text-xs text-white flex items-center justify-between gap-2 min-w-[170px] max-w-[220px] transition-all cursor-pointer shadow-sm select-none"
            >
              <span className="truncate">{activeGame.title}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-white/60 shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div
                style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)', isolation: 'isolate' }}
                className="absolute top-full left-0 mt-1.5 z-50 w-64 max-h-72 rounded-2xl backdrop-blur-3xl bg-[#211e1a]/90 border border-white/30 shadow-[0_24px_64px_rgba(0,0,0,0.95)] p-1.5 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Search Bar inside Dropdown */}
                <div className="px-2 py-1.5 border-b border-white/10 mb-1 flex items-center gap-1.5 shrink-0">
                  <Search className="w-3.5 h-3.5 text-white/40 shrink-0" />
                  <input
                    type="text"
                    placeholder="Поиск игры..."
                    value={gameSearch}
                    onChange={(e) => setGameSearch(e.target.value)}
                    autoFocus
                    className="bg-transparent text-xs text-white placeholder-white/40 focus:outline-none w-full font-sans"
                  />
                  {gameSearch && (
                    <button onClick={() => setGameSearch('')} className="text-white/40 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Games List — Rendered with our custom visionOS transparent scrollbar */}
                <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
                  {filteredDropdownGames.length > 0 ? (
                    filteredDropdownGames.map((g) => {
                      const isSelected = g.appId === selectedAppId;
                      return (
                        <div
                          key={g.appId}
                          onClick={() => {
                            setSelectedAppId(g.appId);
                            setDropdownOpen(false);
                            setGameSearch('');
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-purple-500/30 text-white font-medium border border-purple-400/40 shadow-sm'
                              : 'text-white/80 hover:bg-white/15 hover:text-white'
                          }`}
                        >
                          <span className="truncate mr-2">{g.title}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-purple-300 shrink-0" />}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-xs text-white/40 font-mono">Игры не найдены</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Custom AppID form */}
          <form onSubmit={handleCustomAppIdSubmit} className="hidden lg:flex items-center gap-1.5">
            <input
              type="number"
              placeholder="AppID..."
              value={customAppId}
              onChange={(e) => setCustomAppId(e.target.value)}
              className="w-24 bg-white/10 border border-white/20 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400 font-mono"
            />
            <button
              type="submit"
              disabled={!customAppId.trim() || loading}
              className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/35 text-purple-200 text-xs font-mono transition-all cursor-pointer disabled:opacity-40 shrink-0"
            >
              Загрузить
            </button>
          </form>
        </div>

        {/* Right: Mass Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedApiNames.length > 0 && (
            <button
              onClick={() => handleUnlockSelected(selectedApiNames)}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md shadow-purple-950/30 cursor-pointer disabled:opacity-50"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Разблокировать ({selectedApiNames.length})</span>
            </button>
          )}

          <button
            onClick={handleUnlockAll}
            disabled={actionLoading || lockedCount === 0}
            className="px-3.5 py-2 rounded-2xl bg-purple-500/25 hover:bg-purple-500/35 border border-purple-400/40 text-purple-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Открыть все</span>
          </button>

          <button
            onClick={handleResetAll}
            disabled={actionLoading || unlockedCount === 0}
            className="px-3 py-2 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/35 text-rose-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Заблокировать все достижения игры"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить</span>
          </button>
        </div>
      </GlassCard>

      {/* ====================================================================
          ROW 2: 3 TELEMETRY & PROGRESS CARDS (12 Columns: 4 + 4 + 4)
      ==================================================================== */}
      <div className="grid grid-cols-12 gap-3 shrink-0 relative z-10">
        {/* Card 1: Active Game Plaque (4 cols) */}
        <GlassCard delay={40} animKey={animKey} className="col-span-4 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Выбранная игра
            </span>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-[10px] font-mono text-purple-200 font-bold">
              ID: {selectedAppId}
            </span>
          </div>

          <div className="my-1.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center font-bold font-mono text-xs text-purple-200 shrink-0">
              {activeGame.title.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                {activeGame.title}
              </h3>
              <p className="text-[10px] font-mono text-white/50">
                {(activeGame.hours || 0).toFixed(1)} ч. наиграно в Steam
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50">
            <span>Всего ачивок:</span>
            <span className="text-purple-300 font-bold">{totalCount} шт.</span>
          </div>
        </GlassCard>

        {/* Card 2: Progress & Completion Rate (4 cols) */}
        <GlassCard delay={60} animKey={animKey} className="col-span-4 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Прогресс выполнения
            </span>
            <div className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/35 flex items-center gap-1 shadow-sm">
              <span className="text-[10px] font-mono text-emerald-300 font-bold">
                {completionPercent}% ВЫПОЛНЕНО
              </span>
            </div>
          </div>

          <div className="my-1.5 space-y-1.5">
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-2xl font-bold tracking-tight text-white">
                {unlockedCount} <span className="text-xs font-normal text-white/50">/ {totalCount}</span>
              </span>
              <span className="text-xs text-white/60">
                Осталось: <span className="text-purple-300 font-semibold">{lockedCount}</span>
              </span>
            </div>

            {/* Gradient Progress Bar */}
            <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden p-[1px]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 transition-all duration-700"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50">
            <span>Статус:</span>
            <span className="text-emerald-300 font-semibold">
              {lockedCount === 0 && totalCount > 0 ? 'Идеальная игра (100%)' : 'В процессе прохождения'}
            </span>
          </div>
        </GlassCard>

        {/* Card 3: Security & Fast Filter (4 cols) */}
        <GlassCard delay={80} animKey={animKey} className="col-span-4 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Фильтрация списка
            </span>
          </div>

          {/* Filter Pills */}
          <div className="grid grid-cols-3 gap-1.5 my-1.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`py-1.5 px-2 rounded-xl text-center text-xs font-mono transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-purple-500/30 border border-purple-400/50 text-white font-bold'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/60'
              }`}
            >
              Все ({totalCount})
            </button>
            <button
              onClick={() => setFilterMode('locked')}
              className={`py-1.5 px-2 rounded-xl text-center text-xs font-mono transition-all cursor-pointer ${
                filterMode === 'locked'
                  ? 'bg-purple-500/30 border border-purple-400/50 text-white font-bold'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/60'
              }`}
            >
              Закрытые ({lockedCount})
            </button>
            <button
              onClick={() => setFilterMode('unlocked')}
              className={`py-1.5 px-2 rounded-xl text-center text-xs font-mono transition-all cursor-pointer ${
                filterMode === 'unlocked'
                  ? 'bg-purple-500/30 border border-purple-400/50 text-white font-bold'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/60'
              }`}
            >
              Открытые ({unlockedCount})
            </button>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/40">
            <span>Прямой сокет серверов Valve</span>
            <span className="text-white/60">Без хуков памяти</span>
          </div>
        </GlassCard>
      </div>

      {/* ====================================================================
          ROW 3: ACHIEVEMENTS GRID & ACTIONS (Fills remaining height)
      ==================================================================== */}
      <GlassCard delay={100} animKey={animKey} hoverLift={true} className="p-3.5 px-4 flex-1 min-h-0 flex flex-col justify-between relative z-0">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-purple-300" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Достижения ({filteredAchievements.length})
              </h3>
            </div>

            {lockedCount > 0 && (
              <button
                onClick={handleSelectAllLocked}
                className="text-[11px] font-mono text-purple-300 hover:text-white hover:underline transition-colors cursor-pointer"
              >
                Выбрать все закрытые
              </button>
            )}

            {selectedApiNames.length > 0 && (
              <button
                onClick={() => setSelectedApiNames([])}
                className="text-[11px] font-mono text-white/50 hover:text-white hover:underline transition-colors cursor-pointer"
              >
                Снять выделение
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Поиск по названию или описанию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400 font-sans"
            />
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white/[0.02] rounded-2xl border border-white/5">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-3" />
            <p className="text-xs font-bold text-white/80">Синхронизация базы достижений Steam...</p>
            <p className="text-[11px] font-mono text-white/40 mt-1">
              Запрос схемы ISteamUserStats для AppID {selectedAppId}
            </p>
          </div>
        )}

        {/* Feedback message banner if present */}
        {feedback && (
          <div className={`p-2 px-3 rounded-xl mb-2 flex items-center justify-between text-xs font-mono shrink-0 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200'
              : 'bg-rose-500/20 border border-rose-400/40 text-rose-200'
          }`}>
            <span>{feedback.msg}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-white/60 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Achievements Grid with internal scroll */}
        {!loading && filteredAchievements.length > 0 && (
           <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-max content-start gap-2 custom-scrollbar">
            {filteredAchievements.map((ach) => {
              const isSelected = selectedApiNames.includes(ach.apiName);
              return (
                <div
                  key={ach.apiName}
                  onClick={() => !ach.unlocked && toggleSelectAchievement(ach.apiName)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                    ach.unlocked
                      ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                      : isSelected
                      ? 'bg-purple-500/25 border-purple-400/50 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-white/25 text-white/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      ach.unlocked
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                        : isSelected
                        ? 'bg-purple-500/30 border-purple-400 text-purple-200'
                        : 'bg-white/10 border-white/15 text-white/50'
                    }`}>
                      {ach.iconUrl ? (
                        <img src={ach.iconUrl} alt="" className="w-full h-full rounded-lg object-cover" />
                      ) : ach.unlocked ? (
                        <Unlock className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Lock className="w-4 h-4 text-white/40" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-white leading-tight">
                        {ach.name}
                      </p>
                      <p className="text-[10px] text-white/50 truncate mt-0.5 leading-tight">
                        {ach.description || ach.apiName}
                      </p>
                    </div>
                  </div>

                  {/* Status / Checkbox */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {ach.unlocked ? (
                      <div className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-mono font-bold">
                        Открыто
                      </div>
                    ) : (
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-purple-500 text-white border-purple-400 font-bold'
                            : 'border-white/20 text-transparent hover:border-white/40'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredAchievements.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white/[0.02] rounded-2xl border border-white/5">
            <Trophy className="w-10 h-10 text-white/20 mb-2" />
            <h4 className="text-sm font-bold text-white">Достижения не найдены</h4>
            <p className="text-xs text-white/50 max-w-md mt-1 font-sans">
              Для данной игры нет достижений или измените параметры поискового запроса.
            </p>
          </div>
        )}

        {/* Bottom Status Ticker */}
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50 shrink-0">
          <span>Схема достижений: Steamworks API (AppID: {selectedAppId})</span>
          <span className="text-purple-300 font-semibold">Синхронизация в реальном времени</span>
        </div>
      </GlassCard>
    </div>
  );
};
