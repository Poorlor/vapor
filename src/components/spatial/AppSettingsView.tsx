import React, { useEffect, useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { applyMotionSetting, loadLocalSettings, saveLocalSettings, type AppSettings } from '../../lib/settings';

interface AppSettingsViewProps {
  animKey: number;
}

const rows: { key: keyof AppSettings; title: string; detail: string; desktop?: boolean }[] = [
  { key: 'autostart', title: 'Автозапуск при старте Windows', detail: 'Запуск Vapor в фоне при входе в Windows.', desktop: true },
  { key: 'minimizeToTray', title: 'Сворачивать в системный трей', detail: 'Закрытие окна сохраняет активные сессии. Выход — через меню трея.', desktop: true },
  { key: 'startMinimized', title: 'Запуск в свёрнутом виде', detail: 'При следующем запуске окно будет скрыто в трее.', desktop: true },
  { key: 'gpuAcceleration', title: 'Аппаратное ускорение GPU', detail: 'Изменение применяется после перезапуска Electron.', desktop: true },
  { key: 'fluidAnimations', title: 'Плавные анимации', detail: 'Переходы и эффекты интерфейса. Учитывается системное уменьшение движения.' },
];

export const AppSettingsView: React.FC<AppSettingsViewProps> = ({
  animKey,
}) => {
  const [settings, setSettings] = useState(loadLocalSettings);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const desktop = Boolean(window.vaporAPI?.getSettings);

  useEffect(() => {
    let active = true;
    window.vaporAPI?.getSettings().then(value => {
      if (active) setSettings(value);
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const result = await window.vaporAPI?.saveSettings(settings);
      const saved = result?.settings ?? settings;
      saveLocalSettings(saved);
      applyMotionSetting(saved);
      setSettings(saved);
      setMessage(result?.restartRequired ? 'Сохранено. Перезапустите Vapor для изменения GPU.' : 'Настройки сохранены.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить настройки.');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex h-full flex-col gap-3 text-white">
      <GlassCard delay={20} animKey={animKey} className="flex shrink-0 items-center justify-between gap-4 p-4">
        <h1 className="flex items-center gap-3 font-semibold"><Settings className="size-5" />Настройки Vapor</h1>
        <button disabled={busy} onClick={save} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">
          <Save className="size-4" />{busy ? 'Подождите…' : 'Сохранить'}
        </button>
      </GlassCard>
      {message && <p role="status" className="rounded-xl border border-white/15 bg-black/30 p-3 text-sm">{message}</p>}
      <GlassCard delay={40} animKey={animKey} className="min-h-0 overflow-y-auto p-4">
        {!desktop && <p className="mb-4 text-xs text-amber-200">Настройки Windows доступны при запуске через npm run app.</p>}
        <div className="space-y-3">
          {rows.map(row => (
            <label key={row.key} className="flex items-center justify-between gap-6 rounded-2xl border border-white/15 bg-white/5 p-4">
              <span><span className="block text-sm font-medium">{row.title}</span><span className="mt-1 block text-xs text-white/55">{row.detail}</span></span>
              <input type="checkbox" className="size-5 shrink-0 accent-[#ddb98e]" checked={settings[row.key]} disabled={busy || (row.desktop && !desktop)}
                onChange={event => setSettings(prev => ({ ...prev, [row.key]: event.target.checked }))} />
            </label>
          ))}
          <p className="p-2 text-xs text-white/50">Обновление приложения: установите новую сборку вручную. Источник автоматических обновлений пока не настроен.</p>
        </div>
      </GlassCard>
    </div>
  );
};
