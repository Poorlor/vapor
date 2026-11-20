import React from 'react';
import {
  Trophy,
  Clock,
  Database,
  Terminal,
  Settings,
  Flame,
  ShieldCheck,
  Disc,
  Sparkles
} from 'lucide-react';
import { DiscordLogo } from './PlatformIcons';

interface DiscordSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: any;
  lang: 'ru' | 'en';
  varietyIsRunning?: boolean;
  isVarietyRunning?: boolean;
  farmIsRunning?: boolean;
  isFarmRunning?: boolean;
  farmMultiplier?: number;
  questIsRunning?: boolean;
  isQuestRunning?: boolean;
  questProgressPercent?: number;
}

export function DiscordSidebar({
  activeTab,
  setActiveTab,
  theme,
  lang,
  varietyIsRunning,
  isVarietyRunning,
  farmIsRunning,
  isFarmRunning,
  farmMultiplier,
  questIsRunning,
  isQuestRunning,
  questProgressPercent
}: DiscordSidebarProps) {
  const isVarRunning = Boolean(varietyIsRunning ?? isVarietyRunning);
  const isFmRunning = Boolean(farmIsRunning ?? isFarmRunning);
  const isQRunning = Boolean(questIsRunning ?? isQuestRunning);
  const multiplier = farmMultiplier || 0;

  const navItems = [
    {
      id: 'discord_quests',
      labelRu: 'Квесты Discord',
      labelEn: 'Discord Quests',
      icon: Sparkles,
      badge: isQRunning ? (questProgressPercent ? `${questProgressPercent}%` : 'RUN') : '15m',
      badgeColor: isQRunning
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    },
    {
      id: 'discord_variety',
      labelRu: 'Универсал',
      labelEn: 'Game Variety',
      icon: Trophy,
      badge: isVarRunning ? 'ON' : null,
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
    },
    {
      id: 'discord_hours',
      labelRu: 'Фарм часов',
      labelEn: 'Hours Multiplier',
      icon: Clock,
      badge: isFmRunning ? `${multiplier}x` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    },
    {
      id: 'discord_database',
      labelRu: 'База игр',
      labelEn: 'Games Catalog',
      icon: Database,
      badge: '25k',
      badgeColor: 'bg-white/[0.08] text-white/50 border-white/[0.1]'
    },
    {
      id: 'discord_console',
      labelRu: 'Консоль',
      labelEn: 'Logs & Console',
      icon: Terminal,
      badge: null
    },
    {
      id: 'discord_settings',
      labelRu: 'Настройки',
      labelEn: 'Settings',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <aside
      className="relative backdrop-blur-2xl bg-gradient-to-b from-[#161822]/68 via-[#0e1017]/72 to-[#07080d]/78 border border-white/[0.12] rounded-2xl p-4 lg:w-64 shrink-0 self-start lg:sticky lg:top-8 flex flex-row lg:flex-col justify-between gap-2 overflow-x-auto transition-all duration-300 shadow-[0_20px_48px_rgba(0,0,0,0.85)]"
      style={{
        boxShadow:
          'inset 0 1px 1px 0 rgba(255, 255, 255, 0.45), inset 0 0 18px 0 rgba(255, 255, 255, 0.02), 0 18px 38px -10px rgba(0, 0, 0, 0.85)'
      }}
    >
      {/* Platform Title in Sidebar */}
      <div className="hidden lg:flex items-center gap-2.5 px-3 py-2 mb-2 border-b border-white/[0.06]">
        <div className={`w-6 h-6 rounded-lg bg-white/[0.05] ${theme?.primaryText || 'text-[#5865F2]'} flex items-center justify-center border ${theme?.accentBorder || 'border-white/10'}`}>
          <DiscordLogo className="w-3.5 h-3.5" />
        </div>
        <div className="text-xs font-semibold text-white tracking-tight">
          Discord Менеджер
        </div>
      </div>

      <nav className="flex flex-row lg:flex-col gap-2 w-full">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`group relative px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between gap-3 transition-transform duration-150 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-white/20 select-none shrink-0 lg:w-full cursor-pointer ${
                isActive
                  ? `${theme?.activeNavBg || 'bg-[#5865F2]/20 text-white border border-[#5865F2]/40'} border shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_6px_16px_rgba(0,0,0,0.5)]`
                  : 'text-white/55 hover:text-white hover:bg-white/[0.05] hover:border-white/10 border border-transparent hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-center gap-3">
                <IconComponent
                  size={17}
                  strokeWidth={1.5}
                  className={
                    isActive
                      ? theme?.primaryText || 'text-[#5865F2]'
                      : 'text-white/40 group-hover:text-white transition-colors'
                  }
                />
                <span className="truncate">
                  {lang === 'ru' ? item.labelRu : item.labelEn}
                </span>
              </div>

              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums tracking-wide border ${
                    isActive
                      ? theme?.badgeBg || item.badgeColor
                      : item.badgeColor || 'bg-white/[0.1] text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
