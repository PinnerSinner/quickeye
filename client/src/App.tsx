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
import type {
  ClientMessage,
  JoinedMessage,
  StateUpdateMessage,
  MatchResultMessage,
  ErrorMessage,
} from "@quickeye/shared";
import "./App.css";

export default function App() {
  const wsUrl = import.meta.env.VITE_WSS_URL || "";
  const ws = useWebSocket({ url: wsUrl, enabled: !!wsUrl });
  const [serverRoomCode, setServerRoomCode] = useState<string | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [matchResult, setMatchResult] = useState<{
    correct: boolean;
    symbolId?: number;
    gameOver?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubJoined = ws.on("joined", (msg) => {
      const m = msg as JoinedMessage;
      setServerRoomCode(m.gameId);
      setGameState(m.state);
      console.log("Joined game:", m.gameId);
    });

    const unsubStateUpdate = ws.on("stateUpdate", (msg) => {
      const m = msg as StateUpdateMessage;
      setGameState(m.state);
    });

    const unsubMatchResult = ws.on("matchResult", (msg) => {
      const m = msg as MatchResultMessage;
      setMatchResult(m);
      setTimeout(() => setMatchResult(null), 100);
    });

    const unsubError = ws.on("error", (msg) => {
      const m = msg as ErrorMessage;
      setError(m.message);
      setTimeout(() => setError(null), 3000);
    });

    return () => {
      unsubJoined();
      unsubStateUpdate();
      unsubMatchResult();
      unsubError();
    };
  }, [ws]);

  const handleCreateMultiplayer = (playerName: string) => {
    setServerRoomCode(null);
    setGameState(null);
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

  const handleStartGame = () => {
    if (!wsUrl || !serverRoomCode) return;
    ws.send({
      action: "startGame",
      gameId: serverRoomCode,
    } as ClientMessage);
  };

  const handleSubmitMatch = (gameId: string, symbolId: number) => {
    if (!wsUrl) return;
    ws.send({
      action: "submitMatch",
      gameId,
      symbolId,
    } as ClientMessage);
  };

  return (
    <div className="qe-app-shell">
      <QuickeyeGame
        onCreateMultiplayer={handleCreateMultiplayer}
        onJoinMultiplayer={handleJoinMultiplayer}
        onStartGame={handleStartGame}
        onSubmitMatch={handleSubmitMatch}
        serverRoomCode={serverRoomCode}
        gameState={gameState}
        matchResult={matchResult}
        error={error}
      />
    </div>
  );
}
