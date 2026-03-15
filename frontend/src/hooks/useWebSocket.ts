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

export function useWebSocket(): UseWebSocketReturn {
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const shouldReconnect = useRef(true);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(MIN_DELAY_MS);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${API_CONFIG.WS_URL}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Reset backoff on successful connection
      reconnectDelay.current = MIN_DELAY_MS;
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
        const delay = reconnectDelay.current;
        reconnectTimeout.current = setTimeout(() => {
          // Exponential backoff: double delay up to MAX
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
    // Manual reconnect resets the backoff delay
    reconnectDelay.current = MIN_DELAY_MS;
    wsRef.current?.close();
    connect();
  }, [connect]);

  return { lastMessage, connected, reconnect };
}
