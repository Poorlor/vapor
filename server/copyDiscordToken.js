const { spawnSync } = require('child_process');
const discord = require('./discordManager');

async function main() {
  const matches = [];
  for (const token of discord.autoDetectToken(true)) {
    try {
      matches.push({ token, user: await discord.verifyDiscordUserToken(token) });
    } catch {}
  }
  if (matches.length !== 1) throw new Error(`Нужен один действующий аккаунт Discord; найдено: ${matches.length}`);

  const copied = spawnSync('clip.exe', [], { input: matches[0].token, windowsHide: true });
  if (copied.error || copied.status !== 0) throw new Error('Не удалось скопировать токен в буфер обмена');
  console.log(`Токен аккаунта ${matches[0].user.username} скопирован. Вставьте его в поле «Вручную» в Vapor.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => discord.shutdown());
