const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn, exec, execSync } = require('child_process');
const crypto = require('crypto');
const EventEmitter = require('events');
const net = require('net');
const { personalQuests } = require('./discordQuests');

const { DATA_DIR } = require('./paths');
const CACHE_FILE = path.join(DATA_DIR, 'discord_detectable.json');
const HISTORY_FILE = path.join(DATA_DIR, 'discord_history.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'discord_settings.json');
const DUMMY_SRC = path.join(__dirname, 'discord_dummy.exe');
// A binary-versioned directory avoids reusing locked copies of the old windowed emulator.
const DUMMIES_DIR = path.join(DATA_DIR, 'discord_dummies',
  fs.existsSync(DUMMY_SRC) ? crypto.createHash('sha256').update(fs.readFileSync(DUMMY_SRC)).digest('hex').slice(0, 12) : 'missing');
const FEED_FILE = path.join(DATA_DIR, 'discord_quests_feed.json');
const DESKTOP_USER_AGENT = `Vapor/1.0.0 Electron/${process.versions.electron || require('electron/package.json').version}`;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DUMMIES_DIR)) fs.mkdirSync(DUMMIES_DIR, { recursive: true });

class DiscordIpcClient extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.isConnected = false;
    this.clientId = null;
    this.currentActivity = null;
    this.user = null;
    this.generation = 0;
    this.activityVersion = 0;
  }

  connect(clientId = '432980957394370572') {
    const id = String(clientId);
    if (this.clientId === id && this.isConnected) return Promise.resolve(true);
    if (this.clientId === id && this.connectPromise) return this.connectPromise;
    this.disconnect();
    this.clientId = id;
    const generation = this.generation;
    this.connectPromise = this.openPipe(id, generation).finally(() => {
      if (this.generation === generation) this.connectPromise = null;
    });
    return this.connectPromise;
  }

  openPipe(clientId, generation) {
    return new Promise((resolve) => {
      let found = false;
      const tryPipe = (index) => {
        if (index > 9 || found || generation !== this.generation) {
          if (!found) resolve(false);
          return;
        }

        const pipePath = `\\\\?\\pipe\\discord-ipc-${index}`;
        const sock = net.connect(pipePath);
        this.pendingSocket = sock;
        sock.setTimeout(3000, () => sock.destroy(new Error('Discord IPC timeout')));

        sock.once('connect', () => {
          if (generation !== this.generation) {
            sock.destroy();
            resolve(false);
            return;
          }
          found = true;
          this.socket = sock;
          this.pendingSocket = null;
          sock.setTimeout(0);
          this.setupSocketEvents(sock);
          this.sendHandshake(clientId);
          resolve(true);
        });

        sock.once('error', () => {
          sock.destroy();
          if (!found) tryPipe(index + 1);
        });
        sock.once('close', () => {
          if (generation !== this.generation) resolve(false);
        });
      };

      tryPipe(0);
    });
  }

  setupSocketEvents(sock) {
    let buffer = Buffer.alloc(0);
    sock.on('data', (data) => {
      if (this.socket !== sock) return;
      buffer = Buffer.concat([buffer, data]);
      while (buffer.length >= 8) {
        const op = buffer.readInt32LE(0);
        const len = buffer.readInt32LE(4);
        if (len < 0 || len > 1024 * 1024) {
          sock.destroy();
          return;
        }
        if (buffer.length < 8 + len) return;
        const rawJson = buffer.subarray(8, 8 + len).toString('utf8');
        buffer = buffer.subarray(8 + len);
        if (op === 3) {
          this.writePacket(4, rawJson);
          continue;
        }
        if (op === 2) {
          sock.destroy();
          return;
        }
        try {
          const parsed = JSON.parse(rawJson);
          if (parsed.evt === 'READY') {
            this.isConnected = true;
            this.user = parsed.data?.user || null;
            this.emit('ready', this.user);
            if (this.currentActivity) this.sendFrame('SET_ACTIVITY', this.currentActivity);
          }
        } catch (e) {}
      }
    });

    sock.on('close', () => {
      if (this.socket !== sock) return;
      this.isConnected = false;
      this.socket = null;
    });

    sock.on('error', () => {
      if (this.socket !== sock) return;
      this.isConnected = false;
      this.socket = null;
    });
  }

  sendHandshake(clientId) {
    const payload = JSON.stringify({ v: 1, client_id: String(clientId) });
    this.writePacket(0, payload);
  }

  sendFrame(cmd, args) {
    const payload = JSON.stringify({
      cmd,
      args,
      nonce: String(Date.now() + Math.random())
    });
    this.writePacket(1, payload);
  }

  writePacket(op, payloadStr) {
    if (!this.socket || this.socket.destroyed) return;
    const byteLen = Buffer.byteLength(payloadStr);
    const buf = Buffer.alloc(8 + byteLen);
    buf.writeInt32LE(op, 0);
    buf.writeInt32LE(byteLen, 4);
    buf.write(payloadStr, 8);
    try {
      this.socket.write(buf);
    } catch (e) {}
  }

  async setActivity(gameOrId, customOptions = {}, targetPid = null) {
    if (!gameOrId) return;

    let appId = '432980957394370572';
    let gameName = 'Game';

    if (typeof gameOrId === 'string') {
      if (/^\d+$/.test(gameOrId)) {
        appId = gameOrId;
      }
      gameName = customOptions.details || customOptions.gameName || customOptions.state || 'Game';
    } else if (gameOrId && typeof gameOrId === 'object') {
      if (gameOrId.id && /^\d+$/.test(String(gameOrId.id))) appId = String(gameOrId.id);
      if (gameOrId.name) gameName = gameOrId.name;
    }

    // Connect before capturing the version: disconnect invalidates pending activity.
    const connection = this.connect(appId);
    const version = ++this.activityVersion;
    const connected = await connection;
    if (!connected || version !== this.activityVersion) return false;

    const pid = (targetPid && typeof targetPid === 'number') ? targetPid : process.pid;

    const activityArgs = {
      pid,
      activity: {
        name: gameName,
        details: customOptions.details || gameName,
        state: customOptions.state || 'В игре (Vapor Spoofer)',
        timestamps: customOptions.timestamps || { start: Math.floor(Date.now() / 1000) },
        instance: true
      }
    };

    this.currentActivity = activityArgs;
    if (this.isConnected) {
      this.sendFrame('SET_ACTIVITY', activityArgs);
    }
  }

  clearActivity() {
    this.activityVersion += 1;
    const pid = this.currentActivity?.pid || process.pid;
    this.currentActivity = null;
    if (this.socket && this.isConnected) {
      this.sendFrame('SET_ACTIVITY', { pid, activity: null });
    }
  }

  disconnect() {
    this.generation += 1;
    this.clearActivity();
    this.pendingSocket?.destroy();
    this.pendingSocket = null;
    this.connectPromise = null;
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch (e) {}
      this.socket = null;
    }
    this.isConnected = false;
    this.user = null;
  }
}

function sanitizeExeName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let trimmed = raw.trim().replace(/^>+/, '').trim();
  if (!trimmed) return null;

  // Use only file basename
  trimmed = trimmed.replace(/\\/g, '/');
  const parts = trimmed.split('/');
  let base = parts[parts.length - 1];

  // Remove illegal characters
  base = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  base = base.replace(/[. ]+$/, '');
  if (!base) return null;

  if (!base.toLowerCase().endsWith('.exe')) {
    base += '.exe';
  }
  return base;
}

class DiscordManager extends EventEmitter {
  constructor() {
    super();

    this.games = [];
    this.history = new Set();
    this.settings = { mode: 'process' };
    this.ipcClient = new DiscordIpcClient();
    this.isFetchingGames = false;
    this.discordClientDetected = false;
    this.userToken = null;
    this.tokenUser = null;

    this.loadSettings();

    // Variety Spoofer State
    this.variety = {
      isRunning: false,
      batchSize: 8,
      holdSeconds: 15,
      currentBatch: [],
      currentIndex: 0,
      totalEligible: 0,
      playedCount: 0,
      elapsedBatchSeconds: 0,
      mode: this.settings.mode, // 'process' | 'rpc'
      timerId: null,
      batchProcesses: [],
      loopMode: true,
      cycleCount: 1
    };

    // Hours Farm State
    this.farm = {
      isRunning: false,
      selectedGameIds: [],
      activeGames: [],
      elapsedSeconds: 0,
      targetDurationMinutes: null,
      mode: this.settings.mode,
      timerId: null,
      farmProcesses: []
    };

    // Discord Quest Auto-Completer State
    this.quest = {
      isRunning: false,
      gameId: null,
      gameName: '',
      exeName: '',
      targetDurationMinutes: 15,
      elapsedSeconds: 0,
      percent: 0,
      mode: this.settings.mode || 'process',
      timerId: null,
      questProcess: null,
      startedAt: null,
      questId: null,
      progressSeconds: 0,
      initialProgressSeconds: 0,
      targetSeconds: 0,
      verified: false,
      lastVerifiedAt: null,
      progressError: null,
      progressWarning: null,
      nextHeartbeatAt: 0,
      pollTimer: null,
      pollPromise: null
    };
    // shortcut: the queue lives only for this server session; persist it if restart recovery is needed.
    this.questQueue = [];
    this.questQueueOwner = null;
    this.questQueueError = null;
    this.questQueueWorking = false;
    this.questQueueRetryTimer = null;

    this.loadHistory();
    this.loadCachedGames();
    if (process.env.VAPOR_OFFLINE !== '1') {
      this.checkDiscordRunning();
      this.monitorTimer = setInterval(() => this.checkDiscordRunning(), 5000);
      this.monitorTimer.unref();
    }
  }

  log(level, message) {
    const logObj = {
      level: level.toLowerCase(),
      message,
      timestamp: new Date().toLocaleTimeString('ru-RU')
    };
    this.emit('discord_log', logObj);
  }

  loadSettings() {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed) {
          if (parsed.mode === 'process' || parsed.mode === 'rpc') {
            this.settings.mode = parsed.mode;
          }
          if (parsed.userToken && typeof parsed.userToken === 'string') {
            this.userToken = parsed.userToken.trim();
            this.settings.userToken = this.userToken;
          }
        }
      }
    } catch (e) {
      this.settings = { mode: 'process' };
    }
  }

  saveSettings() {
    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (e) {}
  }

  setMode(mode) {
    if (!['rpc', 'process'].includes(mode)) throw new Error('Неизвестный режим Discord');
    if (mode !== this.settings.mode && (this.variety.isRunning || this.farm.isRunning || this.quest.isRunning)) {
      throw new Error('Остановите активную сессию перед сменой режима');
    }
    const valid = mode;
    this.settings.mode = valid;
    this.variety.mode = valid;
    this.farm.mode = valid;
    this.saveSettings();
    this.log(
      'info',
      `Метод спуфера Discord установлен: ${valid === 'rpc' ? 'Discord IPC Socket (RPC)' : 'Win32 Process Spoofer'}`
    );
    this.emit('discord_status', this.getStatus());
    return { success: true, mode: valid };
  }

  loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.history = new Set(list.map(String));
        }
      }
    } catch (e) {
      this.history = new Set();
    }
  }

  saveHistory() {
    try {
      const list = Array.from(this.history);
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {}
  }

  resetHistory() {
    if (this.variety.isRunning) throw new Error('Остановите ротацию перед сбросом истории');
    this.history.clear();
    this.variety.cycleCount = 1;
    this.saveHistory();
    this.log('info', 'История сыгранных игр Discord сброшена (прогресс обнулен для нового круга).');
    this.emit('discord_status', this.getStatus());
  }

  loadCachedGames() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf8');
        const cached = JSON.parse(raw);
        if (Array.isArray(cached) && cached.length > 0) {
          this.processDetectableList(cached);
          this.log('info', `Загружено ${this.games.length} распознаваемых игр Discord из кэша.`);
          return;
        }
      }
    } catch (e) {}

    // If cache not present or invalid, fetch fresh from Discord
    if (process.env.VAPOR_OFFLINE !== '1') this.fetchDetectableGames();
  }

  async fetchDetectableGames() {
    if (this.isFetchingGames) return;
    this.isFetchingGames = true;
    this.log('info', 'Запрос актуальной базы игр с discord.com/api/v9/applications/detectable...');

    return new Promise((resolve) => {
      const options = {
        hostname: 'discord.com',
        path: '/api/v9/applications/detectable',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          this.log('warn', `Discord API ответил со статусом: ${res.statusCode}. Используем базовый каталог.`);
          this.isFetchingGames = false;
          resolve(this.games);
          return;
        }

        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          this.isFetchingGames = false;
          try {
            const rawList = JSON.parse(body);
            if (Array.isArray(rawList)) {
              fs.writeFileSync(CACHE_FILE, body, 'utf8');
              this.processDetectableList(rawList);
              this.log('success', `Успешно загружено и синхронизировано ${this.games.length} игр Discord!`);
            }
          } catch (err) {
            this.log('error', `Ошибка парсинга базы Discord: ${err.message}`);
          }
          resolve(this.games);
        });
      });

      req.on('error', (err) => {
        this.isFetchingGames = false;
        this.log('warn', `Не удалось обновить базу Discord: ${err.message}`);
        resolve(this.games);
      });

      req.setTimeout(20000, () => {
        req.destroy();
        this.isFetchingGames = false;
        resolve(this.games);
      });

      req.end();
    });
  }

  processDetectableList(rawList) {
    const processed = [];
    const seenIds = new Set();

    for (const app of rawList) {
      if (!app || !app.id || !app.name || seenIds.has(String(app.id))) continue;

      let winExe = null;
      if (Array.isArray(app.executables)) {
        for (const exe of app.executables) {
          if (exe.os === 'win32' && exe.name) {
            const sanitized = sanitizeExeName(exe.name);
            if (sanitized) {
              winExe = sanitized;
              break;
            }
          }
        }
      }

      const verifiedWindowsExecutable = Boolean(winExe);
      if (!winExe && Array.isArray(app.executables) && app.executables.length > 0) {
        winExe = sanitizeExeName(app.executables[0].name);
      }

      if (!winExe) {
        winExe = `${app.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.exe`;
      }

      seenIds.add(String(app.id));
      processed.push({
        id: String(app.id),
        name: app.name,
        exe: winExe,
        exeName: winExe,
        verifiedWindowsExecutable,
        iconHash: app.icon_hash || null,
        iconUrl: app.icon_hash
          ? `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon_hash}.png`
          : null
      });
    }

    this.games = processed;
  }

  checkDiscordRunning() {
    if (process.platform !== 'win32' || this.shuttingDown) return;
    exec('tasklist /FI "IMAGENAME eq Discord*" /NH', { windowsHide: true }, (err, stdout) => {
      if (this.shuttingDown) return;
      const running = Boolean(!err && stdout && stdout.toLowerCase().includes('discord'));
      if (running !== this.discordClientDetected) {
        this.discordClientDetected = running;
        if (running) {
          this.log('info', 'Клиент Discord запущен и готов к фиксации активности!');
          this.ipcClient.connect(this.ipcClient.clientId || undefined).catch(() => {});
        } else {
          this.log('warn', 'Приложение Discord для ПК не обнаружено. Запустите Discord для начисления значков.');
          if (this.quest.isRunning) this.stopQuest(false);
          if (this.farm.isRunning) this.stopFarm();
          if (this.variety.isRunning) this.stopVariety();
          this.ipcClient.disconnect();
        }
        this.emit('discord_status', this.getStatus());
      } else if (running && !this.ipcClient.isConnected) {
        this.ipcClient.connect(this.ipcClient.clientId || undefined).catch(() => {});
      }
    });
  }

  getStatus() {
    const playedCount = this.history.size;
    const totalCount = this.games.length;
    const varietyPercent = totalCount > 0 ? Number(((playedCount / totalCount) * 100).toFixed(1)) : 0;

    return {
      mode: this.settings.mode || 'process',
      isDiscordRunning: this.discordClientDetected,
      discordUser: this.ipcClient.user || null,
      totalDetectableGames: totalCount,
      playedCount,
      varietyPercent,
      variety: {
        isRunning: this.variety.isRunning,
        batchSize: this.variety.batchSize,
        holdSeconds: this.variety.holdSeconds,
        currentIndex: this.variety.currentIndex,
        totalEligible: this.games.filter((g) => !this.history.has(g.id)).length,
        currentBatch: this.variety.currentBatch,
        elapsedBatchSeconds: this.variety.elapsedBatchSeconds,
        mode: this.settings.mode || 'process',
        loopMode: this.variety.loopMode !== false,
        cycleCount: this.variety.cycleCount || 1
      },
      farm: {
        isRunning: this.farm.isRunning,
        isFarming: this.farm.isRunning,
        selectedCount: this.farm.selectedGameIds.length,
        activeGames: this.farm.activeGames,
        elapsedSeconds: this.farm.elapsedSeconds,
        multiplier: this.farm.activeGames.length,
        targetDurationMinutes: this.farm.targetDurationMinutes,
        mode: this.settings.mode || 'process'
      },
      hourFarm: {
        isRunning: this.farm.isRunning,
        isFarming: this.farm.isRunning,
        selectedCount: this.farm.selectedGameIds.length,
        activeGames: this.farm.activeGames,
        elapsedSeconds: this.farm.elapsedSeconds,
        multiplier: this.farm.activeGames.length,
        targetDurationMinutes: this.farm.targetDurationMinutes,
        mode: this.settings.mode || 'process'
      },
      quest: {
        isRunning: this.quest.isRunning,
        gameId: this.quest.gameId,
        gameName: this.quest.gameName,
        exeName: this.quest.exeName,
        targetDurationMinutes: this.quest.targetDurationMinutes,
        elapsedSeconds: this.quest.elapsedSeconds,
        remainingSeconds: this.quest.targetDurationMinutes ? Math.max(0, this.quest.targetDurationMinutes * 60 - this.quest.elapsedSeconds) : 0,
        percent: this.quest.percent,
        startedAt: this.quest.startedAt,
        questId: this.quest.questId,
        progressSeconds: this.quest.progressSeconds,
        targetSeconds: this.quest.targetSeconds,
        verified: this.quest.verified,
        lastVerifiedAt: this.quest.lastVerifiedAt,
        progressError: this.quest.progressError,
        progressWarning: this.quest.progressWarning,
        mode: this.quest.mode,
        taskType: this.quest.taskType || null,
        queue: this.questQueue,
        queueError: this.questQueueError,
        queueRetrying: Boolean(this.questQueueRetryTimer),
        hasUserToken: Boolean(this.userToken),
        tokenUser: this.tokenUser || null
      }
    };
  }

  getGames(query = '', page = 1, pageSize = 60, filter = 'all') {
    page = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    pageSize = Number.isFinite(pageSize) ? Math.max(1, Math.min(200, Math.floor(pageSize))) : 60;
    query = typeof query === 'string' ? query : '';
    let list = this.games;

    if (filter === 'played') {
      list = list.filter((g) => this.history.has(g.id));
    } else if (filter === 'unplayed') {
      list = list.filter((g) => !this.history.has(g.id));
    }

    if (query) {
      const q = query.toLowerCase().trim();
      list = list.filter((g) => g.name.toLowerCase().includes(q) || g.exe.toLowerCase().includes(q) || g.id.includes(q));
    }

    const total = list.length;
    const startIndex = (page - 1) * pageSize;
    const paged = list.slice(startIndex, startIndex + pageSize).map((g) => ({
      ...g,
      isPlayed: this.history.has(g.id)
    }));

    return {
      total,
      page,
      pageSize,
      games: paged
    };
  }

  // --- VARIETY SPOOFER (GAME VARIETY BADGE) ---

  startVariety(batchSize = 1, holdSeconds = 15, mode = null, loopMode = true) {
    if (this.variety.isRunning) return;
    if (!this.discordClientDetected) throw new Error('Запустите клиент Discord для ПК');
    if (!this.games.length) throw new Error('База игр ещё не загружена');
    if (this.farm.isRunning || this.quest.isRunning) throw new Error('Сначала остановите другую активность Discord');

    this.variety.batchSize = Math.max(1, Math.min(16, Math.floor(Number(batchSize) || 1)));
    this.variety.holdSeconds = Math.max(5, Math.min(60, Number(holdSeconds) || 15));
    this.variety.loopMode = loopMode !== false;
    if (mode) {
      this.setMode(mode);
    }

    // If 100% full (no unplayed games left in database), automatically reset history for a new cycle!
    const unplayed = this.games.filter((g) => !this.history.has(g.id));
    if (unplayed.length === 0) {
      this.variety.cycleCount = (this.variety.cycleCount || 1) + 1;
      this.history.clear();
      this.saveHistory();
      this.log(
        'info',
        `База игр Discord была полностью пройдена (100%). Автоматический сброс истории: запуск круга ${this.variety.cycleCount}...`
      );
    }

    this.variety.isRunning = true;
    this.variety.elapsedBatchSeconds = 0;

    this.log(
      'info',
      `Запуск прокачки значка «Универсал» [${this.settings.mode === 'rpc' ? 'Discord IPC Socket (RPC)' : 'Win32 Process Spoofer'}]: батчи по ${this.variety.batchSize} игр, интервал ${this.variety.holdSeconds}с, режим: ${this.variety.loopMode ? 'бесконечный цикл' : 'один круг'}.`
    );

    this.emit('discord_status', this.getStatus());
    this.runNextVarietyBatch();
  }

  runNextVarietyBatch() {
    if (!this.variety.isRunning) return;

    // Pick games not yet in history
    let eligible = this.games.filter((g) => !this.history.has(g.id));
    if (eligible.length === 0) {
      if (this.variety.loopMode !== false) {
        this.variety.cycleCount = (this.variety.cycleCount || 1) + 1;
        this.log('info', `Круг прокачки завершен (100%)! Автоматический переход на круг ${this.variety.cycleCount}...`);
        this.history.clear();
        this.saveHistory();
        eligible = this.games;
      } else {
        this.log('success', 'Поздравляем! Все распознаваемые игры Discord пройдены!');
        this.stopVariety();
        return;
      }
    }

    // Pick distinct executable names for this batch
    const batch = [];
    const usedExes = new Set();
    for (const g of eligible) {
      if (!usedExes.has(g.exe)) {
        usedExes.add(g.exe);
        batch.push(g);
        if (batch.length >= this.variety.batchSize) break;
      }
    }

    if (batch.length === 0) {
      this.log('warn', 'Нет доступных игр для запуска следующего батча.');
      this.stopVariety();
      return;
    }

    this.variety.currentBatch = batch;
    this.variety.elapsedBatchSeconds = 0;
    this.variety.lastRpcGameId = null;

    this.log(
      'info',
      `Запуск батча (${batch.length} игр): ${batch.map((g) => g.name).join(', ')}...`
    );

    // Apply spoofing depending on active mode
    if (this.settings.mode === 'rpc') {
      this.cleanupBatchProcesses();
      this.ipcClient.setActivity(batch[0]);
      this.variety.lastRpcGameId = batch[0].id;
      this.log('info', `[Discord IPC] Установлена активность: "${batch[0].name}"`);
    } else {
      this.ipcClient.clearActivity();
      this.spawnBatchProcesses(batch);
    }

    this.emit('discord_status', this.getStatus());

    // Batch countdown timer
    if (this.variety.timerId) clearInterval(this.variety.timerId);
    this.variety.timerId = setInterval(() => {
      if (!this.variety.isRunning) {
        clearInterval(this.variety.timerId);
        this.variety.timerId = null;
        return;
      }

      this.variety.elapsedBatchSeconds += 1;

      // In RPC mode with multiple games in batch: rotate active game so every game is broadcast
      if (this.settings.mode === 'rpc' && batch.length > 1) {
        const subInterval = Math.max(3, Math.floor(this.variety.holdSeconds / batch.length));
        const subIndex = Math.floor(this.variety.elapsedBatchSeconds / subInterval) % batch.length;
        const targetGame = batch[subIndex];
        if (targetGame && this.variety.lastRpcGameId !== targetGame.id) {
          this.variety.lastRpcGameId = targetGame.id;
          this.ipcClient.setActivity(targetGame);
        }
      }

      this.emit('discord_variety_tick', {
        elapsed: this.variety.elapsedBatchSeconds,
        elapsedBatchSeconds: this.variety.elapsedBatchSeconds,
        holdSeconds: this.variety.holdSeconds,
        currentBatch: this.variety.currentBatch,
        playedTotal: this.history.size,
        playedCount: this.history.size,
        cycleCount: this.variety.cycleCount || 1
      });

      if (this.variety.elapsedBatchSeconds >= this.variety.holdSeconds) {
        clearInterval(this.variety.timerId);
        this.variety.timerId = null;

        // Mark batch as played
        for (const g of batch) {
          this.history.add(g.id);
        }
        this.saveHistory();

        this.log(
          'success',
          `Ротация батча завершена: ${batch.length} процессов. Прогресс значка Discord не подтверждён (${this.history.size} игр в локальной истории).`
        );

        if (this.settings.mode === 'rpc') {
          // Do not send clearActivity before next batch to prevent Gateway rate-limits
        } else {
          this.cleanupBatchProcesses();
        }

        // Show wave transition state cleanly in UI
        this.variety.currentBatch = [];
        this.variety.elapsedBatchSeconds = 0;
        this.emit('discord_status', this.getStatus());

        // 2.5s safe transition interval so Discord game detector cleanly registers process change
        this.variety.transitionTimer = setTimeout(() => {
          this.variety.transitionTimer = null;
          if (this.variety.isRunning) {
            this.runNextVarietyBatch();
          }
        }, 2500);
      }
    }, 1000);
  }

  spawnBatchProcesses(batch) {
    this.cleanupBatchProcesses();

    for (const game of batch) {
      try {
        const dummyExePath = path.join(DUMMIES_DIR, game.exe);
        let needCopy = true;
        if (fs.existsSync(dummyExePath)) {
          try {
            const srcSize = fs.statSync(DUMMY_SRC).size;
            const dstSize = fs.statSync(dummyExePath).size;
            if (srcSize === dstSize) needCopy = false;
          } catch (e) {}
        }

        if (needCopy && fs.existsSync(DUMMY_SRC)) {
          try {
            fs.copyFileSync(DUMMY_SRC, dummyExePath);
          } catch (e) {
            // In case file is locked by previous closing process
          }
        }

        if (fs.existsSync(dummyExePath)) {
          const child = spawn(dummyExePath, [game.name], {
            detached: true,
            windowsHide: true,
            stdio: 'ignore'
          });
          child.on('error', (err) => {
            this.log('warn', `Не удалось запустить процесс ${game.exe}: ${err.message}`);
          });
          child.unref();
          if (child.pid) {
            this.variety.batchProcesses.push({ pid: child.pid, exePath: dummyExePath });
          }
        }
      } catch (e) {
        this.log('warn', `Ошибка подготовки процесса ${game.name}: ${e.message}`);
      }
    }
  }

  cleanupBatchProcesses() {
    if (this.variety.batchProcesses.length > 0) {
      for (const item of this.variety.batchProcesses) {
        try {
          if (item.pid) {
            exec(`taskkill /F /PID ${item.pid} /T`, { windowsHide: true }, () => {});
          }
        } catch (e) {}
      }
      this.variety.batchProcesses = [];
    }
  }

  stopVariety() {
    clearTimeout(this.variety.transitionTimer);
    this.variety.transitionTimer = null;
    if (!this.variety.isRunning) return;
    this.variety.isRunning = false;
    if (this.variety.timerId) {
      clearInterval(this.variety.timerId);
      this.variety.timerId = null;
    }
    this.ipcClient.clearActivity();
    this.cleanupBatchProcesses();
    this.variety.currentBatch = [];
    this.log('warn', 'Прокачка значка «Универсал» остановлена пользователем.');
    this.emit('discord_status', this.getStatus());
  }

  // --- FARM HOURS (GAME TIME MULTIPLIER) ---

  startFarm(gameIds = [], durationMinutes = null, mode = null) {
    if (this.variety.isRunning || this.quest.isRunning) throw new Error('Сначала остановите другую активность Discord');
    if (!this.discordClientDetected) throw new Error('Запустите клиент Discord для ПК');
    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      throw new Error('Не выбраны игры для фарма часов');
    }
    if (durationMinutes != null && (!Number.isFinite(Number(durationMinutes)) || Number(durationMinutes) <= 0)) {
      throw new Error('Длительность должна быть положительным числом');
    }

    const selected = [];
    const usedExes = new Set();
    for (const id of gameIds) {
      if (selected.length >= 20) break;
      const found = this.games.find((g) => g.id === String(id));
      if (found && !usedExes.has(found.exe)) {
        usedExes.add(found.exe);
        selected.push(found);
      }
    }

    if (selected.length === 0) {
      throw new Error('Не выбраны игры для фарма часов');
    }

    if (this.farm.isRunning) this.stopFarm();
    if (mode) this.setMode(mode);
    this.farm.isRunning = true;
    this.farm.selectedGameIds = selected.map((g) => g.id);
    this.farm.activeGames = selected;
    this.farm.elapsedSeconds = 0;
    this.farm.targetDurationMinutes = durationMinutes ? Number(durationMinutes) : null;

    this.log(
      'info',
      `Запуск эмуляции времени Discord [${this.settings.mode === 'rpc' ? 'Discord IPC (одна игра за раз)' : 'Win32 Process Spoofer'}]: ${selected.length} игр выбрано. Зачисление времени зависит от Discord.`
    );

    // Apply farm spoofing depending on active mode
    if (this.settings.mode === 'rpc') {
      this.cleanupFarmProcesses();
      this.ipcClient.setActivity(selected[0]);
      this.log(
        'info',
        `[Discord IPC] Фарм часов: установлена активность "${selected[0].name}" (+${selected.length - 1} в очереди)`
      );
    } else {
      this.ipcClient.clearActivity();
      this.spawnFarmProcesses(selected);
    }

    this.emit('discord_status', this.getStatus());

    if (this.farm.timerId) clearInterval(this.farm.timerId);
    this.farm.timerId = setInterval(() => {
      if (!this.farm.isRunning) {
        clearInterval(this.farm.timerId);
        return;
      }

      this.farm.elapsedSeconds += 1;

      this.emit('discord_farm_tick', {
        elapsedSeconds: this.farm.elapsedSeconds,
        multiplier: this.farm.activeGames.length,
        totalFarmSeconds: this.farm.elapsedSeconds * this.farm.activeGames.length
      });

      if (this.farm.targetDurationMinutes && this.farm.elapsedSeconds >= this.farm.targetDurationMinutes * 60) {
        this.log('success', `Таймер фарма часов завершен (${this.farm.targetDurationMinutes} мин)!`);
        this.stopFarm();
      }
    }, 1000);
  }

  spawnFarmProcesses(games) {
    this.cleanupFarmProcesses();

    for (const game of games) {
      try {
        const dummyExePath = path.join(DUMMIES_DIR, game.exe);
        let needCopy = true;
        if (fs.existsSync(dummyExePath)) {
          try {
            const srcSize = fs.statSync(DUMMY_SRC).size;
            const dstSize = fs.statSync(dummyExePath).size;
            if (srcSize === dstSize) needCopy = false;
          } catch (e) {}
        }

        if (needCopy && fs.existsSync(DUMMY_SRC)) {
          try {
            fs.copyFileSync(DUMMY_SRC, dummyExePath);
          } catch (e) {}
        }

        if (fs.existsSync(dummyExePath)) {
          const child = spawn(dummyExePath, [game.name], {
            detached: true,
            windowsHide: true,
            stdio: 'ignore'
          });
          child.on('error', (err) => {
            this.log('warn', `Не удалось запустить процесс ${game.exe}: ${err.message}`);
          });
          child.unref();
          if (child.pid) {
            this.farm.farmProcesses.push({ pid: child.pid, exePath: dummyExePath });
          }
        }
      } catch (e) {}
    }
  }

  cleanupFarmProcesses() {
    if (this.farm.farmProcesses.length > 0) {
      for (const item of this.farm.farmProcesses) {
        try {
          if (item.pid) {
            exec(`taskkill /F /PID ${item.pid} /T`, { windowsHide: true }, () => {});
          }
        } catch (e) {}
      }
      this.farm.farmProcesses = [];
    }
  }

  stopFarm() {
    if (!this.farm.isRunning) return;
    this.farm.isRunning = false;
    if (this.farm.timerId) {
      clearInterval(this.farm.timerId);
      this.farm.timerId = null;
    }
    this.ipcClient.clearActivity();
    this.cleanupFarmProcesses();
    this.farm.activeGames = [];
    this.log('warn', 'Фарм часов в Discord остановлен.');
    this.emit('discord_status', this.getStatus());
  }

  // --- DISCORD QUEST AUTO-COMPLETER ---

  async startQuest(gameName, exeName, durationMinutes = 15, gameId = null, mode = null, questId = null, taskType = null) {
    if (this.variety.isRunning || this.farm.isRunning) throw new Error('Сначала остановите другую активность Discord');
    if (this.preparingQuest) throw new Error('Запуск квеста уже выполняется');
    if (!exeName || typeof exeName !== 'string') {
      throw new Error('Исполняемый файл (.exe) не указан');
    }

    const sanitizedExe = sanitizeExeName(exeName);
    if (!sanitizedExe || /^(con|prn|aux|nul|com\d|lpt\d)\./i.test(sanitizedExe)) {
      throw new Error('Недопустимое имя исполняемого файла');
    }

    const cleanGameName = gameName && typeof gameName === 'string' ? gameName.trim() : sanitizedExe.replace(/\.exe$/i, '');
    const duration = (durationMinutes === null || durationMinutes === undefined || durationMinutes === 0 || durationMinutes === 'unlimited')
      ? null
      : Number(durationMinutes);
    if (duration !== null && (!Number.isFinite(duration) || duration <= 0 || duration > 1440)) {
      throw new Error('Длительность должна быть положительным числом');
    }
    if (process.platform !== 'win32' && process.env.VAPOR_OFFLINE !== '1') throw new Error('Эмуляция процессов для Discord доступна только в Windows');
    if (!this.discordClientDetected) throw new Error('Запустите клиент Discord для ПК перед началом квеста');
    if (!fs.existsSync(DUMMY_SRC)) throw new Error('Не найден исполняемый файл эмулятора Discord');

    this.preparingQuest = true;
    const questToken = this.userToken;
    let child;
    try {
      let personalQuest = null;
      if (questId != null) {
        if (!/^\d{1,25}$/.test(String(questId))) throw new Error('Некорректный ID квеста');
        const result = await this.fetchPersonalQuests();
        if (this.ipcClient.user?.id && this.tokenUser?.id !== this.ipcClient.user.id) {
          throw new Error('В клиенте Discord и Vapor подключены разные аккаунты');
        }
        personalQuest = result.quests.find(q => q.id === String(questId));
        if (!personalQuest) throw new Error('Квест больше не доступен в профиле Discord');
        if (!personalQuest.isEnrolled || personalQuest.isCompleted || personalQuest.isClaimed) {
          throw new Error('Квест необходимо принять; завершённый квест нельзя запускать повторно');
        }
        if (!personalQuest.supportsDesktopPlay) throw new Error('Для этого квеста не подтверждён запуск игры на ПК или отсутствует .exe в базе Discord');
        if (taskType && !personalQuest.tasks?.some(task => task.type === taskType && task.type.startsWith('PLAY_ON_DESKTOP'))) {
          throw new Error('Платформа ПК не доступна для этого квеста');
        }
        if (personalQuest.expiresAt && Date.parse(personalQuest.expiresAt) <= Date.now()) throw new Error('Срок действия квеста истёк');
        if (personalQuest.exe.toLowerCase() !== sanitizedExe.toLowerCase() ||
            personalQuest.applicationId !== String(gameId)) {
          throw new Error('Приложение и .exe не совпадают с текущим квестом Discord');
        }
      }
      const targetAppId = personalQuest?.applicationId
        || (gameId && /^\d+$/.test(String(gameId)) ? String(gameId) : null)
        || this.games.find(g => g.exe?.toLowerCase() === sanitizedExe.toLowerCase())?.id || null;
      fs.mkdirSync(DUMMIES_DIR, { recursive: true });
      const dummyExePath = path.join(DUMMIES_DIR, sanitizedExe);
      if (!fs.existsSync(dummyExePath) || fs.statSync(dummyExePath).size !== fs.statSync(DUMMY_SRC).size) {
        fs.copyFileSync(DUMMY_SRC, dummyExePath);
      }
      child = this.launchQuestProcess(dummyExePath, cleanGameName);
      await new Promise((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
      });
      if (!child.pid) throw new Error('Процесс эмулятора не получил PID');
      if (personalQuest && this.userToken !== questToken) throw new Error('Аккаунт Discord изменился во время запуска');
      if (this.quest.isRunning) this.stopQuest(false);

      const startedAt = Date.now();
      const desktopTask = personalQuest?.tasks?.find(task => task.type === (taskType || 'PLAY_ON_DESKTOP'))
        || personalQuest?.tasks?.find(task => task.type.startsWith('PLAY_ON_DESKTOP'));
      Object.assign(this.quest, {
        isRunning: true, gameId: targetAppId, questId: personalQuest?.id || null,
        gameName: personalQuest?.gameName || cleanGameName, exeName: sanitizedExe,
        targetDurationMinutes: duration, elapsedSeconds: 0, percent: desktopTask?.targetSeconds
          ? Math.min(100, Math.round(desktopTask.progressSeconds / desktopTask.targetSeconds * 100)) : personalQuest?.percent ?? 0,
        progressSeconds: desktopTask?.progressSeconds ?? personalQuest?.progressSeconds ?? 0,
        targetSeconds: desktopTask?.targetSeconds ?? personalQuest?.targetSeconds ?? 0,
        initialProgressSeconds: desktopTask?.progressSeconds ?? personalQuest?.progressSeconds ?? 0,
        verified: Boolean(personalQuest), lastVerifiedAt: personalQuest ? startedAt : null,
        progressError: null, progressWarning: null, nextHeartbeatAt: 0,
        taskType: taskType || personalQuest?.tasks?.find(task => task.type.startsWith('PLAY_ON_DESKTOP'))?.type || null,
        mode: 'process', startedAt,
        questProcess: { pid: child.pid, exePath: dummyExePath }
      });
      child.once('exit', () => {
        if (this.quest.questProcess?.pid === child.pid && this.quest.isRunning) {
          this.log('error', `Процесс ${sanitizedExe} завершился. Эмуляция квеста остановлена.`);
          this.stopQuest(false);
        }
      });
      child.unref();
      if (personalQuest) {
        await this.sendQuestHeartbeat();
        if (!this.quest.isRunning || this.quest.startedAt !== startedAt) {
          throw new Error('Запуск квеста отменён');
        }
        this.quest.nextHeartbeatAt = Date.now() + 20000;
      }
      // Presence is optional. A successful IPC packet is never proof of quest progress.
      if (targetAppId) this.ipcClient.setActivity(targetAppId, { gameName: cleanGameName, details: cleanGameName }, child.pid)
        .catch(err => this.log('warn', `Discord IPC: ${err.message}`));
      this.quest.timerId = setInterval(() => {
        if (!this.quest.isRunning || this.quest.startedAt !== startedAt) return;
        this.quest.elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        this.emit('discord_quest_tick', this.getStatus().quest);
        if (duration && this.quest.elapsedSeconds === Math.ceil(duration * 60) && !this.quest.questId) {
          this.log('warn', 'Таймер эмуляции истёк. Результат в Discord не подтверждён; процесс остаётся активным до остановки.');
        }
      }, 1000);
      if (personalQuest) {
        this.quest.pollTimer = setInterval(() => this.pollQuestProgress(startedAt), 20000);
        this.quest.pollTimer.unref?.();
      }
      this.log('info', `Процесс ${sanitizedExe} запущен (PID ${child.pid}). ${personalQuest ? 'Ожидание подтверждения прогресса от Discord.' : 'Без персонального квеста выполнение не подтверждается.'}`);
      this.emit('discord_status', this.getStatus());
      return this.getStatus().quest;
    } catch (err) {
      if (child?.pid && this.quest.questProcess?.pid === child.pid) this.stopQuest(false);
      if (child?.pid && this.quest.questProcess?.pid !== child.pid) {
        try { process.kill(child.pid); } catch {}
      }
      throw err;
    } finally {
      this.preparingQuest = false;
    }
  }

  launchQuestProcess(exePath, gameName) {
    // shortcut: a renamed process may not pass Discord game detection; use the real game if progress stays at zero.
    return spawn(exePath, [gameName], { detached: true, windowsHide: true, stdio: 'ignore' });
  }

  async enqueueQuest(questId) {
    if (!/^\d{1,25}$/.test(String(questId))) throw new Error('Некорректный ID квеста');
    const result = await this.fetchPersonalQuests();
    const quest = result.quests.find(q => q.id === String(questId));
    if (!quest?.isEnrolled || quest.isCompleted || quest.isExpired || !quest.supportsDesktopPlay) {
      throw new Error('В очередь можно добавить только принятый и доступный квест для ПК');
    }
    const owner = result.user?.id || this.tokenUser?.id;
    if (!owner) throw new Error('Не удалось подтвердить аккаунт Discord');
    if (this.questQueueOwner && this.questQueueOwner !== owner) throw new Error('Очередь принадлежит другому аккаунту');
    if (this.questQueue.length >= 20) throw new Error('Очередь заполнена (20 квестов)');
    if (this.questQueue.includes(quest.id) || this.quest.questId === quest.id) throw new Error('Этот квест уже запущен или находится в очереди');
    if (!this.questQueue.length) this.questQueueError = null;
    this.questQueueOwner = owner;
    this.questQueue.push(quest.id);
    this.emit('discord_status', this.getStatus());
    if (!this.quest.isRunning) await this.advanceQuestQueue();
    return this.getStatus().quest;
  }

  removeQueuedQuest(questId) {
    if (!/^\d{1,25}$/.test(String(questId))) throw new Error('Некорректный ID квеста');
    this.questQueue = this.questQueue.filter(id => id !== String(questId));
    this.questQueueError = null;
    if (!this.questQueue.length) {
      clearTimeout(this.questQueueRetryTimer);
      this.questQueueRetryTimer = null;
      this.questQueueOwner = null;
    }
    this.emit('discord_status', this.getStatus());
    return this.getStatus().quest;
  }

  async advanceQuestQueue() {
    if (this.questQueueWorking || this.quest.isRunning || !this.questQueue.length || this.questQueueError) return;
    this.questQueueWorking = true;
    const id = this.questQueue[0];
    try {
      const result = await this.fetchPersonalQuests();
      if (result.user?.id !== this.questQueueOwner) throw new Error('Аккаунт Discord изменился; очередь остановлена');
      const quest = result.quests.find(q => q.id === id);
      if (quest?.isCompleted) {
        this.questQueue.shift();
        this.emit('discord_status', this.getStatus());
        queueMicrotask(() => this.advanceQuestQueue());
        return;
      }
      if (!quest?.isEnrolled || quest.isCompleted || quest.isExpired || !quest.supportsDesktopPlay) {
        throw new Error('Следующий квест больше не доступен для выполнения на ПК');
      }
      if (this.quest.isRunning) return;
      await this.startQuest(quest.gameName, quest.exe, null, quest.applicationId, null, id);
      this.questQueue.shift();
      this.emit('discord_status', this.getStatus());
    } catch (err) {
      this.questQueueError = `Очередь: ${err.message}`;
      this.log('warn', this.questQueueError);
      if (!/аккаунт Discord изменился|разные аккаунты|больше не доступен|не доступен для выполнения|не совпадают|не подтверждён запуск/i.test(err.message)) {
        clearTimeout(this.questQueueRetryTimer);
        this.questQueueRetryTimer = setTimeout(() => {
          this.questQueueRetryTimer = null;
          this.questQueueError = null;
          this.advanceQuestQueue();
        }, 30000);
        this.questQueueRetryTimer.unref?.();
      }
      this.emit('discord_status', this.getStatus());
    } finally {
      this.questQueueWorking = false;
    }
  }

  requestQuestAction(questId, action, payload) {
    const token = this.userToken;
    if (!token || !/^\d{1,25}$/.test(String(questId)) || !['console/start', 'console/stop'].includes(action)) {
      return Promise.reject(new Error('Недопустимое действие с квестом'));
    }
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'discord.com', path: `/api/v9/quests/${questId}/${action}`, method: 'POST',
        headers: { Authorization: token, 'User-Agent': DESKTOP_USER_AGENT, 'Content-Type': 'application/json' },
      }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('error', reject);
        res.on('aborted', () => reject(new Error('Discord прервал запрос')));
        res.on('end', () => {
          try {
            if (token !== this.userToken) throw new Error('Аккаунт Discord изменился');
            const data = body ? JSON.parse(body) : null;
            if (![200, 204].includes(res.statusCode)) throw new Error(`Discord: HTTP ${res.statusCode}${data?.message ? ` — ${data.message}` : ''}`);
            resolve(data);
          } catch (err) { reject(err); }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => req.destroy(new Error('Таймаут ответа Discord')));
      req.end(JSON.stringify(payload));
    });
  }

  async startConsoleQuest(questId, taskType) {
    if (!['PLAY_ON_XBOX', 'PLAY_ON_PLAYSTATION'].includes(taskType)) throw new Error('Неподдерживаемая консольная платформа');
    if (this.quest.isRunning || this.questQueueWorking || this.preparingQuest || this.farm.isRunning || this.variety.isRunning) {
      throw new Error('Сначала остановите текущую активность Discord');
    }
    const result = await this.fetchPersonalQuests();
    const quest = result.quests.find(q => q.id === String(questId));
    if (!quest?.isEnrolled || quest.isCompleted || quest.isExpired || !quest.tasks?.some(task => task.type === taskType)) {
      throw new Error('Консольное задание не доступно для этого аккаунта');
    }
    const data = await this.requestQuestAction(quest.id, 'console/start', {});
    if (!data?.started || !data.quest_user_status || (data.quest_user_status.user_id && data.quest_user_status.user_id !== result.user?.id)) {
      throw new Error(data?.error_hints?.join(', ') || 'Discord не подтвердил запуск на консоли; проверьте привязку аккаунта');
    }
    const startedAt = Date.now();
    const selectedTask = quest.tasks.find(t => t.type === taskType);
    Object.assign(this.quest, {
      isRunning: true, questId: quest.id, gameId: quest.applicationId, gameName: quest.gameName,
      exeName: '', mode: 'console', taskType, questProcess: null, startedAt, elapsedSeconds: 0,
      targetDurationMinutes: null,
      progressSeconds: selectedTask.progressSeconds, initialProgressSeconds: selectedTask.progressSeconds,
      targetSeconds: selectedTask.targetSeconds,
      percent: selectedTask.targetSeconds ? Math.min(100, Math.round(selectedTask.progressSeconds / selectedTask.targetSeconds * 100)) : 0,
      verified: true, lastVerifiedAt: startedAt,
      progressError: null, progressWarning: null,
    });
    this.quest.pollTimer = setInterval(() => this.pollQuestProgress(startedAt), 20000);
    this.quest.pollTimer.unref?.();
    this.emit('discord_status', this.getStatus());
    return this.getStatus().quest;
  }

  async stopConsoleQuest() {
    if (!this.quest.isRunning || this.quest.mode !== 'console') throw new Error('Консольный квест не запущен');
    await this.requestQuestAction(this.quest.questId, 'console/stop', {});
    this.stopQuest();
  }

  sendQuestHeartbeat() {
    const { questId, gameId, questProcess } = this.quest;
    const token = this.userToken;
    if (!this.quest.isRunning || !token || !questProcess?.pid ||
        !/^\d{1,25}$/.test(questId) || !/^\d{1,25}$/.test(gameId)) {
      return Promise.reject(new Error('Нет активного персонального квеста для heartbeat'));
    }
    // Discord counts elapsed time; never send a fabricated duration or executable fingerprint.
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'discord.com', path: `/api/v9/quests/${questId}/heartbeat`, method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json', 'User-Agent': DESKTOP_USER_AGENT },
      }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('error', reject);
        res.on('aborted', () => reject(new Error('Discord прервал heartbeat')));
        res.on('end', () => {
          try {
            let data;
            try { data = JSON.parse(body); } catch {
              if (res.statusCode === 200) throw new Error('Некорректный ответ heartbeat Discord');
            }
            if (res.statusCode !== 200) {
              const error = new Error(`Discord heartbeat: HTTP ${res.statusCode}${data?.message ? ` — ${data.message}` : ''}`);
              error.status = res.statusCode;
              const retryAfter = Number(data?.retry_after);
              error.retryAfter = Number.isFinite(retryAfter) ? Math.max(20, retryAfter) : 20;
              throw error;
            }
            if (!data || String(data.quest_id) !== questId || !data.progress) {
              throw new Error('Discord не вернул подтверждение heartbeat для этого квеста');
            }
            if (token !== this.userToken) throw new Error('Аккаунт Discord изменился');
            resolve(data);
          } catch (err) { reject(err); }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => req.destroy(new Error('Таймаут heartbeat Discord')));
      req.end(JSON.stringify({ application_id: gameId, executable_path: questProcess.exePath, terminal: false }));
    });
  }

  async pollQuestProgress(startedAt = this.quest.startedAt) {
    if (!this.quest.isRunning || !this.quest.questId || this.quest.startedAt !== startedAt) return;
    if (this.quest.pollPromise) return this.quest.pollPromise;
    const request = (async () => {
      try {
        if (this.quest.questProcess && Date.now() >= this.quest.nextHeartbeatAt) {
          this.quest.nextHeartbeatAt = Date.now() + 20000;
          await this.sendQuestHeartbeat();
          if (!this.quest.isRunning || this.quest.startedAt !== startedAt) return;
        }
        const result = await this.fetchPersonalQuests();
        if (!this.quest.isRunning || this.quest.startedAt !== startedAt) return;
        const remote = result.quests.find(q => q.id === this.quest.questId);
        if (!remote) throw new Error('Квест больше не найден в профиле Discord');
        const currentTask = remote.tasks?.find(task => task.type === this.quest.taskType);
        this.quest.progressSeconds = currentTask?.progressSeconds ?? remote.progressSeconds;
        this.quest.targetSeconds = currentTask?.targetSeconds ?? remote.targetSeconds;
        this.quest.percent = remote.isCompleted ? 100 : this.quest.targetSeconds
          ? Math.min(99, Math.round(this.quest.progressSeconds / this.quest.targetSeconds * 100)) : Math.min(99, remote.percent || 0);
        this.quest.verified = true;
        this.quest.lastVerifiedAt = Date.now();
        this.quest.progressError = null;
        if (!remote.isCompleted && this.quest.targetSeconds && this.quest.progressSeconds >= this.quest.targetSeconds) {
          this.quest.progressWarning = 'Discord засчитал время, но ещё не подтвердил завершение. Продолжаем проверять квест.';
        } else if (!remote.isCompleted && Date.now() - startedAt >= 90000 &&
            this.quest.progressSeconds <= this.quest.initialProgressSeconds) {
          if (!this.quest.progressWarning) {
            this.quest.progressWarning = 'Discord не засчитывает время. Проверьте задание в клиенте Discord и запустите настоящую игру; процесс-заглушка может не распознаваться.';
            this.log('warn', this.quest.progressWarning);
          }
        } else {
          this.quest.progressWarning = null;
        }
        this.emit('discord_quest_tick', this.getStatus().quest);
        if (remote.isCompleted) {
          this.log('success', `Discord подтвердил выполнение квеста «${remote.questName}». ${remote.isClaimed ? 'Награда получена.' : 'Награду можно забрать в Discord.'}`);
          this.emit('discord_quest_completed', { gameName: remote.gameName, questId: remote.id, verified: true });
          this.stopQuest(false);
          queueMicrotask(() => this.advanceQuestQueue());
        }
      } catch (err) {
        if (this.quest.isRunning && this.quest.startedAt === startedAt) {
          if (err.status === 429) this.quest.nextHeartbeatAt = Date.now() + err.retryAfter * 1000;
          if ([401, 403, 404].includes(err.status)) this.stopQuest(false);
          this.quest.progressError = err.message;
          this.log('warn', `Не удалось проверить прогресс Discord: ${err.message}`);
          this.emit('discord_quest_tick', this.getStatus().quest);
        }
      } finally {
        if (this.quest.pollPromise === request) this.quest.pollPromise = null;
      }
    })();
    this.quest.pollPromise = request;
    return request;
  }

  stopQuest(notify = true) {
    if (!this.quest.isRunning) return;

    const gameName = this.quest.gameName;
    this.quest.isRunning = false;
    if (this.quest.timerId) {
      clearInterval(this.quest.timerId);
      this.quest.timerId = null;
    }
    clearInterval(this.quest.pollTimer);
    this.quest.pollTimer = null;
    this.quest.pollPromise = null;

    if (this.quest.questProcess) {
      try {
        if (this.quest.questProcess.pid) {
          exec(`taskkill /F /PID ${this.quest.questProcess.pid} /T`, { windowsHide: true }, () => {});
        }
      } catch (e) {}
      this.quest.questProcess = null;
    }

    this.ipcClient.clearActivity();
    Object.assign(this.quest, {
      questId: null, gameId: null, gameName: '', exeName: '',
      progressSeconds: 0, initialProgressSeconds: 0, targetSeconds: 0, percent: 0,
      elapsedSeconds: 0, verified: false, lastVerifiedAt: null,
      progressError: null, progressWarning: null, nextHeartbeatAt: 0, taskType: null, startedAt: null, targetDurationMinutes: null
    });

    if (notify) {
      this.log('warn', `Квест Discord «${gameName}» остановлен.`);
    }

    this.emit('discord_quest_tick', this.getStatus().quest);

    this.emit('discord_status', this.getStatus());
  }

  // --- HYBRID DISCORD QUESTS API ---

  getOnlineQuestsFeed() {
    const feedFile = path.join(DATA_DIR, 'discord_quests_feed.json');
    if (fs.existsSync(feedFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(feedFile, 'utf8'));
        if (Array.isArray(data) && data.length > 0) {
          return {
            feed: data,
            count: data.length,
            updatedAt: fs.statSync(feedFile).mtime.toISOString()
          };
        }
      } catch (e) {}
    }
    return { feed: [], count: 0, updatedAt: new Date().toISOString() };
  }

  async refreshOnlineQuestsFeed() {
    const feed = this.getOnlineQuestsFeed();
    this.log('info', 'Локальный каталог загружен. Актуальные задания проверяются через персональный список Discord.');
    return { success: true, ...feed, source: 'local' };
  }

  autoDetectToken(all = false) {
    try {
      const localStatePath = path.join(process.env.APPDATA || '', 'discord', 'Local State');
      if (!fs.existsSync(localStatePath)) {
        throw new Error('Файл Local State Discord не найден в %APPDATA%/discord');
      }
      const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
      const encKeyBase64 = localState?.os_crypt?.encrypted_key;
      if (!encKeyBase64) {
        throw new Error('Ключ os_crypt не найден в Local State Discord');
      }

      const psScript = `Add-Type -AssemblyName System.Security; $k = [Convert]::FromBase64String('${encKeyBase64}'); $k = $k[5..($k.Length - 1)]; $mk = [System.Security.Cryptography.ProtectedData]::Unprotect($k, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Convert]::ToBase64String($mk);`;
      const mkBase64 = execSync(`powershell -NoProfile -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { windowsHide: true }).toString().trim();
      const masterKey = Buffer.from(mkBase64, 'base64');

      const levelDbDir = path.join(process.env.APPDATA || '', 'discord', 'Local Storage', 'leveldb');
      if (!fs.existsSync(levelDbDir)) {
        throw new Error('Папка leveldb Discord не найдена');
      }

      const files = fs.readdirSync(levelDbDir).filter(f => f.endsWith('.ldb') || f.endsWith('.log'));
      const candidates = new Set();
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(levelDbDir, file), 'utf8');
          const matches = content.match(/dQw4w9WgXcQ:[A-Za-z0-9+/=]+/g);
          if (!matches) continue;

          for (const rawMatch of matches) {
            try {
              const encPayloadB64 = rawMatch.split('dQw4w9WgXcQ:')[1];
              const encPayload = Buffer.from(encPayloadB64, 'base64');

              const iv = encPayload.subarray(3, 15);
              const ciphertext = encPayload.subarray(15, encPayload.length - 16);
              const tag = encPayload.subarray(encPayload.length - 16);

              const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
              decipher.setAuthTag(tag);
              let decrypted = decipher.update(ciphertext, undefined, 'utf8');
              decrypted += decipher.final('utf8');

              if (decrypted && decrypted.length >= 20) candidates.add(decrypted);
            } catch (e) {}
          }
        } catch (e) {}
      }
      if (candidates.size) return all ? [...candidates] : candidates.values().next().value;
      throw new Error('Токен не найден в базе данных Discord. Убедитесь, что вы авторизованы в клиенте Discord.');
    } catch (err) {
      throw new Error(`Ошибка автоопределения токена: ${err.message}`);
    }
  }

  async autoConnectToken(persist = true) {
    const active = this.quest.isRunning || this.farm.isRunning || this.variety.isRunning;
    let currentId = this.ipcClient.user?.id || null;
    if (!currentId && !active) {
      this.ipcClient.disconnect();
      const ready = new Promise(resolve => {
        const timer = setTimeout(() => { this.ipcClient.off('ready', onReady); resolve(null); }, 3000);
        const onReady = user => { clearTimeout(timer); resolve(user?.id || null); };
        this.ipcClient.once('ready', onReady);
      });
      await this.ipcClient.connect();
      currentId = await ready;
    }
    const candidates = this.autoDetectToken(true);
    const verified = [];
    for (const token of candidates) {
      try {
        const user = await this.verifyDiscordUserToken(token);
        if (user.id === currentId) return this.setUserToken(token, persist);
        verified.push({ token, user });
      } catch {}
    }
    if (!currentId && verified.length === 1 && (!this.tokenUser?.id || this.tokenUser.id === verified[0].user.id)) {
      return this.setUserToken(verified[0].token, persist);
    }
    if (active && !currentId) throw new Error('Не удалось однозначно определить аккаунт Discord: остановите активность и повторите попытку.');
    throw new Error('Токен текущего аккаунта Discord не найден; подключите его вручную');
  }

  async setUserToken(token, persist = true) {
    if (!token || typeof token !== 'string' || token.trim().length < 20) {
      throw new Error('Некорректный формат токена Discord');
    }
    const cleanToken = token.trim().replace(/^"(.*)"$/, '$1');

    const user = await this.verifyDiscordUserToken(cleanToken);
    if ((this.quest.isRunning || this.farm.isRunning || this.variety.isRunning)
      && ((this.tokenUser?.id && this.tokenUser.id !== user.id) || (this.ipcClient.user?.id && this.ipcClient.user.id !== user.id))) {
      throw new Error('Остановите активность Discord перед сменой аккаунта');
    }
    if (this.tokenUser?.id && this.tokenUser.id !== user.id) {
      if (this.quest.isRunning && this.quest.questId) this.stopQuest(false);
      this.questQueue = [];
      this.questQueueOwner = null;
      this.questQueueError = null;
      clearTimeout(this.questQueueRetryTimer);
      this.questQueueRetryTimer = null;
    }
    this.userToken = cleanToken;
    this.tokenUser = user;

    if (persist) {
      this.settings.userToken = cleanToken;
      this.saveSettings();
    }

    this.log('success', `Discord токен подтвержден: ${user.username} (${user.id}).`);
    this.emit('discord_status', this.getStatus());
    return { success: true, user };
  }

  clearUserToken() {
    if (this.quest.isRunning && this.quest.questId) this.stopQuest(false);
    this.questQueue = [];
    this.questQueueOwner = null;
    this.questQueueError = null;
    clearTimeout(this.questQueueRetryTimer);
    this.questQueueRetryTimer = null;
    this.userToken = null;
    this.tokenUser = null;
    delete this.settings.userToken;
    this.saveSettings();
    this.log('info', 'Пользовательский токен Discord удален.');
    this.emit('discord_status', this.getStatus());
    return { success: true };
  }

  getUserTokenStatus() {
    return {
      hasToken: Boolean(this.userToken),
      user: this.tokenUser || null
    };
  }

  verifyDiscordUserToken(token) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'discord.com',
        path: '/api/v9/users/@me',
        method: 'GET',
        headers: {
          'Authorization': token,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const u = JSON.parse(body);
              if (!u?.id || !u.username) throw new Error('Не получен профиль пользователя');
              resolve({
                id: u.id,
                username: u.username,
                global_name: u.global_name || u.username,
                avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : null,
                discriminator: u.discriminator
              });
            } catch (e) {
              reject(new Error('Ошибка ответа Discord: ' + e.message));
            }
          } else if (res.statusCode === 401) {
            reject(new Error('Недействительный токен Discord (401 Unauthorized)'));
          } else {
            reject(new Error(`Ошибка проверки токена: HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error('Сетевая ошибка Discord: ' + err.message)));
      req.setTimeout(8000, () => {
        req.destroy();
        reject(new Error('Таймаут проверки токена'));
      });
      req.end();
    });
  }

  async fetchPersonalQuests() {
    if (!this.userToken) {
      throw new Error('Токен Discord не подключен');
    }

    const token = this.userToken;
    if (!this.tokenUser) {
      const user = await this.verifyDiscordUserToken(token);
      if (this.userToken !== token) throw new Error('Аккаунт Discord изменился во время запроса');
      this.tokenUser = user;
    }
    const userId = this.tokenUser.id;
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'discord.com',
        path: '/api/v9/quests/@me',
        method: 'GET',
        headers: {
          'Authorization': token,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Discord API ответил со статусом: ${res.statusCode}`));
          }
          try {
            const parsed = JSON.parse(body);
            if (this.userToken !== token) throw new Error('Аккаунт Discord изменился во время запроса');
            const mapped = personalQuests(parsed, this.games, userId);

            resolve({
              quests: mapped,
              totalCount: mapped.length,
              isFallback: false,
              user: this.tokenUser,
              blockedUntil: parsed.quest_enrollment_blocked_until || null
            });
          } catch (e) {
            reject(new Error('Ошибка обработки ответа квестов: ' + e.message));
          }
        });
      });

      req.on('error', (err) => reject(new Error('Ошибка запроса личных квестов: ' + err.message)));
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Таймаут запроса личных квестов'));
      });
      req.end();
    });
  }

  async enrollPersonalQuest(questId) {
    if (!this.userToken) throw new Error('Токен Discord не подключен');
    if (!/^\d{1,25}$/.test(String(questId))) throw new Error('Некорректный ID квеста');
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'discord.com',
        path: `/api/v9/quests/${questId}/enroll`,
        method: 'POST',
        headers: {
          'Authorization': this.userToken,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          'Content-Type': 'application/json',
          'Accept': '*/*'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 204) {
            this.log('success', `Квест успешно принят в Discord (ID: ${questId}).`);
            resolve({ success: true });
          } else {
            reject(new Error(`Ошибка принятия квеста: HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error('Ошибка сети при принятии квеста: ' + err.message)));
      req.setTimeout(8000, () => {
        req.destroy();
        reject(new Error('Таймаут принятия квеста'));
      });
      req.write(JSON.stringify({ location: 1 }));
      req.end();
    });
  }

  async claimPersonalQuest(questId, platform) {
    if (!this.userToken) throw new Error('Токен Discord не подключен');
    if (!/^\d{1,25}$/.test(String(questId))) throw new Error('Некорректный ID квеста');
    const result = await this.fetchPersonalQuests();
    const quest = result.quests.find(q => q.id === String(questId));
    if (!quest?.canClaim) throw new Error('Награда недоступна или уже получена');
    if (!Number.isInteger(platform) || !quest.rewardPlatforms.includes(platform)) throw new Error('Выберите доступную платформу награды');
    const token = this.userToken;
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'discord.com',
        path: `/api/v9/quests/${questId}/claim-reward`,
        method: 'POST',
        headers: {
          'Authorization': token,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          'Content-Type': 'application/json',
          'Accept': '*/*'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(body);
              if (!data?.claimed_at || (Array.isArray(data.errors) && data.errors.length) || this.userToken !== token) {
                throw new Error('Пустое подтверждение получения награды');
              }
              const code = data.code || data.claim_code || data.user_status?.claimed_code || null;
              this.log('success', `Discord ответил на запрос награды за квест ${questId}.`);
              resolve({ success: true, code });
            } catch (e) {
              reject(new Error(`Некорректный ответ Discord при получении награды: ${e.message}`));
            }
          } else {
            reject(new Error(`Ошибка получения награды: HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error('Ошибка сети при получении награды: ' + err.message)));
      req.setTimeout(8000, () => {
        req.destroy();
        reject(new Error('Таймаут получения награды'));
      });
      req.write(JSON.stringify({ location: 1, platform }));
      req.end();
    });
  }

  shutdown() {
    this.shuttingDown = true;
    clearTimeout(this.questQueueRetryTimer);
    clearInterval(this.monitorTimer);
    this.stopVariety();
    this.stopFarm();
    this.stopQuest(false);
    this.ipcClient.disconnect();
  }
}

module.exports = new DiscordManager();
module.exports.DiscordManager = DiscordManager;
module.exports.DiscordIpcClient = DiscordIpcClient;
