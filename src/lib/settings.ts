export interface AppSettings {
  autostart: boolean;
  minimizeToTray: boolean;
  startMinimized: boolean;
  gpuAcceleration: boolean;
  fluidAnimations: boolean;
}
const defaults: AppSettings = { autostart: false, minimizeToTray: true, startMinimized: false, gpuAcceleration: true, fluidAnimations: true };
const key = 'vapor_application_settings_v2';
export function loadLocalSettings(): AppSettings {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
  catch { return { ...defaults }; }
}
export function saveLocalSettings(settings: AppSettings) {
  localStorage.setItem(key, JSON.stringify(settings));
}
export function applyMotionSetting(settings: AppSettings) {
  document.documentElement.dataset.motion = settings.fluidAnimations ? 'full' : 'reduced';
}
declare global {
  interface Window {
    vaporAPI?: {
      platform: string;
      version: string;
      getSettings(): Promise<AppSettings>;
      saveSettings(settings: AppSettings): Promise<{ settings: AppSettings; restartRequired: boolean }>;
    };
  }
}
