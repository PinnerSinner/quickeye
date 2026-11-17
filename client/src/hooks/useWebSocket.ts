/**
 * WebSocket connection hook.
 *
 * Quick primer on the lifecycle: the browser opens ONE long-lived socket to
 * API Gateway (that fires the server's $connect Lambda). Messages then flow
 * both ways over it until it closes (which fires $disconnect). If the network
 * blips or API Gateway's idle timeout (10 min) kicks in, the socket closes and
 * we open a fresh one after a short, growing delay.
 *
 * Note: a fresh socket gets a new connectionId on the server, so it is NOT
 * re-linked to the game you were in. That's the known reconnection gap; the
 * App clears multiplayer state when it happens.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ClientMessage, ServerMessage } from "@quickeye/shared";

export type ConnectionStatus =
  /** No server configured (VITE_WSS_URL empty): solo/bot play only. */
  | "offline"
  /** First connection attempt in progress. */
  | "connecting"
  /** Socket open: real multiplayer available. */
  | "connected"
  /** Socket dropped; retrying. */
  | "reconnecting";

interface UseWebSocketOptions {
  url: string;
  enabled: boolean;
}

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 15000;

export function useWebSocket({ url, enabled }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const active = enabled && !!url;
  const [status, setStatus] = useState<ConnectionStatus>(active ? "connecting" : "offline");
  const [error, setError] = useState<string | null>(null);
  const handlersRef = useRef<Map<string, (msg: ServerMessage) => void>>(new Map());
  // Bumping this closes the socket and opens a fresh one (see restart below).
  const [generation, setGeneration] = useState(0);

  /**
   * Drop the socket and open a new one straight away. Used when leaving a
   * game: the close fires the server's $disconnect handler, which tidies up
   * (deletes a lobby whose host left, marks a player as gone mid-game).
   */
  const restart = useCallback(() => setGeneration((g) => g + 1), []);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    setError("Not connected");
    return false;
  }, []);

  const on = useCallback((type: string, handler: (msg: ServerMessage) => void) => {
    handlersRef.current.set(type, handler);
    return () => {
      if (handlersRef.current.get(type) === handler) handlersRef.current.delete(type);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      setStatus("offline");
      return;
    }

    let stopped = false;
    let attempt = 0;
    let retryTimer: number | undefined;

    const open = () => {
      if (stopped) return;
      setStatus(attempt === 0 ? "connecting" : "reconnecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (stopped) return;
        attempt = 0;
        setStatus("connected");
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          handlersRef.current.get(msg.type)?.(msg);
        } catch (err) {
          console.error("Failed to parse message:", err);
        }
      };

      ws.onerror = () => {
        if (!stopped) setError("Connection error");
      };

      ws.onclose = () => {
        if (stopped) return;
        attempt += 1;
        setStatus("reconnecting");
        const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (attempt - 1));
        retryTimer = window.setTimeout(open, delay);
      };
    };

    open();

    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }, [active, url, generation]);

  // Stable object identity (unless status/error change) so consumers can put
  // it in effect dependency lists without re-subscribing on every render.
  return useMemo(
    () => ({ status, connected: status === "connected", error, send, on, restart }),
    [status, error, send, on, restart]
  );
}
