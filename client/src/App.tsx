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
  LeaderboardMessage,
  LeaderboardEntry,
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
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({
    marathon: [],
    race: [],
    power: [],
  });
  const [availableGames, setAvailableGames] = useState<
    Array<{ gameId: string; host: string; playerCount: number; gameMode: string }>
  >([]);

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

    const unsubLeaderboard = ws.on("leaderboard", (msg) => {
      const m = msg as LeaderboardMessage;
      setLeaderboards((prev) => ({
        ...prev,
        [m.gameMode]: m.entries,
      }));
    });

    const unsubGamesList = ws.on("gamesList", (msg: any) => {
      setAvailableGames(msg.games || []);
    });

    return () => {
      unsubJoined();
      unsubStateUpdate();
      unsubMatchResult();
      unsubError();
      unsubLeaderboard();
      unsubGamesList();
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

  const modeToGameMode = (clientMode: string) => {
    const map: Record<string, string> = {
      marathon: "time-attack-60",
      race: "ten-rounds",
      power: "difficulty-scaling",
    };
    return map[clientMode] || "time-attack-60";
  };

  const handleQueryLeaderboard = (gameMode: string) => {
    if (!wsUrl) return;
    const serverMode = modeToGameMode(gameMode);
    ws.send({
      action: "queryLeaderboard",
      gameMode: serverMode as any,
      period: "all-time",
      limit: 50,
    } as ClientMessage);
  };

  const handleQueryGames = () => {
    if (!wsUrl) return;
    ws.send({
      action: "queryGames",
    } as ClientMessage);
  };

  return (
    <div className="qe-app-shell">
      <QuickeyeGame
        onCreateMultiplayer={handleCreateMultiplayer}
        onJoinMultiplayer={handleJoinMultiplayer}
        onStartGame={handleStartGame}
        onSubmitMatch={handleSubmitMatch}
        onQueryLeaderboard={handleQueryLeaderboard}
        onQueryGames={handleQueryGames}
        serverRoomCode={serverRoomCode}
        gameState={gameState}
        matchResult={matchResult}
        error={error}
        leaderboards={leaderboards}
        availableGames={availableGames}
      />
    </div>
  );
}
