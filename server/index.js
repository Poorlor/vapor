const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const steamManager = require('./steamManager');
const discordManager = require('./discordManager');

const PORT = process.env.PORT || 48721;
const app = express();

function isLocalOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}
app.use((req, res, next) => {
  if (!isLocalOrigin(req.headers.origin)) return res.status(403).json({ success: false, error: 'Origin not allowed' });
  next();
});
app.use(cors({ origin: (origin, cb) => cb(null, isLocalOrigin(origin)) }));
app.use(express.json());
app.get('/api/health', (req, res) => res.json({ service: 'vapor', version: require('../package.json').version }));

// Serve static frontend files if built
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// --- REST API ENDPOINTS ---

// Status & Profile
app.get('/api/status', (req, res) => {
  res.json(steamManager.getStatus());
});

// Achievements summary
app.get('/api/achievements/summary', async (req, res) => {
  try {
    const rawAppIds = req.query.appids || req.query.appIds;
    let appids = null;
    if (rawAppIds) {
      if (typeof rawAppIds === 'string') {
        appids = rawAppIds.split(',').map((id) => Number(id.trim())).filter(Boolean);
      } else if (Array.isArray(rawAppIds)) {
        appids = rawAppIds.map(Number).filter(Boolean);
      }
    }
    const summary = await steamManager.getAchievementsSummary(appids);
    res.json(summary);
  } catch (err) {
    res.json({});
  }
});

// Economy Stats
app.get('/api/economy/stats', async (req, res) => {
  try {
    const stats = await steamManager.getEconomyStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inventory Items
app.get('/api/inventory/items', async (req, res) => {
  try {
    const { game, sortBy, asArray } = req.query;
    const result = await steamManager.getInventoryItems(game, sortBy);
    if (asArray === 'true') {
      return res.json(result.items);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inventory History
app.get('/api/inventory/history', async (req, res) => {
  try {
    const result = await steamManager.getInventoryHistory();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, history: [], totalCount: 0 });
  }
});

// Force Refresh Inventory and History
app.post('/api/inventory/refresh', async (req, res) => {
  try {
    if (!steamManager.isLoggedOn || !steamManager.hasWebSession) throw new Error('Для обновления инвентаря необходим вход в Steam');
    await steamManager.fetchLiveInventory();
    await steamManager.fetchLiveInventoryHistory();
    const invData = await steamManager.getInventoryItems('all', 'price_desc');
    const histData = await steamManager.getInventoryHistory();
    res.json({
      success: true,
      items: invData.items,
      topValuable: invData.topValuable,
      totalCount: invData.totalCount,
      totalValue: invData.totalValue,
      history: histData.history
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Analytics Profile
app.get('/api/analytics/profile', async (req, res) => {
  try {
    const analytics = await steamManager.getProfileAnalytics();
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Library
app.get('/api/games', (req, res) => {
  res.json(steamManager.ownedGames);
});

// Refresh Library & Profile
app.post('/api/refresh', async (req, res) => {
  try {
    await steamManager.refreshUserData();
    res.json({ success: true, count: steamManager.ownedGames.length });
  } catch (err) {
    res.json({ success: false, error: err.message, count: steamManager.ownedGames.length });
  }
});

// Deep Scan / PC Scan: verifies active account and scans local configs, badges, inventory, and library
app.post('/api/library/deep-scan', async (req, res) => {
  try {
    const result = await steamManager.scanPcForActiveAccount();
    res.json({
      success: true,
      verifiedAccount: result.verifiedAccount,
      games: result.games,
      count: result.games?.length || 0,
      analytics: result.analytics,
      economy: result.economy,
      badges: result.badges
    });
  } catch (err) {
    res.json({ success: false, error: err.message, count: steamManager.ownedGames.length, games: steamManager.ownedGames });
  }
});

app.post('/api/pc-scan', async (req, res) => {
  try {
    const result = await steamManager.scanPcForActiveAccount();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Auth: Credentials
app.post('/api/login/credentials', async (req, res) => {
  const { accountName, password, twoFactorCode, authCode } = req.body || {};
  if (!accountName || !password) {
    return res.status(400).json({ error: 'Логин и пароль обязательны' });
  }

  try {
    const result = await steamManager.loginWithCredentials(
      accountName,
      password,
      twoFactorCode,
      authCode
    );
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Auth: Submit Steam Guard Code
app.post('/api/login/guard', async (req, res) => {
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'Код Steam Guard не указан' });
  }

  try {
    const result = await steamManager.submitSteamGuardCode(code);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Auth: QR Code
app.post('/api/login/qr', async (req, res) => {
  try {
    const result = await steamManager.startQRLogin();
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Auth: Logout
app.post('/api/logout', (req, res) => {
  steamManager.logout();
  res.json({ success: true });
});

app.post('/api/login/cancel', (req, res) => {
  steamManager.cancelLogin();
  res.json({ success: true });
});

// App: Shutdown
app.post('/api/shutdown', (req, res) => {
  res.json({ success: true });
  res.once('finish', () => shutdown().then(() => process.exit(0)));
});

// Change Persona State
app.post('/api/persona', (req, res) => {
  const { state, statusName } = req.body || {};
  const result = steamManager.setPersonaState(state, statusName);
  res.json(result);
});

// Hour Booster: Start
app.post('/api/hour-booster/start', (req, res) => {
  const { appIds, targetDurationMinutes } = req.body || {};
  try {
    const result = steamManager.startHourBooster(appIds, targetDurationMinutes);
    res.json({ success: true, status: steamManager.getStatus(), ...result });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Hour Booster: Stop
app.post('/api/hour-booster/stop', (req, res) => {
  steamManager.stopHourBooster();
  res.json({ success: true, status: steamManager.getStatus() });
});

// Card Idler: Scan
app.get('/api/card-idler/scan', async (req, res) => {
  try {
    const games = await steamManager.scanCardDrops();
    res.json(games);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Card Idler: Start
app.post('/api/card-idler/start', (req, res) => {
  const { games, appIds } = req.body || {};
  try {
    const result = steamManager.startCardIdler(games || appIds);
    res.json({ success: true, status: steamManager.getStatus(), ...(result || {}) });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Card Idler: Stop
app.post('/api/card-idler/stop', (req, res) => {
  steamManager.stopCardIdler();
  res.json({ success: true, status: steamManager.getStatus() });
});

// Achievements: List for game
app.get('/api/achievements/:appid', async (req, res) => {
  const { appid } = req.params;
  try {
    const achievements = await steamManager.getGameAchievements(Number(appid));
    res.json(achievements);
  } catch (err) {
    res.json([]);
  }
});

// Achievements: Unlock
app.post('/api/achievements/unlock', async (req, res) => {
  const targetAppId = req.body?.appid || req.body?.appId;
  const achievementNames = req.body?.achievementNames || [];
  try {
    const result = await steamManager.unlockAchievements(Number(targetAppId), achievementNames);
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Achievements: Reset
app.post('/api/achievements/reset', async (req, res) => {
  const targetAppId = req.body?.appid || req.body?.appId;
  try {
    const result = await steamManager.resetAchievements(Number(targetAppId));
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Game Collector: List free games
app.get('/api/collector/list', (req, res) => {
  const games = steamManager.getFreeGamesList();
  const ownedCount = games.filter((g) => g.isOwned).length;
  const availableCount = games.length - ownedCount;
  res.json({
    success: true,
    total: games.length,
    ownedCount,
    availableCount,
    games
  });
});

app.get('/api/collector/badge', async (req, res) => {
  try {
    res.json({ count: await steamManager.getCollectorBadgeCount() });
  } catch {
    res.json({ count: null });
  }
});

// Game Collector: Claim free games batch or single
app.post('/api/collector/claim', async (req, res) => {
  const count = Number(req.body?.count || req.body?.batchSize) || 25;
  const appIds = req.body?.appIds || (req.body?.appId ? [req.body.appId] : null);
  try {
    const result = await steamManager.claimFreeGamesBatch(count, appIds);
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// --- DISCORD ACTIVITY & SPOOFER ENDPOINTS ---
app.get('/api/discord/status', (req, res) => {
  res.json(discordManager.getStatus());
});

app.get('/api/discord/games', (req, res) => {
  const { q, page, pageSize, filter } = req.query;
  res.json(discordManager.getGames(q, Number(page) || 1, Number(pageSize) || 60, filter));
});

app.post('/api/discord/variety/start', (req, res) => {
  try {
    const { batchSize, holdSeconds, mode, loopMode } = req.body || {};
    discordManager.startVariety(batchSize, holdSeconds, mode, loopMode);
    res.json({ success: true, status: discordManager.getStatus() });
  } catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

app.post('/api/discord/variety/stop', (req, res) => {
  discordManager.stopVariety();
  res.json({ success: true, status: discordManager.getStatus() });
});

app.post('/api/discord/variety/reset', (req, res) => {
  try {
    discordManager.resetHistory();
    res.json({ success: true, status: discordManager.getStatus() });
  } catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

app.post('/api/discord/mode', (req, res) => {
  try { res.json(discordManager.setMode(req.body?.mode)); }
  catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

app.post('/api/discord/farm/start', (req, res) => {
  const { gameIds, appId, durationMinutes, mode } = req.body || {};
  let ids = gameIds;
  if (!ids && appId) {
    ids = [String(appId)];
  }
  try {
    discordManager.startFarm(ids, durationMinutes, mode);
    res.json({ success: true, status: discordManager.getStatus() });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/discord/farm/stop', (req, res) => {
  discordManager.stopFarm();
  res.json({ success: true, status: discordManager.getStatus() });
});

app.post('/api/discord/history/reset', (req, res) => {
  try {
    discordManager.resetHistory();
    res.json({ success: true, status: discordManager.getStatus() });
  } catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

// Discord Quests Auto-Completer Routes
app.post('/api/discord/quest/start', async (req, res) => {
  try {
    const { gameName, exeName, durationMinutes, gameId, mode, questId, taskType } = req.body || {};
    const quest = await discordManager.startQuest(gameName, exeName, durationMinutes, gameId, mode, questId, taskType);
    res.json({ success: true, quest });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/discord/quest/progress', async (req, res) => {
  try {
    if (!discordManager.quest.isRunning || !discordManager.quest.questId) {
      return res.status(400).json({ success: false, error: 'Нет запущенного персонального квеста' });
    }
    await discordManager.pollQuestProgress();
    const quest = discordManager.getStatus().quest;
    if (quest.progressError) return res.status(502).json({ success: false, error: quest.progressError, quest });
    res.json({ success: true, quest });
  } catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

app.post('/api/discord/quest/stop', (req, res) => {
  try {
    if (discordManager.quest.mode === 'console' && discordManager.quest.isRunning) {
      return discordManager.stopConsoleQuest().then(() => res.json({ success: true, status: discordManager.getStatus() }))
        .catch(err => res.status(400).json({ success: false, error: err.message }));
    }
    discordManager.stopQuest();
    res.json({ success: true, status: discordManager.getStatus() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/discord/quest/console/start', async (req, res) => {
  try {
    const quest = await discordManager.startConsoleQuest(req.body?.questId, req.body?.taskType);
    res.json({ success: true, quest });
  } catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

app.post('/api/discord/quest/queue', async (req, res) => {
  try {
    const quest = await discordManager.enqueueQuest(req.body?.questId);
    res.json({ success: true, quest });
  } catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

app.delete('/api/discord/quest/queue/:questId', (req, res) => {
  try {
    res.json({ success: true, quest: discordManager.removeQueuedQuest(req.params.questId) });
  } catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

app.post('/api/discord/quest/queue/resume', async (req, res) => {
  clearTimeout(discordManager.questQueueRetryTimer);
  discordManager.questQueueRetryTimer = null;
  discordManager.questQueueError = null;
  await discordManager.advanceQuestQueue();
  res.json({ success: !discordManager.questQueueError, quest: discordManager.getStatus().quest });
});

app.get('/api/discord/quest/status', (req, res) => {
  try {
    const status = discordManager.getStatus();
    res.json(status.quest || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hybrid Quests Feed & Token Routes
app.get('/api/discord/quest/feed', (req, res) => {
  res.json(discordManager.getOnlineQuestsFeed());
});

app.post('/api/discord/quest/feed/refresh', async (req, res) => {
  const result = await discordManager.refreshOnlineQuestsFeed();
  res.json(result);
});

app.get('/api/discord/quest/token/status', (req, res) => {
  res.json(discordManager.getUserTokenStatus());
});

app.get('/api/discord/quest/token/command', (req, res) => {
  const executable = process.execPath.replace(/'/g, "''");
  const script = path.join(__dirname, 'copyDiscordToken.js').replace(/'/g, "''");
  res.json({ command: `${process.versions.electron ? "$env:ELECTRON_RUN_AS_NODE='1'; " : ''}& '${executable}' '${script}'` });
});

app.post('/api/discord/quest/token', async (req, res) => {
  try {
    const { token, persist } = req.body;
    const result = await discordManager.setUserToken(token, persist !== false);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/discord/quest/token/auto-detect', async (req, res) => {
  try {
    const result = await discordManager.autoConnectToken();
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/discord/quest/token', (req, res) => {
  res.json(discordManager.clearUserToken());
});

app.get('/api/discord/quest/personal', async (req, res) => {
  try {
    const quests = await discordManager.fetchPersonalQuests();
    res.json(quests);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/discord/quest/personal/enroll', async (req, res) => {
  try {
    const { questId } = req.body;
    const result = await discordManager.enrollPersonalQuest(questId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/discord/quest/personal/claim', async (req, res) => {
  try {
    const { questId, platform } = req.body || {};
    const result = await discordManager.claimPersonalQuest(questId, platform);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- Window Interaction Endpoints ---
app.post('/api/window/minimize', (req, res) => {
  if (!process.send) return res.status(501).json({ success: false, error: 'Управление окном доступно в Electron' });
  process.send({ type: 'window', action: 'minimize' });
  res.json({ success: true });
});

app.post('/api/window/maximize', (req, res) => {
  if (!process.send) return res.status(501).json({ success: false, error: 'Управление окном доступно в Electron' });
  process.send({ type: 'window', action: 'maximize' });
  res.json({ success: true });
});

app.post('/api/window/close', (req, res) => {
  if (!process.send) return res.status(501).json({ success: false, error: 'Управление окном доступно в Electron' });
  process.send({ type: 'window', action: 'close' });
  res.json({ success: true });
});

// Always return JSON errors for API consumers, including malformed JSON bodies.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(err.status || 400).json({ success: false, error: err.message || 'Ошибка сервера' });
});

// Fallback to index.html for SPA router
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  const indexHtml = path.join(distPath, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    fs.createReadStream(indexHtml).pipe(res);
  } else {
    res.status(503).send('Vapor Web Interface is compiling or not built yet. Please run: npm run build');
  }
});

// --- HTTP & WEBSOCKET SERVER ---
const server = http.createServer(app);
const wss = new WebSocket.Server({
  server,
  path: '/ws',
  verifyClient: ({ origin }) => isLocalOrigin(origin)
});

function broadcast(event, data) {
  const payload = JSON.stringify({ event, data });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Forward events from SteamManager to WebSocket clients
steamManager.on('log', (log) => broadcast('log', log));
steamManager.on('auth_state', (data) => broadcast('auth_state', data));
steamManager.on('profile_updated', (user) => broadcast('profile_updated', user));
steamManager.on('games_loaded', (games) => broadcast('games_loaded', games));
steamManager.on('hour_booster_tick', (tick) => broadcast('hour_booster_tick', tick));
steamManager.on('card_idler_tick', (tick) => broadcast('card_idler_tick', tick));
steamManager.on('client_error', (error) => broadcast('client_error', error));
steamManager.on('qr_timeout', () => broadcast('qr_timeout', {}));

// Forward events from DiscordManager to WebSocket clients
discordManager.on('discord_log', (log) => broadcast('discord_log', log));
discordManager.on('discord_status', (status) => broadcast('discord_status', status));
discordManager.on('discord_variety_tick', (tick) => broadcast('discord_variety_tick', tick));
discordManager.on('discord_farm_tick', (tick) => broadcast('discord_farm_tick', tick));
discordManager.on('discord_quest_tick', (tick) => broadcast('discord_quest_tick', tick));
discordManager.on('discord_quest_completed', (data) => broadcast('discord_quest_completed', data));

wss.on('connection', (ws) => {
  // Send current state immediately on connection
  ws.send(
    JSON.stringify({
      event: 'initial_state',
      data: {
        ...steamManager.getStatus(),
        games: steamManager.ownedGames,
        discord: discordManager.getStatus(),
      },
    })
  );
});

let closing;
function shutdown() {
  if (closing) return closing;
  closing = (async () => {
    discordManager.shutdown();
    steamManager.cancelLogin();
    steamManager.stopHourBooster();
    steamManager.stopCardIdler();
    if (steamManager.isLoggedOn) steamManager.client.logOff();
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    if (server.listening) {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
  })();
  return closing;
}

function startServer({ port = Number(PORT), autoLogin = process.env.VAPOR_OFFLINE !== '1' } = {}) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address();
      console.log(`[Vapor Server] Running on http://127.0.0.1:${address.port}`);
      if (autoLogin) steamManager.tryAutoLogin().catch(console.error);
      if (process.send) process.send({ type: 'ready', port: address.port });
      resolve(server);
    });
  });
}

if (require.main === module) {
  const exit = () => shutdown().then(() => process.exit(0));
  process.on('SIGINT', exit);
  process.on('SIGTERM', exit);
  process.on('message', (message) => { if (message?.type === 'shutdown') exit(); });
  if (process.send) process.on('disconnect', exit);
  startServer().catch((err) => {
    console.error(`[Vapor Server] ${err.message}`);
    discordManager.shutdown();
    process.exit(1);
  });
}

module.exports = { app, server, wss, startServer, shutdown };
