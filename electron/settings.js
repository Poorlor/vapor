const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../server/paths');

const defaults = {
  autostart: false,
  minimizeToTray: true,
  startMinimized: false,
  gpuAcceleration: true,
  fluidAnimations: true,
};
const filename = path.join(DATA_DIR, 'app_settings.json');

function readSettings() {
  try { return normalize(JSON.parse(fs.readFileSync(filename, 'utf8'))); }
  catch { return { ...defaults }; }
}

function normalize(input) {
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [
    key, typeof input?.[key] === 'boolean' ? input[key] : value,
  ]));
}

function saveSettings(input) {
  const settings = normalize(input);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(`${filename}.tmp`, JSON.stringify(settings, null, 2));
  fs.renameSync(`${filename}.tmp`, filename);
  return settings;
}

module.exports = { defaults, readSettings, saveSettings };
