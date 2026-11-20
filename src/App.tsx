import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense, startTransition, ViewTransition } from 'react';
import { api, post } from './lib/api';
import { connectServer } from './lib/serverConnection';
import { applyMotionSetting, loadLocalSettings, saveLocalSettings } from './lib/settings';
import {
  LayoutGrid,
  Clock,
  Layers,
  Trophy,
  CircleDollarSign,
  BarChart3,
  PackagePlus,
  Terminal,
  Settings,
  Sparkles,
  Database
} from 'lucide-react';

import { SteamLogo, DiscordLogo } from './components/discord/PlatformIcons';
const DiscordQuestsTab = lazy(() => import('./components/discord/DiscordQuestsTab').then(m => ({ default: m.DiscordQuestsTab })));
const DiscordVarietyTab = lazy(() => import('./components/discord/DiscordVarietyTab').then(m => ({ default: m.DiscordVarietyTab })));
const DiscordHoursTab = lazy(() => import('./components/discord/DiscordHoursTab').then(m => ({ default: m.DiscordHoursTab })));
const DiscordDatabaseTab = lazy(() => import('./components/discord/DiscordDatabaseTab').then(m => ({ default: m.DiscordDatabaseTab })));
import { DiscordConsoleTab } from './components/discord/DiscordConsoleTab';
import { DiscordSettingsTab } from './components/discord/DiscordSettingsTab';

import { CosmicSpaceBackground } from './components/spatial/CosmicSpaceBackground';
import { DashboardOverviewView } from './components/spatial/DashboardOverviewView';
import { HourFarmSpatialView } from './components/spatial/HourFarmSpatialView';
import { CardIdlerSpatialView } from './components/spatial/CardIdlerSpatialView';
const AchievementsSpatialView = lazy(() => import('./components/spatial/AchievementsSpatialView').then(m => ({ default: m.AchievementsSpatialView })));
const EconomyMarketSpatialView = lazy(() => import('./components/spatial/EconomyMarketSpatialView').then(m => ({ default: m.EconomyMarketSpatialView })));
const AnalyticsSpatialView = lazy(() => import('./components/spatial/AnalyticsSpatialView').then(m => ({ default: m.AnalyticsSpatialView })));
const CollectorSpatialView = lazy(() => import('./components/spatial/CollectorSpatialView').then(m => ({ default: m.CollectorSpatialView })));
import { HomeView, GameItem } from './components/spatial/HomeView';
import { SavingsGoalsView } from './components/spatial/SavingsGoalsView';
import { AchievementsCollectorView } from './components/spatial/AchievementsCollectorView';
import { SettingsView, LogItem } from './components/spatial/SettingsView';
import { AppSettingsView } from './components/spatial/AppSettingsView';
import { LoginModal } from './components/LoginModal';

const EMPTY_PROFILE = { name: 'Войти в Steam', steamId: '', level: 0, wallet: '—', status: 'Offline', avatarUrl: null as string | null };
const PERSONA_NAMES = ['Offline', 'Online', 'Busy', 'Away', 'Snooze', 'Online', 'Online', 'Invisible'];
function mapSteamGame(g: any): GameItem {
  return {
    appId: g.appid, title: g.name || `AppID ${g.appid}`,
    hours: Number(((g.playtime_forever ?? 0) / 60).toFixed(1)),
    genre: g.genre || 'Steam Game', hasCards: (g.cardsRemaining ?? 0) > 0,
    cardsRemaining: g.cardsRemaining ?? 0, cardsTotal: g.cardsTotal ?? 0,
  };
}

function getNowTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatUserWallet(wallet: any): string {
  if (wallet == null || wallet === '') return '0.00';
  const str = String(wallet).trim();
  if (/[₴$€₽£¥zł₸₼kr]/i.test(str)) {
    return str;
  }
  return `${str} ₽`;
}

export default function App() {
  useEffect(() => {
    applyMotionSetting(loadLocalSettings());
    window.vaporAPI?.getSettings().then(settings => {
      applyMotionSetting(settings);
      saveLocalSettings(settings);
    }).catch(console.error);
  }, []);
  // Platform selection: 'steam' | 'discord'
  const [activePlatform, setActivePlatform] = useState<'steam' | 'discord'>('steam');
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [hoveredPlatform, setHoveredPlatform] = useState<string | null>(null);
  const [activeDiscordTab, setActiveDiscordTab] = useState<string>('discord_quests');

  // Navigation: All 9 Steam tabs from the previous version
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(1);

  // Authentication & Profile State
  const [authModalOpen, setAuthModalOpen] = useState(true);
  const [isSteamLoggedOn, setIsSteamLoggedOn] = useState(false);

  const [userProfile, setUserProfile] = useState(EMPTY_PROFILE);
  const [serverConnected, setServerConnected] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const steamActionPending = useRef(false);

  // Games & Booster Slots
  const [games, setGames] = useState<GameItem[]>([]);
  const [slots, setSlots] = useState<Array<GameItem | null>>(() => Array(32).fill(null));

  // Farming & Idling States
  const [isFarmingHours, setIsFarmingHours] = useState(false);
  const [farmElapsedSeconds, setFarmElapsedSeconds] = useState(0);
  const [isFarmingCards, setIsFarmingCards] = useState(false);
  const [farmedCardDrops, setFarmedCardDrops] = useState(0);
  const [cardIdlerState, setCardIdlerState] = useState<any>(null);
  const [isScanningPc, setIsScanningPc] = useState(false);

  // Discord State
  const [discordStatus, setDiscordStatus] = useState<any>(null);
  const [discordMode, setDiscordMode] = useState<'process' | 'rpc'>('process');

  // System Logs
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [discordLogs, setDiscordLogs] = useState<LogItem[]>([]);

  const addLog = useCallback((level: string, message: string) => {
    setLogs((prev) => [
      { id: Date.now() + Math.random(), time: getNowTimestamp(), level: level.toUpperCase(), message },
      ...prev.slice(0, 499)
    ]);
    if (level.toUpperCase() === 'ERROR') setActionError(message);
  }, []);
  const addDiscordLog = useCallback((level: string, message: string) => {
    setDiscordLogs(prev => [{ id: Date.now() + Math.random(), time: getNowTimestamp(), level: level.toUpperCase(), message }, ...prev.slice(0, 499)]);
    if (level.toUpperCase() === 'ERROR') setActionError(message);
  }, []);

  // The complete set of 9 Steam tabs from the previous version
  const steamNavItems = useMemo(
    () => [
      { id: 'dashboard', icon: LayoutGrid, label: 'Обзор', subtitle: 'Сводная панель аккаунта Steam' },
      { id: 'hourfarm', icon: Clock, label: 'Фарм часов', subtitle: 'Эмуляция игрового времени (до 32 слотов)' },
      { id: 'cardidler', icon: Layers, label: 'Фарм карточек', subtitle: 'Автоматический сбор коллекционных карточек' },
      { id: 'achievements', icon: Trophy, label: 'Ачивки', subtitle: 'Менеджер достижений Steam' },
      { id: 'economy', icon: CircleDollarSign, label: 'Экономика', subtitle: 'Инвентарь, баланс и статистика предметов' },
      { id: 'analytics', icon: BarChart3, label: 'Аналитика', subtitle: 'Глубокая статистика библиотеки и времени' },
      { id: 'collector', icon: PackagePlus, label: 'Коллекционер', subtitle: 'Подборка бесплатных пакетов для значка' },
      { id: 'console', icon: Terminal, label: 'Консоль', subtitle: 'Системный журнал событий ядра (/ws)' },
      { id: 'settings', icon: Settings, label: 'Настройки Steam', subtitle: 'Аккаунт Steam и обновление инвентаря' },
    ],
    []
  );

  // The complete set of 6 Discord tabs
  const discordNavItems = useMemo(
    () => [
      { id: 'discord_quests', icon: Sparkles, label: 'Квесты', subtitle: 'Автоматическое выполнение квестов Discord' },
      { id: 'discord_variety', icon: Trophy, label: 'Универсал', subtitle: 'Ротация и буст каталога 25,176 игр' },
      { id: 'discord_hours', icon: Clock, label: 'Фарм часов', subtitle: 'Параллельный буст игрового времени (до 20 игр)' },
      { id: 'discord_database', icon: Database, label: 'База игр', subtitle: 'Реестр поддерживаемых игр Discord' },
      { id: 'discord_console', icon: Terminal, label: 'Консоль', subtitle: 'Журнал процессов и RPC-событий' },
      { id: 'discord_settings', icon: Settings, label: 'Настройки Discord', subtitle: 'Конфигурация Spoofer & RPC сокетов' },
    ],
    []
  );

  const platformNavItems = useMemo(
    () => [
      {
        id: 'steam',
        label: 'Steam',
        icon: SteamLogo,
        statusDot: isSteamLoggedOn ? 'bg-emerald-400' : null
      },
      {
        id: 'discord',
        label: 'Discord',
        icon: DiscordLogo,
        statusDot: discordStatus?.isDiscordRunning ? 'bg-emerald-400' : null
      }
    ],
    [isSteamLoggedOn, discordStatus?.isDiscordRunning]
  );

  const fetchDiscordStatus = async () => {
    try {
      const res = await fetch('/api/discord/status');
      if (res.ok) {
        const data = await res.json();
        setDiscordStatus(data);
        if (data?.mode) setDiscordMode(data.mode);
      }
    } catch (e) {}
  };

  const handleSelectPlatform = (platformId: 'steam' | 'discord') => {
    setActivePlatform(platformId);
    setAppSettingsOpen(false);
    setAnimKey((prev) => prev + 1);
  };

  const handleSelectTab = (tabId: string) => {
    setAppSettingsOpen(false);
    if (activePlatform === 'steam') {
      setActiveTab(tabId);
    } else {
      setActiveDiscordTab(tabId);
    }
    setAnimKey((prev) => prev + 1);
  };

  const handleDiscordModeChange = async (newMode: 'process' | 'rpc') => {
    try {
      await post('/api/discord/mode', { mode: newMode });
      setDiscordMode(newMode);
      await fetchDiscordStatus();
    } catch (e: any) { addDiscordLog('ERROR', e.message); }
  };

  const handleDiscordStartVariety = async (batchSize: number, intervalSec: number, mode?: 'process' | 'rpc', loopMode = true) => {
    const activeM = mode || discordMode;
    try {
      const data = await post('/api/discord/variety/start', { batchSize, holdSeconds: intervalSec, mode: activeM, loopMode });
      if (data.success) fetchDiscordStatus();
      return data;
    } catch (e: any) {
      addDiscordLog('ERROR', 'Ошибка запуска «Универсала»: ' + e.message);
      return { success: false, error: e.message };
    }
  };

  const handleDiscordStopVariety = async () => {
    try {
      const data = await post('/api/discord/variety/stop');
      if (data.success) fetchDiscordStatus();
      return data;
    } catch (e: any) {
      addDiscordLog('ERROR', 'Ошибка остановки «Универсала»: ' + e.message);
      return { success: false, error: e.message };
    }
  };

  const handleDiscordStartFarm = async (gameIds: string[], durationMinutes: number | null = null, mode?: 'process' | 'rpc') => {
    const activeM = mode || discordMode;
    try {
      const data = await post('/api/discord/farm/start', { gameIds, durationMinutes, mode: activeM });
      if (data.success) fetchDiscordStatus();
      return data;
    } catch (e: any) {
      addDiscordLog('ERROR', 'Ошибка запуска фарма времени Discord: ' + e.message);
      return { success: false, error: e.message };
    }
  };

  const handleDiscordStopFarm = async () => {
    try {
      const data = await post('/api/discord/farm/stop');
      if (data.success) fetchDiscordStatus();
      return data;
    } catch (e: any) {
      addDiscordLog('ERROR', 'Ошибка остановки фарма времени Discord: ' + e.message);
      return { success: false, error: e.message };
    }
  };

  const handleDiscordResetVarietyHistory = async () => {
    try {
      const data = await post('/api/discord/variety/reset');
      if (data.success) fetchDiscordStatus();
      return data;
    } catch (e: any) {
      addDiscordLog('ERROR', 'Ошибка сброса ротации «Универсала»: ' + e.message);
      return { success: false, error: e.message };
    }
  };

  const handleDiscordResetHistory = async () => {
    try {
      const data = await post('/api/discord/history/reset');
      if (data.success) fetchDiscordStatus();
      return data;
    } catch (e: any) {
      addDiscordLog('ERROR', 'Ошибка сброса истории Discord: ' + e.message);
      return { success: false, error: e.message };
    }
  };

  const handleDiscordStartQuest = async (gameName: string, exeName: string, durationMinutes: number | null, gameId?: string | null, questId?: string | null, taskType?: string | null) => {
    try {
      const data = await post('/api/discord/quest/start', { gameName, exeName, durationMinutes, gameId, questId, taskType });
      if (data?.success) fetchDiscordStatus();
      return Boolean(data?.success);
    } catch (e: any) {
      addDiscordLog('ERROR', 'Ошибка запуска квеста Discord: ' + e.message);
      return false;
    }
  };

  const handleDiscordStopQuest = async () => {
    try {
      const data = await post('/api/discord/quest/stop');
      if (data?.success) fetchDiscordStatus();
      return Boolean(data?.success);
    } catch (e: any) {
      addDiscordLog('ERROR', 'Ошибка остановки квеста Discord: ' + e.message);
      return false;
    }
  };

  const activeSlotsCount = useMemo(() => slots.filter(Boolean).length, [slots]);
  const remainingCardDrops = useMemo(
    () => games.reduce((sum, g) => sum + (g.hasCards ? (g.cardsRemaining || 0) : 0), 0),
    [games]
  );

  // Handlers
  const handleToggleFarmHours = async (targetDurationMinutes?: number | null) => {
    if (steamActionPending.current) return;
    steamActionPending.current = true;
    setActionError(null);
    try {
      const data = await post(`/api/hour-booster/${isFarmingHours ? 'stop' : 'start'}`, {
        appIds: slots.filter(Boolean).map(s => s!.appId),
        targetDurationMinutes: typeof targetDurationMinutes === 'number' ? targetDurationMinutes : null,
      });
      applySteamStatus(data.status);
    } catch (e: any) { addLog('ERROR', e.message); }
    finally { steamActionPending.current = false; }
  };

  const handleToggleCardIdler = async (scannedGames?: any[]) => {
    if (steamActionPending.current) return;
    steamActionPending.current = true;
    setActionError(null);
    try {
      const queue = isFarmingCards ? [] : Array.isArray(scannedGames) && scannedGames.length ? scannedGames : await api('/api/card-idler/scan');
      const data = await post(`/api/card-idler/${isFarmingCards ? 'stop' : 'start'}`, { games: queue });
      applySteamStatus(data.status);
    } catch (e: any) { addLog('ERROR', e.message); }
    finally { steamActionPending.current = false; }
  };

  const handleScanPc = async () => {
    setIsScanningPc(true);
    addLog('INFO', 'Сканирование ПК: проверка локальной библиотеки Steam...');
    try {
      const data = await post('/api/library/deep-scan');
      if (data.games && Array.isArray(data.games)) {
        setGames(data.games.map(mapSteamGame));
      }
      addLog('SUCCESS', `Сканирование ПК завершено. Найдено игр: ${data.games?.length || games.length}.`);
    } catch (e: any) {
      addLog('ERROR', 'Ошибка сканирования: ' + e.message);
    } finally {
      setIsScanningPc(false);
    }
  };

  const handleAddGameToFarm = (game: GameItem) => {
    if (isFarmingHours) return addLog('WARN', 'Остановите фарм перед изменением слотов.');
    if (slots.some(s => s?.appId === game.appId)) return;
    const emptyIndex = slots.findIndex((s) => s === null);
    if (emptyIndex !== -1) {
      const nextSlots = [...slots];
      nextSlots[emptyIndex] = game;
      setSlots(nextSlots);
      addLog('INFO', `Игра «${game.title}» (ID: ${game.appId}) добавлена в слот #${emptyIndex + 1}.`);
    } else {
      addLog('WARN', 'Все 32 слота фарминга заполнены.');
    }
  };

  const handleRemoveGameFromFarm = (appId: number) => {
    if (isFarmingHours) return addLog('WARN', 'Остановите фарм перед изменением слотов.');
    setSlots((prev) => prev.map((s) => (s && s.appId === appId ? null : s)));
    addLog('INFO', `Игра с AppID ${appId} удалена из слотов фарминга.`);
  };

  const handleClearAllSlots = () => {
    if (isFarmingHours) return addLog('WARN', 'Остановите фарм перед изменением слотов.');
    setSlots(Array(32).fill(null));
    addLog('INFO', 'Все 32 слота фарминга очищены.');
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await post('/api/persona', { statusName: newStatus });
      setUserProfile((p) => ({ ...p, status: newStatus }));
      addLog('INFO', `Статус Steam изменен: [${newStatus}]`);
    } catch (e: any) { addLog('ERROR', e.message); }
  };

  const handleLogout = async () => {
    try {
      await post('/api/logout');
      applySteamStatus({ isLoggedOn: false, user: null });
      startTransition(() => setAuthModalOpen(true));
      addLog('INFO', 'Выполнен выход из учетной записи Steam.');
    } catch (e: any) { addLog('ERROR', e.message); }
  };

  const applyProfile = (user: any) => {
    setUserProfile(user ? {
      name: user.personaName || 'Steam User', steamId: user.steamID || '',
      avatarUrl: user.avatarUrl || null, level: user.level ?? 0,
      wallet: user.wallet != null ? formatUserWallet(user.wallet) : '—',
      status: PERSONA_NAMES[user.personaState] || 'Offline',
    } : EMPTY_PROFILE);
  };

  const applySteamStatus = (data: any) => {
    if (!data) return;
    if (data.isLoggedOn != null) {
      setIsSteamLoggedOn(Boolean(data.isLoggedOn));
      if (data.isLoggedOn) startTransition(() => setAuthModalOpen(false));
      if (!data.isLoggedOn && !data.isLoggingIn) {
        setGames([]);
        setSlots(Array(32).fill(null));
        setIsFarmingHours(false);
        setIsFarmingCards(false);
        setFarmElapsedSeconds(0);
        setFarmedCardDrops(0);
        setCardIdlerState(null);
      }
    }
    if ('user' in data) applyProfile(data.isLoggedOn ? data.user : null);
    if (data.hourBooster) {
      setIsFarmingHours(Boolean(data.hourBooster.isRunning));
      setFarmElapsedSeconds(data.hourBooster.elapsedSeconds ?? 0);
    }
    if (data.cardIdler) {
      setCardIdlerState(data.cardIdler);
      setIsFarmingCards(Boolean(data.cardIdler.isRunning));
      setFarmedCardDrops(data.cardIdler.dropsEarned ?? 0);
    }
  };

  useEffect(() => {
    let firstSnapshot = true;
    return connectServer((evName, data) => {
          if (evName === 'initial_state') {
            applySteamStatus(data);
            const library = (data.games || []).map(mapSteamGame);
            setGames(library);
            if (data.hourBooster?.isRunning) {
              const active = data.hourBooster.activeAppIds.map((id: number) => library.find((g: GameItem) => g.appId === id) || mapSteamGame({ appid: id }));
              setSlots([...active, ...Array(Math.max(0, 32 - active.length)).fill(null)]);
            }
            setDiscordStatus(data.discord);
            if (data.discord?.mode) setDiscordMode(data.discord.mode);
            if (firstSnapshot && !data.isLoggedOn && !data.isLoggingIn) startTransition(() => setAuthModalOpen(true));
            firstSnapshot = false;
          } else if (evName === 'auth_state') {
            applySteamStatus(data);
          } else if (evName === 'profile_updated') {
            applyProfile(data);
          } else if (evName === 'games_loaded') {
            setGames((data || []).map(mapSteamGame));
          } else if (evName === 'client_error') {
            addLog('ERROR', data.message);
          } else if (evName === 'qr_timeout') {
            addLog('WARN', 'QR-код истёк. Сгенерируйте новый код.');
          }
          if (evName === 'log') {
            addLog(data.level || 'INFO', data.message);
          } else if (evName === 'hour_booster_tick') {
            if (data.elapsedSeconds != null) setFarmElapsedSeconds(data.elapsedSeconds);
            if (data.isRunning != null) setIsFarmingHours(data.isRunning);
          } else if (evName === 'card_idler_tick') {
            setCardIdlerState((prev: any) => ({ ...prev, ...data }));
            if (data.dropsEarned != null) setFarmedCardDrops(data.dropsEarned);
            if (data.isRunning != null) setIsFarmingCards(data.isRunning);
          } else if (evName === 'discord_status') {
            setDiscordStatus(data);
            if (data?.mode) setDiscordMode(data.mode);
          } else if (evName === 'discord_quest_tick') {
            setDiscordStatus((prev: any) => ({ ...prev, quest: { ...prev?.quest, ...data } }));
          } else if (evName === 'discord_variety_tick') {
            setDiscordStatus((prev: any) => ({ ...prev, variety: { ...prev?.variety, ...data, isRunning: true } }));
          } else if (evName === 'discord_farm_tick') {
            setDiscordStatus((prev: any) => ({ ...prev, farm: { ...prev?.farm, ...data, isRunning: true } }));
          } else if (evName === 'discord_log') {
            addDiscordLog(data.level || 'INFO', data.message);
          } else if (evName === 'discord_quest_completed') {
            addDiscordLog('SUCCESS', 'Discord подтвердил выполнение квеста: ' + (data.gameName || ''));
            fetchDiscordStatus();
          }
    }, setServerConnected);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans text-white">
      <CosmicSpaceBackground />
      {(!serverConnected || actionError) && (
        <div role="alert" className="absolute top-14 right-8 z-[70] max-w-lg rounded-xl border border-amber-300/30 bg-slate-950/95 px-4 py-3 text-sm shadow-xl">
          {actionError || 'Соединение с сервером потеряно. Переподключение…'}
          {actionError && <button className="ml-4 underline" onClick={() => setActionError(null)}>Закрыть</button>}
        </div>
      )}
      {authModalOpen ? (
        <ViewTransition key="auth-page" enter="auth-enter" exit="auth-exit" default="none">
          <LoginModal
            isOpen={authModalOpen}
            onClose={() => startTransition(() => setAuthModalOpen(false))}
            steamConnected={isSteamLoggedOn}
            onOpenSteam={() => startTransition(() => {
              setActivePlatform('steam');
              setAppSettingsOpen(false);
              setAuthModalOpen(false);
            })}
            onOpenDiscord={() => startTransition(() => {
              setActivePlatform('discord');
              setAppSettingsOpen(false);
              setAnimKey((key) => key + 1);
              setAuthModalOpen(false);
            })}
          />
        </ViewTransition>
      ) : (
      <ViewTransition key="workspace" enter="auth-enter" exit="auth-exit" default="none">
      <div className="relative z-10 w-full h-full flex flex-col pt-3 pb-2.5 pl-9 pr-6 select-none">

      {/* ================================================================
          2. TOP FLOATING SPATIAL BAR (Full-Width Aligned with Main Block)
      ================================================================ */}
      <div className="relative z-20 w-full flex items-center justify-between gap-3 pl-14 mb-2.5 shrink-0 h-10">
        {/* Left User Welcome Pill */}
        <button
          type="button"
          onClick={() => startTransition(() => setAuthModalOpen(true))}
          aria-label="Открыть страницу подключения Steam или Discord"
          style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
          className="workspace-chrome h-10 min-w-0 px-3.5 rounded-full border flex items-center gap-2.5 cursor-pointer overflow-hidden"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 border border-white/60 shadow-inner flex items-center justify-center overflow-hidden">
            {userProfile.avatarUrl ? (
              <img src={userProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-white">
                {userProfile.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono min-w-0">
            <span className="font-semibold text-white truncate">{userProfile.name}</span>
            <span className="text-white/50">• {userProfile.status}</span>
          </div>
        </button>

        <button type="button" onClick={() => { setAppSettingsOpen(true); setAnimKey(key => key + 1); }}
          aria-label="Настройки приложения Vapor" aria-current={appSettingsOpen ? 'page' : undefined}
          className={`workspace-chrome h-10 w-10 shrink-0 rounded-full border flex items-center justify-center ${appSettingsOpen ? 'text-white border-white/50' : 'text-white/70 hover:text-white'}`}>
          <Settings className="size-4" />
        </button>
      </div>

      {/* ================================================================
          3. CENTRAL FULL-SCREEN GLASS BLOCK + HALF-OVERLAPPING LEFT DOCKS
      ================================================================ */}
      <div className="relative z-10 w-full flex-1 min-h-0">
        {/* LEFT FLOATING DOCKS (PLATFORM SWITCHER UPPER + TAB SWITCHER LOWER) */}
        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3 pointer-events-none">
          {/* 1. UPPER GLASS CAPSULE: Platform Switcher (Steam / Discord) */}
          <div className="pointer-events-auto relative w-[52px] py-2 flex flex-col items-center gap-2">
            {/* Dedicated Glass Capsule Background with STRICT rounded-full clipping */}
            <div
              className="workspace-chrome workspace-rail-glass absolute inset-0 rounded-full border overflow-hidden pointer-events-none"
              style={{
                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                isolation: 'isolate',
              }}
            >
              {/* Top specular highlight inside the dock */}
              <div className="absolute inset-x-2 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />
            </div>

            {/* Interactive Platform Navigation Items */}
            <div className="relative z-10 w-full flex flex-col items-center gap-2">
              {platformNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activePlatform === item.id;
                const isHovered = hoveredPlatform === item.id;

                return (
                  <div
                    key={item.id}
                    className="relative w-full h-8 flex items-center justify-center"
                    onMouseEnter={() => setHoveredPlatform(item.id)}
                    onMouseLeave={() => setHoveredPlatform(null)}
                  >
                    <button
                      onClick={() => handleSelectPlatform(item.id as 'steam' | 'discord')}
                      onFocus={() => setHoveredPlatform(item.id)}
                      onBlur={() => setHoveredPlatform(null)}
                      title={item.label}
                      className={`inline-flex items-center whitespace-nowrap transition-[transform,opacity,background-color,color,box-shadow] duration-[250ms] ease-[var(--ease-apple)] ${
                        isHovered
                          ? 'absolute left-[6px] w-max min-w-8 h-8 px-3 rounded-full bg-white text-slate-900 shadow-[0_8px_24px_rgba(255,255,255,0.4)] gap-2 z-50'
                          : isActive
                          ? 'w-8 h-8 rounded-full justify-center bg-white text-slate-950 shadow-[0_0_16px_rgba(255,255,255,0.6)] ring-2 ring-white/80 scale-105'
                          : 'w-8 h-8 rounded-full justify-center text-white/70 hover:text-white hover:bg-white/15 hover:scale-105'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {isHovered && (
                        <span className="text-xs font-bold font-mono text-slate-900 shrink-0 whitespace-nowrap transition-all duration-200">
                          {item.label}
                        </span>
                      )}
                    </button>

                    {/* Status Dot */}
                    {!isActive && !isHovered && item.statusDot && (
                      <span className={`absolute bottom-0 right-1.5 w-1.5 h-1.5 rounded-full ${item.statusDot} shadow-sm pointer-events-none`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. LOWER GLASS CAPSULE: Tab Switcher (Steam or Discord Tabs) */}
          <div className="pointer-events-auto relative w-[52px] py-2.5 flex flex-col items-center gap-2">
            {/* Dedicated Glass Capsule Background with STRICT rounded-full clipping */}
            <div
              className="workspace-chrome workspace-rail-glass absolute inset-0 rounded-full border overflow-hidden pointer-events-none"
              style={{
                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                isolation: 'isolate',
              }}
            >
              {/* Top specular highlight inside the dock */}
              <div className="absolute inset-x-2 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />
            </div>

            {/* Interactive Navigation Items (Unclipped for smooth hover expand pills) */}
            <div className="relative z-10 w-full flex flex-col items-center gap-2">
              {(activePlatform === 'steam' ? steamNavItems : discordNavItems).map((item) => {
                const Icon = item.icon;
                const isActive = !appSettingsOpen && (activePlatform === 'steam' ? activeTab : activeDiscordTab) === item.id;
                const isHovered = hoveredTab === item.id;

                return (
                  <div
                    key={item.id}
                    className="relative w-full h-8 flex items-center justify-center"
                    onMouseEnter={() => setHoveredTab(item.id)}
                    onMouseLeave={() => setHoveredTab(null)}
                  >
                    <button
                      onClick={() => handleSelectTab(item.id)}
                      onFocus={() => setHoveredTab(item.id)}
                      onBlur={() => setHoveredTab(null)}
                      title={item.label}
                      className={`inline-flex items-center whitespace-nowrap transition-[transform,opacity,background-color,color,box-shadow] duration-[250ms] ease-[var(--ease-apple)] ${
                        isHovered
                          ? 'absolute left-[6px] w-max min-w-8 h-8 px-3 rounded-full bg-white text-slate-900 shadow-[0_8px_24px_rgba(255,255,255,0.4)] gap-2 z-50'
                          : isActive
                          ? 'w-8 h-8 rounded-full justify-center bg-white text-slate-950 shadow-[0_0_16px_rgba(255,255,255,0.6)] ring-2 ring-white/80 scale-105'
                          : 'w-8 h-8 rounded-full justify-center text-white/70 hover:text-white hover:bg-white/15 hover:scale-105'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {isHovered && (
                        <span className="text-xs font-bold font-mono text-slate-900 shrink-0 whitespace-nowrap transition-all duration-200">
                          {item.label}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cards float directly above the background, without a second opaque panel. */}
        <div className="relative w-full h-full pl-14 py-2 overflow-hidden">
          <div key={appSettingsOpen ? 'app-settings' : `${activePlatform}-${activePlatform === 'steam' ? activeTab : activeDiscordTab}`} className="relative z-10 w-full h-full overflow-y-auto workspace-view">
            <Suspense fallback={<div role="status" className="p-6 text-white/60">Загрузка вкладки…</div>}>
            {appSettingsOpen ? (
              <AppSettingsView animKey={animKey} />
            ) : activePlatform === 'steam' ? (
              <>
                {activeTab === 'dashboard' && (
                  <DashboardOverviewView
                    animKey={animKey}
                    userProfile={userProfile}
                     games={games}
                    slots={slots}
                    isFarmingHours={isFarmingHours}
                    farmElapsedSeconds={farmElapsedSeconds}
                    activeSlotsCount={activeSlotsCount}
                    isFarmingCards={isFarmingCards}
                    remainingCardDrops={remainingCardDrops}
                    farmedCardDrops={farmedCardDrops}
                    isScanningPc={isScanningPc}
                    logs={logs}
                    onToggleFarmHours={handleToggleFarmHours}
                    onToggleCardIdler={handleToggleCardIdler}
                    onScanPc={handleScanPc}
                    onAddGameToFarm={handleAddGameToFarm}
                    onRemoveGameFromFarm={handleRemoveGameFromFarm}
                    onStatusChange={handleStatusChange}
                    onOpenAuthModal={() => startTransition(() => setAuthModalOpen(true))}
                    onLogout={handleLogout}
                    onNavigateTab={(tab) => handleSelectTab(tab)}
                  />
                )}
                {activeTab === 'hourfarm' && (
                  <HourFarmSpatialView
                    animKey={animKey}
                    userProfile={userProfile}
                     games={games}
                    slots={slots}
                    isFarmingHours={isFarmingHours}
                    farmElapsedSeconds={farmElapsedSeconds}
                    activeSlotsCount={activeSlotsCount}
                    isScanningPc={isScanningPc}
                    onToggleFarmHours={handleToggleFarmHours}
                    onScanPc={handleScanPc}
                    onAddGameToFarm={handleAddGameToFarm}
                    onRemoveGameFromFarm={handleRemoveGameFromFarm}
                    onClearAllSlots={handleClearAllSlots}
                  />
                )}
                {activeTab === 'cardidler' && (
                  <CardIdlerSpatialView
                    animKey={animKey}
                    currentApp={cardIdlerState?.currentApp}
                     games={games}
                    isFarmingCards={isFarmingCards}
                    farmedCardDrops={farmedCardDrops}
                    remainingCardDrops={remainingCardDrops}
                    onToggleCardIdler={handleToggleCardIdler}
                  />
                )}
                {activeTab === 'achievements' && (
                  <AchievementsSpatialView
                    animKey={animKey}
                     games={games}
                    userProfile={userProfile}
                  />
                )}
                {activeTab === 'economy' && (
                  <EconomyMarketSpatialView
                    animKey={animKey}
                    userProfile={userProfile}
                  />
                )}
                {activeTab === 'analytics' && (
                  <AnalyticsSpatialView
                    animKey={animKey}
                     games={games}
                    userProfile={userProfile}
                  />
                )}
                {activeTab === 'collector' && (
                  <CollectorSpatialView
                    animKey={animKey}
                    userProfile={userProfile}
                  />
                )}
                {activeTab === 'console' && (
                  <DiscordConsoleTab
                    platform="Steam"
                    logs={logs}
                    onClear={() => setLogs([])}
                    animKey={animKey}
                  />
                )}
                {activeTab === 'settings' && (
                  <SettingsView
                    animKey={animKey}
                    userProfile={userProfile}
                    onLogout={handleLogout}
                    onOpenAuthModal={() => startTransition(() => setAuthModalOpen(true))}
                  />
                )}
              </>
            ) : (
              <>
                {activeDiscordTab === 'discord_quests' && (
                  <DiscordQuestsTab
                    animKey={animKey}
                    questStatus={discordStatus?.quest}
                    onStartQuest={handleDiscordStartQuest}
                    onStopQuest={handleDiscordStopQuest}
                    fetchDiscordStatus={fetchDiscordStatus}
                    addLog={addDiscordLog}
                  />
                )}
                {activeDiscordTab === 'discord_variety' && (
                  <DiscordVarietyTab
                    animKey={animKey}
                    discordStatus={discordStatus}
                    status={discordStatus}
                    mode={discordMode}
                    onStart={handleDiscordStartVariety}
                    onStop={handleDiscordStopVariety}
                    onReset={handleDiscordResetVarietyHistory}
                    fetchDiscordStatus={fetchDiscordStatus}
                    addLog={addDiscordLog}
                  />
                )}
                {activeDiscordTab === 'discord_hours' && (
                  <DiscordHoursTab
                    animKey={animKey}
                    discordStatus={discordStatus}
                    status={discordStatus}
                    mode={discordMode}
                    onStartFarm={handleDiscordStartFarm}
                    onStopFarm={handleDiscordStopFarm}
                    fetchDiscordStatus={fetchDiscordStatus}
                    addLog={addDiscordLog}
                  />
                )}
                {activeDiscordTab === 'discord_database' && (
                  <DiscordDatabaseTab
                    animKey={animKey}
                    addLog={addDiscordLog}
                  />
                )}
                {activeDiscordTab === 'discord_console' && (
                  <DiscordConsoleTab
                    animKey={animKey}
                    logs={discordLogs}
                    onClear={() => setDiscordLogs([])}
                  />
                )}
                {activeDiscordTab === 'discord_settings' && (
                  <DiscordSettingsTab
                    animKey={animKey}
                    discordStatus={discordStatus}
                    status={discordStatus}
                    mode={discordMode}
                    onModeChange={handleDiscordModeChange}
                    onResetHistory={handleDiscordResetHistory}
                    addLog={addDiscordLog}
                  />
                )}
              </>
            )}
            </Suspense>
          </div>
        </div>
      </div>

      </div>
      </ViewTransition>
      )}
    </div>
  );
}
