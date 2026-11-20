import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Trash2,
  Copy,
  Check,
  Search,
  ArrowDownCircle,
  Filter,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type { LogEvent } from '../types';

export interface ConsoleTabProps {
  logs: LogEvent[];
  clearLogs: () => void;
}

export function ConsoleTab({ logs, clearLogs }: ConsoleTabProps) {
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'success' | 'warn' | 'error'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}]: ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter((l) => {
    if (levelFilter !== 'all' && l.level !== levelFilter) return false;
    if (searchQuery.trim()) {
      return l.message.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="w-full h-full overflow-hidden px-8 py-6 flex flex-col space-y-4">
      {/* Top Header Card */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">{t('console_title')}</h2>
          </div>
          <p className="text-xs text-gray-400 max-w-xl">
            {t('console_desc')}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              autoScroll
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-[#181c28] text-gray-400 border-[#242b3b]'
            }`}
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            <span>{t('autoscroll')}</span>
          </button>

          <button
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181c28] border border-[#242b3b] text-gray-300 hover:text-white text-xs font-semibold transition-all disabled:opacity-50"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Скопировано!' : t('copy_logs')}</span>
          </button>

          <button
            onClick={clearLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('clear_console')}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-[#131722] p-1 rounded-xl border border-[#232938]">
          {(['all', 'info', 'success', 'warn', 'error'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                levelFilter === lvl
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#131722] border border-[#232938] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Terminal Output Window */}
      <div className="flex-1 bg-[#090b10] border border-[#1d2333] rounded-2xl p-4 overflow-y-auto font-mono text-xs shadow-inner space-y-1.5 select-text">
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            <span>Журнал пуст. Запустите одну из функций для отображения логов.</span>
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            let levelColor = 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
            if (log.level === 'success') {
              levelColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
            } else if (log.level === 'warn') {
              levelColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
            } else if (log.level === 'error') {
              levelColor = 'text-rose-400 border-rose-500/30 bg-rose-500/10';
            }

            return (
              <div
                key={index}
                className="flex items-start gap-3 py-1 px-2 rounded hover:bg-[#111520] transition-colors"
              >
                <span className="text-gray-500 select-none flex-shrink-0 text-[11px]">
                  {log.timestamp}
                </span>
                <span
                  className={`text-[9px] uppercase px-1.5 py-0.5 rounded border font-bold select-none flex-shrink-0 ${levelColor}`}
                >
                  {log.level}
                </span>
                <span className="text-gray-200 leading-relaxed break-all">
                  {log.message}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default ConsoleTab;
