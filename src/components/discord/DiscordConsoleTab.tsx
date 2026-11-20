// @ts-nocheck
import React, { useState } from 'react';
import { Terminal, Trash2, Copy, Check, Download } from 'lucide-react';
import { GlassCard } from '../spatial/GlassCard';
import { formatDiagnosticLogs } from '../../lib/logExport';

interface DiscordConsoleTabProps {
  animKey?: number;
  theme?: any;
  lang?: 'ru' | 'en';
  logs: any[];
  setLogs?: React.Dispatch<React.SetStateAction<any[]>>;
  onClear?: () => void;
  platform?: 'Steam' | 'Discord';
}

export const DiscordConsoleTab: React.FC<DiscordConsoleTabProps> = ({
  animKey = 0,
  logs = [],
  setLogs,
  onClear,
  platform = 'Discord',
}) => {
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'>('ALL');
  const [copied, setCopied] = useState(false);

  const handleClear = () => {
    if (onClear) onClear();
    if (setLogs) setLogs([]);
  };

  const handleCopyLogs = async () => {
    const text = formatDiagnosticLogs(logs);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  };

  const handleExportLogs = () => {
    const file = new Blob([formatDiagnosticLogs(logs)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vapor-${platform.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.log`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const filteredLogs = logs.filter((item) => {
    if (levelFilter === 'ALL') return true;
    return (item.level || '').toUpperCase() === levelFilter;
  });

  return (
    <div className="flex flex-col h-full gap-3 select-none text-white">
      {/* ====================================================================
          ROW 1: CONTROL & HEADER PLAQUE
      ==================================================================== */}
      <GlassCard
        delay={20}
        animKey={animKey}
        hoverLift={true}
        className="p-3.5 px-4 shrink-0 flex items-center justify-between gap-4"
      >
        {/* Left: Title & Subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/35 flex items-center justify-center text-emerald-300 shadow-lg shrink-0">
            <Terminal className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                Консоль событий {platform}
              </h2>
              <span className="px-2 py-0.2 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-mono font-semibold text-emerald-300">
                LIVE / WS
              </span>
            </div>
            <p className="text-xs text-white/55 font-mono truncate">
              Системный журнал подключений, действий и ошибок
            </p>
          </div>
        </div>

        {/* Right: Level Filters & Clear */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/15 text-xs font-mono">
            {(['ALL', 'INFO', 'SUCCESS', 'WARN', 'ERROR'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  levelFilter === lvl
                    ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 font-bold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {lvl === 'ALL' ? 'Все' : lvl}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white/80 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
            title="Скопировать журнал"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Скопировано' : 'Копировать'}</span>
          </button>

          <button
            onClick={handleExportLogs}
            disabled={logs.length === 0}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white/80 hover:text-white flex items-center gap-1.5 disabled:opacity-40"
            title="Скачать журнал для диагностики"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Экспорт</span>
          </button>

          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white/80 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
            title="Очистить лог"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-300" />
            <span>Очистить</span>
          </button>
        </div>
      </GlassCard>

      {/* ====================================================================
          ROW 2: TERMINAL GLASS BODY
      ==================================================================== */}
      <GlassCard delay={40} animKey={animKey} hoverLift={true} tint="dark" className="p-4 flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
        {/* Terminal Header Bar */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[11px] font-mono text-white/40 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/70">{platform.toUpperCase()} / WEBSOCKET</span>
          </div>
          <span>Записей: {filteredLogs.length}</span>
        </div>

        {/* Log Entries */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1.5 custom-scrollbar font-mono text-xs select-text">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/30 text-xs font-mono">
              Журнал событий {platform} пуст
            </div>
          ) : (
            filteredLogs.map((item, idx) => {
              const lvl = (item.level || '').toUpperCase();
              const levelColor =
                lvl === 'SUCCESS'
                  ? 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30'
                  : lvl === 'WARN'
                  ? 'text-amber-300 bg-amber-500/15 border-amber-400/30'
                  : lvl === 'ERROR'
                  ? 'text-rose-300 bg-rose-500/15 border-rose-400/30'
                  : 'text-sky-300 bg-sky-500/15 border-sky-400/30';

              return (
                <div key={item.id || idx} className="flex items-start gap-2.5 py-0.5 leading-relaxed hover:bg-white/[0.03] px-1.5 rounded-lg transition-colors">
                  <span className="text-white/35 shrink-0 select-none">[{item.time}]</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold shrink-0 border select-none ${levelColor}`}>
                    {lvl}
                  </span>
                  <span className="text-white/85 break-all">{item.message}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Terminal Footer Sub-bar */}
        <div className="pt-2 mt-2 border-t border-white/10 flex items-center justify-between gap-3 text-[11px] font-mono text-white/40 shrink-0 select-none">
          <span>Служба: {platform}</span>
          <span className="text-right">При ошибке экспортируйте журнал, проверьте и отправьте разработчику. Не отправляйте токены.</span>
        </div>
      </GlassCard>
    </div>
  );
};
