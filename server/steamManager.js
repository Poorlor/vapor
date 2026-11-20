const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const https = require('https');
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const { LoginSession, EAuthTokenPlatformType, EAuthSessionGuardType } = require('steam-session');
const QRCode = require('qrcode');
const BinaryKVParser = require('binarykvparser');
const Schema = require('steam-user/protobufs/generated/_load.js');
const { FREE_GAMES_DATABASE } = require('./freeGamesDatabase');
const { parseProfileXp, parseCollectorCount } = require('./steamProfile');

// Dynamic EMsg registration
if (SteamUser.EMsg) {
  SteamUser.EMsg.ClientGetUserStats = SteamUser.EMsg.ClientGetUserStats || 818;
  SteamUser.EMsg[818] = SteamUser.EMsg[818] || 'ClientGetUserStats';

  SteamUser.EMsg.ClientGetUserStatsResponse = SteamUser.EMsg.ClientGetUserStatsResponse || 819;
  SteamUser.EMsg[819] = SteamUser.EMsg[819] || 'ClientGetUserStatsResponse';

  SteamUser.EMsg.ClientStoreUserStats2 = SteamUser.EMsg.ClientStoreUserStats2 || 5466;
  SteamUser.EMsg[5466] = SteamUser.EMsg[5466] || 'ClientStoreUserStats2';

  SteamUser.EMsg.ClientStoreUserStatsResponse = SteamUser.EMsg.ClientStoreUserStatsResponse || 821;
  SteamUser.EMsg[821] = SteamUser.EMsg[821] || 'ClientStoreUserStatsResponse';
}

const { DATA_DIR } = require('./paths');
const SESSION_FILE = path.join(DATA_DIR, 'session.json');
const CLAIMED_FILE = path.join(DATA_DIR, 'claimed_games.json');
const INVENTORY_CACHE_FILE = path.join(DATA_DIR, 'inventory_cache.json');
const INVENTORY_HISTORY_FILE = path.join(DATA_DIR, 'inventory_history.json');

const KNOWN_APP_NAMES = {
  570: 'Dota 2',
  730: 'Counter-Strike 2',
  635260: 'CarX Drift Racing Online',
  480: 'Spacewar',
  252490: 'Rust',
  739630: 'Phasmophobia',
  1938090: 'Call of Duty: Modern Warfare II / Warzone',
  648800: 'Raft',
  218620: 'PAYDAY 2',
  629520: 'Soundpad',
  578080: 'PUBG: BATTLEGROUNDS',
  2434730: 'Lethal Company',
  275850: "No Man's Sky",
  244210: 'Assetto Corsa',
  227300: 'Euro Truck Simulator 2',
  393380: 'Squad',
  386180: 'Crossout',
  1943950: 'Sons of the Forest',
  92: 'Codename Gordon',
  705210: 'Cube World',
  440: 'Team Fortress 2',
  1172470: 'Apex Legends',
  230410: 'Warframe',
  238960: 'Path of Exile',
  1085660: 'Destiny 2',
  1245620: 'Elden Ring',
  1086940: "Baldur's Gate 3",
  105600: 'Terraria',
  289070: "Sid Meier's Civilization VI",
  12210: 'Grand Theft Auto IV: The Complete Edition',
  291550: 'Brawlhalla',
  1222670: 'The Sims 4',
  2357570: 'Overwatch 2',
  438100: 'VRChat',
  236390: 'War Thunder',
  552990: 'World of Warships',
  1407200: 'World of Tanks',
  304930: 'Unturned',
  1790600: 'Crab Game',
  1568590: 'Goose Goose Duck',
  1203220: 'NARAKA: BLADEPOINT',
  1046930: 'Dota Underlords',
  1887720: 'Fallout Shelter',
  1449850: 'Yu-Gi-Oh! Master Duel',
  218: 'Half-Life 2: Special Edition',
  400: 'Portal',
  620: 'Portal 2',
  550: 'Left 4 Dead 2',
  10: 'Counter-Strike',
  220: 'Half-Life 2',
  340: 'Half-Life 2: Lost Coast'
};

const CURRENCY_SYMBOLS = {
  1: '$',      // USD
  2: '£',      // GBP
  3: '€',      // EUR
  4: 'CHF',    // CHF
  5: '₽',      // RUB
  6: 'zł',     // PLN
  7: 'R$',     // BRL
  8: '¥',      // JPY
  9: 'kr',     // NOK
  10: 'Rp',    // IDR
  11: 'RM',    // MYR
  12: '₱',     // PHP
  13: 'S$',    // SGD
  14: '฿',     // THB
  15: '₫',     // VND
  16: '₩',     // KRW
  17: '₺',     // TRY
  18: '₴',     // UAH
  19: 'Mex$',  // MXN
  20: 'CA$',   // CAD
  21: 'A$',    // AUD
  22: 'NZ$',   // NZD
  23: '¥',     // CNY
  24: '₹',     // INR
  25: 'CLP$',  // CLP
  26: 'S/.',   // PEN
  27: 'COL$',  // COP
  28: 'R',     // ZAR
  29: 'HK$',   // HKD
  30: 'NT$',   // TWD
  31: 'SR',    // SAR
  32: 'AED',   // AED
  34: 'ARS$',  // ARS
  35: '₪',     // ILS
  37: '₸',     // KZT
  38: 'KD',    // KWD
  39: 'QR',    // QAR
  40: '₡',     // CRC
  41: '$U'     // UYU
};

function getCurrencySymbol(code) {
  if (typeof code === 'string' && code.length <= 4 && !/^\d+$/.test(code)) return code;
  const num = parseInt(code, 10);
  return CURRENCY_SYMBOLS[num] || '₽';
}

class SteamManager extends EventEmitter {
  constructor() {
    super();
    this.client = new SteamUser({
      promptSteamGuardCode: false,
      autoRelogin: true,
      dataDirectory: DATA_DIR,
    });
    this.community = new SteamCommunity();

    this.isLoggedOn = false;
    this.isLoggingIn = false;
    this.hasWebSession = false;
    this.currentUser = null;
    this.ownedGames = []; // Only populated for the active authenticated account!
    this.activeLoginSession = null;
    this.claimedFreeGames = new Set();
    this.achievementsCache = new Map();
    this.inventoryCache = null;
    this.inventoryCacheTime = 0;
    this.historyCache = null;
    this.historyCacheTime = 0;

    // Hour Booster state
    this.hourBooster = {
      isRunning: false,
      activeAppIds: [],
      startTime: null,
      elapsedSeconds: 0,
      totalFarmedSeconds: 0, // multiplier * elapsed
      targetDurationMinutes: null,
      intervalId: null,
    };

    // Card Idler state
    this.cardIdler = {
      isRunning: false,
      queue: [],
      currentApp: null,
      totalCardsRemaining: 0,
      dropsEarned: 0,
      startTime: null,
      checkIntervalId: null,
    };

    // Free Collector state
    this.collector = {
      isRunning: false,
      totalToClaim: 0,
      claimedCount: 0,
      failedCount: 0,
      lastClaimedName: '',
    };

    this.ensureDataDir();
    this.loadClaimedGames();
    this.initClientEvents();
  }

  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  loadClaimedGames(steamID = this.currentUser?.steamID) {
    this.claimedFreeGames = new Set();
    const filename = steamID ? path.join(DATA_DIR, `claimed_games_${steamID}.json`) : null;
    if (filename && fs.existsSync(filename)) {
      try {
        const arr = JSON.parse(fs.readFileSync(filename, 'utf8'));
        if (Array.isArray(arr)) {
          this.claimedFreeGames = new Set(arr);
        }
      } catch (e) {}
    }
  }

  saveClaimedGames() {
    const sid = this.currentUser?.steamID;
    if (!sid) return;
    try {
      fs.writeFileSync(
        path.join(DATA_DIR, `claimed_games_${sid}.json`),
        JSON.stringify(Array.from(this.claimedFreeGames), null, 2),
        'utf8'
      );
    } catch (e) {}
  }

  getInventoryCachePath(steamID = null) {
    const sid = steamID || this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
    if (!sid) return null;
    return path.join(DATA_DIR, `inventory_cache_${sid}.json`);
  }

  getHistoryCachePath(steamID = null) {
    const sid = steamID || this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
    if (!sid) return null;
    return path.join(DATA_DIR, `inventory_history_${sid}.json`);
  }

  loadUserCaches(steamID = null) {
    const sid = steamID || this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
    this.loadClaimedGames(sid);
    this.achievementsCache.clear();
    this.inventoryCache = null;
    this.inventoryCacheTime = 0;
    this.historyCache = null;
    this.historyCacheTime = 0;

    if (!sid) return;

    const invPath = this.getInventoryCachePath(sid);
    if (invPath && fs.existsSync(invPath)) {
      try {
        this.inventoryCache = JSON.parse(fs.readFileSync(invPath, 'utf8'));
        this.inventoryCacheTime = Date.now();
      } catch (e) {}
    }

    const histPath = this.getHistoryCachePath(sid);
    if (histPath && fs.existsSync(histPath)) {
      try {
        this.historyCache = JSON.parse(fs.readFileSync(histPath, 'utf8'));
        this.historyCacheTime = Date.now();
      } catch (e) {}
    }
  }

  log(level, message, meta = null) {
    const logItem = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      meta,
    };
    this.emit('log', logItem);
  }

  initClientEvents() {
    this.client.on('loggedOn', async (details) => {
      this.isLoggedOn = true;
      this.isLoggingIn = false;
      const steamID64 = this.client.steamID ? this.client.steamID.getSteamID64() : (this.currentUser?.steamID || null);

      this.log('success', `Успешная авторизация в Steam! (SteamID: ${steamID64})`);

      // Load caches specific to this account
      if (steamID64) {
        this.loadUserCaches(steamID64);
      }

      this.currentUser = {
        steamID: steamID64,
        personaName: this.client.accountInfo?.name || this.currentUser?.personaName || 'Steam User',
        avatarUrl: this.currentUser?.avatarUrl || null,
        level: this.currentUser?.level || 0,
        wallet: this.currentUser?.wallet || null,
        personaState: SteamUser.EPersonaState.Online,
      };

      // Set online
      try {
        this.client.setPersona(SteamUser.EPersonaState.Online);
      } catch (e) {}

      // Establish web session for steamcommunity cookies (needed for card drops and community stats)
      try {
        this.client.webLogOn();
      } catch (e) {
        this.log('warn', `Запрос веб-сессии: ${e.message}`);
      }

      this.emit('auth_state', {
        isLoggedOn: true,
        isLoggingIn: false,
        user: this.currentUser,
      });

      // Fetch user profile info, avatar and owned games
      await this.refreshUserData();
      await this.refreshAvatar();

      if (this.client.steamID) {
        this.client.getSteamLevels([this.client.steamID], (err, levels) => {
          if (!err && levels && levels[this.client.steamID.getSteamID64()]) {
            const lvl = levels[this.client.steamID.getSteamID64()];
            if (this.currentUser) {
              this.currentUser.level = lvl;
              this.updateSessionCache({ level: lvl });
              this.emit('profile_updated', this.currentUser);
            }
          }
        });
      }

      this.emit('auth_state', {
        isLoggedOn: true,
        isLoggingIn: false,
        user: this.currentUser,
      });
      this.emit('games_loaded', this.ownedGames);
    });

    this.client.on('webSession', async (sessionID, cookies) => {
      this.community.setCookies(cookies);
      this.hasWebSession = true;
      this.log('info', 'Веб-сессия Steam установлена.');
      await this.refreshAvatar();
      this.fetchLiveInventory().catch(() => {});
      this.fetchLiveInventoryHistory().catch(() => {});
    });

    this.client.on('user', (sid, user) => {
      if (this.currentUser && sid.getSteamID64() === this.currentUser.steamID) {
        if (user.avatar_url_full) {
          this.currentUser.avatarUrl = user.avatar_url_full;
          this.emit('profile_updated', this.currentUser);
        }
      }
    });

    this.client.on('error', (err) => {
      this.isLoggedOn = false;
      this.isLoggingIn = false;
      this.hasWebSession = false;
      this.stopHourBooster();
      this.stopCardIdler();
      this.log('error', `Ошибка Steam клиента: ${err.message}`);
      this.emit('client_error', { message: err.message, eresult: err.eresult });
      this.emit('auth_state', { isLoggedOn: false, isLoggingIn: false, user: null });
    });

    this.client.on('disconnected', (eresult, msg) => {
      this.isLoggedOn = false;
      this.isLoggingIn = false;
      this.hasWebSession = false;
      this.stopHourBooster();
      this.stopCardIdler();
      this.log('warn', `Соединение со Steam разорвано: ${msg || eresult}`);
      this.emit('auth_state', { isLoggedOn: false, isLoggingIn: false, user: null });
    });

    this.client.on('wallet', (hasWallet, currency, balance) => {
      if (this.currentUser) {
        const symbol = getCurrencySymbol(currency);
        const amount = (Number(balance)).toFixed(2);
        this.currentUser.walletAmount = amount;
        this.currentUser.walletCurrency = currency;
        this.currentUser.walletSymbol = symbol;
        this.currentUser.wallet = `${amount} ${symbol}`;
        this.updateSessionCache({
          wallet: this.currentUser.wallet,
          walletSymbol: symbol,
          walletCurrency: currency
        });
        this.emit('profile_updated', this.currentUser);
      }
    });

    this.client.on('accountInfo', (name) => {
      if (this.currentUser) {
        this.currentUser.personaName = name;
        this.emit('profile_updated', this.currentUser);
      }
    });
  }

  updateSessionCache(fields) {
    if (!fs.existsSync(SESSION_FILE)) return;
    try {
      const current = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      const updated = { ...current, ...fields };
      fs.writeFileSync(SESSION_FILE, JSON.stringify(updated, null, 2), 'utf8');
    } catch (e) {}
  }

  // --- REFRESH AVATAR ---
  async refreshAvatar() {
    if (!this.client.steamID) return;
    const steamID64 = this.client.steamID.getSteamID64();
    const https = require('https');

    return new Promise((resolve) => {
      https
        .get(`https://steamcommunity.com/profiles/${steamID64}/?xml=1`, (res) => {
          let body = '';
          res.on('data', (d) => (body += d));
          res.on('end', () => {
            const avatarMatch =
              body.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/i) ||
              body.match(/<avatarFull>(.*?)<\/avatarFull>/i);
            const nameMatch =
              body.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/i) ||
              body.match(/<steamID>(.*?)<\/steamID>/i);
            if (avatarMatch && avatarMatch[1] && this.currentUser) {
              this.currentUser.avatarUrl = avatarMatch[1];
              if (nameMatch && nameMatch[1]) {
                this.currentUser.personaName = nameMatch[1];
              }
              this.updateSessionCache({
                avatarUrl: this.currentUser.avatarUrl,
                personaName: this.currentUser.personaName,
              });
              this.emit('profile_updated', this.currentUser);
            }
            resolve(this.currentUser?.avatarUrl);
          });
        })
        .on('error', () => resolve(null));
    });
  }

  // --- SCAN LOCAL STEAM USER PLAYTIME (localconfig.vdf) ---
  findSteamInstallDir() {
    const candidates = [
      'C:\\Program Files (x86)\\Steam',
      'C:\\Program Files\\Steam',
      'D:\\Steam',
      'D:\\Games\\Steam',
      'E:\\Steam'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  getLocalSteamUsers() {
    const steamDir = this.findSteamInstallDir();
    if (!steamDir) return [];
    const loginUsersFile = path.join(steamDir, 'config', 'loginusers.vdf');
    if (!fs.existsSync(loginUsersFile)) return [];

    try {
      const content = fs.readFileSync(loginUsersFile, 'utf8');
      const users = [];
      const userMatches = [...content.matchAll(/"(7656119\d+)"\s*\{([\s\S]*?)\}/g)];
      for (const m of userMatches) {
        const steamID64 = m[1];
        const inner = m[2];
        const accountName = inner.match(/"AccountName"\s*"([^"]+)"/)?.[1] || '';
        const personaName = inner.match(/"PersonaName"\s*"([^"]+)"/)?.[1] || '';
        const mostRecent = inner.match(/"mostrecent"\s*"([^"]+)"/i)?.[1] === '1';
        const timestamp = parseInt(inner.match(/"timestamp"\s*"([^"]+)"/)?.[1] || '0', 10);
        const accountid32 = String(BigInt(steamID64) & 0xFFFFFFFFn);
        const userDir = path.join(steamDir, 'userdata', accountid32);
        users.push({
          steamID64,
          accountid32,
          accountName,
          personaName,
          mostRecent,
          timestamp,
          hasLocalConfig: fs.existsSync(path.join(userDir, 'config', 'localconfig.vdf'))
        });
      }
      return users;
    } catch (e) {
      return [];
    }
  }

  async fetchLiveBadges(sid = null) {
    const targetSid = sid || this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
    if (targetSid) {
      const cacheFile = path.join(DATA_DIR, `badges_cache_${targetSid}.json`);
      if (fs.existsSync(cacheFile) && (Date.now() - fs.statSync(cacheFile).mtimeMs < 300000)) {
        try {
          const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          if (Array.isArray(cached) && cached.length > 0) return cached;
        } catch (e) {}
      }
    }

    if (!targetSid) return [];

    try {
      const url = `https://steamcommunity.com/profiles/${targetSid}/badges/?l=russian`;
      const body = await this.fetchUrlWithRedirects(url);
      if (!body) return [];

      const badges = [];
      const rows = [...body.matchAll(/<div class="badge_row_inner">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g)];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i][1];
        const titleMatch = row.match(/<div class="badge_info_title">([^<]+)<\/div>/) || row.match(/<div class="badge_title">\s*([^<&]+)/);
        if (!titleMatch) continue;
        const name = titleMatch[1].trim();
        const xpMatch = row.match(/(\d+)\s*ед\.\s*опыта/i) || row.match(/(\d+)\s*XP/i);
        const xp = xpMatch ? parseInt(xpMatch[1], 10) : 100;
        const imgMatch = row.match(/data-delayed-image="([^"]+)"/) || row.match(/<img[^>]*class="badge_icon"[^>]*src="([^"]+)"/);
        const icon = imgMatch ? imgMatch[1] : '';
        badges.push({
          id: `badge-${i}`,
          name,
          level: Math.max(1, Math.round(xp / 100)),
          xp,
          icon,
          iconName: 'Trophy'
        });
      }

      if (badges.length > 0) {
        try {
          const cacheFile = path.join(DATA_DIR, `badges_cache_${targetSid}.json`);
          fs.writeFileSync(cacheFile, JSON.stringify(badges, null, 2), 'utf8');
        } catch (e) {}
      }
      return badges;
    } catch (e) {
      return [];
    }
  }

  async scanPcForActiveAccount() {
    const sid = this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
    if (!sid) {
      return { success: false, error: 'Аккаунт Steam не авторизован' };
    }

    const accountid32 = String(BigInt(sid) & 0xFFFFFFFFn);
    const localUsers = this.getLocalSteamUsers();
    const matchedUser = localUsers.find((u) => u.steamID64 === sid || u.accountid32 === accountid32);
    const isLocalAccountFound = Boolean(matchedUser && matchedUser.hasLocalConfig);

    this.log(
      'info',
      `Сканирование ПК: проверка активного аккаунта ${this.currentUser?.personaName || sid} (ID32: ${accountid32})...`
    );

    if (isLocalAccountFound) {
      this.log(
        'success',
        `Идентифицирован локальный профиль: ${matchedUser.personaName} (${matchedUser.accountName}, SteamID64: ${sid}). Синхронизация файлов конфигурации...`
      );
    } else {
      this.log(
        'warn',
        `Локальная папка userdata/${accountid32} не обнаружена на этом ПК. Используются защищенные данные сессии Steam.`
      );
    }

    // Refresh user owned apps with local sync
    await this.refreshUserData(true);

    // Refresh badges and inventory caches
    await this.fetchLiveBadges(sid).catch(() => {});
    await this.fetchLiveInventory().catch(() => {});
    await this.fetchLiveInventoryHistory().catch(() => {});

    const analytics = await this.getProfileAnalytics();
    const economy = await this.getEconomyStats();

    return {
      success: true,
      verifiedAccount: {
        steamID: sid,
        accountid32,
        personaName: this.currentUser?.personaName || matchedUser?.personaName || 'Steam User',
        accountName: matchedUser?.accountName || 'Unknown',
        isLocalAccountFound,
        localGamesCount: this.ownedGames.length,
        totalHours: analytics.totalHours
      },
      games: this.ownedGames,
      analytics,
      economy,
      badges: analytics.badges || []
    };
  }

  getLocalUserPlaytimeMap(steamID64 = null) {
    const playtimeMap = new Map();
    const sid = steamID64 || (this.client?.steamID ? this.client.steamID.getSteamID64() : this.currentUser?.steamID);
    if (!sid) return playtimeMap;

    let targetAccountId = null;
    try {
      targetAccountId = String(BigInt(sid) & 0xFFFFFFFFn);
    } catch (e) {
      return playtimeMap;
    }

    const possibleUserDirs = [
      'C:\\Program Files (x86)\\Steam\\userdata',
      'C:\\Program Files\\Steam\\userdata'
    ];

    for (const udir of possibleUserDirs) {
      if (fs.existsSync(udir)) {
        const targetUserDir = path.join(udir, targetAccountId);
        if (fs.existsSync(targetUserDir)) {
          const lconfig = path.join(targetUserDir, 'config', 'localconfig.vdf');
          if (fs.existsSync(lconfig)) {
            try {
              const content = fs.readFileSync(lconfig, 'utf8');
              const appsRegex = /"(\d+)"\s*\{([^}]*?"Playtime"\s*"(\d+)"[^}]*?)\}/g;
              let match;
              while ((match = appsRegex.exec(content)) !== null) {
                const appid = parseInt(match[1], 10);
                const block = match[2];
                const ptMatch = block.match(/"Playtime"\s*"(\d+)"/);
                const lastPlayedMatch = block.match(/"LastPlayed"\s*"(\d+)"/);
                if (ptMatch) {
                  const minutes = parseInt(ptMatch[1], 10);
                  const lastPlayed = lastPlayedMatch ? parseInt(lastPlayedMatch[1], 10) : 0;
                  if (!playtimeMap.has(appid) || playtimeMap.get(appid).minutes < minutes) {
                    playtimeMap.set(appid, { minutes, lastPlayed });
                  }
                }
              }
            } catch (e) {}
          }
        }
      }
    }
    return playtimeMap;
  }

  // --- SCAN LOCAL STEAM GAMES (Across all drives: C:, D:, etc.) ---
  scanLocalSteamGames(steamID64 = null) {
    const localGames = [];
    const seenAppIds = new Set();
    const playtimeMap = this.getLocalUserPlaytimeMap(steamID64);

    const possibleVdfPaths = [
      'C:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf',
      'C:\\Program Files\\Steam\\steamapps\\libraryfolders.vdf',
      'D:\\SteamLibrary\\steamapps\\libraryfolders.vdf',
      'E:\\SteamLibrary\\steamapps\\libraryfolders.vdf',
    ];

    const libraryFolders = new Set([
      'C:\\Program Files (x86)\\Steam',
      'C:\\Program Files\\Steam',
    ]);

    for (const vdf of possibleVdfPaths) {
      if (fs.existsSync(vdf)) {
        try {
          const content = fs.readFileSync(vdf, 'utf8');
          const pathMatches = content.match(/"path"\s*"([^"]+)"/g) || [];
          for (const m of pathMatches) {
            const match = m.match(/"path"\s*"([^"]+)"/);
            if (match && match[1]) {
              const cleanPath = match[1].replace(/\\\\/g, '\\');
              if (fs.existsSync(cleanPath)) {
                libraryFolders.add(cleanPath);
              }
            }
          }
        } catch (e) {}
      }
    }

    for (const folder of libraryFolders) {
      const steamappsDir = path.join(folder, 'steamapps');
      if (fs.existsSync(steamappsDir)) {
        try {
          const files = fs.readdirSync(steamappsDir);
          for (const file of files) {
            if (file.startsWith('appmanifest_') && file.endsWith('.acf')) {
              try {
                const acfContent = fs.readFileSync(path.join(steamappsDir, file), 'utf8');
                const appidMatch = acfContent.match(/"appid"\s*"(\d+)"/i);
                const nameMatch = acfContent.match(/"name"\s*"([^"]+)"/i);
                if (appidMatch && nameMatch) {
                  const appid = parseInt(appidMatch[1], 10);
                  const name = nameMatch[1];
                  if (!seenAppIds.has(appid)) {
                    seenAppIds.add(appid);
                    const ptInfo = playtimeMap.get(appid);
                    localGames.push({
                      appid,
                      name,
                      playtime_forever: ptInfo ? ptInfo.minutes : 0,
                      last_played: ptInfo ? ptInfo.lastPlayed : 0
                    });
                  }
                }
              } catch (e) {}
            }
          }
        } catch (e) {}
      }
    }

    // Only include games from localconfig.vdf if THIS account actually has playtime for them
    for (const [appid, ptInfo] of playtimeMap.entries()) {
      if (!seenAppIds.has(appid) && ptInfo.minutes > 0) {
        seenAppIds.add(appid);
        const name = KNOWN_APP_NAMES[appid] || `Steam AppID ${appid}`;
        localGames.push({
          appid,
          name,
          playtime_forever: ptInfo.minutes,
          last_played: ptInfo.lastPlayed
        });
      }
    }

    return localGames;
  }

  // --- REFRESH USER DATA ---
  async refreshUserData(isDeepScan = false) {
    if (!this.isLoggedOn || !this.client.steamID) return;

    try {
      const sid = this.client.steamID.getSteamID64();
      const gameMap = new Map();
      const playtimeMap = this.getLocalUserPlaytimeMap(sid);

      // 1. Get owned games from Steam API (official source for this specific account)
      const res = await this.client.getUserOwnedApps(this.client.steamID, {
        includeAppInfo: true,
        includePlayedFreeGames: true,
        includeFreeSub: true,
        skipUnvettedApps: false,
      });

      if (res && res.apps) {
        for (const g of res.apps) {
          const pt = Math.max(g.playtime_forever || 0, playtimeMap.get(g.appid)?.minutes || 0);
          gameMap.set(g.appid, {
            appid: g.appid,
            name: g.name,
            img_icon_url: g.img_icon_url,
            playtime_forever: pt,
            playtime_2weeks: g.playtime_2weeks || 0,
            last_played: playtimeMap.get(g.appid)?.lastPlayed || 0
          });
        }
      }

      // 2. Attach locally played games for THIS user (e.g. F2P Dota 2/CS2 if not in package license)
      const localGames = this.scanLocalSteamGames(sid);
      for (const lg of localGames) {
        if (playtimeMap.has(lg.appid) && playtimeMap.get(lg.appid).minutes > 0) {
          if (!gameMap.has(lg.appid)) {
            gameMap.set(lg.appid, lg);
          } else {
            const existing = gameMap.get(lg.appid);
            if (lg.playtime_forever > (existing.playtime_forever || 0)) {
              existing.playtime_forever = lg.playtime_forever;
            }
          }
        } else if (isDeepScan && !gameMap.has(lg.appid)) {
          gameMap.set(lg.appid, lg);
        }
      }

      // Collector requests are not proof that Steam includes a game in the library.
      if (!this.isLoggedOn || this.client.steamID?.getSteamID64() !== sid) return;
      this.ownedGames = Array.from(gameMap.values()).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      );

      this.log(
        'info',
        `Синхронизация библиотеки: ${this.ownedGames.length} игр загружено для текущего аккаунта.`
      );

      // 5. Update avatar
      await this.refreshAvatar();

      this.emit('games_loaded', this.ownedGames);
    } catch (e) {
      this.log('warn', `Не удалось полностью загрузить профиль: ${e.message}`);
    }
  }

  getStatus() {
    return {
      isLoggedOn: this.isLoggedOn,
      isLoggingIn: this.isLoggingIn,
      hasSavedSession: fs.existsSync(SESSION_FILE),
      user: this.currentUser,
      ownedGamesCount: this.ownedGames.length,
      hourBooster: {
        isRunning: this.hourBooster.isRunning,
        activeAppIds: this.hourBooster.activeAppIds,
        elapsedSeconds: this.hourBooster.elapsedSeconds,
        totalFarmedSeconds: this.hourBooster.totalFarmedSeconds,
        multiplier: this.hourBooster.activeAppIds.length,
        targetDurationMinutes: this.hourBooster.targetDurationMinutes,
      },
      cardIdler: {
        isRunning: this.cardIdler.isRunning,
        currentApp: this.cardIdler.currentApp,
        totalCardsRemaining: this.cardIdler.totalCardsRemaining,
        dropsEarned: this.cardIdler.dropsEarned,
      },
    };
  }

  // --- AUTHENTICATION ---
  // 1. Check saved session
  async tryAutoLogin() {
    this.ensureDataDir();
    if (!fs.existsSync(SESSION_FILE)) {
      return false;
    }

    try {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      if (data && data.refreshToken) {
        this.isLoggingIn = true;
        if (data.steamID) {
          this.loadUserCaches(data.steamID);
          this.currentUser = {
            steamID: data.steamID,
            personaName: data.personaName || data.accountName || 'Steam User',
            avatarUrl: data.avatarUrl || null,
            level: data.level || 0,
            wallet: data.wallet || null,
            personaState: SteamUser.EPersonaState.Online,
          };
        }
        this.emit('auth_state', {
          isLoggedOn: false,
          isLoggingIn: true,
          user: this.currentUser,
        });
        this.log('info', 'Найден сохраненный токен сессии, автоматический вход...');
        this.client.logOn({ refreshToken: data.refreshToken });
        return true;
      }
    } catch (e) {
      this.isLoggingIn = false;
      this.log('warn', `Ошибка чтения сохраненной сессии: ${e.message}`);
    }
    this.isLoggingIn = false;
    return false;
  }

  cancelLogin() {
    const session = this.activeLoginSession;
    this.activeLoginSession = null;
    if (session) {
      session.cancelLoginAttempt();
      session.emit('vapor_cancel');
    }
    this.isLoggingIn = false;
  }

  createLoginSession() {
    this.cancelLogin();
    if (this.isLoggedOn) throw new Error('Сначала выйдите из текущего аккаунта Steam');
    const session = new LoginSession(EAuthTokenPlatformType.SteamClient);
    this.activeLoginSession = session;
    this.isLoggingIn = true;
    session.vaporResult = new Promise((resolve, reject) => {
      const fail = (err) => {
        if (this.activeLoginSession === session) {
          this.activeLoginSession = null;
          this.isLoggingIn = false;
          this.emit('client_error', { message: err.message });
          this.emit('auth_state', { isLoggedOn: false, isLoggingIn: false, user: null });
        }
        reject(err);
      };
      session.once('authenticated', () => {
        if (this.activeLoginSession !== session) return;
        this.finalizeLogin(session).then(resolve, fail);
      });
      session.on('error', fail);
      session.once('timeout', () => {
        this.emit('qr_timeout');
        fail(new Error('Срок действия авторизации истёк. Попробуйте снова.'));
      });
      session.once('vapor_cancel', () => reject(new Error('Авторизация отменена')));
    });
    // QR and device confirmation finish in the background.
    session.vaporResult.catch(() => {});
    return session;
  }

  // 2. Credentials login
  async loginWithCredentials(accountName, password, twoFactorCode = null, authCode = null) {
    this.log('info', `Попытка входа для пользователя "${accountName}"...`);

    const session = this.createLoginSession();

    try {
      const startRes = await session.startWithCredentials({
        accountName,
        password,
        steamGuardCode: twoFactorCode || authCode,
      });

      if (startRes.actionRequired) {
        if (startRes.validActions?.some((a) => a.type === EAuthSessionGuardType.EmailCode)) {
          // Email Guard code required
          this.log('warn', 'Требуется код подтверждения Steam Guard, отправленный на Email.');
          return {
            status: 'need_code',
            codeType: 'email',
            detail: startRes.validActions[0]?.detail,
          };
        } else if (startRes.validActions?.some((a) => a.type === EAuthSessionGuardType.DeviceCode)) {
          // Mobile 2FA Authenticator code required
          this.log('warn', 'Требуется мобильный код Steam Guard (2FA / Authenticator).');
          return {
            status: 'need_code',
            codeType: 'mobile',
          };
        } else {
          return {
            status: 'pending',
          };
        }
      }

      // If already authenticated:
      return await session.vaporResult;
    } catch (err) {
      if (this.activeLoginSession === session) this.cancelLogin();
      this.log('error', `Ошибка авторизации: ${err.message}`);
      throw err;
    }
  }

  // Submit Steam Guard Code
  async submitSteamGuardCode(code) {
    if (!this.activeLoginSession) {
      throw new Error('Нет активной сессии авторизации');
    }

    try {
      const session = this.activeLoginSession;
      this.log('info', 'Отправка кода Steam Guard...');
      await session.submitSteamGuardCode(code);
      return await session.vaporResult;
    } catch (err) {
      this.log('error', `Неверный код Steam Guard: ${err.message}`);
      throw err;
    }
  }

  // 3. QR Code login
  async startQRLogin() {
    this.log('info', 'Генерация QR-кода для входа через Steam Mobile...');
    const session = this.createLoginSession();

    let qrChallenge;
    try {
      qrChallenge = await session.startWithQR();
    } catch (err) {
      if (this.activeLoginSession === session) this.cancelLogin();
      throw err;
    }
    const qrDataUrl = await QRCode.toDataURL(qrChallenge.qrChallengeUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#252334',
        light: '#f3ead8',
      },
    });

    return {
      qrDataUrl,
      qrUrl: qrDataUrl,
      qrChallengeUrl: qrChallenge.qrChallengeUrl,
    };
  }

  async finalizeLogin(session) {
    if (!session.refreshToken) throw new Error('Steam ещё не подтвердил авторизацию');
    this.log('success', 'Токен получен. Подключение к серверам Steam...');
    this.ensureDataDir();
    const refreshToken = session.refreshToken;
    const steamID64 = session.steamID
      ? (typeof session.steamID.getSteamID64 === 'function'
          ? session.steamID.getSteamID64()
          : String(session.steamID))
      : null;
    const accountName = session.accountName || session._accountName || null;

    // Save data/session.json with accountName, steamID, refreshToken, savedAt
    fs.writeFileSync(
      SESSION_FILE,
      JSON.stringify(
        {
          accountName,
          steamID: steamID64,
          refreshToken,
          savedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf8'
    );

    this.isLoggingIn = true;
    this.client.logOn({ refreshToken });

    return {
      success: true,
      status: 'success',
      steamID: steamID64,
      accountName,
    };
  }

  logout() {
    this.cancelLogin();
    this.stopHourBooster();
    this.stopCardIdler();
    if (this.isLoggedOn) {
      this.client.logOff();
    }
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
    this.isLoggedOn = false;
    this.isLoggingIn = false;
    this.hasWebSession = false;
    this.currentUser = null;
    this.ownedGames = [];
    this.inventoryCache = null;
    this.inventoryCacheTime = 0;
    this.historyCache = null;
    this.historyCacheTime = 0;
    this.achievementsCache.clear();
    this.claimedFreeGames.clear();
    this.log('info', 'Выход из аккаунта Steam выполнен.');
    this.emit('auth_state', { isLoggedOn: false, isLoggingIn: false, user: null });
  }

  setPersonaState(state, statusName = null) {
    if (!this.isLoggedOn) throw new Error('Сначала необходимо авторизоваться в Steam');
    const names = { Online: 1, Offline: 0, Invisible: 7, Away: 3, Busy: 2, Snooze: 4 };
    const stateNum = state != null ? Number(state) : names[statusName];
    if (![0, 1, 2, 3, 4, 5, 6, 7].includes(stateNum)) throw new Error('Неизвестный статус Steam');
    try {
      this.client.setPersona(stateNum);
    } catch (e) {
      this.log('error', `Ошибка смены сетевого статуса: ${e.message}`);
      throw e;
    }

    try {
      const Schema = require('steam-user/protobufs/generated/_load.js');
      if (Schema?.CMsgClientChangeStatus && typeof this.client._send === 'function') {
        const payload = {
          persona_state: stateNum,
          persona_set_by_user: true
        };
        this.client._send(
          { msg: SteamUser.EMsg.ClientChangeStatus, proto: {} },
          Schema.CMsgClientChangeStatus.encode(payload).finish()
        );
      }
    } catch (e) {}

    if (this.currentUser) {
      this.currentUser.personaState = stateNum;
      this.emit('profile_updated', this.currentUser);
    }

    this.syncLocalSteamClientStatus(stateNum);

    const statusLabels = { 0: 'Офлайн', 1: 'В сети', 2: 'Не беспокоить', 3: 'Отошел', 4: 'Спит', 7: 'Невидимка' };
    this.log('info', `Сетевой статус профиля изменен: ${statusLabels[stateNum] || stateNum}`);
    return { success: true, personaState: stateNum };
  }

  syncLocalSteamClientStatus(stateNum) {
    if (process.platform !== 'win32') return;
    const protocolMap = {
      0: 'offline',
      1: 'online',
      2: 'busy',
      3: 'away',
      4: 'snooze',
      7: 'invisible'
    };
    const cmd = protocolMap[stateNum];
    if (!cmd) return;

    require('child_process').exec('tasklist /FI "IMAGENAME eq steam.exe" /NH', { windowsHide: true }, (err, stdout) => {
      if (!err && stdout && stdout.toLowerCase().includes('steam.exe')) {
        require('child_process').execFile('rundll32.exe', ['url.dll,FileProtocolHandler', `steam://status/${cmd}`], { windowsHide: true }, () => {});
      }
    });
  }

  // --- HOUR BOOSTER (Up to 32 games simultaneously) ---
  startHourBooster(appIds, targetDurationMinutes = null) {
    if (!this.isLoggedOn) {
      throw new Error('Сначала необходимо авторизоваться в Steam');
    }

    if (!Array.isArray(appIds) || appIds.length === 0) {
      throw new Error('Не выбраны игры для фарма часов');
    }

    // Steam supports up to 32 games simultaneously
    if (appIds.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) {
      throw new Error('AppID должен быть положительным целым числом');
    }
    const clampedAppIds = [...new Set(appIds.map(Number))].slice(0, 32);
    if (targetDurationMinutes != null && (!Number.isFinite(Number(targetDurationMinutes)) || Number(targetDurationMinutes) <= 0)) {
      throw new Error('Длительность должна быть положительным числом');
    }

    this.stopHourBooster();
    this.stopCardIdler();
    this.client.gamesPlayed(clampedAppIds);

    this.hourBooster.isRunning = true;
    this.hourBooster.activeAppIds = clampedAppIds;
    this.hourBooster.startTime = Date.now();
    this.hourBooster.elapsedSeconds = 0;
    this.hourBooster.totalFarmedSeconds = 0;
    this.hourBooster.targetDurationMinutes = targetDurationMinutes;

    const gameNames = clampedAppIds.map((id) => {
      const found = this.ownedGames.find((g) => g.appid === id);
      return found ? found.name : `AppID ${id}`;
    });

    this.log(
      'success',
      `Старт фарма часов: ${clampedAppIds.length} игр запущено параллельно (множитель ${clampedAppIds.length}x)!`
    );
    this.log('info', `Активные игры: ${gameNames.join(', ')}`);

    // Ticker every 1 second
    this.hourBooster.intervalId = setInterval(() => {
      this.hourBooster.elapsedSeconds = Math.floor((Date.now() - this.hourBooster.startTime) / 1000);
      this.hourBooster.totalFarmedSeconds = this.hourBooster.elapsedSeconds * this.hourBooster.activeAppIds.length;

      const progress = {
        isRunning: true,
        activeAppIds: this.hourBooster.activeAppIds,
        elapsedSeconds: this.hourBooster.elapsedSeconds,
        totalFarmedSeconds: this.hourBooster.totalFarmedSeconds,
        multiplier: this.hourBooster.activeAppIds.length,
        targetDurationMinutes: this.hourBooster.targetDurationMinutes,
      };

      this.emit('hour_booster_tick', progress);

      // Auto-stop on target duration
      if (
        this.hourBooster.targetDurationMinutes &&
        this.hourBooster.elapsedSeconds >= this.hourBooster.targetDurationMinutes * 60
      ) {
        this.log('info', `Таймер фарма часов завершен (${this.hourBooster.targetDurationMinutes} мин).`);
        this.stopHourBooster();
      }
    }, 1000);

    return {
      activeCount: clampedAppIds.length,
      multiplier: clampedAppIds.length,
    };
  }

  stopHourBooster() {
    if (this.hourBooster.intervalId) {
      clearInterval(this.hourBooster.intervalId);
      this.hourBooster.intervalId = null;
    }

    if (this.hourBooster.isRunning) {
      this.hourBooster.isRunning = false;
      this.hourBooster.activeAppIds = [];
      if (this.isLoggedOn) {
        this.client.gamesPlayed([]);
      }
      this.log('info', 'Фарм часов остановлен.');
      this.emit('hour_booster_tick', {
        isRunning: false,
        activeAppIds: [],
        elapsedSeconds: this.hourBooster.elapsedSeconds,
        totalFarmedSeconds: this.hourBooster.totalFarmedSeconds,
        multiplier: 0,
      });
    }
  }

  // --- TRADING CARD IDLER ---
  async scanCardDrops() {
    const steamID = this.client?.steamID ? this.client.steamID.getSteamID64() : this.currentUser?.steamID;
    if (!this.isLoggedOn || !steamID) {
      throw new Error('Сначала необходимо авторизоваться в Steam для сканирования карточек');
    }

    this.log('info', 'Сканирование оставшихся дропов карточек в библиотеке Steam...');

    // Ensure authenticated web session
    if (!this.hasWebSession) {
      try {
        if (this.isLoggedOn && typeof this.client.webLogOn === 'function') {
          this.client.webLogOn();
        }
      } catch (e) {
        this.log('warn', `Запрос веб-сессии: ${e.message}`);
      }

      // Also, if a refreshToken exists in session.json, create a new LoginSession(EAuthTokenPlatformType.SteamClient),
      // set session.refreshToken = refreshToken, call await session.getWebCookies(), and call this.community.setCookies(cookies)!
      if (fs.existsSync(SESSION_FILE)) {
        try {
          const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
          if (sessionData && sessionData.refreshToken) {
            const webSession = new LoginSession(EAuthTokenPlatformType.SteamClient);
            webSession.refreshToken = sessionData.refreshToken;
            const cookies = await webSession.getWebCookies();
            if (cookies && cookies.length > 0) {
              this.community.setCookies(cookies);
              this.hasWebSession = true;
              this.log('info', 'Веб-сессия Steam Community успешно авторизована через refresh-токен.');
            }
          }
        } catch (cookieErr) {
          this.log('warn', `Получение веб-куки через refresh токен: ${cookieErr.message}`);
        }
      }

      if (!this.hasWebSession && this.isLoggedOn) {
        await new Promise((resolve) => {
          const done = () => {
            clearTimeout(timeout);
            this.client.removeListener('webSession', done);
            resolve();
          };
          const timeout = setTimeout(done, 3000);
          this.client.once('webSession', done);
        });
      }
    }

    const dropGames = [];
    const seenAppIds = new Set();

    // Scrape all available pages until empty or no more card drops
    for (let p = 1; p <= 50; p++) {
      const pageGames = await this.fetchBadgePage(p, seenAppIds);
      dropGames.push(...pageGames);
      if (!pageGames.hasNextPage) break;
    }

    // Sort alphabetically
    dropGames.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

    this.log(
      'success',
      `Сканирование завершено: найдено ${dropGames.length} игр с доступными карточками!`
    );
    return dropGames;
  }

  fetchBadgePage(page, seenAppIds = new Set()) {
    return new Promise((resolve, reject) => {
      const url = `https://steamcommunity.com/my/badges/?p=${page}`;
      this.community.httpRequestGet(url, (err, res, body) => {
        if (err || !body || res?.statusCode !== 200) return reject(err || new Error('Не удалось загрузить страницу значков Steam'));

        if (body.includes('class="login_modal"') || body.includes('id="login_form"')) {
          this.log('warn', 'Сессия Steam Community не авторизована (перенаправление на страницу входа).');
          return reject(new Error('Веб-сессия Steam Community не авторизована'));
        }

        const parts = body.split(/class="[^"]*\bbadge_row\s+is_link[^"]*"/);
        const pageGames = [];

        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          const dropMatch =
            part.match(/(\d+)\s+card drops?\s+remaining/i) ||
            part.match(/Осталось[^<>\d]*(\d+)[^<>\d]*карточ/i) ||
            part.match(/<span\s+class="progress_info_bold">(\d+)\s+card drops?\s+remaining<\/span>/i) ||
            part.match(/Осталось[^<>\d]*карточ[^<>\d]*(\d+)/i) ||
            part.match(/Осталось[^<>\d]*выпадений[^<>\d]*(\d+)/i);

          if (!dropMatch) continue;

          const dropsCount = parseInt(dropMatch[1], 10);
          if (dropsCount <= 0 || isNaN(dropsCount)) continue;

          const appMatch =
            part.match(/\/gamecards\/(\d+)/) ||
            part.match(/steam:\/\/run\/(\d+)/) ||
            part.match(/gamebadge_(\d+)/);

          if (!appMatch) continue;

          const appid = parseInt(appMatch[1], 10);
          if (seenAppIds.has(appid)) continue;
          seenAppIds.add(appid);

          let name = `AppID ${appid}`;
          const titleMatch = part.match(/<div\s+class="badge_title">([\s\S]*?)<\/div>/i);
          if (titleMatch) {
            name = titleMatch[1]
              .replace(/<span[\s\S]*?<\/span>/gi, '')
              .replace(/<[^>]+>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/View details/gi, '')
              .trim();
          } else {
            const found = this.ownedGames.find((g) => g.appid === appid);
            if (found) name = found.name;
          }

          pageGames.push({
            appid,
            name,
            cardsRemaining: dropsCount,
          });
        }
        Object.defineProperty(pageGames, 'hasNextPage', {
          value: new RegExp(`[?&]p=${page + 1}(?:[&"'#]|&amp;)`).test(body)
        });
        resolve(pageGames);
      });
    });
  }

  startCardIdler(gamesWithDrops) {
    if (!this.isLoggedOn) {
      throw new Error('Сначала необходимо авторизоваться в Steam');
    }

    if (!Array.isArray(gamesWithDrops) || gamesWithDrops.length === 0) {
      throw new Error('Нет доступных игр с карточками для фарма');
    }

    // Normalize input to objects with appid, name, cardsRemaining
    const normalized = gamesWithDrops.map((item) => {
      if (typeof item === 'number' || typeof item === 'string') {
        const id = Number(item);
        const owned = this.ownedGames.find((g) => g.appid === id);
        return {
          appid: id,
          name: owned ? owned.name : `AppID ${id}`,
          cardsRemaining: 3
        };
      }
      return {
        appid: Number(item.appid || item.appId),
        name: item.name || item.title || `AppID ${item.appid || item.appId}`,
        cardsRemaining: Number(item.cardsRemaining ?? 0)
      };
    }).filter((g) => Number.isSafeInteger(g.appid) && g.appid > 0 && Number.isFinite(g.cardsRemaining) && g.cardsRemaining > 0);
    if (!normalized.length) throw new Error('Нет доступных игр с карточками для фарма');

    this.stopCardIdler();
    this.stopHourBooster(); // Pause hour booster to idle cards

    this.cardIdler.isRunning = true;
    this.cardIdler.queue = [...normalized];
    this.cardIdler.dropsEarned = 0;
    this.cardIdler.totalCardsRemaining = normalized.reduce((acc, g) => acc + (g.cardsRemaining || 0), 0);
    this.cardIdler.startTime = Date.now();

    this.idleNextCardGame();
    return { success: true, count: normalized.length };
  }

  idleNextCardGame() {
    if (!this.cardIdler.isRunning) return;

    if (this.cardIdler.queue.length === 0) {
      this.log('success', 'Все доступные коллекционные карточки успешно выбиты!');
      this.stopCardIdler();
      return;
    }

    const nextGame = this.cardIdler.queue[0];
    this.cardIdler.currentApp = nextGame;

    this.log(
      'info',
      `Фарм карточек: запуск "${nextGame.name}" (осталось выбить карточек: ${nextGame.cardsRemaining})...`
    );
    this.client.gamesPlayed([nextGame.appid]);

    this.emit('card_idler_tick', {
      isRunning: true,
      currentApp: nextGame,
      queueLength: this.cardIdler.queue.length,
      totalCardsRemaining: this.cardIdler.totalCardsRemaining,
      dropsEarned: this.cardIdler.dropsEarned,
    });

    // Check for drop every 10 minutes
    if (this.cardIdler.checkIntervalId) clearInterval(this.cardIdler.checkIntervalId);
    this.cardIdler.checkIntervalId = setInterval(async () => {
      try {
        const freshList = await this.scanCardDrops();
        if (!this.cardIdler.isRunning || this.cardIdler.currentApp !== nextGame) return;
        const updated = freshList.find((g) => g.appid === nextGame.appid);
        if (!updated || updated.cardsRemaining === 0) {
          this.log('success', `Все карточки для игры "${nextGame.name}" получены!`);
          this.cardIdler.dropsEarned += nextGame.cardsRemaining;
          this.cardIdler.totalCardsRemaining = Math.max(0, this.cardIdler.totalCardsRemaining - nextGame.cardsRemaining);
          this.cardIdler.queue.shift();
          this.idleNextCardGame();
        } else if (updated.cardsRemaining < nextGame.cardsRemaining) {
          const dropped = nextGame.cardsRemaining - updated.cardsRemaining;
          this.log('success', `Дроп карточки! Получено +${dropped} в "${nextGame.name}"!`);
          this.cardIdler.dropsEarned += dropped;
          this.cardIdler.totalCardsRemaining -= dropped;
          nextGame.cardsRemaining = updated.cardsRemaining;
          this.emit('card_idler_tick', {
            isRunning: true,
            currentApp: nextGame,
            queueLength: this.cardIdler.queue.length,
            totalCardsRemaining: this.cardIdler.totalCardsRemaining,
            dropsEarned: this.cardIdler.dropsEarned,
          });
        }
      } catch (e) {
        // Continue idling
      }
    }, 10 * 60 * 1000);
  }

  stopCardIdler() {
    if (this.cardIdler.checkIntervalId) {
      clearInterval(this.cardIdler.checkIntervalId);
      this.cardIdler.checkIntervalId = null;
    }
    if (this.cardIdler.isRunning) {
      this.cardIdler.isRunning = false;
      this.cardIdler.currentApp = null;
      if (this.isLoggedOn) {
        this.client.gamesPlayed([]);
      }
      this.log('info', 'Фарм карточек остановлен.');
      this.emit('card_idler_tick', { isRunning: false });
    }
  }

  // --- ACHIEVEMENTS MANAGER ---
  fetchUrlWithRedirects(url, maxHops = 5) {
    return new Promise((resolve, reject) => {
      if (maxHops <= 0) return resolve('');
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      };
      try {
        if (this.community && this.community._jar) {
          const cookieStr = this.community._jar.getCookieStringSync('https://steamcommunity.com');
          if (cookieStr) headers['Cookie'] = cookieStr;
        }
      } catch (e) {}

      const req = https.get(url, { headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let nextUrl = res.headers.location;
          if (url.includes('xml=1') && !nextUrl.includes('xml=1')) {
            nextUrl += nextUrl.includes('?') ? '&xml=1' : '/?xml=1';
          }
          return this.fetchUrlWithRedirects(nextUrl, maxHops - 1).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      });
      req.on('error', () => resolve(''));
      req.setTimeout(8000, () => {
        req.destroy();
        resolve('');
      });
    });
  }

  sendClientGetUserStats(appid) {
    return new Promise((resolve, reject) => {
      if (!this.isLoggedOn) {
        return reject(new Error('Не авторизован в Steam'));
      }
      const sid = this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
      if (!sid) {
        return reject(new Error('SteamID отсутствует'));
      }
      const payload = {
        game_id: appid,
        crc_stats: 0,
        schema_local_version: 0,
        steam_id_for_user: sid,
      };

      const timeout = setTimeout(() => {
        reject(new Error('ClientGetUserStats timeout'));
      }, 7000);

      try {
        this.client._send(
          { msg: SteamUser.EMsg.ClientGetUserStats, proto: {} },
          payload,
          (res) => {
            clearTimeout(timeout);
            resolve(res);
          }
        );
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  parseProtoAchievements(appid, res) {
    if (!res || !res.schema) return [];
    let parsed;
    try {
      parsed = BinaryKVParser.parse(res.schema);
    } catch (e) {
      return [];
    }

    const appObj = parsed[String(appid)] || parsed[Number(appid)] || parsed;
    if (!appObj || !appObj.stats) return [];

    // Map user stats: stat_id -> stat_value
    const userStatsMap = new Map();
    if (Array.isArray(res.stats)) {
      for (const s of res.stats) {
        userStatsMap.set(Number(s.stat_id), Number(s.stat_value));
      }
    }

    const achievements = [];
    const statsObj = appObj.stats;

    for (const statId of Object.keys(statsObj)) {
      const statDef = statsObj[statId];
      if (!statDef) continue;

      const isAchStat =
        statDef.type === 'ACHIEVEMENTS' ||
        statDef.type === 8 ||
        statDef.type === 4 ||
        statDef.bits;

      if (!isAchStat || !statDef.bits) continue;

      const userVal = userStatsMap.get(Number(statId)) || 0;
      const bitsObj = statDef.bits;

      for (const bitKey of Object.keys(bitsObj)) {
        const bitIndex = Number(bitKey);
        const achInfo = bitsObj[bitKey];
        if (!achInfo) continue;

        const isUnlocked = (userVal & (1 << bitIndex)) !== 0;
        const apiName = achInfo.name || `ACH_${bitIndex}`;

        const display = achInfo.display || {};
        const title = typeof display.name === 'object'
          ? (display.name.russian || display.name.english || apiName)
          : (display.name || apiName);
        const desc = typeof display.desc === 'object'
          ? (display.desc.russian || display.desc.english || '')
          : (display.desc || display.description || '');

        const iconHash = display.icon || '';
        const iconGrayHash = display.icon_gray || display.icon || '';

        const iconOpen = iconHash.startsWith('http')
          ? iconHash
          : (iconHash ? `https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/${appid}/${iconHash}` : '');
        const iconClosed = iconGrayHash.startsWith('http')
          ? iconGrayHash
          : (iconGrayHash ? `https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/${appid}/${iconGrayHash}` : iconOpen);

        achievements.push({
          apiName,
          name: title,
          description: desc,
          unlocked: isUnlocked,
          iconOpen,
          iconClosed,
          statId: Number(statId),
          bit: bitIndex,
        });
      }
    }

    return achievements;
  }

  async getAchievementsFallback(appid) {
    const steamID64 = this.client?.steamID ? this.client.steamID.getSteamID64() : this.currentUser?.steamID;
    const parseAchievementsFromXml = (xmlStr) => {
      const achievements = [];
      const achBlocks = xmlStr.match(/<achievement[\s\S]*?<\/achievement>/g) || [];

      for (const block of achBlocks) {
        const closedMatch = block.match(/closed="(\d)"/i);
        const nameMatch = block.match(/<name>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/name>/i);
        const apiMatch = block.match(/<apiname>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/apiname>/i);
        const descMatch = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        const iconClosedMatch = block.match(/<iconClosed>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/iconClosed>/i);
        const iconOpenMatch = block.match(/<iconOpen>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/iconOpen>/i);

        const isUnlocked = closedMatch ? closedMatch[1] === '1' : false;
        let apiName = apiMatch ? apiMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';

        if (apiName) {
          achievements.push({
            apiName,
            name: nameMatch ? nameMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : apiName,
            description: descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '',
            unlocked: isUnlocked,
            iconOpen: iconOpenMatch ? iconOpenMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '',
            iconClosed: iconClosedMatch ? iconClosedMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '',
          });
        }
      }
      return achievements;
    };

    let achievements = [];
    let personal = false;

    // 1. Query user stats: https://steamcommunity.com/profiles/${steamID64}/stats/${appid}/?xml=1
    if (steamID64) {
      const userStatsUrl = `https://steamcommunity.com/profiles/${steamID64}/stats/${appid}/?xml=1`;
      try {
        const body = await this.fetchUrlWithRedirects(userStatsUrl);
        if (body && !body.includes('<error>') && body.includes('<achievement')) {
          achievements = parseAchievementsFromXml(body);
          personal = achievements.length > 0;
        }
      } catch (e) {}
    }

    // 2. If user profile is Private or returns <error> or no achievements, fall back to querying public schema
    if (achievements.length === 0) {
      this.log('info', `Профиль скрыт или нет персональной статистики, запрос публичной схемы достижений для AppID ${appid}...`);

      // 2a. Global stats XML: https://steamcommunity.com/stats/${appid}/achievements/?xml=1
      try {
        const publicStatsUrl = `https://steamcommunity.com/stats/${appid}/achievements/?xml=1`;
        const publicXml = await this.fetchUrlWithRedirects(publicStatsUrl);
        if (publicXml && !publicXml.includes('<error>') && publicXml.includes('<achievement')) {
          achievements = parseAchievementsFromXml(publicXml);
        }
      } catch (e) {}

      // 2b. Global stats alternate URL: https://steamcommunity.com/stats/${appid}/?xml=1
      if (achievements.length === 0) {
        try {
          const publicStatsAlt = `https://steamcommunity.com/stats/${appid}/?xml=1`;
          const altXml = await this.fetchUrlWithRedirects(publicStatsAlt);
          if (altXml && !altXml.includes('<error>') && altXml.includes('<achievement')) {
            achievements = parseAchievementsFromXml(altXml);
          }
        } catch (e) {}
      }

      // 2c. Steam Web API GetSchemaForGame if key is present
      if (achievements.length === 0 && process.env.STEAM_API_KEY) {
        try {
          const schemaUrl = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${process.env.STEAM_API_KEY}&appid=${appid}`;
          const schemaJson = await this.fetchUrlWithRedirects(schemaUrl);
          const parsed = JSON.parse(schemaJson);
          const apiAchs = parsed?.game?.availableGameStats?.achievements;
          if (Array.isArray(apiAchs) && apiAchs.length > 0) {
            achievements = apiAchs.map((a) => ({
              apiName: a.name,
              name: a.displayName || a.name,
              description: a.description || '',
              unlocked: false,
              iconOpen: a.icon || '',
              iconClosed: a.icongray || a.icon || '',
            }));
          }
        } catch (e) {}
      }

      // 2d. Steam Web API GetGlobalAchievementPercentagesForApp (public, no key needed)
      if (achievements.length === 0) {
        try {
          const globalUrl = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appid}`;
          const globalJson = await this.fetchUrlWithRedirects(globalUrl);
          const parsed = JSON.parse(globalJson);
          const globalAchs = parsed?.achievementpercentages?.achievements;
          if (Array.isArray(globalAchs) && globalAchs.length > 0) {
            achievements = globalAchs.map((a) => ({
              apiName: a.name,
              name: a.name,
              description: '',
              unlocked: false,
              iconOpen: `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${appid}/${a.name}.jpg`,
              iconClosed: `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${appid}/${a.name}.jpg`,
            }));
          }
        } catch (e) {}
      }
    }

    return { achievements, personal };
  }

  async getGameAchievements(appid) {
    const numAppId = Number(appid);
    // Check memory cache
    const cached = this.achievementsCache.get(numAppId);
    if (cached && (Date.now() - cached.time < 60000)) {
      return cached.data;
    }

    this.log('info', `Запрос списка достижений для AppID ${numAppId}...`);
    let achievements = [];

    // 1. Try native Steam Client protocol (ClientGetUserStats + BinaryKVParser)
    if (this.isLoggedOn) {
      try {
        const protoRes = await this.sendClientGetUserStats(numAppId);
        if (protoRes && protoRes.schema) {
          achievements = this.parseProtoAchievements(numAppId, protoRes);
          const userStatIds = new Set((protoRes.stats || []).map(stat => Number(stat.stat_id)));
          if (achievements.length > 0 && achievements.every(achievement => userStatIds.has(achievement.statId))) {
            this.log('success', `Получено ${achievements.length} достижений для AppID ${numAppId} через Steam CM сокет.`);
            this.achievementsCache.set(numAppId, { data: achievements, time: Date.now(), verified: true });
            return achievements;
          }
        }
      } catch (err) {
        this.log('info', `Steam CM ClientGetUserStats: ${err.message}, переход к XML fallback...`);
      }
    }

    // 2. Fallback to XML and Web API
    const fallback = await this.getAchievementsFallback(numAppId);
    achievements = fallback.achievements;
    this.log('success', `Получено ${achievements.length} достижений для AppID ${numAppId}.`);
    this.achievementsCache.set(numAppId, { data: achievements, time: Date.now(), verified: fallback.personal });
    return achievements;
  }

  async getAchievementsSummary(appids) {
    if (!Array.isArray(appids) || appids.length === 0) {
      appids = (this.ownedGames || []).map((g) => g.appid).slice(0, 50);
    }
    if (appids.length === 0) {
      return {};
    }

    const summary = {};
    const promises = appids.map(async (id) => {
      const numId = Number(id);
      try {
        const achs = await this.getGameAchievements(numId);
        const total = achs.length;
        const unlocked = achs.filter((a) => a.unlocked).length;
        summary[numId] = { total, unlocked };
      } catch (e) {
        summary[numId] = { total: 0, unlocked: 0 };
      }
    });

    await Promise.allSettled(promises);
    return summary;
  }

  async unlockAchievements(appid, achievementApiNames) {
    if (!Number.isSafeInteger(Number(appid)) || Number(appid) <= 0 || !Array.isArray(achievementApiNames) || !achievementApiNames.length) {
      return { success: false, error: 'Укажите AppID и список достижений' };
    }
    if (this.hourBooster.isRunning || this.cardIdler.isRunning) return { success: false, error: 'Остановите фарм перед изменением достижений' };
    if (!this.isLoggedOn) {
      return { success: false, error: 'Сначала необходимо авторизоваться в Steam' };
    }
    const sid = this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
    if (!sid) {
      return { success: false, error: 'SteamID отсутствует' };
    }

    const numAppId = Number(appid);
    this.log(
      'info',
      `Синхронизация ISteamUserStats: запуск AppID ${numAppId} и отправка ${achievementApiNames.length} достижений...`
    );

    // Keep game active in Steam protocol
    try {
      this.client.gamesPlayed([numAppId]);
    } catch (e) {}

    let userStatsRes;
    try {
      userStatsRes = await this.sendClientGetUserStats(numAppId);
    } catch (err) {
      this.log('warn', `ClientGetUserStats error: ${err.message}`);
    }

    if (!userStatsRes || !userStatsRes.schema) {
      this.achievementsCache.delete(numAppId);
      return { success: false, error: 'Steam не предоставил схему достижений. Изменения не подтверждены.' };
    }

    let parsed;
    try {
      parsed = BinaryKVParser.parse(userStatsRes.schema);
    } catch (e) {
      return { success: false, error: 'Ошибка парсинга бинарной схемы' };
    }

    const appObj = parsed[String(numAppId)] || parsed[numAppId] || parsed;
    const statsObj = appObj?.stats || {};

    const userStatsMap = new Map();
    if (Array.isArray(userStatsRes.stats)) {
      for (const s of userStatsRes.stats) {
        userStatsMap.set(Number(s.stat_id), Number(s.stat_value));
      }
    }

    const targetSet = new Set(achievementApiNames);

    for (const statId of Object.keys(statsObj)) {
      const statDef = statsObj[statId];
      if (!statDef || !statDef.bits) continue;

      let currentStatVal = userStatsMap.get(Number(statId)) || 0;
      let statModified = false;

      for (const bitKey of Object.keys(statDef.bits)) {
        const achInfo = statDef.bits[bitKey];
        if (achInfo && targetSet.has(achInfo.name)) {
          const bitIndex = Number(bitKey);
          currentStatVal |= (1 << bitIndex);
          statModified = true;
        }
      }

      if (statModified) {
        userStatsMap.set(Number(statId), currentStatVal);
      }
    }

    const updatedStats = Array.from(userStatsMap.entries()).map(([stat_id, stat_value]) => ({
      stat_id: Number(stat_id),
      stat_value: Number(stat_value),
    }));

    const payload = {
      game_id: numAppId,
      settor_steam_id: sid,
      settee_steam_id: sid,
      crc_stats: userStatsRes.crc_stats || 0,
      explicit_reset: false,
      stats: updatedStats,
    };

    this.achievementsCache.delete(numAppId);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Steam не подтвердил сохранение достижений за 5 секунд' });
      }, 5000);

      this.client._send(
        { msg: SteamUser.EMsg.ClientStoreUserStats2, proto: {} },
        payload,
        (res) => {
          clearTimeout(timeout);
          if (res?.eresult !== 1) return resolve({ success: false, error: `Steam отклонил сохранение: ${res?.eresult ?? 'нет подтверждения'}` });
          this.log('success', `Достижения для AppID ${numAppId} сохранены в Steam CM.`);
          resolve({ success: true, eresult: res.eresult, count: achievementApiNames.length });
        }
      );
    });
  }

  async resetAchievements(appid) {
    if (!Number.isSafeInteger(Number(appid)) || Number(appid) <= 0) return { success: false, error: 'Некорректный AppID' };
    if (this.hourBooster.isRunning || this.cardIdler.isRunning) return { success: false, error: 'Остановите фарм перед изменением достижений' };
    if (!this.isLoggedOn) {
      return { success: false, error: 'Сначала необходимо авторизоваться в Steam' };
    }
    const sid = this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
    if (!sid) {
      return { success: false, error: 'SteamID отсутствует' };
    }

    const numAppId = Number(appid);
    this.log('info', `Сброс всех достижений для AppID ${numAppId} в Steam CM (ClientStoreUserStats2, explicit_reset: true)...`);

    try {
      this.client.gamesPlayed([numAppId]);
    } catch (e) {}

    let crc = 0;
    let zeroedStats = [];

    try {
      const userStatsRes = await this.sendClientGetUserStats(numAppId);
      if (userStatsRes) {
        crc = userStatsRes.crc_stats || 0;
        if (Array.isArray(userStatsRes.stats)) {
          zeroedStats = userStatsRes.stats.map((s) => ({
            stat_id: Number(s.stat_id),
            stat_value: 0,
          }));
        }
      }
    } catch (err) {
      this.log('warn', `ClientGetUserStats error during reset: ${err.message}`);
    }

    const payload = {
      game_id: numAppId,
      settor_steam_id: sid,
      settee_steam_id: sid,
      crc_stats: crc,
      explicit_reset: true,
      stats: zeroedStats,
    };

    this.achievementsCache.delete(numAppId);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Steam не подтвердил сброс достижений за 5 секунд' });
      }, 5000);

      this.client._send(
        { msg: SteamUser.EMsg.ClientStoreUserStats2, proto: {} },
        payload,
        (res) => {
          clearTimeout(timeout);
          if (res?.eresult !== 1) return resolve({ success: false, error: `Steam отклонил сброс: ${res?.eresult ?? 'нет подтверждения'}` });
          this.log('success', `Достижения для AppID ${numAppId} сброшены в Steam.`);
          resolve({ success: true, eresult: res.eresult });
        }
      );
    });
  }

  // --- GAME COLLECTOR BOOSTER (Claim Free Games) ---
  getFreeGamesList() {
    const ownedPackages = new Set((this.client.licenses || []).map((license) => license.package_id));
    return FREE_GAMES_DATABASE.map((game) => ({
      ...game,
      isOwned: ownedPackages.has(game.subid) || this.claimedFreeGames.has(game.subid),
    }));
  }

  async claimFreePackage(game, steamID) {
    if (game.requiresAppid && !this.ownedGames.some((owned) => owned.appid === game.requiresAppid)
      && !this.getFreeGamesList().some((owned) => owned.appid === game.requiresAppid && owned.isOwned)) {
      throw new Error(`Требуется базовая игра AppID ${game.requiresAppid}`);
    }
    const details = await new Promise((resolve, reject) => {
      this.community.httpRequest({
        url: `https://store.steampowered.com/api/appdetails?appids=${game.appid}&l=english`,
        json: true, timeout: 10000,
      }, (err, _response, body) => err ? reject(err) : resolve(body?.[game.appid]));
    });
    const free = details?.success && details.data?.steam_appid === game.appid
      && details.data?.package_groups?.some((group) =>
      group.subs?.some((sub) => sub.packageid === game.subid && sub.is_free_license === true
        && Number(sub.price_in_cents_with_discount) === 0));
    if (!free) throw new Error('Бесплатный пакет больше недоступен в вашем регионе');
    if (!this.isLoggedOn || this.client.steamID?.getSteamID64() !== steamID
      || this.currentUser?.steamID !== steamID || !this.hasWebSession
      || this.community.steamID?.getSteamID64() !== steamID) {
      throw new Error('Аккаунт Steam изменился во время получения лицензий');
    }

    const result = await new Promise((resolve, reject) => {
      this.community.httpRequestPost({
        url: `https://store.steampowered.com/freelicense/addfreelicense/${game.subid}`,
        form: { ajax: true, sessionid: this.community.getSessionID('https://store.steampowered.com') },
        json: true, timeout: 10000,
      }, (err, response, body) => err ? reject(err)
        : response?.statusCode === 200 && Array.isArray(body) && body.length === 0
          ? resolve(true) : reject(new Error(`Steam не подтвердил получение пакета (${response?.statusCode || 'нет ответа'})`)));
    });
    return result;
  }

  async claimFreeGamesBatch(batchSize = 25, explicitAppIds = null) {
    if (this.collector.isRunning) throw new Error('Активация лицензий уже выполняется');
    batchSize = Math.max(1, Math.min(100, Math.floor(Number(batchSize) || 25)));
    if (!this.isLoggedOn) {
      throw new Error('Сначала необходимо авторизоваться в Steam');
    }
    const steamID = this.client.steamID?.getSteamID64();
    if (!this.hasWebSession || !steamID || this.currentUser?.steamID !== steamID
      || this.community.steamID?.getSteamID64() !== steamID) {
      throw new Error('Нет веб-сессии этого аккаунта Steam. Повторно войдите в Steam.');
    }

    let toClaim = [];
    if (Array.isArray(explicitAppIds) && explicitAppIds.length > 0) {
      const freeGames = this.getFreeGamesList();
      toClaim = [...new Set(explicitAppIds.map(Number))].map((id) => freeGames.find((g) => g.appid === id));
      if (toClaim.some((game) => !game)) throw new Error('AppID отсутствует в проверенном каталоге коллекционера');
      toClaim = toClaim.filter((game) => !game.isOwned);
    } else {
      const freeGames = this.getFreeGamesList();
      const unowned = freeGames.filter((g) => !g.isOwned);

      if (unowned.length === 0) {
        this.log('info', 'Все доступные бесплатные игры из каталога уже есть на вашем аккаунте!');
        return { success: true, totalClaimed: 0, grantedCount: 0, message: 'Все игры уже получены' };
      }

      toClaim = unowned.slice(0, batchSize);
    }

    this.collector.isRunning = true;
    this.collector.totalToClaim = toClaim.length;
    this.collector.claimedCount = 0;

    this.log(
      'info',
      `Активация ${toClaim.length} бесплатных лицензий в Steam...`
    );

    try {
      const successfullyClaimed = [];
      const failedGames = [];
      for (const game of toClaim) {
        if (!this.isLoggedOn || this.client.steamID?.getSteamID64() !== steamID
          || this.currentUser?.steamID !== steamID
          || !this.hasWebSession || this.community.steamID?.getSteamID64() !== steamID) {
          throw new Error('Аккаунт Steam изменился во время получения лицензий');
        }
        try {
          await this.claimFreePackage(game, steamID);
          if (this.client.steamID?.getSteamID64() !== steamID || this.currentUser?.steamID !== steamID) {
            throw new Error('Аккаунт Steam изменился');
          }
          successfullyClaimed.push(game);
          this.claimedFreeGames.add(game.subid);
          this.saveClaimedGames();
        } catch (e) {
          failedGames.push(`${game.name}: ${e.message}`);
        }
      }

      const count = successfullyClaimed.length;
      this.collector.claimedCount = count;
      this.collector.isRunning = false;

      this.log('info', `Steam подтвердил получение ${count} бесплатных пакетов; не получено: ${failedGames.length}. Значок проверяется отдельно.`);
      return {
        success: count > 0 || failedGames.length === 0,
        grantedCount: count,
        claimedGames: successfullyClaimed.map((g) => g.name),
        failedGames,
        error: count === 0 && failedGames.length ? failedGames[0] : undefined,
      };
    } catch (e) {
      this.collector.isRunning = false;
      this.log('warn', `Результат запроса лицензий: ${e.message}`);
      return {
        success: false,
        error: e.message,
      };
    }
  }

  // --- ECONOMY & INVENTORY ---
  getCuratedInventory() {
    return [];
  }

  // --- LIVE INVENTORY & HISTORY FETCHING ---
  async fetchLiveInventory() {
    const sid = this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
    if (!this.hasWebSession || !sid) {
      if (this.inventoryCache && this.inventoryCache.length > 0) return this.inventoryCache;
      return this.getCuratedInventory();
    }

    const apps = [
      { appid: 730, contextid: 2, name: 'CS2' },
      { appid: 570, contextid: 2, name: 'Dota 2' },
      { appid: 753, contextid: 6, name: 'Steam Карточки' },
      { appid: 440, contextid: 2, name: 'TF2' },
      { appid: 252490, contextid: 2, name: 'Rust' }
    ];

    const allItems = [];
    const symbol = this.currentUser?.walletSymbol || '₴';

    for (const app of apps) {
      try {
        await new Promise((r) => setTimeout(r, 450));
        const items = await new Promise((resolve) => {
          this.community.getUserInventoryContents(sid, app.appid, app.contextid, true, 'russian', (err, inv) => {
            if (err) resolve([]);
            else resolve(inv || []);
          });
        });

        for (const it of items) {
          const rarityTag = Array.isArray(it.tags) ? it.tags.find((t) => t.category === 'Rarity' || t.category_name === 'Редкость') : null;
          const exteriorTag = Array.isArray(it.tags) ? it.tags.find((t) => t.category === 'Exterior') : null;

          let priceNum = 5;
          const nameLower = (it.market_hash_name || it.name || '').toLowerCase();
          if (nameLower.includes('kilowatt') || nameLower.includes('киловатт')) priceNum = 82;
          else if (nameLower.includes('revolution') || nameLower.includes('революция')) priceNum = 45;
          else if (nameLower.includes('frying pan') || nameLower.includes('сковорода')) priceNum = 55;
          else if (nameLower.includes('ringmaster') || nameLower.includes('рингмастер')) priceNum = 72;
          else if (nameLower.includes('genesis') || nameLower.includes('генезис')) priceNum = 35;
          else if (nameLower.includes('banana leaf') || nameLower.includes('банановые листья')) priceNum = 28;
          else if (nameLower.includes('electric blue') || nameLower.includes('электрическая синь')) priceNum = 22;
          else if (nameLower.includes('ellis') || nameLower.includes('эллис')) priceNum = 35;
          else if (nameLower.includes('case') || nameLower.includes('кейс')) priceNum = 25;
          else if (nameLower.includes('arcana') || nameLower.includes('аркана')) priceNum = 850;
          else if (nameLower.includes('immortal')) priceNum = 180;
          else if (nameLower.includes('taunt') || nameLower.includes('насмешка')) priceNum = 45;
          else if (nameLower.includes('announcer') || nameLower.includes('комментатор')) priceNum = 35;
          else if (nameLower.includes('loading screen') || nameLower.includes('загрузочный экран')) priceNum = 6;
          else if (rarityTag && rarityTag.name && rarityTag.name.includes('Тайное')) priceNum = 450;
          else if (rarityTag && rarityTag.name && rarityTag.name.includes('Засекреченное')) priceNum = 180;
          else if (rarityTag && rarityTag.name && rarityTag.name.includes('Запрещенное')) priceNum = 65;
          else if (rarityTag && rarityTag.name && rarityTag.name.includes('Армейское')) priceNum = 20;
          else if (app.appid === 753) priceNum = 2;

          allItems.push({
            id: it.assetid || it.id,
            name: it.name,
            market_hash_name: it.market_hash_name || it.name,
            game: app.name,
            gameId: app.appid,
            wear: exteriorTag ? exteriorTag.name : (it.type || app.name),
            rarity: rarityTag ? rarityTag.name : 'Стандартное',
            rarityColor: rarityTag && rarityTag.color ? `#${rarityTag.color}` : '#8847ff',
            price: `${priceNum} ${symbol}`,
            priceNum,
            tradable: Boolean(it.tradable),
            image: it.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${it.icon_url}/360fx360f` : ''
          });
        }
      } catch (e) {}
    }

    // Safeguard: Merge with previous cache so rate-limited apps retain their items
    if (this.inventoryCache && this.inventoryCache.length > 0) {
      for (const app of apps) {
        const fetchedForApp = allItems.filter((i) => i.gameId === app.appid);
        if (fetchedForApp.length === 0) {
          const prevForApp = this.inventoryCache.filter((i) => i.gameId === app.appid);
          allItems.push(...prevForApp);
        }
      }
    }

    if (allItems.length > 0) {
      allItems.sort((a, b) => (b.priceNum || 0) - (a.priceNum || 0));
      this.inventoryCache = allItems;
      this.inventoryCacheTime = Date.now();
      const invPath = this.getInventoryCachePath(sid);
      if (invPath) {
        try {
          fs.writeFileSync(invPath, JSON.stringify(allItems, null, 2), 'utf8');
        } catch (e) {}
      }
      return allItems;
    }

    if (this.inventoryCache && this.inventoryCache.length > 0) return this.inventoryCache;
    return [];
  }

  async fetchLiveInventoryHistory() {
    if (!this.hasWebSession) {
      if (this.historyCache && this.historyCache.length > 0) return this.historyCache;
      return [];
    }

    return new Promise((resolve) => {
      this.community.httpRequestGet({
        uri: 'https://steamcommunity.com/my/inventoryhistory/?l=russian',
        json: false
      }, (err, res, body) => {
        if (err || !body) {
          resolve(this.historyCache || []);
          return;
        }

        try {
          const historyItems = [];
          const rowMatches = [...body.matchAll(/<div class="tradehistoryrow">([\s\S]*?)(?=<div class="tradehistoryrow"|$)/g)];

          for (let i = 0; i < Math.min(rowMatches.length, 50); i++) {
            const row = rowMatches[i][1];
            const dateMatch = row.match(/<div class="tradehistory_date">\s*([^\n<]+)\s*<div class="tradehistory_timestamp">([^<]+)<\/div>/);
            const descMatch = row.match(/<div class="tradehistory_event_description">([\s\S]*?)<\/div>/);
            const signMatch = row.match(/<div class="tradehistory_items_plusminus">([+\-])<\/div>/);

            const items = [];
            const itemMatches = [...row.matchAll(/<a[^>]*class="[^"]*history_item[^"]*"[^>]*data-appid="(\d+)"[^>]*>([\s\S]*?)<\/a>/g)];

            for (const im of itemMatches) {
              const appid = parseInt(im[1], 10);
              const inner = im[2];
              const imgMatch = inner.match(/<img[^>]*src="([^"]+)"/);
              const nameMatch = inner.match(/<span class="history_item_name"[^>]*>([^<]+)<\/span>/);
              const colorMatch = inner.match(/style="color:\s*([^;"]+)"/);

              let game = 'Steam';
              if (appid === 730) game = 'CS2';
              if (appid === 570) game = 'Dota 2';
              if (appid === 440) game = 'TF2';
              if (appid === 252490) game = 'Rust';
              if (appid === 753) game = 'Сообщество Steam';

              items.push({
                appid,
                game,
                name: nameMatch ? nameMatch[1].trim() : 'Предмет Steam',
                image: imgMatch ? imgMatch[1] : '',
                color: colorMatch ? colorMatch[1].trim() : '#d2d2d2'
              });
            }

            if (descMatch) {
              const rawDesc = descMatch[1].replace(/<[^>]+>/g, '').trim();
              historyItems.push({
                id: `hist-${i}-${Date.now()}`,
                date: dateMatch ? dateMatch[1].trim() : '',
                time: dateMatch ? dateMatch[2].trim() : '',
                event: rawDesc,
                type: signMatch ? signMatch[1] : '+',
                items
              });
            }
          }

          if (historyItems.length > 0) {
            this.historyCache = historyItems;
            this.historyCacheTime = Date.now();
            const sid = this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
            const histPath = this.getHistoryCachePath(sid);
            if (histPath) {
              try {
                fs.writeFileSync(histPath, JSON.stringify(historyItems, null, 2), 'utf8');
              } catch (e) {}
            }
          }
          resolve(historyItems);
        } catch (e) {
          resolve(this.historyCache || []);
        }
      });
    });
  }

  async getInventoryItems(gameFilter = 'all', sortBy = 'price_desc') {
    const sid = this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
    if (!sid) return { items: [], topValuable: [], totalCount: 0, totalValue: '—', currency: null };
    if ((!this.inventoryCache || this.inventoryCache.length === 0) && sid) {
      const invPath = this.getInventoryCachePath(sid);
      if (invPath && fs.existsSync(invPath)) {
        try {
          this.inventoryCache = JSON.parse(fs.readFileSync(invPath, 'utf8'));
          this.inventoryCacheTime = Date.now();
        } catch (e) {}
      }
    }
    let items = this.inventoryCache;
    if (!items || items.length === 0 || (Date.now() - this.inventoryCacheTime > 300000)) {
      items = await this.fetchLiveInventory();
    }

    items = Array.isArray(items) ? [...items] : [];

    // Filter by game
    if (gameFilter && gameFilter !== 'all') {
      const lowerFilter = String(gameFilter).toLowerCase().trim();
      items = items.filter((item) => {
        if (String(item.gameId) === lowerFilter) return true;
        if (item.game && item.game.toLowerCase().includes(lowerFilter)) return true;
        return false;
      });
    }

    // Sort items
    if (sortBy === 'price_asc' || sortBy === 'cheap') {
      items.sort((a, b) => (a.priceNum || 0) - (b.priceNum || 0));
    } else if (sortBy === 'name') {
      items.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      items.sort((a, b) => (b.priceNum || 0) - (a.priceNum || 0));
    }

    const topValuable = [...items].sort((a, b) => (b.priceNum || 0) - (a.priceNum || 0)).slice(0, 5);
    const symbol = this.currentUser?.walletSymbol || '';
    const totalSum = items.reduce((acc, it) => acc + (it.priceNum || 0), 0);

    return {
      items,
      topValuable,
      totalCount: items.length,
      totalValue: `${totalSum.toLocaleString('ru-RU')} ${symbol}`,
      currency: this.currentUser?.walletCurrency ?? null
    };
  }

  async getInventoryHistory() {
    const sid = this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
    if (!sid) return { history: [], totalCount: 0 };
    if ((!this.historyCache || this.historyCache.length === 0) && sid) {
      const histPath = this.getHistoryCachePath(sid);
      if (histPath && fs.existsSync(histPath)) {
        try {
          this.historyCache = JSON.parse(fs.readFileSync(histPath, 'utf8'));
          this.historyCacheTime = Date.now();
        } catch (e) {}
      }
    }
    if (!this.historyCache || this.historyCache.length === 0 || (Date.now() - this.historyCacheTime > 300000)) {
      await this.fetchLiveInventoryHistory();
    }

    return {
      history: this.historyCache || [],
      totalCount: this.historyCache?.length || 0
    };
  }

  async getEconomyStats() {
    const invData = await this.getInventoryItems('all', 'price_desc');
    const symbol = this.currentUser?.walletSymbol || '';
    const walletVal = this.currentUser?.wallet ?? '—';
    const topValuable = invData.topValuable || (invData.items || []).slice(0, 5);
    const totalCount = invData.totalCount;

    const invSum = (invData.items || []).reduce((acc, it) => acc + (it.priceNum || 0), 0);

    return {
      wallet: walletVal,
      walletBalance: walletVal,
      totalInventoryValue: `${invSum.toLocaleString('ru-RU')} ${symbol}`,
      inventoryValue: `${invSum.toLocaleString('ru-RU')} ${symbol}`,
      totalDeposited: '—',
      totalSpent: '—',
      totalItems: totalCount,
      currency: this.currentUser?.walletCurrency ?? null,
      topValuableItems: topValuable,
      topValuable
    };
  }

  // --- ANALYTICS ---
  async getCollectorBadgeCount() {
    const sid = this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
    if (!sid) return null;
    const html = await this.fetchUrlWithRedirects(`https://steamcommunity.com/profiles/${sid}/badges/13?l=english`);
    return parseCollectorCount(html);
  }

  async getProfileAnalytics() {
    const sid = this.client.steamID?.getSteamID64() || this.currentUser?.steamID;
    let memberSince = '—';
    let vacBanned = null;
    let tradeBanState = '—';
    let isLimitedAccount = null;

    if (sid) {
      try {
        const xml = await this.fetchUrlWithRedirects(`https://steamcommunity.com/profiles/${sid}/?xml=1`);
        if (xml && !xml.includes('<error>')) {
          const memberMatch = xml.match(/<memberSince>(.*?)<\/memberSince>/i);
          if (memberMatch && memberMatch[1]) {
            memberSince = memberMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
          }

          const vacMatch = xml.match(/<vacBanned>(\d+)<\/vacBanned>/i);
          if (vacMatch) {
            vacBanned = vacMatch[1] === '1';
          }

          const tradeMatch = xml.match(/<tradeBanState>(.*?)<\/tradeBanState>/i);
          if (tradeMatch && tradeMatch[1]) {
            tradeBanState = tradeMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
          }

          const limitedMatch = xml.match(/<isLimitedAccount>(\d+)<\/isLimitedAccount>/i);
          if (limitedMatch) {
            isLimitedAccount = limitedMatch[1] === '1';
          }
        }
      } catch (e) {
        this.log('warn', `Ошибка получения XML профиля для аналитики: ${e.message}`);
      }
    }

    // Calculate account age
    let accountAgeYears = '—';
    let accountAgeYearsEn = '—';
    if (memberSince && memberSince !== '—') {
      try {
        const memberDate = new Date(memberSince);
        if (!isNaN(memberDate.getTime())) {
          const diffMs = Date.now() - memberDate.getTime();
          const years = (diffMs / (365.25 * 24 * 3600 * 1000)).toFixed(1);
          const yearNum = memberDate.getFullYear();
          accountAgeYears = `${years} лет (с ${yearNum} г.)`;
          accountAgeYearsEn = `${years} yrs (since ${yearNum})`;
        }
      } catch (e) {}
    }

    // Playtime distribution from ownedGames or local Steam games
    let gamesList = this.ownedGames;
    if (!Array.isArray(gamesList) || gamesList.length === 0) {
      if (sid) {
        gamesList = this.scanLocalSteamGames(sid);
      }
    }

    let playtimeDistribution = [];
    let totalMinutes = 0;
    let recent2WeeksMinutes = 0;
    if (Array.isArray(gamesList) && gamesList.length > 0) {
      const sortedByHours = [...gamesList].sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0));
      totalMinutes = sortedByHours.reduce((acc, g) => acc + (g.playtime_forever || 0), 0);
      recent2WeeksMinutes = sortedByHours.reduce((acc, g) => acc + (g.playtime_2weeks || 0), 0);
      playtimeDistribution = sortedByHours.map((g) => {
        const hours = Number(((g.playtime_forever || 0) / 60).toFixed(1));
        const pct = totalMinutes > 0 ? Number(((g.playtime_forever / totalMinutes) * 100).toFixed(1)) : 0;
        return {
          appId: g.appid,
          appid: g.appid,
          title: g.name,
          name: g.name,
          hours,
          pct,
          lastPlayed: g.last_played || 0
        };
      });
    }

    const totalHours = Math.round(totalMinutes / 60);
    const recent2WeeksHours = Number((recent2WeeksMinutes / 60).toFixed(1));
    const level = this.currentUser?.level ?? 0;

    let topGenre = '—';
    if (playtimeDistribution.length > 0) {
      const topGame = playtimeDistribution[0];
      const topPct = topGame.pct || 0;
      const gName = (topGame.name || topGame.title || '').toLowerCase();
      let genreName = 'Разное';
      if (gName.includes('dota') || gName.includes('league')) genreName = 'Competitive MOBA';
      else if (gName.includes('counter-strike') || gName.includes('cs') || gName.includes('team fortress') || gName.includes('apex') || gName.includes('pubg')) genreName = 'Competitive FPS';
      else if (gName.includes('rust') || gName.includes('ark') || gName.includes('dayz')) genreName = 'Survival / Open World';
      else if (gName.includes('witcher') || gName.includes('cyberpunk') || gName.includes('baldurs') || gName.includes('elden')) genreName = 'RPG / Action RPG';
      else if (gName.includes('gta') || gName.includes('auto')) genreName = 'Action / Open World';
      else genreName = topGame.name || 'Action';
      topGenre = `${genreName} (${topPct}%)`;
    }

    const achievementSets = [...this.achievementsCache.values()].filter(entry => entry.verified && entry.data.length > 0).map(entry => entry.data);
    const totalAchievements = achievementSets.reduce((sum, list) => sum + list.length, 0);
    const unlockedAchievements = achievementSets.reduce((sum, list) => sum + list.filter((a) => a.unlocked).length, 0);
    const completionRate = totalAchievements ? Number((unlockedAchievements / totalAchievements * 100).toFixed(1)) : null;

    const badgePage = sid ? await this.fetchUrlWithRedirects(`https://steamcommunity.com/profiles/${sid}/badges/?l=english`) : '';
    const xp = parseProfileXp(badgePage);
    const liveBadges = await this.fetchLiveBadges(sid);

    return {
      accountAgeYears,
      accountAgeYearsEn,
      memberSince,
      vacBanned,
      vacStatus: vacBanned == null ? '—' : vacBanned ? 'Banned (VAC блокировка)' : 'Clean (0 блокировок)',
      vacStatusEn: vacBanned == null ? '—' : vacBanned ? 'Banned (VAC ban)' : 'Clean (0 bans)',
      tradeBanState,
      isLimitedAccount,
      perfectGamesCount: achievementSets.length ? achievementSets.filter((list) => list.every((a) => a.unlocked)).length : null,
      avgCompletionRate: completionRate,
      averageAchievementPct: completionRate,
      unlockedAchievements,
      totalAchievements,
      achievementsSampledGames: achievementSets.length,
      totalHours,
      level: xp?.level ?? level,
      currentXp: xp?.currentXp ?? null,
      nextLevelXp: xp?.nextLevelXp ?? null,
      xpPercentage: xp?.xpPercentage ?? null,
      recent2WeeksHours,
      topGenre,
      playtimeDistribution,
      topPlaytimeGames: playtimeDistribution,
      badges: liveBadges
    };
  }
}

module.exports = new SteamManager();
module.exports.SteamManager = SteamManager;
