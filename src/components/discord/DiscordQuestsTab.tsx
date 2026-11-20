// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Play,
  Square,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
  Info,
  Layers,
  ChevronRight,
  ExternalLink,
  Gamepad2,
  RefreshCw,
  UserCheck,
  LogOut,
  KeyRound,
  Gift,
  Copy,
  Check,
  AlertTriangle,
  Sliders,
  Trash2,
  User,
  Plus,
  ArrowRight
} from 'lucide-react';
import { GlassCard } from '../spatial/GlassCard';

interface QuestState {
  isRunning: boolean;
  gameId: string | null;
  gameName: string;
  exeName: string;
  targetDurationMinutes: number | null;
  elapsedSeconds: number;
  remainingSeconds: number;
  percent: number;
  questId?: string | null;
  progressSeconds?: number;
  targetSeconds?: number;
  verified?: boolean;
  lastVerifiedAt?: number | null;
  progressError?: string | null;
  progressWarning?: string | null;
  taskType?: string | null;
  queue?: string[];
  queueError?: string | null;
  queueRetrying?: boolean;
  startedAt: number | null;
  hasUserToken?: boolean;
  tokenUser?: {
    id: string;
    username: string;
    global_name: string;
    avatar: string | null;
  } | null;
}

interface DiscordQuestsTabProps {
  animKey?: number;
  theme?: any;
  lang?: 'ru' | 'en';
  questStatus?: QuestState;
  onStartQuest?: (gameName: string, exeName: string, durationMinutes: number | null, gameId?: string | null, questId?: string | null, taskType?: string | null) => Promise<boolean>;
  onStopQuest?: () => Promise<boolean>;
  fetchDiscordStatus?: () => void;
  addLog?: (level: string, message: string) => void;
}

// Popular games with frequent Discord Quests
const DEFAULT_FEED_GAMES = [
  { id: 'fortnite', name: 'Fortnite', exeName: 'FortniteClient-Win64-Shipping.exe', durationMinutes: 15, banner: 'Epic Games • Battle Royale' },
  { id: 'genshin', name: 'Genshin Impact', exeName: 'GenshinImpact.exe', durationMinutes: 15, banner: 'HoYoverse • Action RPG' },
  { id: 'honkai', name: 'Honkai: Star Rail', exeName: 'StarRail.exe', durationMinutes: 15, banner: 'HoYoverse • Turn-based RPG' },
  { id: 'valorant', name: 'VALORANT', exeName: 'VALORANT-Win64-Shipping.exe', durationMinutes: 15, banner: 'Riot Games • Tactical FPS' },
  { id: 'apex', name: 'Apex Legends', exeName: 'r5apex.exe', durationMinutes: 15, banner: 'EA / Respawn • Battle Royale' },
  { id: 'lol', name: 'League of Legends', exeName: 'LeagueClient.exe', durationMinutes: 15, banner: 'Riot Games • MOBA' },
  { id: 'minecraft', name: 'Minecraft', exeName: 'Minecraft.Windows.exe', durationMinutes: 15, banner: 'Mojang • Sandbox' },
  { id: 'roblox', name: 'Roblox', exeName: 'RobloxPlayerBeta.exe', durationMinutes: 15, banner: 'Roblox Corp • Meta Platform' },
  { id: 'cod', name: 'Call of Duty: Warzone', exeName: 'cod.exe', durationMinutes: 15, banner: 'Activision • FPS Battle Royale' },
  { id: 'rocketleague', name: 'Rocket League', exeName: 'RocketLeague.exe', durationMinutes: 15, banner: 'Psyonix • Sports Action' },
  { id: 'overwatch2', name: 'Overwatch 2', exeName: 'Overwatch.exe', durationMinutes: 15, banner: 'Blizzard • Hero Shooter' },
  { id: 'warframe', name: 'Warframe', exeName: 'Warframe.x64.exe', durationMinutes: 15, banner: 'Digital Extremes • Sci-Fi Action' },
  { id: 'cs2', name: 'Counter-Strike 2', exeName: 'cs2.exe', durationMinutes: 15, banner: 'Valve • Tactical Shooter' },
  { id: 'dota2', name: 'Dota 2', exeName: 'dota2.exe', durationMinutes: 15, banner: 'Valve • MOBA' },
  { id: 'deadbydaylight', name: 'Dead by Daylight', exeName: 'DeadByDaylight-Win64-Shipping.exe', durationMinutes: 15, banner: 'Behaviour • Asymmetric Horror' },
  { id: 'r6s', name: 'Tom Clancy\'s Rainbow Six Siege', exeName: 'RainbowSix.exe', durationMinutes: 15, banner: 'Ubisoft • Tactical FPS' },
];


export const DiscordQuestsTab: React.FC<DiscordQuestsTabProps> = ({
  animKey = 0,
  questStatus,
  onStartQuest,
  onStopQuest,
  fetchDiscordStatus,
  addLog,
}) => {
  // Mode A: personal (с токеном) | Mode B: catalog (без токена / по .exe)
  const [activeMode, setActiveMode] = useState<'personal' | 'catalog'>('personal');

  // Token management
  const [tokenStatus, setTokenStatus] = useState<{ hasToken: boolean; user?: any }>({ hasToken: false, user: null });
  const [isDetectingToken, setIsDetectingToken] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [isSubmittingToken, setIsSubmittingToken] = useState(false);

  const handleCopyTokenCommand = async () => {
    try {
      const res = await fetch('/api/discord/quest/token/command');
      if (!res.ok) throw new Error('Команда недоступна');
      const { command } = await res.json();
      if (typeof command !== 'string') throw new Error('Команда недоступна');
      await navigator.clipboard.writeText(command);
      setShowManualInput(true);
      addLog?.('INFO', 'Команда скопирована для PowerShell. Её можно запустить из любой папки, но не в консоли браузера Discord.');
    } catch {
      addLog?.('ERROR', 'Не удалось скопировать команду в буфер обмена.');
    }
  };

  // Personal quests state
  const [personalQuests, setPersonalQuests] = useState<any[]>([]);
  const [taskChoices, setTaskChoices] = useState<Record<string, string>>({});
  const [rewardChoices, setRewardChoices] = useState<Record<string, number>>({});
  const [questFilter, setQuestFilter] = useState<'all' | 'enrolled' | 'available'>('all');
  const [isLoadingPersonal, setIsLoadingPersonal] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const personalRequestId = useRef(0);
  const personalLoading = useRef(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Duration selector: 15, 30, 45, 60 or null (auto)
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);

  // Catalog / custom exe state
  const [searchQuery, setSearchQuery] = useState('');
  const [customGameName, setCustomGameName] = useState('');
  const [customExeName, setCustomExeName] = useState('');
  const [isStartingQuest, setIsStartingQuest] = useState(false);

  const quest = questStatus || {
    isRunning: false,
    gameId: null,
    gameName: '',
    exeName: '',
    targetDurationMinutes: 15,
    elapsedSeconds: 0,
    remainingSeconds: 0,
    percent: 0,
    startedAt: null,
  };

  const isRunning = Boolean(quest.isRunning);

  // Format MM:SS or HH:MM:SS
  const formatTimer = (sec: number) => {
    const safeSec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(safeSec / 3600);
    const m = Math.floor((safeSec % 3600) / 60);
    const s = safeSec % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Format expiry ISO string
  const formatExpiry = (isoString?: string | null) => {
    if (!isoString) return 'Бессрочно';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Бессрочно';
      const now = Date.now();
      const diff = d.getTime() - now;
      if (diff <= 0) return 'Истек';
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      if (days > 0) return `Осталось ${days} дн. ${hours} ч.`;
      return `Осталось ${hours} ч.`;
    } catch (e) {
      return 'Бессрочно';
    }
  };

  // Check token status on mount
  const checkTokenStatus = async () => {
    try {
      const res = await fetch('/api/discord/quest/token/status');
      const data = await res.json();
      if (data && typeof data === 'object') {
        const hasTok = Boolean(data.hasToken);
        setTokenStatus({ hasToken: hasTok, user: data.user || null });
      }
    } catch (e) {}
  };

  useEffect(() => {
    checkTokenStatus();
  }, []);

  // Sync token from questStatus prop if provided
  useEffect(() => {
    if (questStatus?.hasUserToken != null) {
      setTokenStatus((prev) => ({
        hasToken: Boolean(questStatus.hasUserToken),
        user: questStatus.hasUserToken ? questStatus.tokenUser || prev.user : null
      }));
    }
  }, [questStatus?.hasUserToken, questStatus?.tokenUser]);

  // Load personal quests
  const loadPersonalQuests = async (silent = false) => {
    if (personalLoading.current) return;
    personalLoading.current = true;
    const requestId = ++personalRequestId.current;
    if (!silent) setIsLoadingPersonal(true);
    try {
      const res = await fetch('/api/discord/quest/personal');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.quests)) throw new Error(data.error || 'Не удалось загрузить список квестов');
      if (requestId === personalRequestId.current) {
        setPersonalQuests(data.quests);
        if (data.user) setTokenStatus({ hasToken: true, user: data.user });
        setPersonalError(null);
      }
    } catch (e: any) {
      if (requestId === personalRequestId.current) {
        setPersonalQuests([]);
        setPersonalError(e.message);
        addLog?.('ERROR', 'Ошибка загрузки персональных квестов: ' + e.message);
      }
    } finally {
      personalLoading.current = false;
      if (requestId === personalRequestId.current) setIsLoadingPersonal(false);
    }
  };

  // Auto-detect token from local Discord leveldb files
  const handleAutoDetectToken = async () => {
    setIsDetectingToken(true);
    try {
      const res = await fetch('/api/discord/quest/token/auto-detect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTokenStatus({ hasToken: true, user: data.user });
        addLog?.('SUCCESS', `Discord токен обнаружен: ${data.user?.username || data.user?.global_name || 'Авторизован'}!`);
        fetchDiscordStatus?.();
      } else {
        addLog?.('ERROR', 'Не удалось найти токен: ' + (data.error || 'Запустите Discord и авторизуйтесь.'));
      }
    } catch (e: any) {
      addLog?.('ERROR', 'Ошибка автоопределения токена: ' + e.message);
    } finally {
      setIsDetectingToken(false);
    }
  };

  // Connect manual token
  const handleSaveManualToken = async () => {
    if (!manualToken.trim()) {
      addLog?.('WARN', 'Введите токен Discord.');
      return;
    }
    setIsSubmittingToken(true);
    try {
      const res = await fetch('/api/discord/quest/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: manualToken.trim(), persist: true })
      });
      const data = await res.json();
      if (data.success) {
        setTokenStatus({ hasToken: true, user: data.user });
        setShowManualInput(false);
        setManualToken('');
        addLog?.('SUCCESS', `Discord токен подтвержден: ${data.user?.username || data.user?.global_name || 'Авторизован'}!`);
        fetchDiscordStatus?.();
      } else {
        addLog?.('ERROR', 'Неверный токен Discord: ' + (data.error || 'Проверьте токен.'));
      }
    } catch (e: any) {
      addLog?.('ERROR', 'Ошибка подключения токена: ' + e.message);
    } finally {
      setIsSubmittingToken(false);
    }
  };

  // Remove token
  const handleDeleteToken = async () => {
    try {
      const res = await fetch('/api/discord/quest/token', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        personalRequestId.current++;
        setTokenStatus({ hasToken: false, user: null });
        setPersonalQuests([]);
        setPersonalError(null);
        setIsLoadingPersonal(false);
        addLog?.('INFO', 'Токен Discord отключен.');
        fetchDiscordStatus?.();
      }
    } catch (e: any) {
      addLog?.('ERROR', 'Ошибка удаления токена: ' + e.message);
    }
  };

  // Enroll quest
  const handleEnrollQuest = async (questId: string, questName: string) => {
    setActionLoadingId(questId);
    try {
      const res = await fetch('/api/discord/quest/personal/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId })
      });
      const data = await res.json();
      if (data.success) {
        addLog?.('SUCCESS', `Квест «${questName}» успешно принят!`);
        setQuestFilter('enrolled');
        loadPersonalQuests();
        fetchDiscordStatus?.();
      } else {
        addLog?.('ERROR', 'Ошибка принятия квеста: ' + (data.error || 'Discord отклонил запрос.'));
      }
    } catch (e: any) {
      addLog?.('ERROR', 'Ошибка принятия квеста: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Claim reward
  const handleClaimQuest = async (questId: string, questName: string, platform: number) => {
    setActionLoadingId(questId);
    try {
      const res = await fetch('/api/discord/quest/personal/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId, platform })
      });
      const data = await res.json();
      if (data.success) {
        addLog?.('SUCCESS', `Награда за «${questName}» успешно получена! ${data.code ? `Код: ${data.code}` : ''}`);
        loadPersonalQuests();
        fetchDiscordStatus?.();
      } else {
        addLog?.('ERROR', 'Ошибка получения награды: ' + (data.error || 'Discord отклонил запрос.'));
      }
    } catch (e: any) {
      addLog?.('ERROR', 'Ошибка получения награды: ' + e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Start quest
  const handleStart = async (gameName: string, exeName: string, durationMin?: number | null, gameId?: string | null, questId?: string | null, taskType?: string | null) => {
    const finalDuration = selectedDuration ?? durationMin ?? 15;
    setIsStartingQuest(true);
    try {
      if (onStartQuest) {
        const started = await onStartQuest(gameName, exeName, finalDuration, gameId, questId, taskType);
        if (!started) return;
      } else {
        const res = await fetch('/api/discord/quest/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameName, exeName, durationMinutes: finalDuration, gameId, questId, taskType })
        });
        const data = await res.json();
        if (!res.ok || data.success === false) throw new Error(data.error || 'Не удалось запустить процесс');
        addLog?.('INFO', `Процесс «${gameName}» запущен; ожидаем подтверждения Discord.`);
      }
      fetchDiscordStatus?.();
    } catch (e: any) {
      addLog?.('ERROR', 'Ошибка запуска квеста: ' + e.message);
    } finally {
      setIsStartingQuest(false);
    }
  };

  const handleConsoleStart = async (questId: string, taskType: string) => {
    setIsStartingQuest(true);
    try {
      const res = await fetch('/api/discord/quest/console/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questId, taskType })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Discord не запустил консольный квест');
      fetchDiscordStatus?.();
    } catch (e: any) { addLog?.('ERROR', e.message); }
    finally { setIsStartingQuest(false); }
  };

  const changeQueue = async (questId: string, remove = false) => {
    try {
      const res = await fetch(remove ? `/api/discord/quest/queue/${questId}` : '/api/discord/quest/queue', {
        method: remove ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(!remove && { body: JSON.stringify({ questId }) })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || data.quest?.queueError || 'Ошибка очереди');
      fetchDiscordStatus?.();
    } catch (e: any) { addLog?.('ERROR', e.message); }
  };

  // Stop quest
  const handleStop = async () => {
    try {
      if (onStopQuest) {
        await onStopQuest();
      } else {
        const res = await fetch('/api/discord/quest/stop', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          addLog?.('WARN', 'Квест Discord остановлен пользователем.');
        }
      }
      fetchDiscordStatus?.();
    } catch (e: any) {
      addLog?.('ERROR', 'Ошибка остановки квеста: ' + e.message);
    }
  };

  // Custom launch
  const handleCustomLaunch = () => {
    if (!customExeName.trim()) {
      addLog?.('WARN', 'Укажите имя исполняемого файла (.exe).');
      return;
    }
    const cleanExe = customExeName.trim().endsWith('.exe') ? customExeName.trim() : `${customExeName.trim()}.exe`;
    const cleanName = customGameName.trim() || cleanExe.replace(/\.exe$/i, '');
    handleStart(cleanName, cleanExe, selectedDuration || 15);
  };

  // Filtered popular games
  const filteredPopularGames = useMemo(() => {
    if (!searchQuery.trim()) return DEFAULT_FEED_GAMES;
    const q = searchQuery.toLowerCase();
    return DEFAULT_FEED_GAMES.filter(
      (g) => g.name.toLowerCase().includes(q) || g.exeName.toLowerCase().includes(q) || g.banner.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const activeUser = tokenStatus.user || questStatus?.tokenUser || null;
  const hasToken = tokenStatus.hasToken;
  const accountId = activeUser?.id;
  const visibleQuests = personalQuests.filter(q => questFilter === 'all' || (questFilter === 'enrolled' ? q.isEnrolled : !q.isEnrolled));
  useEffect(() => {
    personalRequestId.current++;
    personalLoading.current = false;
    setPersonalQuests([]);
    setTaskChoices({});
    setRewardChoices({});
    setPersonalError(null);
    setIsLoadingPersonal(false);
    return () => { personalRequestId.current++; };
  }, [hasToken, accountId]);

  useEffect(() => {
    if (hasToken && activeMode === 'personal') loadPersonalQuests(Boolean(quest.lastVerifiedAt));
  }, [hasToken, accountId, quest.isRunning, activeMode]);
  useEffect(() => {
    if (!hasToken || activeMode !== 'personal') return;
    const timer = setInterval(() => loadPersonalQuests(true), 30000);
    return () => clearInterval(timer);
  }, [hasToken, accountId, activeMode]);

  return (
    <div className="flex flex-col h-full gap-3 select-none text-white">
      {/* ====================================================================
          ROW 1: HEADER & TOKEN MANAGEMENT PLAQUE
      ==================================================================== */}
      <GlassCard
        delay={20}
        animKey={animKey}
        hoverLift={true}
        className="p-3.5 px-4 shrink-0 flex flex-wrap items-center justify-between gap-3"
      >
        {/* Left: Title & Subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-lg shrink-0">
            <Sparkles className="w-5 h-5 text-purple-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                Discord Quests
              </h2>
              <span className="px-2 py-0.2 rounded-full bg-purple-500/15 border border-purple-400/30 text-[10px] font-mono font-semibold text-purple-300">
                ПРОГРЕСС DISCORD
              </span>
            </div>
            <p className="text-xs text-white/55 font-mono truncate">
              Запуск поддерживаемых игровых заданий и проверка прогресса Discord
            </p>
          </div>
        </div>

        {/* Center: Mode Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/15 font-mono text-xs">
          <button
            onClick={() => setActiveMode('personal')}
            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'personal'
                ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40 font-bold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Gift className="w-3.5 h-3.5 text-purple-300" />
            <span>Персональные квесты</span>
          </button>
          <button
            onClick={() => setActiveMode('catalog')}
            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'catalog'
                ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40 font-bold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5 text-purple-300" />
            <span>Запуск по .exe</span>
          </button>
        </div>

        {/* Right: Duration selector & Token Status */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Duration Selector */}
          <div className="flex items-center gap-1 font-mono text-xs bg-black/30 p-1 rounded-xl border border-white/10">
            {[15, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                onClick={() => setSelectedDuration(mins)}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                  selectedDuration === mins
                    ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40 font-bold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {mins}м
              </button>
            ))}
            <button
              onClick={() => setSelectedDuration(null)}
              className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                selectedDuration === null
                  ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40 font-bold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Авто
            </button>
          </div>

          {/* Token User Status */}
          {hasToken ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-purple-500/15 border border-purple-400/30 text-xs font-mono">
              {activeUser?.avatar ? (
                <img
                  src={activeUser.avatar}
                  alt={activeUser.username}
                  className="w-5 h-5 rounded-full object-cover border border-purple-400/40"
                />
              ) : (
                <UserCheck className="w-4 h-4 text-emerald-400" />
              )}
              <span className="text-white/90 font-medium truncate max-w-[120px]">
                {activeUser?.global_name || activeUser?.username || 'Discord User'}
              </span>
              <button
                onClick={handleAutoDetectToken}
                disabled={isDetectingToken}
                className="p-1 rounded-lg text-white/60 hover:text-purple-200 hover:bg-purple-500/20 disabled:opacity-50"
                title="Определить аккаунт после переключения в Discord"
                aria-label="Обновить аккаунт Discord"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDetectingToken ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleDeleteToken}
                className="p-1 rounded-lg text-white/40 hover:text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
                title="Отключить токен"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleAutoDetectToken}
                disabled={isDetectingToken}
                className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 border border-purple-400/40 text-xs font-mono font-medium text-purple-200 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Автоматически извлечь токен из локальной базы клиента Discord"
              >
                <Zap className={`w-3.5 h-3.5 text-purple-300 ${isDetectingToken ? 'animate-spin' : ''}`} />
                <span>{isDetectingToken ? 'Поиск...' : 'Автоопределить'}</span>
              </button>

              <button
                onClick={() => setShowManualInput((prev) => !prev)}
                className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white/80 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                title="Ввести токен Discord вручную"
              >
                <KeyRound className="w-3.5 h-3.5 text-purple-300" />
                <span>Вручную</span>
              </button>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Manual Token Input Drawer */}
      {showManualInput && !hasToken && (
        <GlassCard
          delay={25}
          animKey={animKey}
          hoverLift={true}
          className="p-3.5 px-4 shrink-0 bg-purple-950/20 border-purple-500/30 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <div className="flex items-center gap-2 text-xs font-mono text-purple-200 shrink-0">
            <KeyRound className="w-4 h-4 text-purple-300" />
            <span>Токен Discord:</span>
          </div>
          <input
            type="password"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Вставьте токен Discord (mfa... или OT...)"
            className="flex-1 px-3 py-1.5 rounded-xl bg-black/50 border border-white/15 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-purple-400/60"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyTokenCommand}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white"
              title="Выполнять в PowerShell из любой папки, не в консоли браузера Discord"
            >
              Команда PowerShell
            </button>
            <button
              onClick={handleSaveManualToken}
              disabled={isSubmittingToken || !manualToken.trim()}
              className="px-3.5 py-1.5 rounded-xl bg-purple-500/30 hover:bg-purple-500/40 border border-purple-400/50 text-xs font-mono font-semibold text-purple-100 transition-all cursor-pointer disabled:opacity-40"
            >
              {isSubmittingToken ? 'Проверка...' : 'Подключить'}
            </button>
            <button
              onClick={() => {
                setShowManualInput(false);
                setManualToken('');
              }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white/70 hover:text-white transition-all cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </GlassCard>
      )}

      {/* ====================================================================
          ROW 2: ACTIVE QUEST PROGRESS BANNER (Always visible if isRunning)
      ==================================================================== */}
      {isRunning && (
        <GlassCard
          delay={30}
          animKey={animKey}
          hoverLift={true}
          className="p-3.5 px-4 shrink-0 bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-emerald-900/20 border-purple-500/30 flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
                <Zap className="w-5 h-5 text-purple-300 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white truncate">
                    {quest.gameName || 'Discord Quest Game'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold">
                    {quest.progressSeconds > 0 ? 'ПРОГРЕСС DISCORD' : 'ОЖИДАНИЕ ПРОГРЕССА'}
                  </span>
                </div>
                <div className="text-xs font-mono text-white/50 truncate flex items-center gap-2">
                  {quest.mode === 'console' ? (
                    <span>{quest.taskType === 'PLAY_ON_XBOX' ? 'Xbox' : 'PlayStation'} · прогресс сообщает Discord</span>
                  ) : (
                    <>
                      <span>{quest.exeName}</span>
                      <span>•</span>
                      <span>Локальный таймер: {formatTimer(quest.remainingSeconds)}</span>
                      <span>•</span>
                      <span>Прошло: {formatTimer(quest.elapsedSeconds)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-lg font-mono font-bold text-purple-200">
                {quest.questId ? `${quest.percent || 0}% Discord` : 'Не подтверждено'}
              </span>
              <button
                onClick={handleStop}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/40 text-xs font-mono font-semibold text-rose-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Остановить квест</span>
              </button>
            </div>
          </div>

          <p role="status" className="text-[11px] font-mono text-white/60">
            {quest.questId
              ? quest.progressError
                ? `Не удалось обновить прогресс: ${quest.progressError}`
                : `Discord: ${formatTimer(quest.progressSeconds ?? 0)} / ${formatTimer(quest.targetSeconds ?? 0)} · проверено ${quest.lastVerifiedAt ? new Date(quest.lastVerifiedAt).toLocaleTimeString() : 'ожидание'}`
              : 'Запуск процесса не подтверждает выполнение персонального квеста или начисление награды.'}
          </p>
          {quest.progressWarning && <p role="alert" className="text-xs text-amber-200">{quest.progressWarning}</p>}
          {quest.mode === 'console' && <p className="text-xs text-white/60">Консоль должна быть привязана к Discord и играть в нужную игру.</p>}
          {quest.questId && <button onClick={async () => {
            try {
              const res = await fetch('/api/discord/quest/progress', { method: 'POST' });
              const result = await res.json();
              if (!res.ok || result.success === false) throw new Error(result.error);
              fetchDiscordStatus?.();
              await loadPersonalQuests();
            } catch (error: any) { addLog?.('ERROR', error.message); }
          }} className="self-start rounded-lg border border-white/20 px-3 py-1 text-xs">Проверить прогресс Discord</button>}
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, quest.percent || 0))}%` }}
            />
          </div>
        </GlassCard>
      )}

      {/* ====================================================================
          ROW 3: TAB CONTENT (Mode A: Personal Quests | Mode B: Catalog / Exe)
      ==================================================================== */}
      {activeMode === 'personal' ? (
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          {!hasToken ? (
            /* Prompt to connect token */
            <GlassCard
              delay={40}
              animKey={animKey}
              hoverLift={true}
              className="flex-1 p-8 flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 rounded-3xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 mb-4 shadow-xl">
                <KeyRound className="w-8 h-8 text-purple-300" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Подключите токен Discord для персональных квестов
              </h3>
              <p className="text-xs text-white/55 font-mono max-w-lg mb-6 leading-relaxed">
                Vapor автоматически считает список персональных заданий из вашего профиля Discord, отобразит оставшееся время, прогресс выполнения и позволит в один клик принять квест, запустить эмуляцию игры и забрать готовую награду.
              </p>

              <div className="flex items-center gap-3 flex-wrap justify-center">
                <button
                  onClick={handleAutoDetectToken}
                  disabled={isDetectingToken}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/30 to-indigo-500/30 hover:from-purple-500/40 hover:to-indigo-500/40 border border-purple-400/50 text-xs font-mono font-bold text-white flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Zap className={`w-4 h-4 text-purple-300 ${isDetectingToken ? 'animate-spin' : ''}`} />
                  <span>{isDetectingToken ? 'Поиск токена в Discord...' : 'Автоопределить токен из Discord'}</span>
                </button>

                <button
                  onClick={() => setShowManualInput(true)}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono font-semibold text-white flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  <KeyRound className="w-4 h-4 text-purple-300" />
                  <span>Ввести токен вручную</span>
                </button>
                <button
                  onClick={handleCopyTokenCommand}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono font-semibold text-white"
                  title="Выполнять в PowerShell из любой папки, не в консоли Discord"
                >
                  Скопировать команду PowerShell
                </button>
              </div>
              <p className="mt-3 text-[11px] text-white/50">Запустите команду в PowerShell из любой папки, затем вставьте токен в поле «Вручную». Не вставляйте её в консоль браузера Discord.</p>
            </GlassCard>
          ) : (
            /* Personal Quests List */
            <GlassCard
              delay={40}
              animKey={animKey}
              hoverLift={true}
              className="p-3.5 px-4 flex-1 min-h-0 flex flex-col justify-between"
            >
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-purple-300" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                     {questFilter === 'all' ? 'Все задания' : questFilter === 'enrolled' ? 'Принятые квесты' : 'Доступные задания'} ({visibleQuests.length})
                  </h3>
                </div>

                <button
                  onClick={() => loadPersonalQuests()}
                  disabled={isLoadingPersonal}
                  className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white/80 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-purple-300 ${isLoadingPersonal ? 'animate-spin' : ''}`} />
                  <span>{isLoadingPersonal ? 'Загрузка...' : 'Обновить'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3 text-xs shrink-0">
                 {(['all', 'enrolled', 'available'] as const).map(filter => (
                  <button key={filter} onClick={() => setQuestFilter(filter)} aria-pressed={questFilter === filter}
                    className={`px-3 py-1.5 rounded-lg border hover:bg-white/15 ${questFilter === filter ? 'bg-purple-500/20 border-purple-400/40 text-purple-100' : 'border-white/15 text-white/60'}`}>
                     {filter === 'all' ? 'Все' : filter === 'enrolled' ? 'Мои квесты' : 'Доступные'}
                  </button>
                ))}
                <span className="text-white/45">Истёкшие и исключённые Discord задания скрыты</span>
              </div>
              {(quest.queue?.length || quest.queueError) && (
                <div className="mb-3 rounded-xl border border-purple-400/25 bg-purple-500/10 p-2 text-xs shrink-0">
                  <div className="font-semibold text-purple-200 mb-1">Очередь ПК-квестов (до закрытия Vapor)</div>
                  {quest.queue?.map((id, index) => (
                    <div key={id} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="truncate">{index + 1}. {personalQuests.find(q => q.id === id)?.questName || `Квест ${id}`}</span>
                      <button type="button" onClick={() => changeQueue(id, true)} className="text-rose-200 hover:text-white" aria-label={`Убрать квест ${id} из очереди`}>Убрать</button>
                    </div>
                  ))}
                  {quest.queueError && <div role="alert" className="text-amber-200 flex items-center gap-2">{quest.queueError}{quest.queueRetrying && ' · Повтор автоматически через 30 секунд'}
                  </div>}
                  {!isRunning && !!quest.queue?.length && !quest.queueRetrying && <button type="button" onClick={async () => {
                      try {
                      const res = await fetch('/api/discord/quest/queue/resume', { method: 'POST' });
                      const data = await res.json();
                      if (!data.success) addLog?.('ERROR', data.quest?.queueError || 'Не удалось возобновить очередь');
                      fetchDiscordStatus?.();
                      } catch (e: any) { addLog?.('ERROR', e.message); }
                    }} className="underline">{quest.queueError ? 'Повторить' : 'Продолжить очередь'}</button>}
                  </div>
              )}

              {/* Quests Container */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1.5 custom-scrollbar">
                {isLoadingPersonal ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-white/50 font-mono text-xs gap-3">
                    <RefreshCw className="w-7 h-7 text-purple-300 animate-spin" />
                    <span>Загрузка персональных заданий из Discord...</span>
                  </div>
                ) : personalError ? (
                  <div role="alert" className="h-full flex flex-col items-center justify-center p-8 text-center text-rose-200 font-mono text-xs gap-3">
                    <AlertTriangle className="w-7 h-7" />
                    <span>Не удалось проверить квесты Discord: {personalError}</span>
                    <button onClick={() => loadPersonalQuests()} className="px-3 py-1 rounded-lg border border-white/20">Повторить</button>
                  </div>
                ) : visibleQuests.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white/[0.02] rounded-2xl border border-white/10">
                    <Gift className="w-10 h-10 text-purple-300/40 mb-3" />
                     <h4 className="text-sm font-semibold text-white/80">{questFilter === 'enrolled' ? 'Нет принятых активных квестов' : 'Нет доступных заданий'}</h4>
                    <p className="text-xs text-white/40 font-mono mt-1 max-w-md">
                       {questFilter === 'enrolled' ? 'Примите задание в Discord или в разделе «Доступные», затем обновите список.' : 'Discord не вернул действующих заданий для этого аккаунта.'}
                    </p>
                  </div>
                ) : (
                  visibleQuests.map((q) => {
                    const isThisRunning = isRunning && quest.questId === q.id;
                    const task = q.tasks?.find((t: any) => t.type === taskChoices[q.id])
                      || q.tasks?.find((t: any) => t.type.startsWith('PLAY_ON_DESKTOP'))
                      || q.tasks?.[0];
                    const rewardPlatform = q.rewardPlatforms?.length === 1 ? q.rewardPlatforms[0] : rewardChoices[q.id];
                    const isEnrolled = Boolean(q.isEnrolled);
                    const isCompleted = Boolean(q.isCompleted);
                    const isClaimed = Boolean(q.isClaimed);
                    const isActionLoading = actionLoadingId === q.id;

                    return (
                      <div
                        key={q.id}
                        className="surface-tile p-3.5 rounded-2xl border border-white/15 hover:border-white/30 flex flex-col gap-2.5 transition-[border-color] duration-200"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0 mt-0.5">
                              <Gift className="w-5 h-5 text-purple-300" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white truncate">
                                  {q.questName || q.gameName}
                                </span>
                                {isClaimed ? (
                                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[10px] font-mono font-bold">
                                    НАГРАДА ПОЛУЧЕНА
                                  </span>
                                ) : isCompleted ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold">
                                    ВЫПОЛНЕН
                                  </span>
                                ) : isEnrolled ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-mono font-bold">
                                    ПРИНЯТ
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/20 text-[10px] font-mono">
                                    НЕ ПРИНЯТ
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-mono text-white/50 flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-purple-300 font-semibold">{q.rewardTitle}</span>
                                <span>•</span>
                                <span>{q.gameName}{q.exe ? ` (${q.exe})` : ''}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-white/40" />
                                  <span>{formatExpiry(q.expiresAt)}</span>
                                </span>
                              </div>
                              {isEnrolled && !isCompleted && q.tasks?.length > 0 && (
                                <label className="flex items-center gap-2 mt-2 text-xs text-white/70">
                                  Выполнять на:
                                  <select aria-label={`Платформа выполнения ${q.questName}`} value={task?.type || ''}
                                    disabled={isThisRunning || isStartingQuest}
                                    onChange={e => setTaskChoices(prev => ({ ...prev, [q.id]: e.target.value }))}
                                    className="bg-slate-800 border border-white/20 rounded-lg px-2 py-1 text-white">
                                    {q.tasks.map((t: any) => <option key={t.type} value={t.type}>{t.type.startsWith('PLAY_ON_DESKTOP') ? 'ПК' : t.type === 'PLAY_ON_XBOX' ? 'Xbox' : 'PlayStation'}</option>)}
                                  </select>
                                </label>
                              )}
                              {isCompleted && q.canClaim && (
                                <label className="flex items-center gap-2 mt-2 text-xs text-white/70">
                                  Платформа награды:
                                  <select aria-label={`Платформа награды ${q.questName}`} value={rewardPlatform ?? ''}
                                    onChange={e => setRewardChoices(prev => ({ ...prev, [q.id]: Number(e.target.value) }))}
                                    className="bg-slate-800 border border-white/20 rounded-lg px-2 py-1 text-white">
                                    {q.rewardPlatforms?.length > 1 && <option value="" disabled>Выберите</option>}
                                    {q.rewardPlatforms?.map((p: number) => <option key={p} value={p}>{['Любая', 'Xbox', 'PlayStation', 'Switch', 'ПК'][p]}</option>)}
                                  </select>
                                </label>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isClaimed ? (
                              q.claimedCode ? (
                                <button
                                  onClick={() => {
                                    navigator.clipboard?.writeText(q.claimedCode);
                                    setCopiedCodeId(q.id);
                                    setTimeout(() => setCopiedCodeId(null), 2000);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-xs font-mono text-sky-200 flex items-center gap-1.5 transition-all cursor-pointer"
                                  title="Скопировать код награды"
                                >
                                  {copiedCodeId === q.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Скопировано!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 text-sky-300" />
                                      <span>Код: {q.claimedCode}</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-xs font-mono text-white/40 px-2 py-1">Награда начислена</span>
                              )
                            ) : isCompleted && q.canClaim ? (
                              <button
                                onClick={() => handleClaimQuest(q.id, q.questName || q.gameName, rewardPlatform)}
                                disabled={isActionLoading || rewardPlatform == null}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/40 text-xs font-mono font-bold text-emerald-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                              >
                                <Gift className="w-3.5 h-3.5" />
                                <span>{isActionLoading ? 'Запрос...' : 'Забрать награду'}</span>
                              </button>
                            ) : isCompleted ? (
                              <span className="text-xs text-white/50">Срок получения награды истёк</span>
                            ) : !isEnrolled ? (
                              <button
                                onClick={() => handleEnrollQuest(q.id, q.questName || q.gameName)}
                                disabled={isActionLoading || q.isExpired}
                                className="px-3.5 py-1.5 rounded-xl bg-purple-500/25 hover:bg-purple-500/35 border border-purple-400/40 text-xs font-mono font-bold text-purple-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{isActionLoading ? 'Принятие...' : 'Принять квест'}</span>
                              </button>
                            ) : isThisRunning ? (
                              <button
                                onClick={handleStop}
                                className="px-3.5 py-1.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/40 text-xs font-mono font-bold text-rose-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>Остановить</span>
                              </button>
                            ) : (
                              <>
                              <button
                                onClick={() => task?.type.startsWith('PLAY_ON_DESKTOP')
                                  ? handleStart(q.gameName, q.exe, Math.max(1, Math.ceil((task.targetSeconds - task.progressSeconds) / 60)), task.applicationId, q.id, task.type)
                                  : handleConsoleStart(q.id, task.type)}
                                disabled={isStartingQuest || isRunning || !task || (task.type.startsWith('PLAY_ON_DESKTOP') && !q.supportsDesktopPlay) || q.isExpired}
                                title={task?.type.startsWith('PLAY_ON_DESKTOP') ? 'Запустить игру и отслеживать прогресс Discord' : 'Запустить на привязанной к Discord консоли'}
                                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/30 to-indigo-500/30 hover:from-purple-500/40 hover:to-indigo-500/40 border border-purple-400/50 text-xs font-mono font-bold text-purple-100 flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Начать квест</span>
                              </button>
                              {q.supportsDesktopPlay && !quest.queue?.includes(q.id) && (
                                <button type="button" onClick={() => changeQueue(q.id)} disabled={isStartingQuest}
                                  className="px-2.5 py-1.5 rounded-xl border border-purple-400/40 text-purple-100 text-xs hover:bg-purple-500/20 disabled:opacity-40">ПК в очередь</button>
                              )}
                              {quest.queue?.includes(q.id) && <span className="text-xs text-purple-200">В очереди</span>}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono text-white/50">
                            <span>Прогресс Discord: {formatTimer(task?.progressSeconds ?? q.progressSeconds)} / {formatTimer(task?.targetSeconds ?? q.targetSeconds)} · {task?.type || q.taskType || 'тип не определён'}</span>
                            <span className="font-bold text-purple-300">{task?.targetSeconds ? Math.min(100, Math.round(task.progressSeconds / task.targetSeconds * 100)) : q.percent}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-300"
                              style={{ width: `${task?.targetSeconds ? Math.min(100, Math.round(task.progressSeconds / task.targetSeconds * 100)) : Math.min(100, Math.max(0, q.percent || 0))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Info Sub-bar */}
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  <span>Discord Quests Protocol Active</span>
                  <span className="text-white/20">•</span>
                  <span>Поддержка автопринятия и получения наград</span>
                </div>
                <span>Vapor Quests Engine</span>
              </div>
            </GlassCard>
          )}
        </div>
      ) : (
        /* Mode B: Catalog of Games (.exe) without token */
        <GlassCard
          delay={40}
          animKey={animKey}
          hoverLift={true}
          className="p-3.5 px-4 flex-1 min-h-0 flex flex-col justify-between"
        >
          {/* Search & Custom Launcher Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-3 shrink-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск популярной игры или имени .exe..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-purple-400/50"
              />
            </div>

            {/* Custom Exe Launcher */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={customGameName}
                onChange={(e) => setCustomGameName(e.target.value)}
                placeholder="Название игры (опц.)..."
                className="w-36 px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-purple-400/50"
              />
              <input
                type="text"
                value={customExeName}
                onChange={(e) => setCustomExeName(e.target.value)}
                placeholder="Имя.exe..."
                className="w-36 px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-purple-400/50"
              />
              <button
                onClick={handleCustomLaunch}
                disabled={isStartingQuest || !customExeName.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/30 to-indigo-500/30 hover:from-purple-500/40 hover:to-indigo-500/40 border border-purple-400/50 text-xs font-mono font-bold text-purple-100 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Запустить .exe</span>
              </button>
            </div>
          </div>

          {/* Popular Games Grid */}
          <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredPopularGames.map((game) => {
                const isThisRunning = isRunning && (quest.exeName === game.exeName || quest.gameName === game.name);

                return (
                  <div
                    key={game.id}
                    className={`surface-tile p-3 rounded-2xl border transition-[border-color] duration-200 flex flex-col justify-between gap-2.5 ${
                      isThisRunning
                        ? 'bg-purple-500/20 border-purple-400/50 shadow-lg'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
                          <Gamepad2 className="w-4 h-4 text-purple-300" />
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 font-mono text-[10px] text-white/70">
                          {game.durationMinutes} мин
                        </span>
                      </div>

                      <div className="text-xs font-bold text-white truncate" title={game.name}>
                        {game.name}
                      </div>
                      <div className="text-[10px] text-white/50 truncate mt-0.5">
                        {game.banner}
                      </div>
                      <div className="text-[10px] font-mono text-purple-300/80 truncate mt-1">
                        {game.exeName}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/10">
                      {isThisRunning ? (
                        <button
                          onClick={handleStop}
                          className="w-full py-1.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/40 text-xs font-mono font-bold text-rose-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Остановить</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStart(game.name, game.exeName, game.durationMinutes)}
                          disabled={isStartingQuest}
                          className="w-full py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/35 text-xs font-mono font-semibold text-purple-200 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-40"
                        >
                          <Play className="w-3 h-3 fill-current" />
                           <span>Запустить процесс</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Sub-bar */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span>Примеры игр для эмуляции ({DEFAULT_FEED_GAMES.length}); не подтверждённые квесты</span>
              <span className="text-white/20">•</span>
              <span>Режим эмуляции процессов Win32</span>
            </div>
            <span>Vapor Quests Engine</span>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
