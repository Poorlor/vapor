import { useState } from 'react';
import { LogOut, RefreshCw, Settings } from 'lucide-react';
import { post } from '../../lib/api';
import { GlassCard } from './GlassCard';

export interface LogItem {
  id: number | string;
  time: string;
  level: string;
  message: string;
}

interface SettingsViewProps {
  animKey: number;
  userProfile: { name: string; steamId: string };
  onLogout: () => void;
  onOpenAuthModal: () => void;
}

export function SettingsView({ animKey, userProfile, onLogout, onOpenAuthModal }: SettingsViewProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refreshInventory = async () => {
    setBusy(true);
    try {
      await post('/api/inventory/refresh');
      setMessage('Инвентарь и история обновлены.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось обновить инвентарь.');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex h-full flex-col gap-3 text-white">
      <GlassCard delay={20} animKey={animKey} className="shrink-0 p-4">
        <h1 className="flex items-center gap-3 font-semibold"><Settings className="size-5" />Настройки Steam</h1>
      </GlassCard>
      <GlassCard delay={40} animKey={animKey} className="p-4">
        <p className="mb-4 text-sm text-white/75">{userProfile.steamId ? `${userProfile.name} · ${userProfile.steamId}` : 'Аккаунт Steam не подключён'}</p>
        <div className="flex flex-wrap gap-3">
          <button disabled={busy || !userProfile.steamId} onClick={refreshInventory} className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-xs disabled:opacity-40"><RefreshCw className="size-4" />Обновить инвентарь</button>
          <button onClick={userProfile.steamId ? onLogout : onOpenAuthModal} className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-xs"><LogOut className="size-4" />{userProfile.steamId ? 'Выйти из Steam' : 'Войти в Steam'}</button>
        </div>
        {message && <p role="status" className="mt-4 text-sm text-white/75">{message}</p>}
      </GlassCard>
    </div>
  );
}
