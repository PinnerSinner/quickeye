/**
 * App root.
 *
 * The whole UI is the ported design prototype (QuickeyeGame). Solo play runs
 * client-side; multiplayer create/join/browse/play go over the WebSocket
 * backend when VITE_WSS_URL is set at build time. Without it the app runs
 * offline (solo + bots) and the connection badge says so.
 *
 * React note: everything the server tells us lives in useState here, and is
 * passed down to QuickeyeGame as props. When a message arrives we call a
 * setter, React re-renders, and the screens pick up the new values.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useWebSocket } from "./hooks";
import { QuickeyeGame } from "./quickeye/QuickeyeGame";
import { ConnectionBadge } from "./quickeye/ConnectionBadge";
import type { MatchFeedback } from "./quickeye/MultiplayerBoard";
import type {
  ClientMessage,
  GameState,
  JoinedMessage,
  StateUpdateMessage,
  MatchResultMessage,
  ErrorMessage,
  LeaderboardMessage,
  LeaderboardEntry,
} from "@quickeye/shared";
import "./App.css";

// Server errors (bad room code, game full, dropped connection...) used to be
// stored but never shown. This toast makes them visible.
const toastStyle: CSSProperties = {
  position: "fixed",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 1001,
  maxWidth: "calc(100vw - 32px)",
  padding: "10px 16px",
  background: "#D02020",
  color: "#fff",
  border: "3px solid #000",
  boxShadow: "4px 4px 0 0 #000",
  font: "700 14px/1.4 'Outfit',sans-serif",
};

const modeToGameMode = (clientMode: string) => {
  const map: Record<string, string> = {
    marathon: "time-attack-60",
    race: "ten-rounds",
    power: "difficulty-scaling",
  };
  return map[clientMode] || "time-attack-60";
};

const modeFromGameMode = (serverMode: string) => {
  const map: Record<string, string> = {
    "time-attack-60": "marathon",
    "ten-rounds": "race",
    "difficulty-scaling": "power",
  };
  return map[serverMode] || "marathon";
};

export default function App() {
  const wsUrl = import.meta.env.VITE_WSS_URL || "";
  const ws = useWebSocket({ url: wsUrl, enabled: !!wsUrl });
  const { on, send, status, restart } = ws;
  const online = status === "connected";

  const [serverRoomCode, setServerRoomCode] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [matchResult, setMatchResult] = useState<{
    correct: boolean;
    symbolId?: number;
    gameOver?: boolean;
  } | null>(null);
  const [matchFeedback, setMatchFeedback] = useState<MatchFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({
    marathon: [],
    race: [],
    power: [],
  });
  const [availableGames, setAvailableGames] = useState<
    Array<{ gameId: string; host: string; playerCount: number; gameMode: string }>
  >([]);

  // The room we're currently in. A ref (not state) so the message handlers,
  // which are registered once, always see the latest value.
  const roomRef = useRef<string | null>(null);

  const showError = (message: string) => {
    setError(message);
    window.setTimeout(() => setError(null), 3500);
  };

  // Subscribe to server messages once. `on` is stable, so this runs one time.
  useEffect(() => {
    const unsubs = [
      on("joined", (msg) => {
        const m = msg as JoinedMessage;
        roomRef.current = m.gameId;
        setServerRoomCode(m.gameId);
        setMyPlayerId(m.playerId);
        setGameState(m.state);
      }),
      on("stateUpdate", (msg) => {
        const m = msg as StateUpdateMessage;
        // Ignore broadcasts for a game we've walked away from: the server
        // still has this socket linked to it until we create/join another.
        if (m.state.gameId === roomRef.current) setGameState(m.state);
      }),
      on("matchResult", (msg) => {
        const m = msg as MatchResultMessage;
        setMatchResult(m);
        setMatchFeedback({ correct: m.correct, symbolId: m.symbolId, nonce: Date.now() + Math.random() });
        window.setTimeout(() => setMatchResult(null), 100);
      }),
      on("error", (msg) => showError((msg as ErrorMessage).message)),
      on("leaderboard", (msg) => {
        const m = msg as LeaderboardMessage;
        setLeaderboards((prev) => ({ ...prev, [modeFromGameMode(m.gameMode)]: m.entries }));
      }),
      on("gamesList", (msg: any) => setAvailableGames(msg.games || [])),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on]);

  // Known gap: a dropped socket comes back with a new connectionId, which the
  // server doesn't link back to your game. Rather than leave you staring at a
  // frozen board, drop out of the game and say why.
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === "connected" && status !== "connected" && serverRoomCode) {
      leaveGame();
      showError("Lost connection to the server, so you've dropped out of that game.");
    }
    prevStatus.current = status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /** Walk away from the current game (user pressed Back / Leave). */
  const quitGame = () => {
    const wasInGame = roomRef.current !== null;
    leaveGame();
    // Fresh socket = server runs $disconnect for the old one and cleans up.
    if (wasInGame) restart();
  };

  const leaveGame = () => {
    roomRef.current = null;
    setServerRoomCode(null);
    setMyPlayerId(null);
    setGameState(null);
    setMatchFeedback(null);
  };

  const requireOnline = () => {
    if (online) return true;
    showError(
      wsUrl
        ? "Not connected to the server yet. Hang on a sec and try again."
        : "Multiplayer needs the game server, and this build is offline."
    );
    return false;
  };

  const handleCreateMultiplayer = (playerName: string) => {
    leaveGame();
    if (!requireOnline()) return;
    send({ action: "createGame", playerName, gameType: "multiplayer" } as ClientMessage);
  };

  const handleJoinMultiplayer = (code: string, playerName: string) => {
    leaveGame();
    if (!requireOnline()) return;
    send({ action: "joinGame", gameId: code, playerName } as ClientMessage);
  };

  const handleStartGame = () => {
    if (!serverRoomCode || !requireOnline()) return;
    send({ action: "startGame", gameId: serverRoomCode } as ClientMessage);
  };

  const handleSubmitMatch = (gameId: string, symbolId: number) => {
    if (!requireOnline()) return;
    send({ action: "submitMatch", gameId, symbolId } as ClientMessage);
  };

  const handleQueryLeaderboard = (gameMode: string) => {
    if (!online) return;
    send({
      action: "queryLeaderboard",
      gameMode: modeToGameMode(gameMode) as any,
      period: "all-time",
      limit: 50,
    } as ClientMessage);
  };

  const handleQueryGames = () => {
    if (!online) return;
    send({ action: "queryGames" } as ClientMessage);
  };

  return (
    <div className="qe-app-shell">
      <ConnectionBadge status={status} />
      {error && (
        <div role="alert" data-testid="error-toast" style={toastStyle}>
          {error}
        </div>
      )}
      <QuickeyeGame
        connectionStatus={status}
        myPlayerId={myPlayerId}
        onCreateMultiplayer={handleCreateMultiplayer}
        onJoinMultiplayer={handleJoinMultiplayer}
        onStartGame={handleStartGame}
        onSubmitMatch={handleSubmitMatch}
        onQueryLeaderboard={handleQueryLeaderboard}
        onQueryGames={handleQueryGames}
        onLeaveMultiplayer={quitGame}
        serverRoomCode={serverRoomCode}
        gameState={gameState}
        matchResult={matchResult}
        matchFeedback={matchFeedback}
        error={error}
        leaderboards={leaderboards}
        availableGames={availableGames}
      />
    </div>
  );
}
