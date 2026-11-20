// Only Discord's own quest status is authoritative. A local countdown or
// presence packet cannot prove a quest or reward was credited.
function normalizeQuest(q, games = [], now = Date.now()) {
  const config = q?.config || {};
  const status = q?.user_status || {};
  const legacy = config.task_config || config.taskConfig || {};
  const tasks = (config.task_config_v2 || config.taskConfigV2)?.tasks || legacy.tasks
    || (legacy.task && legacy.target ? { [legacy.task]: { target: legacy.target } } : {});
  const taskType = Object.keys(tasks).find(key => status.progress?.[key]?.value > 0)
    || Object.keys(tasks).find(key => ['PLAY_ON_DESKTOP', 'PLAY_ON_DESKTOP_V2'].includes(key))
    || Object.keys(tasks)[0] || null;
  const desktopType = Object.keys(tasks).find(key => ['PLAY_ON_DESKTOP', 'PLAY_ON_DESKTOP_V2'].includes(key));
  const targetSeconds = Number(tasks[taskType]?.target ?? status.progress?.target_seconds ?? 0);
  const progressSeconds = Number(status.progress?.[taskType]?.value
    ?? status.progress?.seconds ?? status.stream_progress_seconds ?? 0);
  const applicationId = String(tasks[desktopType || taskType]?.applications?.[0]?.id
    || config.application?.id || config.application_id || '');
  const detectedGame = games.find(game => game.id === applicationId);
  const gameName = config.messages?.game_title || config.application?.name || detectedGame?.name || 'Discord Game';
  const exe = detectedGame?.verifiedWindowsExecutable ? detectedGame.exe : null;
  return {
    id: String(q.id),
    applicationId,
    taskType,
    tasks: Object.entries(tasks).filter(([type]) => ['PLAY_ON_DESKTOP', 'PLAY_ON_DESKTOP_V2', 'PLAY_ON_XBOX', 'PLAY_ON_PLAYSTATION'].includes(type))
      .map(([type, task]) => ({
        type, targetSeconds: Number(task.target) || 0, progressSeconds: Number(status.progress?.[type]?.value) || 0,
        applicationId: String(task.applications?.[0]?.id || config.application?.id || config.application_id || ''),
      })),
    rewardPlatforms: Array.isArray(config.rewards_config?.platforms) && config.rewards_config.platforms.length
      ? config.rewards_config.platforms.filter(p => [0, 1, 2, 3, 4].includes(p)) : [0],
    supportsDesktopPlay: Boolean(desktopType && exe),
    questName: config.messages?.quest_name || gameName,
    gameName,
    exe,
    rewardTitle: config.messages?.reward_title || config.rewards_config?.rewards?.[0]?.messages?.name || 'Награда квеста',
    expiresAt: config.expires_at || null,
    isExpired: config.expires_at ? Date.parse(config.expires_at) <= now : false,
    canClaim: Boolean(status.completed_at) && !status.claimed_at &&
      (!config.rewards_config?.rewards_expire_at || Date.parse(config.rewards_config.rewards_expire_at) > now),
    isEnrolled: Boolean(status.enrolled_at),
    isCompleted: Boolean(status.completed_at),
    isClaimed: Boolean(status.claimed_at),
    claimedCode: status.claimed_code || null,
    progressSeconds: Number.isFinite(progressSeconds) ? Math.max(0, progressSeconds) : 0,
    targetSeconds: Number.isFinite(targetSeconds) ? Math.max(0, targetSeconds) : 0,
    percent: targetSeconds > 0 ? Math.min(100, Math.max(0, Math.round(progressSeconds / targetSeconds * 100))) : 0,
  };
}

// /quests/@me also includes expired, preview and excluded campaigns.
function personalQuests(response, games = [], userId = null, now = Date.now()) {
  if (!Array.isArray(response?.quests)) throw new Error('Ответ Discord не содержит список квестов');
  const excluded = new Set((response.excluded_quests || []).map(q => String(q.id)));
  const seen = new Set();
  return response.quests.filter(q => {
    if (!q?.id || !q.config || excluded.has(String(q.id)) || seen.has(String(q.id))) return false;
    seen.add(String(q.id));
    if (q.preview || q.config.features?.includes(21)) return false;
    if (userId && q.user_status?.user_id && q.user_status.user_id !== userId) return false;
    const starts = Date.parse(q.config.starts_at);
    const expires = Date.parse(q.config.expires_at);
    if (q.config.starts_at && (!Number.isFinite(starts) || starts > now)) return false;
    if (q.config.expires_at && !Number.isFinite(expires)) return false;
    if (expires <= now) {
      const rewardExpiry = Date.parse(q.config.rewards_config?.rewards_expire_at);
      return Boolean(q.user_status?.completed_at && !q.user_status.claimed_at && rewardExpiry > now);
    }
    return true;
  }).map(q => normalizeQuest(q, games, now));
}

module.exports = { normalizeQuest, personalQuests };
