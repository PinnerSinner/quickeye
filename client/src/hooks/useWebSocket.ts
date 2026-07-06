import { useEffect, useRef, useState, useCallback } from "react";
import type { ClientMessage, ServerMessage } from "@quickeye/shared";

interface UseWebSocketOptions {
  url: string;
  enabled: boolean;
}

export function useWebSocket({ url, enabled }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handlersRef = useRef<Map<string, (msg: ServerMessage) => void>>(
    new Map()
  );

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      setError("Not connected");
    }
  }, []);

  const on = useCallback((type: string, handler: (msg: ServerMessage) => void) => {
    handlersRef.current.set(type, handler);
    return () => handlersRef.current.delete(type);
  }, []);

  useEffect(() => {
    if (!enabled || !url) return;

    const ws = new WebSocket(url);
    let mounted = true;

    ws.onopen = () => {
      if (mounted) {
        setConnected(true);
        setError(null);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        const handler = handlersRef.current.get(msg.type);
        if (handler) {
          handler(msg);
        }
      } catch (err) {
        console.error("Failed to parse message:", err);
      }
    };

    ws.onerror = () => {
      if (mounted) {
        setError("Connection error");
        setConnected(false);
      }
    };

    ws.onclose = () => {
      if (mounted) {
        setConnected(false);
      }
    };

    wsRef.current = ws;

    return () => {
      mounted = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [enabled, url]);

  return { connected, error, send, on };
}
