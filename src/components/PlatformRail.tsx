import React from 'react';
import { SteamLogo, DiscordLogo } from './discord/PlatformIcons';

interface PlatformRailProps {
  activePlatform: 'steam' | 'discord';
  setActivePlatform: (p: 'steam' | 'discord') => void;
  lang: 'ru' | 'en';
  isSteamLoggedOn: boolean;
  isDiscordRunning: boolean;
  theme?: any;
  isFarmingHours?: boolean;
  isFarmingCards?: boolean;
  isDiscordVarietyRunning?: boolean;
  isDiscordFarmRunning?: boolean;
}

export function PlatformRail({
  activePlatform,
  setActivePlatform,
  lang,
  isSteamLoggedOn,
  isDiscordRunning,
  theme,
  isFarmingHours = false,
  isFarmingCards = false,
  isDiscordVarietyRunning = false,
  isDiscordFarmRunning = false
}: PlatformRailProps) {
  const dotColor = theme?.dotColor || '#ffffff';
  const spotlightColor = theme?.spotlightColor || 'rgba(255, 255, 255, 0.25)';
  const accentBorder = theme?.accentBorder || 'border-white/30';
  const primaryText = theme?.primaryText || 'text-white';

  const isSteamActiveBusy = isFarmingHours || isFarmingCards;
  const isDiscordActiveBusy = isDiscordVarietyRunning || isDiscordFarmRunning;

  return (
    <aside
      className="w-18 shrink-0 flex flex-col items-center py-4 bg-gradient-to-b from-[#161822]/68 via-[#0e1017]/72 to-[#07080d]/78 backdrop-blur-2xl border border-white/[0.12] rounded-2xl self-start sticky top-8 z-30 transition-all duration-300 shadow-[0_20px_48px_rgba(0,0,0,0.85)]"
      style={{
        boxShadow:
          'inset 0 1px 1px 0 rgba(255, 255, 255, 0.45), inset 0 0 18px 0 rgba(255, 255, 255, 0.02), 0 18px 38px -10px rgba(0, 0, 0, 0.85)'
      }}
    >
      {/* Platform List */}
      <div className="flex flex-col items-center gap-3 w-full">
        {/* Steam Platform Button */}
        <div className="relative flex items-center justify-center w-full group">
          {/* Active Indicator Pill (Theme-adapted) */}
          <span
            style={
              activePlatform === 'steam'
                ? {
                    backgroundColor: dotColor,
                    boxShadow: `0 0 12px ${spotlightColor}`
                  }
                : undefined
            }
            className={`absolute left-0 w-1 rounded-r-full transition-all duration-300 ${
              activePlatform === 'steam'
                ? 'h-9 opacity-100'
                : 'h-2 opacity-0 group-hover:opacity-100 group-hover:h-5 bg-white/40'
            }`}
          />

          <button
            type="button"
            onClick={() => setActivePlatform('steam')}
            title={lang === 'ru' ? 'Менеджер Steam' : 'Steam Manager'}
            style={
              activePlatform === 'steam'
                ? {
                    background:
                      'linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.04) 100%)',
                    boxShadow: `inset 0 1px 1px 0 rgba(255, 255, 255, 0.45), 0 8px 24px -4px ${spotlightColor}`
                  }
                : undefined
            }
            className={`relative w-12 h-12 flex items-center justify-center transition-transform duration-150 active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
              activePlatform === 'steam'
                ? `rounded-xl border ${accentBorder} text-white`
                : 'rounded-xl bg-white/[0.03] text-white/50 hover:text-white hover:bg-white/[0.08] hover:border-white/20 border border-transparent hover:-translate-y-0.5'
            }`}
          >
            <SteamLogo
              className={`w-5 h-5 transition-colors ${
                activePlatform === 'steam' ? primaryText : 'text-white/60 group-hover:text-white'
              }`}
            />

            {/* Status Dot */}
            {isSteamActiveBusy ? (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#050508] flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
              </span>
            ) : isSteamLoggedOn ? (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#050508] flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </span>
            ) : null}
          </button>
        </div>

        {/* Discord Platform Button */}
        <div className="relative flex items-center justify-center w-full group">
          {/* Active Indicator Pill (Theme-adapted) */}
          <span
            style={
              activePlatform === 'discord'
                ? {
                    backgroundColor: dotColor,
                    boxShadow: `0 0 12px ${spotlightColor}`
                  }
                : undefined
            }
            className={`absolute left-0 w-1 rounded-r-full transition-all duration-300 ${
              activePlatform === 'discord'
                ? 'h-9 opacity-100'
                : 'h-2 opacity-0 group-hover:opacity-100 group-hover:h-5 bg-white/40'
            }`}
          />

          <button
            type="button"
            onClick={() => setActivePlatform('discord')}
            title={lang === 'ru' ? 'Менеджер Discord' : 'Discord Manager'}
            style={
              activePlatform === 'discord'
                ? {
                    background:
                      'linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.04) 100%)',
                    boxShadow: `inset 0 1px 1px 0 rgba(255, 255, 255, 0.45), 0 8px 24px -4px ${spotlightColor}`
                  }
                : undefined
            }
            className={`relative w-12 h-12 flex items-center justify-center transition-transform duration-150 active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
              activePlatform === 'discord'
                ? `rounded-xl border ${accentBorder} text-white`
                : 'rounded-xl bg-white/[0.03] text-white/50 hover:text-white hover:bg-white/[0.08] hover:border-white/20 border border-transparent hover:-translate-y-0.5'
            }`}
          >
            <DiscordLogo
              className={`w-5 h-5 transition-colors ${
                activePlatform === 'discord' ? primaryText : 'text-white/60 group-hover:text-white'
              }`}
            />

            {/* Status Dot */}
            {isDiscordActiveBusy ? (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#050508] flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
              </span>
            ) : isDiscordRunning ? (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#050508] flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </aside>
  );
}
