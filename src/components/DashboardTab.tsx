import React, { useEffect, useState } from 'react';
import {
  Clock,
  Layers,
  Trophy,
  PackagePlus,
  Gamepad2,
  Timer,
  LogIn,
  User,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type { SteamUser, SteamGame, HourBoosterState, CardIdlerState } from '../types';

export interface DashboardTabProps {
  user: SteamUser | null;
  ownedGames: SteamGame[];
  hourBooster: HourBoosterState;
  cardIdler: CardIdlerState;
  isLoggedOn: boolean;
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

function StatCard({
  icon,
  label,
  children,
  accentColor = 'text-cyan-400',
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="bg-[#131722] border border-[#232938] rounded-2xl p-5 flex flex-col justify-between min-h-[116px] transition-all duration-200 hover:border-[#2e3a50]">
      <div className="flex items-center gap-2.5">
        <div className={`${accentColor}`}>{icon}</div>
        <span className="text-sm text-gray-400 font-medium">{label}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function DashboardTab({
  user,
  ownedGames,
  hourBooster,
  cardIdler,
  isLoggedOn,
}: DashboardTabProps) {
  const { t } = useI18n();
  const [avatarError, setAvatarError] = useState(false);

  // Live elapsed timer for hour booster
  const [elapsedOffset, setElapsedOffset] = useState(0);

  useEffect(() => {
    if (!hourBooster.isRunning) {
      setElapsedOffset(0);
      return;
    }
    setElapsedOffset(0);
    const interval = setInterval(() => {
      setElapsedOffset((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [hourBooster.isRunning, hourBooster.elapsedSeconds]);

  if (!isLoggedOn) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="bg-[#131722] border border-[#232938] rounded-2xl p-10 flex flex-col items-center gap-5 max-w-sm text-center shadow-lg shadow-black/20">
          <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center">
            <LogIn className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">
            {t('dashboard.loginPrompt', 'Войдите в Steam чтобы начать')}
          </h2>
          <p className="text-sm text-gray-500">
            {t(
              'dashboard.loginDescription',
              'Подключите свой аккаунт Steam для доступа ко всем функциям'
            )}
          </p>
        </div>
      </div>
    );
  }

  const totalPlaytimeMinutes = ownedGames.reduce(
    (sum, g) => sum + (g.playtime_forever || 0),
    0
  );

  const boosterElapsed = (hourBooster.elapsedSeconds || 0) + elapsedOffset;

  return (
    <div className="w-full h-full overflow-y-auto px-8 py-6 space-y-6">
      {/* Profile Card */}
      {user && (
        <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-5">
            {user.avatarUrl && !avatarError ? (
              <img
                src={user.avatarUrl}
                alt={user.personaName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-16 h-16 rounded-xl ring-2 ring-cyan-500/30 object-cover shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-600/30 to-purple-600/30 border border-cyan-500/40 flex items-center justify-center ring-2 ring-cyan-500/30 shadow-md">
                <span className="text-xl font-bold text-cyan-300">
                  {user.personaName ? user.personaName.charAt(0).toUpperCase() : 'U'}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">
                {user.personaName}
              </h2>
              <span className="text-xs text-gray-500 font-mono">{user.steamID}</span>
              <div className="flex items-center gap-3 mt-1">
                {user.level != null && user.level > 0 && (
                  <span className="flex items-center gap-1.5 text-xs bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md">
                    <Trophy className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-semibold">
                      {t('dashboard.level', 'Уровень')} {user.level}
                    </span>
                  </span>
                )}
                {user.wallet != null && (
                  <span className="text-xs text-emerald-400 font-medium bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                    {user.wallet} ₽
                  </span>
                )}
                <span className="text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md font-mono">
                  Steam CM Protocol
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Games Owned */}
        <StatCard
          icon={<PackagePlus className="w-5 h-5" />}
          label={t('dashboard.gamesOwned', 'Игр в библиотеке')}
          accentColor="text-purple-400"
        >
          <span className="text-3xl font-bold text-white">
            {ownedGames.length.toLocaleString()}
          </span>
        </StatCard>

        {/* Total Playtime */}
        <StatCard
          icon={<Gamepad2 className="w-5 h-5" />}
          label={t('dashboard.totalPlaytime', 'Общее время в играх')}
          accentColor="text-emerald-400"
        >
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-white">
              {formatPlaytimeHours(totalPlaytimeMinutes)}
            </span>
            <span className="text-sm text-gray-500">
              {t('dashboard.hours', 'ч.')}
            </span>
          </div>
        </StatCard>

        {/* Hour Booster Status */}
        <StatCard
          icon={<Timer className="w-5 h-5" />}
          label={t('dashboard.hourBooster', 'Накрутка часов')}
          accentColor="text-cyan-400"
        >
          {hourBooster.isRunning ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
                </span>
                <span className="text-xl font-bold text-white">
                  {hourBooster.activeAppIds?.length || 0}x
                </span>
                <span className="text-xs text-gray-400">
                  {t('dashboard.multiplier', 'множитель')}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-cyan-300 font-mono">
                  <Clock className="w-3.5 h-3.5 inline mr-1 opacity-60" />
                  {formatSeconds(boosterElapsed)}
                </span>
                {hourBooster.totalFarmedSeconds != null &&
                  hourBooster.totalFarmedSeconds > 0 && (
                    <span className="text-gray-500">
                      {t('dashboard.total', 'Всего')}:{' '}
                      {formatSeconds(hourBooster.totalFarmedSeconds)}
                    </span>
                  )}
              </div>
            </div>
          ) : (
            <span className="text-base font-semibold text-gray-500">
              {t('dashboard.inactive', 'Неактивно')}
            </span>
          )}
        </StatCard>

        {/* Card Idler Status */}
        <StatCard
          icon={<Layers className="w-5 h-5" />}
          label={t('dashboard.cardIdler', 'Фарм карточек')}
          accentColor="text-amber-400"
        >
          {cardIdler.isRunning ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                </span>
                <span className="text-sm font-semibold text-white truncate max-w-[180px]">
                  {cardIdler.currentApp?.name || t('dashboard.farming', 'Фармится...')}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                <Layers className="w-3.5 h-3.5 inline mr-1 opacity-60" />
                {cardIdler.currentApp?.cardsRemaining ?? cardIdler.totalCardsRemaining}{' '}
                {t('dashboard.cardsLeft', 'карт осталось')}
              </span>
            </div>
          ) : (
            <span className="text-base font-semibold text-gray-500">
              {t('dashboard.inactive', 'Неактивно')}
            </span>
          )}
        </StatCard>
      </div>

      {/* Feature Showcase Banner */}
      <div className="bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/40 border border-cyan-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-base font-bold text-white mb-1">
            Автономный мульти-бустер готов к работе
          </h3>
          <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
            Vapor работает напрямую через сокет-протокол серверов Steam (Steam CM), эмулируя присутствие пользователя и запуск до 32 игр без открытого официального клиента Steam.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-cyan-400 font-semibold bg-cyan-500/10 border border-cyan-500/20 px-3.5 py-2 rounded-xl">
          <Clock className="w-4 h-4" />
          <span>1 час = 32 часа профиля</span>
        </div>
      </div>
    </div>
  );
}

export default DashboardTab;
