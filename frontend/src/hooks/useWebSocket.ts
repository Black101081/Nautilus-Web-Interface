import { useEffect, useRef, useState, useCallback } from 'react';
import { API_CONFIG } from '../config';

export interface WsMessage {
  type: string;
  timestamp: string;
  data: {
    engine: { status: string; is_running: boolean; strategies_count: number };
    strategies_count: number;
    positions_count: number;
    risk: Record<string, number>;
  };
}

interface UseWebSocketReturn {
  lastMessage: WsMessage | null;
  connected: boolean;
  reconnect: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const shouldReconnect = useRef(true);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${API_CONFIG.WS_URL}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
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
      if (shouldReconnect.current) {
        reconnectTimeout.current = setTimeout(connect, 3000);
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
    wsRef.current?.close();
    connect();
  }, [connect]);

  return { lastMessage, connected, reconnect };
}
