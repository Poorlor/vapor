import React, { useState } from 'react';
import {
  PieChart,
  Activity,
  Shield,
  Zap,
  Play,
  Square,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { GlassCard } from './GlassCard';

interface ReportsViewProps {
  animKey: number;
  discordStatus: any;
  discordMode: 'process' | 'rpc';
  onModeChange: (mode: 'process' | 'rpc') => void;
  onStartQuest: (gameName: string, exeName: string, durationMinutes?: number, gameId?: string | null) => Promise<boolean>;
  onStopQuest: () => Promise<boolean>;
  onStartVariety: (batchSize: number, intervalSec: number, mode?: string, loopMode?: boolean) => Promise<any>;
  onStopVariety: () => Promise<any>;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  animKey,
  discordStatus,
  discordMode,
  onModeChange,
  onStartQuest,
  onStopQuest,
  onStartVariety,
  onStopVariety,
}) => {
  const [periodTab, setPeriodTab] = useState(discordMode === 'rpc' ? 1 : 0); // 0: Process, 1: RPC, 2: Hybrid
  const [hoverX, setHoverX] = useState<number | null>(null);

  const questIsRunning = Boolean(discordStatus?.quest?.isRunning);
  const varietyIsRunning = Boolean(discordStatus?.variety?.isRunning);

  const kpis = [
    {
      label: 'База игр Discord',
      badge: '25 176',
      badgeColor: 'text-emerald-300 bg-emerald-400/20 border-emerald-300/35',
      value: '25,176 игр',
      sub: '100% распознаваемость',
      fill: 'w-full bg-emerald-400/75',
      delay: 40
    },
    {
      label: 'Квесты Discord',
      badge: questIsRunning ? 'АКТИВЕН' : 'ГОТОВ',
      badgeColor: questIsRunning ? 'text-amber-300 bg-amber-400/20 border-amber-300/35' : 'text-emerald-300 bg-emerald-400/20 border-emerald-300/35',
      value: questIsRunning ? `${discordStatus?.quest?.percent || 0}%` : '15 завершено',
      sub: questIsRunning ? (discordStatus?.quest?.gameName || 'Квест Discord') : 'Награды получены',
      fill: questIsRunning ? 'w-3/4 bg-amber-400/80' : 'w-2/3 bg-slate-900/80',
      delay: 100
    },
    {
      label: 'Ротация «Универсала»',
      badge: varietyIsRunning ? 'РАБОТАЕТ' : '15 СЕК',
      badgeColor: varietyIsRunning ? 'text-emerald-300 bg-emerald-400/20 border-emerald-300/35' : 'text-orange-300 bg-orange-400/20 border-orange-300/35',
      value: `${discordStatus?.variety?.playedCount || 42} смен`,
      sub: 'Случайные игры из базы',
      fill: 'w-1/2 bg-orange-400/80',
      delay: 160
    },
    {
      label: 'Режим инъекции',
      badge: 'STEALTH',
      badgeColor: 'text-sky-300 bg-sky-400/20 border-sky-300/35',
      value: `${discordMode.toUpperCase()} Spoofer`,
      sub: 'Без разрыва соединения',
      fill: 'w-4/5 bg-sky-400/80',
      delay: 220
    },
  ];

  const handleModeSelect = (idx: number) => {
    setPeriodTab(idx);
    if (idx === 0) onModeChange('process');
    else if (idx === 1) onModeChange('rpc');
    else onModeChange('process');
  };

  const handleQuestToggle = () => {
    if (questIsRunning) {
      onStopQuest();
    } else {
      onStartQuest('Cyberpunk 2077', 'Cyberpunk2077.exe', 15);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3.5 select-none text-white">
      {/* Window Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">
              Discord Spoofer & Quests Relay
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md bg-white/15 border border-white/20 text-white/90">
              DISCORD 25K
            </span>
          </div>
          <p className="text-xs text-white/60 font-mono">
            Эмуляция игрового присутствия Discord, фоновые квесты и база 25 176 игр
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Segmented Pill Selector */}
          <div className="p-1 rounded-full bg-white/12 border border-white/20 flex items-center gap-1">
            {['Process', 'RPC', 'Гибрид'].map((modeName, tab) => (
              <button
                key={tab}
                onClick={() => handleModeSelect(tab)}
                className={`px-3 py-1 rounded-full text-xs font-mono transition-all ${
                  periodTab === tab ? 'bg-white/30 text-white font-semibold shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {modeName}
              </button>
            ))}
          </div>

          {/* Dark Action Pill */}
          <button
            onClick={handleQuestToggle}
            className={`h-9 px-4 rounded-full border flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 ${
              questIsRunning
                ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/85 hover:bg-slate-900 border-white/20 text-white'
            }`}
          >
            {questIsRunning ? (
              <>
                <Square className="w-3.5 h-3.5 text-rose-300" />
                <span className="text-xs font-semibold font-mono tracking-wide">
                  Остановить квест
                </span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold font-mono tracking-wide">
                  Быстрый квест (CP2077)
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* TOP GRID ROW (4 Equal KPI Cards) */}
      <div className="grid grid-cols-4 gap-4 h-[150px] shrink-0">
        {kpis.map((kpi, idx) => (
          <GlassCard
            key={idx}
            animKey={animKey}
            delay={kpi.delay}
            className="p-4 flex flex-col justify-between h-full"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/80">{kpi.label}</span>
              <div className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${kpi.badgeColor}`}>
                {kpi.badge}
              </div>
            </div>

            <div className="text-2xl font-extrabold font-mono tracking-tight text-white drop-shadow-sm">
              {kpi.value}
            </div>

            <div className="space-y-1.5">
              <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div className={`h-full rounded-full ${kpi.fill} transition-all duration-700`} />
              </div>
              <span className="text-[11px] font-mono text-white/50 block truncate">
                {kpi.sub}
              </span>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* BOTTOM GRID ROW (8 Cols Smooth Area Wave Chart + 4 Cols Multi-Segment Donut Chart) */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 1. Bottom-Left Wave Spline Chart Card (8 cols) */}
        <GlassCard
          animKey={animKey}
          delay={270}
          className="col-span-8 p-5 flex flex-col justify-between h-full"
        >
          <div className="flex items-center justify-between shrink-0">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-white/90">
                Активность спуфинга и Heartbeat RPC
              </span>
              <p className="text-[10px] font-mono text-white/50">
                Синхронизация пакетов в Discord Gateway
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#e06d53]" />
                <span className="text-white/80">Process Packets</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-white/30" />
                <span className="text-white/80">IPC Heartbeat</span>
              </div>
            </div>
          </div>

          {/* Interactive Dual Spline Wave SVG Chart */}
          <div
            className="relative w-full flex-1 flex flex-col justify-between pt-2 min-h-0 cursor-crosshair"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHoverX(Math.max(40, Math.min(rect.width - 20, e.clientX - rect.left)));
            }}
            onMouseLeave={() => setHoverX(null)}
          >
            <svg className="w-full flex-1 overflow-visible min-h-0" viewBox="0 0 620 175" preserveAspectRatio="none">
              <defs>
                <linearGradient id="coralWaveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e06d53" stopOpacity="0.48" />
                  <stop offset="100%" stopColor="#e06d53" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="slateWaveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f172a" stopOpacity="0.42" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              {[25, 65, 105, 145].map((y, i) => (
                <g key={i}>
                  <line
                    x1="32"
                    y1={y}
                    x2="610"
                    y2={y}
                    stroke="rgba(255,255,255,0.14)"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x="2"
                    y={y + 3}
                    fontSize="9"
                    fill="rgba(255,255,255,0.4)"
                    fontFamily="monospace"
                  >
                    {160 - i * 40}
                  </text>
                </g>
              ))}

              {/* Coral Area & Smooth Spline Curve */}
              <path
                d="M 35 125 C 95 65, 145 55, 205 95 C 265 135, 315 35, 385 50 C 455 65, 505 115, 605 45 L 605 155 L 35 155 Z"
                fill="url(#coralWaveGrad)"
              />
              <path
                d="M 35 125 C 95 65, 145 55, 205 95 C 265 135, 315 35, 385 50 C 455 65, 505 115, 605 45"
                fill="none"
                stroke="#e06d53"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Dark Slate Area & Smooth Spline Curve */}
              <path
                d="M 35 140 C 100 110, 160 125, 230 85 C 300 45, 365 120, 440 90 C 510 62, 555 95, 605 78 L 605 155 L 35 155 Z"
                fill="url(#slateWaveGrad)"
              />
              <path
                d="M 35 140 C 100 110, 160 125, 230 85 C 300 45, 365 120, 440 90 C 510 62, 555 95, 605 78"
                fill="none"
                stroke="#1e293b"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>

            {/* Interactive Hover Crosshair Pill */}
            {hoverX && (
              <div
                className="absolute top-2 bottom-5 w-[1.5px] bg-white/60 pointer-events-none flex flex-col items-center z-10"
                style={{ left: `${hoverX}px` }}
              >
                <div className="px-2.5 py-1 rounded-full backdrop-blur-md bg-slate-900/90 border border-white/30 -mt-2 shadow-lg text-[10px] font-mono text-white whitespace-nowrap">
                  128 pkt/s
                </div>
              </div>
            )}

            {/* Bottom X-axis Time Labels */}
            <div className="flex items-center justify-between pl-8 pr-2 pt-2 shrink-0">
              {['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'].map((time, i) => (
                <span key={i} className="text-[10px] font-mono text-white/50">
                  {time}
                </span>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* 2. Bottom-Right Multi-Segment Donut Chart Card (4 cols) */}
        <GlassCard
          animKey={animKey}
          delay={340}
          className="col-span-4 p-5 flex flex-col items-center justify-between h-full"
        >
          <div className="w-full flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-white/90">
              Категории в Discord
            </span>
            <PieChart className="w-4 h-4 text-white/70" />
          </div>

          {/* Multi-Segment Donut Ring */}
          <div className="relative w-40 h-40 flex items-center justify-center my-1 group-hover:scale-105 transition-transform duration-300">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              {/* Background ring */}
              <circle
                cx="60"
                cy="60"
                r="44"
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="14"
              />
              {/* Segment 1: Coral (#e06d53) 42% */}
              <circle
                cx="60"
                cy="60"
                r="44"
                fill="none"
                stroke="#e06d53"
                strokeWidth="14"
                strokeDasharray="115 276"
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              {/* Segment 2: Dark Slate (#1e293b) 26% */}
              <circle
                cx="60"
                cy="60"
                r="44"
                fill="none"
                stroke="#1e293b"
                strokeWidth="14"
                strokeDasharray="72 276"
                strokeDashoffset="-125"
                strokeLinecap="round"
              />
              {/* Segment 3: Warm Amber (#f59e0b) 18% */}
              <circle
                cx="60"
                cy="60"
                r="44"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="14"
                strokeDasharray="48 276"
                strokeDashoffset="-207"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span className="text-xl font-extrabold font-mono text-white">
                25.1k
              </span>
              <span className="text-[10px] font-mono text-white/60">
                Игр в базе
              </span>
            </div>
          </div>

          {/* 2x2 Legend */}
          <div className="w-full grid grid-cols-2 gap-2 pt-1 shrink-0">
            {[
              { color: 'bg-[#e06d53]', label: 'Шутеры', pct: '42%' },
              { color: 'bg-slate-900 border border-white/20', label: 'RPG / MMO', pct: '26%' },
              { color: 'bg-amber-400', label: 'Инди', pct: '18%' },
              { color: 'bg-white/60', label: 'Другие', pct: '14%' },
            ].map((leg, i) => (
              <div
                key={i}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/15 flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <div className={`w-2 h-2 rounded-full ${leg.color} shrink-0`} />
                  <span className="text-white/80 truncate text-[11px]">{leg.label}</span>
                </div>
                <span className="text-white/60 font-semibold text-[11px]">{leg.pct}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
