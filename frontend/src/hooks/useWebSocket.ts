import { useEffect, useRef, useState, useCallback } from 'react';
import { API_CONFIG } from '../config';

export interface WsMessage {
  type: string;
  timestamp?: string;
  ts?: string;
  data?: {
    engine?: { status: string; is_running: boolean; strategies_count: number };
    strategies_count?: number;
    positions_count?: number;
    risk?: Record<string, number>;
  };
  // live_data fields (top-level from backend snapshot)
  engine?: { is_initialized: boolean; trader_id: string; strategies_count: number; backtests_count: number };
  metrics?: { cpu_percent: number; memory_percent: number };
  strategies?: Array<{ id: string; name: string; status: string }>;
  open_positions_count?: number;
  total_orders_count?: number;
}

interface UseWebSocketReturn {
  lastMessage: WsMessage | null;
  connected: boolean;
  reconnect: () => void;
}

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useWebSocket(): UseWebSocketReturn {
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const shouldReconnect = useRef(true);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(MIN_DELAY_MS);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${API_CONFIG.WS_URL}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Reset backoff and attempt counter on successful connection
      reconnectDelay.current = MIN_DELAY_MS;
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        setLastMessage(msg);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (shouldReconnect.current) {
        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          console.warn(`[WS] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
          return;
        }
        reconnectAttempts.current += 1;
        const delay = reconnectDelay.current;
        console.info(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);
        reconnectTimeout.current = setTimeout(() => {
          reconnectDelay.current = Math.min(delay * 2, MAX_DELAY_MS);
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    shouldReconnect.current = true;
    connect();

    return () => {
      shouldReconnect.current = false;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    // Manual reconnect resets the backoff delay and attempt counter
    reconnectDelay.current = MIN_DELAY_MS;
    reconnectAttempts.current = 0;
    wsRef.current?.close();
    connect();
  }, [connect]);

  return { lastMessage, connected, reconnect };
}
