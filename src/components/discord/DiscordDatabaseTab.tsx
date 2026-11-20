// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Search,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  RefreshCw,
  Play,
  Layers,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { GlassCard } from '../spatial/GlassCard';

interface DiscordDatabaseTabProps {
  animKey?: number;
  theme?: any;
  lang?: 'ru' | 'en';
  addLog: (level: string, message: string) => void;
}

export const DiscordDatabaseTab: React.FC<DiscordDatabaseTabProps> = ({
  animKey = 0,
  addLog,
}) => {
  const [games, setGames] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'played' | 'unplayed'>('all');
  const [loading, setLoading] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const pageSize = 48;
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const requestVersion = useRef(0);

  const loadGames = () => {
    const version = ++requestVersion.current;
    setLoading(true);
    const url = `/api/discord/games?q=${encodeURIComponent(debouncedSearch)}&page=${page}&pageSize=${pageSize}&filter=${filter}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (version !== requestVersion.current) return;
        if (d && Array.isArray(d.games)) {
          setGames(d.games);
          setTotalCount(d.total);
          setTotalPages(Math.max(1, Math.ceil(d.total / pageSize)));
        }
      })
      .catch((err) => {
        addLog('ERROR', 'Ошибка загрузки базы: ' + err.message);
      })
      .finally(() => { if (version === requestVersion.current) setLoading(false); });
  };

  useEffect(() => {
    loadGames();
    return () => { requestVersion.current += 1; };
  }, [page, filter, debouncedSearch]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleLaunchSingle = async (game: any) => {
    setLaunchingId(game.id);
    try {
      const res = await fetch('/api/discord/quest/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameName: game.name,
          exeName: game.exeName || game.exe,
          durationMinutes: 15,
          gameId: game.id,
        })
      });
      const d = await res.json();
      if (!res.ok || d.success === false) throw new Error(d.error || 'Не удалось запустить игру');
      if (d.success) {
        addLog('SUCCESS', `Игра «${game.name}» запущена в Discord Spoofer!`);
      }
    } catch (e: any) {
      addLog('ERROR', 'Ошибка запуска: ' + e.message);
    } finally {
      setLaunchingId(null);
    }
  };

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
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/35 flex items-center justify-center text-purple-300 shadow-lg shrink-0">
            <Database className="w-5 h-5 text-purple-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                Реестр игр Discord
              </h2>
              <span className="px-2 py-0.2 rounded-full bg-purple-500/15 border border-purple-400/30 text-[10px] font-mono font-semibold text-purple-300">
                {totalCount.toLocaleString()} ИГР В БАЗЕ
              </span>
            </div>
            <p className="text-xs text-white/55 font-mono truncate">
              Официальный реестр Discord Detectable Applications для распознавания процессов и значков
            </p>
          </div>
        </div>

        {/* Right: Search, Filter pills, Refresh */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по 25,176 играм..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/15 text-xs text-white placeholder-white/40 focus:border-purple-400/50 focus:outline-none transition-all font-mono"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/15 text-xs font-mono">
            {[
              { id: 'all', label: 'Все' },
              { id: 'played', label: 'Сыгранные' },
              { id: 'unplayed', label: 'Новые' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFilter(f.id as any);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filter === f.id
                    ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40 font-bold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadGames}
            disabled={loading}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 hover:text-white transition-all cursor-pointer disabled:opacity-40"
            title="Обновить базу"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </GlassCard>

      {/* ====================================================================
          ROW 2: GAMES CATALOG CONTAINER & PAGINATION
      ==================================================================== */}
      <GlassCard delay={60} animKey={animKey} hoverLift={true} className="p-3.5 px-4 flex-1 min-h-0 flex flex-col justify-between">
        {/* Top Pagination & Info Bar inside card */}
        <div className="p-2 px-3 rounded-xl bg-white/[0.04] border border-white/10 shrink-0 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs font-mono text-white/60">
            <span>Найдено игр: <strong className="text-white font-bold">{totalCount.toLocaleString()}</strong></span>
            <span>•</span>
            <span>Показано по 48 на страницу</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center gap-1 transition-all cursor-pointer disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Назад</span>
            </button>

            <span className="px-3 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-white/80">
              {page} / {totalPages || 1}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center gap-1 transition-all cursor-pointer disabled:opacity-30"
            >
              <span>Вперед</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Games Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 custom-scrollbar">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-white/40">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
              <span className="text-xs font-mono">Загрузка каталога игр...</span>
            </div>
          ) : games.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center p-8 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
              <Database className="w-10 h-10 text-white/30 mb-2" />
              <span className="text-sm font-semibold text-white/70">Игры не найдены</span>
              <span className="text-xs font-mono text-white/40 mt-1">Попробуйте изменить поисковый запрос или фильтр</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="p-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 hover:border-white/30 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-lg group"
                >
                  <div className="flex items-start gap-2.5 min-w-0 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0 font-mono text-xs">
                      <Gamepad2 className="w-4 h-4 text-purple-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate" title={game.name}>
                        {game.name}
                      </div>
                      <div className="text-[10px] font-mono text-white/45 truncate mt-0.5" title={game.exeName}>
                        {game.exeName || `${game.name}.exe`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] font-mono">
                    {game.isPlayed ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Сыграно</span>
                      </span>
                    ) : (
                      <span className="text-white/40">Не сыграно</span>
                    )}

                    <button
                      onClick={() => handleLaunchSingle(game)}
                      disabled={launchingId === game.id}
                      className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 hover:text-white flex items-center gap-1 transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                      title="Запустить игру в Discord Spoofer"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Фарм</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Sub-bar */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span>Официальный каталог Discord: 25,176 приложений</span>
          </div>
          <span>Vapor Spoofer • Build 2026.11</span>
        </div>
      </GlassCard>
    </div>
  );
};
