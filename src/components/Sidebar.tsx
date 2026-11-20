import React from 'react';
import {
  Flame,
  Clock,
  Layers,
  Trophy,
  PackagePlus,
  Terminal,
  Settings,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { TabType } from '../types';
import { useI18n } from '../i18n';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isLoggedOn: boolean;
  hourMultiplier: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isLoggedOn,
  hourMultiplier,
}) => {
  const { t } = useI18n();

  const navItems = [
    { id: 'dashboard' as TabType, label: t('dashboard'), icon: Flame },
    {
      id: 'hour_farm' as TabType,
      label: t('hour_farm'),
      icon: Clock,
      badge: hourMultiplier > 0 ? `${hourMultiplier}x` : null,
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    },
    { id: 'card_idler' as TabType, label: t('card_idler'), icon: Layers },
    { id: 'achievements' as TabType, label: t('achievements'), icon: Trophy },
    { id: 'collector' as TabType, label: t('collector'), icon: PackagePlus },
    { id: 'console' as TabType, label: t('console'), icon: Terminal },
    { id: 'settings' as TabType, label: t('settings'), icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0e1017] border-r border-[#1a1f2e] flex flex-col flex-shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-[#1a1f2e]">
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          {isLoggedOn && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#0e1017] rounded-full animate-pulse" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base tracking-wide bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              {t('app_title')}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-gray-500 font-medium">Steam Protocol Booster</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/15 to-purple-500/10 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-500/5'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#161a26]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-gray-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Steam Status Bar */}
      <div className="p-3.5 m-3 rounded-xl bg-[#131622] border border-[#1e2436] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2 h-2 rounded-full ${
              isLoggedOn ? 'bg-emerald-400 shadow-md shadow-emerald-400/50' : 'bg-rose-500'
            }`}
          />
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-gray-200">
              {isLoggedOn ? 'Steam Connected' : 'Disconnected'}
            </span>
            <span className="text-[9px] text-gray-400">
              {isLoggedOn ? 'Protocol Active' : 'Offline'}
            </span>
          </div>
        </div>
        <ShieldCheck className="w-4 h-4 text-emerald-400/80" />
      </div>
    </aside>
  );
};
