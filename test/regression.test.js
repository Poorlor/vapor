const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter, once } = require('node:events');
const https = require('node:https');
const { spawnSync } = require('node:child_process');
const tempBase = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Temp/opencode') : os.tmpdir();
fs.mkdirSync(tempBase, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(tempBase, 'vapor-test-'));
process.env.VAPOR_DATA_DIR = dataDir;
process.env.VAPOR_OFFLINE = '1';
const steam = require('../server/steamManager');
const discord = require('../server/discordManager');
const { SteamManager } = steam;
const { DiscordManager, DiscordIpcClient } = discord;
const service = require('../server/index');
const { LoginSession, EAuthSessionGuardType } = require('steam-session');
const { normalizeQuest, personalQuests } = require('../server/discordQuests');
const { parseProfileXp, parseCollectorCount } = require('../server/steamProfile');

test('Steam badge page supplies total XP, level progress and counted games only', async () => {
  const html = `<div class="profile_xp_block">
    <span class="profile_xp_block_level">Level <span class="friendPlayerLevel"><span class="friendPlayerLevelNum">40</span></span></span>
    <span class="profile_xp_block_xp">XP 10,650</span>
    <div class="profile_xp_block_remaining">350 XP to reach Level 41</div>
    <div style="clear: both"></div></div>`;
  assert.deepEqual(parseProfileXp(html), { level: 40, currentXp: 10650, nextLevelXp: 11000, xpPercentage: 30 });
  assert.equal(parseProfileXp('<div>private profile</div>'), null);
  assert.equal(parseCollectorCount('<div>1,234 games in library</div>'), 1234);
  assert.equal(parseCollectorCount('<div>1 game in library</div>'), 1);
  assert.equal(parseCollectorCount('<div>Steam sign in</div>'), null);

  const source = fs.readFileSync(path.join(__dirname, '../src/lib/collectorTiers.ts'), 'utf8');
  const { stripTypeScriptTypes } = require('node:module');
  const { COLLECTOR_TIERS } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);
  assert.deepEqual(COLLECTOR_TIERS.slice(0, 9).map(t => [t.count, t.xp]),
    [[1, 100], [5, 125], [10, 150], [25, 200], [50, 250], [100, 325], [250, 500], [500, 750], [1000, 1250]]);
  assert.equal(COLLECTOR_TIERS.at(-1).count, 40000);
});

test('diagnostic export hides credentials but keeps useful errors', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/logExport.ts'), 'utf8');
  const { stripTypeScriptTypes } = require('node:module');
  const { formatDiagnosticLogs } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);
  const output = formatDiagnosticLogs([
    { time: '12:00', level: 'ERROR', message: 'Discord 401 authorization: Bearer example-secret token=abc123' },
    { time: '12:01', level: 'INFO', message: 'mfa.abcdef123456789012345678' },
    { time: '12:02', level: 'WARN', message: '{"access_token":"private123"}' },
  ]);
  assert.match(output, /Discord 401/);
  assert.doesNotMatch(output, /example-secret|abc123|abcdef123456789012345678|private123/);
});

after(async () => {
  await service.shutdown();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('empty accounts never inherit another account inventory, badges or demo statistics', async () => {
  fs.writeFileSync(path.join(dataDir, 'inventory_cache_other.json'), '[{"name":"private item","priceNum":999}]');
  fs.writeFileSync(path.join(dataDir, 'badges_cache_other.json'), '[{"name":"private badge"}]');
  assert.equal((await steam.getInventoryItems()).totalCount, 0);
  assert.deepEqual((await steam.getInventoryHistory()).history, []);
  assert.deepEqual(await steam.fetchLiveBadges(), []);
  const stats = await steam.getEconomyStats();
  assert.equal(stats.totalItems, 0);
  assert.equal(stats.totalSpent, '—');
  const analytics = await steam.getProfileAnalytics();
  assert.equal(analytics.totalHours, 0);
  assert.equal(analytics.memberSince, '—');
  assert.deepEqual(analytics.badges, []);
});

test('analytics counts only verified personal achievements and names its sample', async () => {
  const manager = new SteamManager();
  manager.achievementsCache.set(10, { verified: false, data: [{ unlocked: false }], time: Date.now() });
  let profile = await manager.getProfileAnalytics();
  assert.equal(profile.perfectGamesCount, null);
  assert.equal(profile.avgCompletionRate, null);
  assert.equal(profile.achievementsSampledGames, 0);
  manager.achievementsCache.set(20, { verified: true, data: [{ unlocked: true }, { unlocked: false }], time: Date.now() });
  profile = await manager.getProfileAnalytics();
  assert.equal(profile.avgCompletionRate, 50);
  assert.equal(profile.achievementsSampledGames, 1);
  assert.equal(profile.perfectGamesCount, 0);
});

test('achievement fallback does not treat a public schema as personal progress', async (t) => {
  const manager = new SteamManager();
  manager.currentUser = { steamID: '76561198000000001' };
  const xml = '<achievement closed="1"><apiname>ACH_WIN</apiname><name>Victory</name></achievement>';
  t.mock.method(manager, 'fetchUrlWithRedirects', async url => url.includes('/stats/10/') ? xml
    : url.includes('/stats/20/achievements/') ? xml : '');
  await manager.getGameAchievements(10);
  await manager.getGameAchievements(20);
  assert.equal(manager.achievementsCache.get(10).verified, true);
  assert.equal(manager.achievementsCache.get(20).verified, false);
});

test('Steam CM schema without user stats cannot verify achievement progress', async (t) => {
  const manager = new SteamManager();
  manager.isLoggedOn = true;
  t.mock.method(manager, 'sendClientGetUserStats', async () => ({ schema: 'schema', stats: [] }));
  t.mock.method(manager, 'parseProtoAchievements', () => [{ statId: 1, unlocked: false }]);
  t.mock.method(manager, 'getAchievementsFallback', async () => ({ achievements: [], personal: false }));
  await manager.getGameAchievements(10);
  assert.equal(manager.achievementsCache.get(10).verified, false);
});

test('Steam Guard waits for the authenticated event before saving a token', async (t) => {
  const manager = new SteamManager();
  let loggedOnToken;
  t.mock.method(manager.client, 'logOn', details => { loggedOnToken = details.refreshToken; });
  t.mock.method(LoginSession.prototype, 'startWithCredentials', async () => ({
    actionRequired: true, validActions: [{ type: EAuthSessionGuardType.DeviceCode }],
  }));
  t.mock.method(LoginSession.prototype, 'submitSteamGuardCode', async function () {
    // A successful code submission does not itself return a token.
    queueMicrotask(() => {
      Object.defineProperty(this, 'refreshToken', { value: 'test-only-token' });
      Object.defineProperty(this, 'steamID', { value: null });
      this.emit('authenticated');
    });
  });
  const prompt = await manager.loginWithCredentials('test', 'test');
  assert.equal(prompt.status, 'need_code');
  assert.equal(prompt.codeType, 'mobile');
  assert.equal(loggedOnToken, undefined);
  const result = await manager.submitSteamGuardCode('12345');
  assert.equal(result.success, true);
  assert.equal(loggedOnToken, 'test-only-token');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'session.json'))).refreshToken, 'test-only-token');
  manager.cancelLogin();
  fs.unlinkSync(path.join(dataDir, 'session.json'));
});

test('saved Steam session reconnects on restart and logout forgets its token', async (t) => {
  const manager = new SteamManager();
  fs.writeFileSync(path.join(dataDir, 'session.json'), JSON.stringify({
    steamID: '76561198000000001', accountName: 'remembered-user', refreshToken: 'test-only-token',
  }));
  let token;
  t.mock.method(manager.client, 'logOn', details => { token = details.refreshToken; });
  assert.equal(await manager.tryAutoLogin(), true);
  assert.equal(token, 'test-only-token');
  assert.equal(manager.getStatus().hasSavedSession, true);
  manager.logout();
  assert.equal(fs.existsSync(path.join(dataDir, 'session.json')), false);
});

test('cancelled QR sessions cannot log in later', (t) => {
  const manager = new SteamManager();
  const finalize = t.mock.method(manager, 'finalizeLogin', async () => ({ success: true }));
  const session = manager.createLoginSession();
  manager.cancelLogin();
  session.emit('authenticated');
  assert.equal(finalize.mock.callCount(), 0);
});

test('hour booster validates IDs, preserves a running session on invalid input and excludes card idling', (t) => {
  const manager = new SteamManager();
  manager.isLoggedOn = true;
  const played = t.mock.method(manager.client, 'gamesPlayed', () => {});
  manager.startCardIdler([{ appid: 10, name: 'Cards', cardsRemaining: 2 }]);
  manager.startHourBooster([20, '20', 30]);
  assert.equal(manager.cardIdler.isRunning, false);
  assert.deepEqual(manager.hourBooster.activeAppIds, [20, 30]);
  assert.throws(() => manager.startHourBooster(['invalid']));
  assert.equal(manager.hourBooster.isRunning, true);
  manager.stopHourBooster();
  assert.deepEqual(manager.getStatus().hourBooster.activeAppIds, []);
  assert.deepEqual(played.mock.calls.at(-1).arguments[0], []);
});

test('disconnect stops the farming timers and clears active state', (t) => {
  const manager = new SteamManager();
  t.mock.method(manager.client, 'gamesPlayed', () => {});
  manager.isLoggedOn = true;
  manager.startHourBooster([10]);
  manager.client.emit('disconnected', 1, 'test disconnect');
  assert.equal(manager.hourBooster.isRunning, false);
  assert.equal(manager.hourBooster.intervalId, null);
});

test('card scanning continues past pages without drops and rejects network failures', async (t) => {
  const manager = new SteamManager();
  manager.isLoggedOn = true;
  manager.hasWebSession = true;
  manager.currentUser = { steamID: 'test' };
  const requests = [];
  t.mock.method(manager.community, 'httpRequestGet', (url, cb) => {
    requests.push(url);
    cb(null, { statusCode: 200 }, url.endsWith('p=1')
      ? '<a href="?p=2">Next</a><div class="badge_row is_link">No drops</div>'
      : '<div class="badge_row is_link"><a href="/gamecards/42/">Game</a><div class="badge_title">Test Game</div>3 card drops remaining</div>');
  });
  assert.deepEqual(await manager.scanCardDrops(), [{ appid: 42, name: 'Test Game', cardsRemaining: 3 }]);
  assert.equal(requests.length, 2);
  t.mock.method(manager.community, 'httpRequestGet', (url, cb) => cb(new Error('network down')));
  await assert.rejects(manager.scanCardDrops(), /network down/);
});

test('achievement writes require Steam acknowledgement and collector only accepts curated IDs', async (t) => {
  const manager = new SteamManager();
  manager.isLoggedOn = true;
  manager.currentUser = { steamID: 'test' };
  t.mock.method(manager.client, 'gamesPlayed', () => {});
  t.mock.method(manager, 'sendClientGetUserStats', async () => null);
  assert.equal((await manager.unlockAchievements(10, ['ACH'])).success, false);
  t.mock.method(manager.client, '_send', (header, payload, cb) => cb({ eresult: 15 }));
  assert.equal((await manager.resetAchievements(10)).success, false);
  manager.hasWebSession = true;
  manager.client.steamID = { getSteamID64: () => 'test' };
  manager.community.steamID = { getSteamID64: () => 'test' };
  await assert.rejects(manager.claimFreeGamesBatch(1, [10]), /проверенном каталоге/);
  assert.equal(manager.claimedFreeGames.size, 0);
});

test('collector lists only sourced +1 candidates with distinct Steam packages', () => {
  const { FREE_GAMES_DATABASE } = require('../server/freeGamesDatabase');
  assert.equal(FREE_GAMES_DATABASE.length, 25);
  assert.equal(new Set(FREE_GAMES_DATABASE.map(game => game.appid)).size, 25);
  assert.equal(new Set(FREE_GAMES_DATABASE.map(game => game.subid)).size, 25);
  assert.ok(FREE_GAMES_DATABASE.every(game => Number.isSafeInteger(game.appid) && Number.isSafeInteger(game.subid)));
  assert.ok(!FREE_GAMES_DATABASE.some(game => [730, 570, 440, 252150, 247120].includes(game.appid)));
  assert.deepEqual(FREE_GAMES_DATABASE.filter(game => game.name.startsWith('Artifact')).map(game => game.subid),
    [555176, 555169]);
});

test('collector checks a free store package and only reports a confirmed license', async (t) => {
  const manager = new SteamManager();
  manager.isLoggedOn = manager.hasWebSession = true;
  manager.currentUser = { steamID: 'test' };
  manager.client.steamID = manager.community.steamID = { getSteamID64: () => 'test' };
  t.mock.method(manager.community, 'getSessionID', () => 'test-session');
  let free = false;
  t.mock.method(manager.community, 'httpRequest', (_options, cb) => cb(null, { statusCode: 200 }, {
    272060: { success: true, data: { steam_appid: 272060, package_groups: [{ subs: [{
      packageid: 36561, is_free_license: true, price_in_cents_with_discount: free ? 0 : 100,
    }] }] } },
  }));
  const post = t.mock.method(manager.community, 'httpRequestPost', (_options, cb) => cb(null, { statusCode: 200 }, []));
  assert.equal((await manager.claimFreeGamesBatch(1, [272060])).grantedCount, 0);
  assert.equal(post.mock.callCount(), 0);
  free = true;
  assert.equal((await manager.claimFreeGamesBatch(1, [272060])).grantedCount, 1);
  assert.match(post.mock.calls[0].arguments[0].url, /\/freelicense\/addfreelicense\/36561$/);
  assert.deepEqual(post.mock.calls[0].arguments[0].form, { ajax: true, sessionid: 'test-session' });
  assert.ok(manager.getFreeGamesList().find(game => game.appid === 272060).isOwned);
  assert.ok(!manager.ownedGames.some(game => game.appid === 272060));
  assert.ok(manager.claimedFreeGames.has(36561));
});

test('collector does not mark a rejected Steam checkout as owned', async (t) => {
  const manager = new SteamManager();
  manager.isLoggedOn = manager.hasWebSession = true;
  manager.currentUser = { steamID: 'test' };
  manager.client.steamID = manager.community.steamID = { getSteamID64: () => 'test' };
  t.mock.method(manager.community, 'httpRequest', (_options, cb) => cb(null, { statusCode: 200 }, {
    272060: { success: true, data: { steam_appid: 272060, package_groups: [{ subs: [{
      packageid: 36561, is_free_license: true, price_in_cents_with_discount: 0,
    }] }] } },
  }));
  t.mock.method(manager.community, 'httpRequestPost', (_options, cb) =>
    cb(null, { statusCode: 200 }, { purchaseresultdetail: 9 }));
  const result = await manager.claimFreeGamesBatch(1, [272060]);
  assert.equal(result.grantedCount, 0);
  assert.equal(manager.getFreeGamesList().find(game => game.appid === 272060).isOwned, false);
  assert.ok(!manager.claimedFreeGames.has(36561));
});

test('collector ignores legacy AppID claims and refuses paid-base DLC without its base', async (t) => {
  const manager = new SteamManager();
  manager.claimedFreeGames.add(8650);
  assert.equal(manager.getFreeGamesList().find(game => game.appid === 8650).isOwned, false);
  manager.isLoggedOn = manager.hasWebSession = true;
  manager.currentUser = { steamID: 'test' };
  manager.client.steamID = manager.community.steamID = { getSteamID64: () => 'test' };
  const post = t.mock.method(manager.community, 'httpRequestPost', () => assert.fail('paid base required'));
  const result = await manager.claimFreeGamesBatch(1, [8650]);
  assert.equal(result.grantedCount, 0);
  assert.match(result.error, /Требуется базовая игра AppID 8600/);
  assert.equal(post.mock.callCount(), 0);
});

test('Discord settings retain the saved token when switching modes', () => {
  fs.writeFileSync(path.join(dataDir, 'discord_settings.json'), JSON.stringify({ mode: 'process', userToken: 'test-only' }));
  const manager = new DiscordManager();
  manager.setMode('rpc');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'discord_settings.json'))).userToken, 'test-only');
  manager.shutdown();
});

test('Discord catalog exposes executable names and bounds pagination', () => {
  const manager = new DiscordManager();
  manager.processDetectableList([{ id: '123', name: 'Test', executables: [{ os: 'win32', name: 'bin/test.exe' }] }]);
  const result = manager.getGames({}, -10, Infinity);
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 60);
  assert.equal(result.games[0].exeName, 'test.exe');
  manager.discordClientDetected = true;
  assert.throws(() => manager.startFarm(['unknown']), /Не выбраны/);
  assert.equal(manager.farm.isRunning, false);
  manager.shutdown();
});

test('stopping variety cancels a pending next batch even after a restart', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const manager = new DiscordManager();
  const next = t.mock.method(manager, 'runNextVarietyBatch', () => {});
  manager.variety.isRunning = true;
  manager.variety.transitionTimer = setTimeout(() => manager.runNextVarietyBatch(), 2500);
  manager.stopVariety();
  manager.variety.isRunning = true;
  t.mock.timers.tick(3000);
  assert.equal(next.mock.callCount(), 0);
  manager.shutdown();
});

test('IPC reassembles partial and coalesced frames, responds to ping and ignores stale socket closure', () => {
  const ipc = new DiscordIpcClient();
  const socket = new EventEmitter();
  const packets = [];
  socket.write = packet => packets.push(packet);
  socket.destroy = () => socket.emit('close');
  ipc.socket = socket;
  ipc.setupSocketEvents(socket);
  const packet = (op, data) => {
    const bytes = Buffer.from(JSON.stringify(data));
    const header = Buffer.alloc(8);
    header.writeInt32LE(op, 0); header.writeInt32LE(bytes.length, 4);
    return Buffer.concat([header, bytes]);
  };
  const ready = packet(1, { evt: 'READY', data: { user: { id: 'test' } } });
  socket.emit('data', ready.subarray(0, 5));
  assert.equal(ipc.isConnected, false);
  socket.emit('data', Buffer.concat([ready.subarray(5), packet(3, { ping: 1 })]));
  assert.equal(ipc.user.id, 'test');
  assert.equal(packets[0].readInt32LE(0), 4);
  ipc.currentActivity = { pid: 1234 };
  ipc.clearActivity();
  assert.equal(JSON.parse(packets.at(-1).subarray(8)).args.pid, 1234);
  ipc.socket = { destroyed: false };
  socket.emit('close');
  assert.equal(ipc.isConnected, true);
});

test('Discord quest data uses server progress and rejects unsupported task types', () => {
  const games = [{ id: '101', name: 'Example Game', exe: 'example.exe', verifiedWindowsExecutable: true }];
  const quest = normalizeQuest({
    id: '202',
    config: { application: { id: '101', name: 'Example Game' }, task_config_v2: { tasks: { PLAY_ON_DESKTOP: { target: 900 } } } },
    user_status: { enrolled_at: 'today', progress: { PLAY_ON_DESKTOP: { value: 240 } } },
  }, games);
  assert.equal(quest.progressSeconds, 240);
  assert.equal(quest.targetSeconds, 900);
  assert.equal(quest.supportsDesktopPlay, true);
  assert.equal(quest.exe, 'example.exe');
  const video = normalizeQuest({
    id: '303',
    config: { application: { id: '101' }, task_config_v2: { tasks: { WATCH_VIDEO: { target: 60 } } } },
  }, games);
  assert.equal(video.supportsDesktopPlay, false);
  assert.equal(normalizeQuest({ id: '404', config: { task_config_v2: { tasks: { PLAY_ON_DESKTOP: { target: 900 } } } } }).supportsDesktopPlay, false);
  assert.equal(normalizeQuest({ id: '405', config: { application: { id: '101' }, task_config_v2: { tasks: { PLAY_ON_DESKTOP: { target: 900 } } } } }, [
    { id: '101', name: 'Example Game', exe: 'invented.exe', verifiedWindowsExecutable: false },
  ]).supportsDesktopPlay, false);
  assert.equal(normalizeQuest({ id: '406', config: { application: { id: '999', name: 'Example Game' }, task_config_v2: { tasks: { PLAY_ON_DESKTOP: { target: 900 } } } } }, games).exe, null);
  const current = normalizeQuest({
    id: '407',
    config: { taskConfigV2: { tasks: { PLAY_ON_DESKTOP_V2: { target: 900, applications: [{ id: '101' }] } } } },
    user_status: { progress: { PLAY_ON_DESKTOP_V2: { value: 121 } } },
  }, games);
  assert.equal(current.applicationId, '101');
  assert.equal(current.exe, 'example.exe');
  assert.equal(current.gameName, 'Example Game');
  assert.equal(current.progressSeconds, 121);
  assert.equal(current.supportsDesktopPlay, true);
  const multiPlatform = normalizeQuest({
    id: '409', config: { application: { id: '101' }, task_config_v2: { tasks: {
      PLAY_ON_DESKTOP: { target: 900, applications: [{ id: '101' }] },
      PLAY_ON_XBOX: { target: 900 },
      PLAY_ON_PLAYSTATION: { target: 900 },
    } }, rewards_config: { platforms: [1, 4] } },
    user_status: { progress: { PLAY_ON_XBOX: { value: 240 } } },
  }, games);
  assert.equal(multiPlatform.supportsDesktopPlay, true);
  assert.deepEqual(multiPlatform.rewardPlatforms, [1, 4]);
  assert.equal(multiPlatform.tasks.find(t => t.type === 'PLAY_ON_XBOX').progressSeconds, 240);
  assert.equal(normalizeQuest({
    id: '408',
    config: { application: { id: '999' }, task_config_v2: { tasks: { PLAY_ON_DESKTOP: { target: 900, applications: [{ id: '101' }] } } } },
  }, games).applicationId, '101');
});

test('quest queue advances in order and retries transient failures without a button', async (t) => {
  const manager = new DiscordManager();
  t.after(() => manager.shutdown());
  t.mock.timers.enable({ apis: ['setTimeout'] });
  manager.tokenUser = { id: '100', username: 'test' };
  manager.userToken = 'test-token';
  const quests = ['201', '202', '203'].map(id => ({
    id, gameName: id, exe: 'game.exe', applicationId: '101',
    isEnrolled: true, isCompleted: false, isExpired: false, supportsDesktopPlay: true,
  }));
  t.mock.method(manager, 'fetchPersonalQuests', async () => ({ user: manager.tokenUser, quests }));
  const launched = [];
  let fail = false;
  t.mock.method(manager, 'startQuest', async (_name, _exe, _duration, _gameId, _mode, id) => {
    if (fail) throw new Error('offline');
    launched.push(id);
    manager.quest.isRunning = true;
    manager.quest.questId = id;
  });
  await manager.enqueueQuest('201');
  assert.deepEqual(launched, ['201']);
  await manager.enqueueQuest('202');
  await manager.enqueueQuest('203');
  await assert.rejects(manager.enqueueQuest('202'), /очереди/);
  assert.deepEqual(manager.getStatus().quest.queue, ['202', '203']);
  manager.quest.isRunning = false;
  fail = true;
  await manager.advanceQuestQueue();
  assert.match(manager.questQueueError, /offline/);
  assert.deepEqual(manager.questQueue, ['202', '203']);
  fail = false;
  t.mock.timers.tick(30000);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(launched, ['201', '202']);
  manager.quest.isRunning = false;
  await manager.advanceQuestQueue();
  assert.deepEqual(launched, ['201', '202', '203']);
  manager.quest.isRunning = false;
  await manager.enqueueQuest('201');
  manager.clearUserToken();
  assert.deepEqual(manager.questQueue, []);
});

test('console task requires a linked account response and polls without desktop heartbeat', async (t) => {
  const manager = new DiscordManager();
  t.after(() => manager.shutdown());
  manager.userToken = 'test-token';
  manager.tokenUser = { id: '100', username: 'test' };
  t.mock.method(manager, 'fetchPersonalQuests', async () => ({
    user: { id: '100' }, quests: [{
      id: '201', gameName: 'Example', applicationId: '101', isEnrolled: true,
      percent: 100, tasks: [{ type: 'PLAY_ON_XBOX', progressSeconds: 15, targetSeconds: 900 }],
    }],
  }));
  let reply = { started: false, error_hints: ['Console offline'] };
  const action = t.mock.method(manager, 'requestQuestAction', async (_id, type) => type === 'console/start' ? reply : null);
  await assert.rejects(manager.startConsoleQuest('201', 'PLAY_ON_XBOX'), /Console offline/);
  reply = { started: true, quest_user_status: { user_id: '999' } };
  await assert.rejects(manager.startConsoleQuest('201', 'PLAY_ON_XBOX'), /не подтвердил/);
  reply = { started: true, quest_user_status: { user_id: '100' } };
  await manager.startConsoleQuest('201', 'PLAY_ON_XBOX');
  assert.equal(manager.quest.taskType, 'PLAY_ON_XBOX');
  assert.equal(manager.quest.questProcess, null);
  assert.equal(manager.quest.progressSeconds, 15);
  assert.equal(manager.quest.percent, 2);
  await manager.stopConsoleQuest();
  assert.equal(action.mock.calls.at(-1).arguments[1], 'console/stop');
  assert.equal(manager.quest.isRunning, false);
});

test('verified Discord completion starts the next queued quest without claiming rewards', async (t) => {
  const manager = new DiscordManager();
  t.after(() => manager.shutdown());
  manager.tokenUser = { id: '100' };
  manager.questQueueOwner = '100';
  manager.questQueue = ['202'];
  manager.quest.isRunning = true;
  manager.quest.questId = '201';
  manager.quest.startedAt = Date.now();
  t.mock.method(manager, 'fetchPersonalQuests', async () => ({
    user: { id: '100' },
    quests: [
      { id: '201', isCompleted: true, questName: 'First', gameName: 'First', progressSeconds: 900, targetSeconds: 900, percent: 100 },
      { id: '202', gameName: 'Second', exe: 'second.exe', applicationId: '102',
        isEnrolled: true, isCompleted: false, isExpired: false, supportsDesktopPlay: true },
    ],
  }));
  const start = t.mock.method(manager, 'startQuest', async () => {
    manager.quest.isRunning = true;
    manager.quest.questId = '202';
  });
  await manager.pollQuestProgress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(start.mock.callCount(), 1);
  assert.equal(manager.quest.questId, '202');
  assert.deepEqual(manager.questQueue, []);
});

test('99% remains active until Discord confirms completion, then starts queued quest', async (t) => {
  const manager = new DiscordManager();
  t.after(() => manager.shutdown());
  manager.questQueueOwner = '100';
  manager.questQueue = ['202'];
  manager.quest.isRunning = true;
  manager.quest.questId = '201';
  manager.quest.startedAt = Date.now();
  manager.quest.targetSeconds = 900;
  manager.quest.initialProgressSeconds = 890;
  let completed = false;
  t.mock.method(manager, 'fetchPersonalQuests', async () => ({
    user: { id: '100' },
    quests: [
      { id: '201', isCompleted: completed, questName: 'First', gameName: 'First',
        progressSeconds: completed ? 900 : 899, targetSeconds: 900, percent: 100 },
      { id: '202', gameName: 'Second', exe: 'second.exe', applicationId: '102',
        isEnrolled: true, isCompleted: false, isExpired: false, supportsDesktopPlay: true },
    ],
  }));
  const start = t.mock.method(manager, 'startQuest', async () => {
    manager.quest.isRunning = true;
    manager.quest.questId = '202';
  });
  await manager.pollQuestProgress();
  assert.equal(manager.quest.percent, 99);
  assert.equal(manager.quest.isRunning, true);
  assert.equal(start.mock.callCount(), 0);
  completed = true;
  await manager.pollQuestProgress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(start.mock.callCount(), 1);
});

test('auto-detect matches a fresh IPC account instead of the first cached token', async (t) => {
  const manager = new DiscordManager();
  t.after(() => manager.shutdown());
  manager.userToken = 'previous-token';
  manager.tokenUser = { id: '100', username: 'previous' };
  const savedToken = manager.settings.userToken;
  t.mock.method(manager.ipcClient, 'connect', async () => {
    queueMicrotask(() => manager.ipcClient.emit('ready', { id: '200' }));
    return true;
  });
  t.mock.method(manager, 'autoDetectToken', () => ['old-test-token-long-enough', 'new-test-token-long-enough']);
  t.mock.method(manager, 'verifyDiscordUserToken', async token =>
    ({ id: token === 'new-test-token-long-enough' ? '200' : '100', username: 'test' }));
  await manager.autoConnectToken(false);
  assert.equal(manager.userToken, 'new-test-token-long-enough');
  assert.equal(manager.tokenUser.id, '200');
  assert.equal(manager.settings.userToken, savedToken);
  manager.autoDetectToken.mock.mockImplementation(() => ['old-test-token-long-enough']);
  await assert.rejects(manager.autoConnectToken(false), /не найден/);
  assert.equal(manager.userToken, 'new-test-token-long-enough');
});

test('auto-detect keeps active Discord IPC alive when its user is already known', async (t) => {
  const manager = new DiscordManager();
  t.after(() => manager.shutdown());
  manager.farm.isRunning = true;
  manager.ipcClient.user = { id: '200' };
  const disconnect = t.mock.method(manager.ipcClient, 'disconnect', () => {});
  t.mock.method(manager, 'autoDetectToken', () => ['matching-token-long-enough']);
  t.mock.method(manager, 'verifyDiscordUserToken', async () => ({ id: '200', username: 'test' }));
  const result = await manager.autoConnectToken(false);
  assert.equal(result.success, true);
  assert.equal(disconnect.mock.callCount(), 0);
  assert.equal(manager.farm.isRunning, true);
  manager.farm.isRunning = false;
});

test('auto-detect uses a single verified local account when IPC cannot identify one', async (t) => {
  const manager = new DiscordManager();
  t.after(() => manager.shutdown());
  t.mock.method(manager.ipcClient, 'connect', async () => false);
  t.mock.method(manager, 'autoDetectToken', () => ['single-test-token-long-enough']);
  t.mock.method(manager, 'verifyDiscordUserToken', async () => ({ id: '200', username: 'test' }));
  const result = await manager.autoConnectToken(false);
  assert.equal(result.user.id, '200');
});

test('auto-detect a single account during farming without interrupting it', async (t) => {
  const manager = new DiscordManager();
  t.after(() => manager.shutdown());
  manager.farm.isRunning = true;
  t.mock.method(manager, 'autoDetectToken', () => ['single-test-token-long-enough']);
  t.mock.method(manager, 'verifyDiscordUserToken', async () => ({ id: '200', username: 'test' }));
  const disconnect = t.mock.method(manager.ipcClient, 'disconnect', () => {});
  assert.equal((await manager.autoConnectToken(false)).success, true);
  assert.equal(disconnect.mock.callCount(), 0);
  manager.farm.isRunning = false;
});

test('standalone token command reports missing Discord data instead of claiming success', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '../server/copyDiscordToken.js')], {
    cwd: process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32') : os.tmpdir(),
    env: { ...process.env, APPDATA: dataDir }, encoding: 'utf8', windowsHide: true, timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Local State/);
  assert.doesNotMatch(result.stdout, /скопирован/);
});

test('Discord detectable catalog never presents guessed executables as verified quest games', () => {
  const manager = new DiscordManager();
  manager.processDetectableList([
    { id: '100', name: 'Windows game', executables: [{ os: 'win32', name: 'win.exe' }] },
    { id: '101', name: 'Other OS', executables: [{ os: 'darwin', name: 'mac.exe' }] },
    { id: '102', name: 'No executable', executables: [] },
  ]);
  assert.deepEqual(manager.games.map(g => g.verifiedWindowsExecutable), [true, false, false]);
  manager.shutdown();
});

test('personal quests filter excluded, expired, hidden, future and foreign campaigns', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');
  const make = (id, config = {}, status = null) => ({
    id, config: { starts_at: '2026-11-01', expires_at: '2026-12-01', ...config }, user_status: status,
  });
  const enrolled = { user_id: '100', enrolled_at: '2026-11-18' };
  const completed = { ...enrolled, completed_at: '2026-11-18' };
  const result = personalQuests({ quests: [
    make('1', {}, enrolled), make('2'), make('3'), make('4', { expires_at: '2026-11-18' }, enrolled),
    { ...make('5'), preview: true }, make('6', { features: [21] }),
    make('7', { starts_at: '2026-11-20' }), make('8', {}, { ...enrolled, user_id: '999' }),
    make('9', { expires_at: 'invalid' }), make('1', {}, enrolled),
    make('10', { expires_at: '2026-11-18', rewards_config: { rewards_expire_at: '2026-12-01' } }, completed),
    make('11', { expires_at: '2026-11-18', rewards_config: { rewards_expire_at: '2026-11-18' } }, completed),
    make('12', { expires_at: '2026-11-18', rewards_config: { rewards_expire_at: '2026-12-01' } }, { ...completed, claimed_at: '2026-11-18' }),
  ], excluded_quests: [{ id: '3' }] }, [], '100', now);
  assert.deepEqual(result.map(q => q.id), ['1', '2', '10']);
  assert.deepEqual(result.map(q => q.isEnrolled), [true, false, true]);
  assert.equal(result[2].isExpired, true);
  assert.equal(result[2].canClaim, true);
  assert.throws(() => personalQuests({}), /не содержит список/);
});

test('Discord quest API reads actual progress and never claims reward on malformed server response', async (t) => {
  const manager = new DiscordManager();
  manager.userToken = 'test-only-token';
  manager.tokenUser = { id: '100', username: 'test' };
  manager.processDetectableList([{ id: '101', name: 'Example Game', executables: [{ os: 'win32', name: 'example.exe' }] }]);
  const responseBody = JSON.stringify({
    quests: [{ id: '202', config: { application: { id: '101', name: 'Example Game' },
      task_config_v2: { tasks: { PLAY_ON_DESKTOP: { target: 900 } } }, rewards_config: { platforms: [1, 4] } },
    user_status: { enrolled_at: 'today', completed_at: 'today', progress: { PLAY_ON_DESKTOP: { value: 240 } } } }],
  });
  let claimBody = 'not json';
  let payload;
  t.mock.method(https, 'request', (options, callback) => {
    assert.equal(options.hostname, 'discord.com');
    assert.equal(options.headers.Authorization, 'test-only-token');
    const request = new EventEmitter();
    request.setTimeout = () => {};
    request.write = body => { payload = JSON.parse(body); };
    request.end = () => queueMicrotask(() => {
      const response = new EventEmitter();
      response.statusCode = 200;
      callback(response);
      response.emit('data', Buffer.from(options.path.endsWith('/claim-reward') ? claimBody : responseBody));
      response.emit('end');
    });
    return request;
  });
  const result = await manager.fetchPersonalQuests();
  assert.equal(result.quests[0].progressSeconds, 240);
  assert.equal(result.quests[0].supportsDesktopPlay, true);
  await assert.rejects(manager.claimPersonalQuest('202', 3), /платформу/);
  await assert.rejects(manager.claimPersonalQuest('202'), /платформу/);
  await assert.rejects(manager.claimPersonalQuest('202', 1), /Некорректный ответ/);
  claimBody = '{}';
  await assert.rejects(manager.claimPersonalQuest('202', 1), /Пустое подтверждение/);
  claimBody = '{"claimed_at":"today","code":"test-only-code"}';
  assert.deepEqual(await manager.claimPersonalQuest('202', 4), { success: true, code: 'test-only-code' });
  assert.deepEqual(payload, { location: 1, platform: 4 });
  manager.shutdown();
});

test('personal quest starts only after Discord enrollment and confirmed process spawn', async (t) => {
  const manager = new DiscordManager();
  manager.processDetectableList([{ id: '101', name: 'Example Game', executables: [{ os: 'win32', name: 'example.exe' }] }]);
  manager.discordClientDetected = true;
  const remote = {
    id: '202', applicationId: '101', gameName: 'Example Game', exe: 'example.exe',
    isEnrolled: true, isCompleted: false, isClaimed: false, supportsDesktopPlay: true,
    progressSeconds: 240, targetSeconds: 900, percent: 27,
  };
  t.mock.method(manager, 'fetchPersonalQuests', async () => ({ quests: [remote] }));
  const heartbeat = t.mock.method(manager, 'sendQuestHeartbeat', async () => ({ quest_id: '202', progress: {} }));
  const fakeChild = new EventEmitter();
  fakeChild.pid = 999999;
  fakeChild.unref = () => {};
  const launcher = t.mock.method(manager, 'launchQuestProcess', () => {
    queueMicrotask(() => fakeChild.emit('spawn'));
    return fakeChild;
  });
  t.mock.method(manager.ipcClient, 'setActivity', async () => true);
  t.mock.method(manager.ipcClient, 'clearActivity', () => {});
  manager.userToken = 'test-only';
  await assert.rejects(manager.startQuest('Example Game', 'example.exe', 15, '101', null, '303'), /больше не доступен/);
  await assert.rejects(manager.startQuest('Example Game', 'other.exe', 15, '101', null, '202'), /не совпадают/);
  assert.equal(launcher.mock.callCount(), 0);
  await manager.startQuest('Example Game', 'example.exe', 15, '101', null, '202');
  assert.equal(manager.quest.isRunning, true);
  assert.equal(manager.quest.percent, 27);
  assert.equal(manager.quest.questId, '202');
  assert.equal(heartbeat.mock.callCount(), 1);
  remote.progressSeconds = 900;
  remote.percent = 100;
  remote.isCompleted = true;
  const completed = once(manager, 'discord_quest_completed');
  await manager.pollQuestProgress();
  assert.equal((await completed)[0].verified, true);
  assert.equal(manager.quest.isRunning, false);
  assert.equal(manager.quest.pollTimer, null);
  assert.equal(manager.quest.questId, null);
  heartbeat.mock.mockImplementation(async () => { throw new Error('heartbeat denied'); });
  remote.isCompleted = false;
  await assert.rejects(manager.startQuest('Example Game', 'example.exe', 15, '101', null, '202'), /heartbeat denied/);
  assert.equal(manager.quest.isRunning, false);
  assert.equal(manager.quest.questProcess, null);
  launcher.mock.mockImplementation(() => {
    manager.userToken = 'another-test-token';
    queueMicrotask(() => fakeChild.emit('spawn'));
    return fakeChild;
  });
  await assert.rejects(manager.startQuest('Example Game', 'example.exe', 15, '101', null, '202'), /Аккаунт Discord изменился/);
  assert.equal(manager.quest.isRunning, false);
  manager.shutdown();
});

test('quest heartbeats use the active application and handle malformed replies, rate limits and denial', async (t) => {
  const manager = new DiscordManager();
  t.after(() => manager.shutdown());
  manager.userToken = 'test-only-token';
  Object.assign(manager.quest, {
    isRunning: true, questId: '202', gameId: '101', startedAt: Date.now(),
    questProcess: { pid: 999999, exePath: 'C:\\test\\example.exe' },
  });
  let status = 200;
  let body = JSON.stringify({ quest_id: '202', progress: { PLAY_ON_DESKTOP: { value: 20 } } });
  let requests = 0;
  t.mock.method(https, 'request', (options, callback) => {
    requests++;
    assert.equal(options.path, '/api/v9/quests/202/heartbeat');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'test-only-token');
    assert.match(options.headers['User-Agent'], /Electron\//);
    const request = new EventEmitter();
    request.setTimeout = () => {};
    request.end = payload => {
      assert.deepEqual(JSON.parse(payload), {
        application_id: '101', executable_path: 'C:\\test\\example.exe', terminal: false,
      });
      queueMicrotask(() => {
        const response = new EventEmitter();
        response.statusCode = status;
        callback(response);
        response.emit('data', body);
        response.emit('end');
      });
    };
    return request;
  });
  assert.equal((await manager.sendQuestHeartbeat()).progress.PLAY_ON_DESKTOP.value, 20);
  assert.equal(manager.quest.progressSeconds, 0);
  body = '{}';
  await assert.rejects(manager.sendQuestHeartbeat(), /не вернул подтверждение/);
  body = '{"quest_id":"999","progress":{}}';
  await assert.rejects(manager.sendQuestHeartbeat(), /не вернул подтверждение/);
  body = 'not json';
  await assert.rejects(manager.sendQuestHeartbeat(), /Некорректный ответ/);
  status = 429;
  body = '{"retry_after":60}';
  const fetch = t.mock.method(manager, 'fetchPersonalQuests', async () => ({
    quests: [{ id: '202', progressSeconds: 20, targetSeconds: 900, percent: 2 }],
  }));
  await manager.pollQuestProgress();
  assert.ok(manager.quest.nextHeartbeatAt >= Date.now() + 59000);
  assert.match(manager.quest.progressError, /429/);
  const before = requests;
  await manager.pollQuestProgress();
  assert.equal(requests, before);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(manager.quest.progressSeconds, 20);
  status = 403;
  body = 'Forbidden';
  manager.quest.nextHeartbeatAt = 0;
  await manager.pollQuestProgress();
  assert.equal(manager.quest.isRunning, false);
  assert.match(manager.quest.progressError, /403/);
});

test('failed quest process launch does not interrupt an existing quest', async (t) => {
  const manager = new DiscordManager();
  manager.discordClientDetected = true;
  manager.quest.isRunning = true;
  manager.quest.gameName = 'Previous game';
  manager.quest.startedAt = Date.now();
  const child = new EventEmitter();
  t.mock.method(manager, 'launchQuestProcess', () => {
    queueMicrotask(() => child.emit('error', new Error('spawn failed')));
    return child;
  });
  await assert.rejects(manager.startQuest('Next game', 'next.exe', 15), /spawn failed/);
  assert.equal(manager.quest.isRunning, true);
  assert.equal(manager.quest.gameName, 'Previous game');
  manager.shutdown();
});

test('a failed Discord refresh is visible, and concurrent refreshes share one request', async (t) => {
  const manager = new DiscordManager();
  manager.quest.isRunning = true;
  manager.quest.questId = '202';
  manager.quest.startedAt = Date.now();
  let rejectFetch;
  const fetch = t.mock.method(manager, 'fetchPersonalQuests', () => new Promise((resolve, reject) => { rejectFetch = reject; }));
  const first = manager.pollQuestProgress();
  const second = manager.pollQuestProgress();
  assert.equal(fetch.mock.callCount(), 1);
  rejectFetch(new Error('network unavailable'));
  await Promise.all([first, second]);
  assert.match(manager.getStatus().quest.progressError, /network unavailable/);
  manager.stopQuest(false);
  manager.shutdown();
});

test('quest reports zero server progress without claiming credit for a detected process', async (t) => {
  const manager = new DiscordManager();
  manager.quest.isRunning = true;
  manager.quest.questId = '202';
  manager.quest.startedAt = Date.now() - 100000;
  const remote = { id: '202', progressSeconds: 0, targetSeconds: 900, percent: 0, isCompleted: false };
  t.mock.method(manager, 'fetchPersonalQuests', async () => ({ quests: [remote] }));
  await manager.pollQuestProgress();
  assert.match(manager.getStatus().quest.progressWarning, /не засчитывает время/);
  assert.equal(manager.getStatus().quest.percent, 0);
  remote.progressSeconds = 20;
  remote.percent = 2;
  await manager.pollQuestProgress();
  assert.equal(manager.getStatus().quest.progressWarning, null);
  assert.equal(manager.getStatus().quest.progressSeconds, 20);
  manager.shutdown();
});

test('local quest timers cannot mark completion without Discord confirmation', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const manager = new DiscordManager();
  manager.quest.isRunning = true;
  manager.quest.questId = '202';
  manager.quest.percent = 0;
  manager.quest.startedAt = Date.now();
  const complete = t.mock.fn();
  manager.on('discord_quest_completed', complete);
  manager.quest.timerId = setInterval(() => {
    manager.quest.elapsedSeconds += 1;
    manager.emit('discord_quest_tick', manager.getStatus().quest);
  }, 1000);
  t.mock.timers.tick(60 * 60 * 1000);
  assert.equal(complete.mock.callCount(), 0);
  assert.equal(manager.quest.percent, 0);
  manager.shutdown();
});

test('REST and WebSocket publish complete state, structured errors and bind only to loopback', async () => {
  await service.startServer({ port: 0, autoLogin: false });
  assert.equal(service.server.address().address, '127.0.0.1');
  const base = `http://127.0.0.1:${service.server.address().port}`;
  assert.equal((await (await fetch(`${base}/api/health`)).json()).service, 'vapor');
  assert.equal((await (await fetch(`${base}/api/discord/quest/token/command`)).json()).command,
    `& '${process.execPath.replace(/'/g, "''")}' '${path.join(__dirname, '../server/copyDiscordToken.js').replace(/'/g, "''")}'`);
  const invalid = await fetch(`${base}/api/discord/mode`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"mode":"invalid"}',
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).success, false);
  const malformed = await fetch(`${base}/api/persona`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).success, false);
  assert.equal((await fetch(`${base}/api/status`, { headers: { Origin: 'https://example.com' } })).status, 403);
  const WebSocket = require('ws');
  const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws');
  const [raw] = await once(ws, 'message');
  const initial = JSON.parse(raw);
  assert.equal(initial.event, 'initial_state');
  assert.equal(initial.data.cardIdler.isRunning, false);
  assert.equal(initial.data.discord.quest.isRunning, false);
  ws.close();
  await once(ws, 'close');
});
