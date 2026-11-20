import { useState, useEffect, useRef, useCallback } from 'react';
import type { SteamUser, SteamGame, HourBoosterState, CardIdlerState, LogEvent } from '../types';

export function useSteamWebSocket() {
  const [isLoggedOn, setIsLoggedOn] = useState(false);
  const [user, setUser] = useState<SteamUser | null>(null);
  const [ownedGames, setOwnedGames] = useState<SteamGame[]>([]);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [hourBooster, setHourBooster] = useState<HourBoosterState>({
    isRunning: false,
    activeAppIds: [],
    elapsedSeconds: 0,
    totalFarmedSeconds: 0,
    multiplier: 0,
    targetDurationMinutes: null,
  });
  const [cardIdler, setCardIdler] = useState<CardIdlerState>({
    isRunning: false,
    currentApp: null,
    totalCardsRemaining: 0,
    dropsEarned: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const host = window.location.host || '127.0.0.1:48721';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const { event: evName, data } = JSON.parse(event.data);

        switch (evName) {
          case 'initial_state':
            setIsLoggedOn(data.isLoggedOn);
            setUser(data.user);
            if (data.games) setOwnedGames(data.games);
            if (data.hourBooster) setHourBooster(data.hourBooster);
            break;

          case 'auth_state':
            setIsLoggedOn(data.isLoggedOn);
            setUser(data.user);
            break;

          case 'profile_updated':
            setUser(data);
            break;

          case 'games_loaded':
            setOwnedGames(data);
            break;

          case 'hour_booster_tick':
            setHourBooster((prev) => ({ ...prev, ...data }));
            break;

          case 'card_idler_tick':
            setCardIdler((prev) => ({ ...prev, ...data }));
            break;

          case 'log':
            setLogs((prev) => [data, ...prev.slice(0, 499)]); // Keep last 500 logs
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = () => {
      setTimeout(connect, 2000); // Reconnect on disconnect
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    // Initial fetch via REST
    fetch('/api/status')
      .then((r) => r.json())
      .then((data) => {
        setIsLoggedOn(data.isLoggedOn);
        setUser(data.user);
        if (data.hourBooster) setHourBooster(data.hourBooster);
        if (data.cardIdler) setCardIdler(data.cardIdler);
      })
      .catch(() => {});

    fetch('/api/games')
      .then((r) => r.json())
      .then((games) => {
        if (Array.isArray(games)) setOwnedGames(games);
      })
      .catch(() => {});

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const clearLogs = () => setLogs([]);

  return {
    isLoggedOn,
    user,
    ownedGames,
    logs,
    clearLogs,
    hourBooster,
    cardIdler,
  };
}
