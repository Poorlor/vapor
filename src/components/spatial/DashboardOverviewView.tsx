// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Layers,
  Trophy,
  Wallet,
  ShieldCheck,
  Gamepad2,
  PackagePlus,
  Play,
  Pause,
  Scan,
  Copy,
  Check,
  ExternalLink,
  Cpu,
  ArrowRight,
  RefreshCw,
  Plus,
  X
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import type { GameItem } from './HomeView';
import type { LogItem } from './SettingsView';

export interface DashboardOverviewViewProps {
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
  isFarmingCards: boolean;
  remainingCardDrops: number;
  farmedCardDrops: number;
  isScanningPc: boolean;
  logs: LogItem[];
  onToggleFarmHours: () => void;
  onToggleCardIdler: () => void;
  onScanPc: () => void;
  onAddGameToFarm: (game: GameItem) => void;
  onRemoveGameFromFarm: (appId: number) => void;
  onStatusChange: (status: string) => void;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  onNavigateTab: (tabId: string) => void;
}

function formatSeconds(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatPlaytimeHours(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  if (hours >= 1000) {
    return `${(hours / 1000).toFixed(1)}k`;
  }
  return hours.toFixed(1);
}

const STEAM_STATUS_OPTIONS = [
  { id: 'Online', label: 'В сети', dotColor: 'bg-emerald-400' },
  { id: 'Busy', label: 'Не беспокоить', dotColor: 'bg-rose-400' },
  { id: 'Away', label: 'Отошел', dotColor: 'bg-amber-400' },
  { id: 'Snooze', label: 'Сплю', dotColor: 'bg-blue-400' },
  { id: 'Invisible', label: 'Невидимый', dotColor: 'bg-slate-400' },
];

export const DashboardOverviewView: React.FC<DashboardOverviewViewProps> = ({
  animKey,
  userProfile,
  games,
  slots,
  isFarmingHours,
  farmElapsedSeconds,
  activeSlotsCount,
  isFarmingCards,
  remainingCardDrops,
  farmedCardDrops,
  isScanningPc,
  logs,
  onToggleFarmHours,
  onToggleCardIdler,
  onScanPc,
  onAddGameToFarm,
  onRemoveGameFromFarm,
  onStatusChange,
  onOpenAuthModal,
  onLogout,
  onNavigateTab,
}) => {
  const [copiedSteamId, setCopiedSteamId] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const currentElapsed = farmElapsedSeconds;

  const handleCopySteamId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (userProfile?.steamId) {
      navigator.clipboard?.writeText(userProfile.steamId);
      setCopiedSteamId(true);
      setTimeout(() => setCopiedSteamId(false), 2000);
    }
  };

  const totalPlaytimeMinutes = useMemo(() => {
    return games.reduce((sum, g) => sum + (g.hours ? g.hours * 60 : 0), 0);
  }, [games]);

  const activeSlotsGames = useMemo(() => {
    return slots.filter((s): s is GameItem => Boolean(s));
  }, [slots]);

  const recentLogs = useMemo(() => {
    return (logs || []).slice(0, 3);
  }, [logs]);

  return (
    <div className="dashboard-overview flex flex-col h-full gap-3 select-none text-white">
      {/* ====================================================================
          ROW 1: PROFILE CARD (8 COLS) + VAC & SECURITY PLAQUE (4 COLS)
      ==================================================================== */}
      <div className="grid grid-cols-12 gap-3 shrink-0">
        {/* User Profile Glass Card (8 cols) */}
        <GlassCard delay={20} animKey={animKey} className="col-span-8 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Avatar & User Identity */}
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Avatar with dynamic glow */}
              <div className="relative shrink-0">
                {userProfile.avatarUrl && !avatarError ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={userProfile.name}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-13 h-13 rounded-2xl object-cover ring-2 ring-white/35 shadow-lg"
                  />
                ) : (
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-indigo-500/40 via-purple-500/30 to-white/10 border border-white/30 flex items-center justify-center ring-2 ring-white/20 shadow-lg">
                    <span className="text-lg font-bold font-mono text-white/90">
                      {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'V'}
                    </span>
                  </div>
                )}
                {/* Active farming pulse aura around avatar */}
                {isFarmingHours && (
                  <span className="absolute -inset-1 rounded-2xl border-2 border-cyan-400/60 animate-pulse pointer-events-none" />
                )}
                {/* Online status dot */}
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-slate-950 flex items-center justify-center">
                  <span className={`w-2 h-2 rounded-full ${userProfile.steamId ? 'bg-emerald-400' : 'bg-white/40'}`} />
                </div>
              </div>

              {/* Persona Info */}
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-tight truncate max-w-[220px]">
                    {userProfile.name}
                  </h2>
                  <span className="px-2 py-0.2 rounded-full bg-white/10 border border-white/20 text-[10px] font-mono text-white/80">
                    Steam ID
                  </span>
                </div>

                {/* SteamID with one-click copy button */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-white/55 tracking-wide">
                    {userProfile.steamId}
                  </span>
                  <button
                    onClick={handleCopySteamId}
                    title="Скопировать SteamID64"
                    className="p-1 rounded-md bg-white/5 hover:bg-white/20 border border-white/10 text-white/60 hover:text-white transition-all duration-150 cursor-pointer"
                  >
                    {copiedSteamId ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Badges & Persona State Cycler */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Level Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/15 border border-purple-400/30 text-purple-200">
                <Trophy className="w-3.5 h-3.5 text-purple-300" />
                <span className="text-xs font-bold font-mono">Lvl {userProfile.level}</span>
              </div>

              {/* Wallet Badge */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${userProfile.steamId ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300' : 'bg-white/10 border-white/20 text-white/65'}`}>
                <Wallet className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold font-mono">{userProfile.wallet}</span>
              </div>

              {/* Persona Status Selector Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                  disabled={!userProfile.steamId}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Сменить статус Steam"
                >
                    <span className={`w-2 h-2 rounded-full ${userProfile.steamId && userProfile.status !== 'Offline' ? 'bg-emerald-400' : 'bg-white/40'}`} />
                  <span>{userProfile.status}</span>
                </button>

                {statusMenuOpen && (
                  <div
                    style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)', isolation: 'isolate' }}
                    className="absolute right-0 top-full mt-1.5 w-36 rounded-2xl backdrop-blur-2xl bg-slate-900/95 border border-white/20 shadow-2xl p-1.5 z-50 flex flex-col gap-1 overflow-hidden"
                  >
                    {STEAM_STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          onStatusChange(opt.id);
                          setStatusMenuOpen(false);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-left text-xs font-mono flex items-center gap-2 transition-all cursor-pointer ${
                          userProfile.status === opt.id
                            ? 'bg-white/20 text-white font-semibold'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${opt.dotColor}`} />
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom sub-row: Steam CM Protocol link & quick account switcher */}
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-300/80">Steam CM Protocol</span>
              <span className="text-white/25">•</span>
              <span>TLS 1.3 Direct Socket</span>
            </div>
            <button
              onClick={userProfile.steamId ? onLogout : onOpenAuthModal}
              className="text-[11px] font-mono text-white/60 hover:text-white underline decoration-white/30 hover:decoration-white transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>{userProfile.steamId ? 'Выйти / сменить аккаунт' : 'Войти в Steam'}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </GlassCard>

        {/* Security & Protocol Shield Plaque (4 cols) */}
        <GlassCard delay={40} animKey={animKey} className="col-span-4 p-3.5 px-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-xl border flex items-center justify-center ${userProfile.steamId ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' : 'bg-white/10 border-white/20 text-white/65'}`}>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-wide leading-tight">СТАТУС ПОДКЛЮЧЕНИЯ</h3>
                <p className={`text-[10px] font-mono leading-tight ${userProfile?.steamId ? 'text-emerald-300' : 'text-white/65'}`}>{userProfile?.steamId ? 'Steam подключён' : 'Нет авторизации'}</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold ${userProfile?.steamId ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' : 'bg-white/10 border-white/20 text-white/65'}`}>
              {userProfile?.steamId ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          {/* Connection telemetry items */}
          <div className="space-y-1 my-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-white/45">Аккаунт:</span>
              <span className="text-white/80">{userProfile?.steamId || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-white/45">Steam Guard:</span>
              <span className="text-white/65">Состояние не предоставлено</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-white/45">Режим клиента:</span>
              <span className="text-cyan-300">Автономный сокет</span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/40">
            <span>Блокировки проверяются в аналитике</span>
            <span className="text-white/60">Steam CM</span>
          </div>
        </GlassCard>
      </div>

      {/* ====================================================================
          ROW 2: STEAM METRICS
      ==================================================================== */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {/* Metric 1: Hour Booster */}
        <GlassCard delay={60} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">Фарм часов</span>
            </div>
            <button
              onClick={onToggleFarmHours}
              className={`p-1.5 rounded-xl border transition-all duration-200 flex items-center justify-center cursor-pointer ${
                isFarmingHours
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/40 text-amber-300'
                  : 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400/40 text-cyan-300'
              }`}
              title={isFarmingHours ? 'Остановить фарм' : 'Запустить фарм'}
            >
              {isFarmingHours ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="my-1">
            {isFarmingHours ? (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tracking-tight text-white">
                  {activeSlotsCount}x
                </span>
                <span className="text-xs font-mono text-cyan-300">
                  {formatSeconds(currentElapsed)}
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-white/40">
                  {activeSlotsCount}x
                </span>
                <span className="text-xs font-mono text-white/40">На паузе</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
            <span>Слоты: {activeSlotsCount} / 32</span>
            <button
              onClick={() => onNavigateTab('hourfarm')}
              className="text-cyan-300 hover:text-white flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              <span>Настроить</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>
        </GlassCard>

        {/* Metric 2: Card Idler */}
        <GlassCard delay={80} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">Фарм карточек</span>
            </div>
            <button
              onClick={onToggleCardIdler}
              className={`p-1.5 rounded-xl border transition-all duration-200 flex items-center justify-center cursor-pointer ${
                isFarmingCards
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/40 text-amber-300'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-white/80'
              }`}
              title={isFarmingCards ? 'Остановить сбор карт' : 'Запустить сбор карт'}
            >
              {isFarmingCards ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-white">
                {farmedCardDrops}
              </span>
              <span className="text-xs font-mono text-amber-300">
                выпало • {remainingCardDrops} в очереди
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
            <span className="truncate max-w-[120px]">
              {isFarmingCards ? 'Фарм активен' : 'Ожидание'}
            </span>
            <button
              onClick={() => onNavigateTab('cardidler')}
              className="text-amber-300 hover:text-white flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              <span>Очередь</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>
        </GlassCard>

        {/* Metric 3: Steam Library */}
        <GlassCard delay={100} animKey={animKey} className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                <PackagePlus className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-white/70">Игр в библиотеке</span>
            </div>
            <button
              onClick={onScanPc}
              disabled={isScanningPc}
              className={`p-1.5 rounded-xl border transition-all duration-200 flex items-center justify-center cursor-pointer ${
                isScanningPc
                  ? 'bg-purple-500/30 border-purple-400 text-purple-200 animate-spin'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-white/80'
              }`}
              title="Сканировать библиотеку ПК"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">
                {games.length.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-purple-300">
                {formatPlaytimeHours(totalPlaytimeMinutes)} ч. наиграно
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/10 pt-1.5">
            <span>Локальный ПК</span>
            <span className={userProfile?.steamId ? 'text-emerald-400' : 'text-white/65'}>{userProfile?.steamId ? 'Данные аккаунта' : 'Требуется вход'}</span>
          </div>
        </GlassCard>

      </div>

      {/* ====================================================================
          ROW 3: ACTIVE EMULATION POOL (8 COLS) + QUICK ACTIONS & LOGS (4 COLS)
      ==================================================================== */}
      <div className="grid grid-cols-12 gap-3 shrink-0 min-h-[190px]">
        {/* Active Boost Pool (8 cols) */}
        <GlassCard delay={140} animKey={animKey} className="col-span-8 p-3.5 px-4 flex flex-col justify-between h-full min-h-0">
          <div className="flex items-center justify-between shrink-0 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white/80">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight leading-tight">
                  Активный пул эмуляции
                </h3>
                <p className="text-[11px] font-mono text-white/50 leading-tight">
                  Игры в пуле Steam ({activeSlotsGames.length} / 32 слотов)
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('hourfarm')}
              className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить в пул</span>
            </button>
          </div>

          {/* 3 Active Game Rows */}
          <div className="flex flex-col justify-between flex-1 gap-2 min-h-0">
            {activeSlotsGames.length === 0 && (
              <p className="text-sm text-white/70">Пул пуст. Добавьте игры во вкладке «Фарм часов».</p>
            )}
            {activeSlotsGames.slice(0, 3).map((game, idx) => (
              <div
                key={`${game.appId}-${idx}`}
                className="flex-1 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/12 hover:border-white/25 px-3.5 flex items-center justify-between transition-all duration-200"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center font-mono text-xs font-bold text-white/70 shrink-0">
                    {idx + 1}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white truncate max-w-[200px]">
                        {game.title}
                      </h4>
                      <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-[10px] font-mono text-white/60">
                        AppID: {game.appId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-white/45 mt-0.5">
                      <span>{game.genre || 'Steam Game'}</span>
                      <span>•</span>
                      <span className="text-cyan-300 font-semibold">{game.hours} ч. в Steam</span>
                    </div>
                  </div>
                </div>

                {/* Right Status & Remove Action */}
                <div className="flex items-center gap-3 shrink-0">
                  {isFarmingHours ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[11px] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      <span>Фармится</span>
                    </div>
                  ) : (
                    <div className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-white/50 text-[11px] font-mono">
                      В пуле (пауза)
                    </div>
                  )}

                  <button
                    onClick={() => onRemoveGameFromFarm(game.appId)}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-400/40 text-white/40 hover:text-rose-300 transition-all cursor-pointer"
                    title="Убрать из пула"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Quick Diagnostics & Controls Deck (4 cols) */}
        <GlassCard delay={160} animKey={animKey} className="col-span-4 p-3.5 px-4 flex flex-col justify-between h-full min-h-0">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white/80">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight leading-tight">Быстрые команды</h3>
                <p className="text-[11px] font-mono text-white/50 leading-tight">Управление ядром Vapor</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-1.5">
              <button
                onClick={onToggleFarmHours}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-mono font-semibold flex items-center justify-between transition-all duration-200 cursor-pointer ${
                  isFarmingHours
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/40 text-amber-200'
                    : 'bg-white/15 hover:bg-white/25 border-white/30 text-white shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isFarmingHours ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isFarmingHours ? 'Остановить весь фарм' : 'Запустить весь фарм'}</span>
                </div>
                <span className="text-[10px] text-white/60">{activeSlotsCount} / 32</span>
              </button>

              <button
                onClick={onScanPc}
                disabled={isScanningPc}
                className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Scan className={`w-3.5 h-3.5 ${isScanningPc ? 'animate-spin' : ''}`} />
                  <span>Глубокое сканирование ПК</span>
                </div>
                <span className="text-[10px] text-white/50">/api/library</span>
              </button>
            </div>
          </div>

          {/* Micro Log Live Ticker */}
          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center justify-between mb-1 text-[10px] font-mono text-white/45">
              <span>СОБЫТИЯ ЯДРА</span>
              <button
                onClick={() => onNavigateTab('console')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Консоль
              </button>
            </div>

            <div className="space-y-1">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-1 px-2 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-between text-[10px] font-mono"
                >
                  <span className="text-white/75 truncate max-w-[200px]">{log.message}</span>
                  <span className="text-white/40 shrink-0">[{log.time}]</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

    </div>
  );
};
