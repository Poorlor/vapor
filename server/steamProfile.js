function parseProfileXp(html) {
  const block = html.match(/<div class="profile_xp_block">([\s\S]*?)<div style="clear: both">/i)?.[1] || '';
  const xp = block.match(/class="profile_xp_block_xp"[^>]*>\s*XP\s*([\d,]+)/i);
  const level = block.match(/class="friendPlayerLevelNum"[^>]*>(\d+)/i);
  const remaining = block.match(/class="profile_xp_block_remaining"[^>]*>[\s\S]*?([\d,]+)\s*XP to reach Level/i);
  if (!xp || !level || !remaining) return null;
  const currentXp = Number(xp[1].replace(/,/g, ''));
  const xpRemaining = Number(remaining[1].replace(/,/g, ''));
  const currentLevel = Number(level[1]);
  const xpForLevel = (Math.floor(currentLevel / 10) + 1) * 100;
  return { level: currentLevel, currentXp, nextLevelXp: currentXp + xpRemaining, xpPercentage: Math.max(0, Math.min(100, Math.round((1 - xpRemaining / xpForLevel) * 100))) };
}

function parseCollectorCount(html) {
  const match = html.match(/\b([\d,]+)\s+games? in library\b/i);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

module.exports = { parseProfileXp, parseCollectorCount };
