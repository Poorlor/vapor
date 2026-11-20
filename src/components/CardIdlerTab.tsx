import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Play, Square, RefreshCw, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { useI18n } from '../i18n';
import type { CardIdlerState, CardIdlerGame } from '../types';

export interface CardIdlerTabProps {
  cardIdler: CardIdlerState;
  isLoggedOn: boolean;
}

const API_BASE = '/api';

export function CardIdlerTab({ cardIdler, isLoggedOn }: CardIdlerTabProps) {
  const { t } = useI18n();

  const [scannedGames, setScannedGames] = useState<CardIdlerGame[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const sortedScannedGames = useMemo(() => {
    return [...scannedGames].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }, [scannedGames]);

  const handleScan = async () => {
    if (!isLoggedOn) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const res = await fetch(`${API_BASE}/card-idler/scan`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setScannedGames(data);
      }
    } catch (err: any) {
      setScanError(err.message || 'Ошибка сканирования значков');
    } finally {
      setIsScanning(false);
    }
  };

  const handleStartIdling = async () => {
    const listToIdle = scannedGames.length > 0
      ? scannedGames
      : cardIdler.currentApp
      ? [cardIdler.currentApp]
      : [];

    if (listToIdle.length === 0) return;

    setIsActionLoading(true);
    try {
      await fetch(`${API_BASE}/card-idler/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ games: listToIdle }),
      });
    } catch (err) {
      console.error('Failed to start card idler:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStopIdling = async () => {
    setIsActionLoading(true);
    try {
      await fetch(`${API_BASE}/card-idler/stop`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop card idler:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Auto scan once when logged in and no games loaded yet
  useEffect(() => {
    if (isLoggedOn && scannedGames.length === 0 && !cardIdler.isRunning) {
      handleScan();
    }
  }, [isLoggedOn]);

  const totalDrops = scannedGames.reduce((sum, g) => sum + g.cardsRemaining, 0);

  return (
    <div className="w-full h-full overflow-y-auto px-8 py-6 space-y-6">
      {/* Top Banner Card */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl font-bold text-white">{t('card_idler_title')}</h2>
            </div>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              {t('card_idler_desc')}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleScan}
              disabled={isScanning || !isLoggedOn || cardIdler.isRunning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#181c28] border border-[#242b3b] text-gray-200 hover:text-white hover:border-amber-500/40 text-xs font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isScanning ? t('scanning_msg') : t('scan_drops_btn')}</span>
            </button>

            {cardIdler.isRunning ? (
              <button
                onClick={handleStopIdling}
                disabled={isActionLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 font-semibold text-xs transition-all shadow-md shadow-rose-950/20"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>{t('stop_card_idling')}</span>
              </button>
            ) : (
              <button
                onClick={handleStartIdling}
                disabled={sortedScannedGames.length === 0 || !isLoggedOn || isActionLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{t('start_card_idling')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Card Idler Status */}
        {cardIdler.isRunning && (
          <div className="mt-6 pt-6 border-t border-[#1f2535] grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0b0c10] border border-amber-500/30 p-4 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Layers className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-gray-400 uppercase tracking-wider block font-medium">
                  {t('current_game_idling')}
                </span>
                <span className="text-sm font-bold text-white truncate block">
                  {cardIdler.currentApp?.name || 'Steam Game'}
                </span>
                <span className="text-[10px] text-amber-400 font-mono">
                  Осталось карт: {cardIdler.currentApp?.cardsRemaining ?? 0}
                </span>
              </div>
            </div>

            <div className="bg-[#0b0c10] border border-[#1d2333] p-4 rounded-xl flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-[11px] text-gray-400 uppercase tracking-wider block font-medium">
                  {t('cards_dropped_session')}
                </span>
                <span className="text-lg font-bold font-mono text-emerald-300">
                  +{cardIdler.dropsEarned}
                </span>
              </div>
            </div>

            <div className="bg-[#0b0c10] border border-[#1d2333] p-4 rounded-xl flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <span className="text-[11px] text-gray-400 uppercase tracking-wider block font-medium">
                  {t('cards_remaining')}
                </span>
                <span className="text-lg font-bold font-mono text-gray-200">
                  {cardIdler.totalCardsRemaining}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scanned Badge Queue List */}
      <div className="bg-[#131722] border border-[#232938] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">{t('card_queue_title')}</h3>
            <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-semibold">
              {sortedScannedGames.length} {t('games_in_queue')} ({totalDrops} {t('card_drops_left')})
            </span>
          </div>
        </div>

        {scanError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs mb-4">
            {scanError}
          </div>
        )}

        {sortedScannedGames.length === 0 && !isScanning && !scanError && (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-[#0b0c10] rounded-xl border border-[#1d2333]">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3" />
            <p className="text-sm font-semibold text-gray-200">
              {t('no_drops_found')}
            </p>
            <p className="text-xs text-gray-500 mt-1 max-w-md">
              Нажмите кнопку «Сканировать карточки» выше, чтобы проверить актуальные значки Steam на вашем аккаунте.
            </p>
          </div>
        )}

        {isScanning && (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-[#0b0c10] rounded-xl border border-[#1d2333]">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
            <p className="text-xs text-gray-300 font-medium">{t('scanning_msg')}</p>
          </div>
        )}

        {sortedScannedGames.length > 0 && !isScanning && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sortedScannedGames.map((game, idx) => {
              const isCurrent = cardIdler.isRunning && cardIdler.currentApp?.appid === game.appid;
              return (
                <div
                  key={game.appid}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5'
                      : 'bg-[#0b0c10] border-[#1d2333] text-gray-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 font-mono">#{idx + 1}</span>
                      <p className="text-xs font-semibold truncate text-white">
                        {game.name}
                      </p>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono mt-1">
                      AppID: {game.appid}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141724] border border-[#23293c] flex-shrink-0">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300">
                      {game.cardsRemaining}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CardIdlerTab;
