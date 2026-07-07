/**
 * App root.
 *
 * The whole UI is the ported design prototype (QuickeyeGame). Solo play runs
 * client-side; multiplayer create/join are wired to the WebSocket backend when
 * a VITE_WSS_URL is configured (best-effort — the game stays playable offline).
 */

import { useEffect, useState } from "react";
import { useWebSocket } from "./hooks";
import { QuickeyeGame } from "./quickeye/QuickeyeGame";
import type { ClientMessage, JoinedMessage } from "@quickeye/shared";
import "./App.css";

export default function App() {
  const wsUrl = import.meta.env.VITE_WSS_URL || "";
  const ws = useWebSocket({ url: wsUrl, enabled: !!wsUrl });
  const [serverRoomCode, setServerRoomCode] = useState<string | null>(null);

  useEffect(() => {
    const unsub = ws.on("joined", (msg) => {
      const m = msg as JoinedMessage;
      setServerRoomCode(m.gameId);
      console.log("Joined game:", m.gameId);
    });
    return () => {
      unsub();
    };
  }, [ws]);

  const handleCreateMultiplayer = (playerName: string) => {
    setServerRoomCode(null);
    if (!wsUrl) return;
    ws.send({
      action: "createGame",
      playerName,
      gameType: "multiplayer",
    } as ClientMessage);
  };

  const handleJoinMultiplayer = (code: string, playerName: string) => {
    if (!wsUrl) return;
    ws.send({
      action: "joinGame",
      gameId: code,
      playerName,
    } as ClientMessage);
  };

  return (
    <div className="qe-app-shell">
      <QuickeyeGame
        onCreateMultiplayer={handleCreateMultiplayer}
        onJoinMultiplayer={handleJoinMultiplayer}
        serverRoomCode={serverRoomCode}
      />
    </div>
  );
}
