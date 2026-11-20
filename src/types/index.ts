export type TabType =
  | 'dashboard'
  | 'hour_farm'
  | 'card_idler'
  | 'achievements'
  | 'collector'
  | 'console'
  | 'settings';

export interface SteamUser {
  steamID: string | null;
  personaName: string;
  avatarUrl: string | null;
  level: number;
  wallet: string | null;
  personaState: number;
}

export interface SteamGame {
  appid: number;
  name: string;
  img_icon_url?: string;
  playtime_forever: number;
  playtime_2weeks?: number;
}

export interface HourBoosterState {
  isRunning: boolean;
  activeAppIds: number[];
  elapsedSeconds: number;
  totalFarmedSeconds: number;
  multiplier: number;
  targetDurationMinutes: number | null;
}

export interface CardIdlerGame {
  appid: number;
  name: string;
  cardsRemaining: number;
}

export interface CardIdlerState {
  isRunning: boolean;
  currentApp: CardIdlerGame | null;
  totalCardsRemaining: number;
  dropsEarned: number;
}

export interface Achievement {
  apiName: string;
  name: string;
  description: string;
  unlocked: boolean;
  iconClosed: string;
  iconOpen: string;
}

export interface FreeGame {
  appid: number;
  name: string;
  type: string;
  isOwned: boolean;
}

export interface LogEvent {
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  meta?: any;
}
