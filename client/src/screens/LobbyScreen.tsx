import { useState, useEffect } from "react";
import type { GameState } from "@quickeye/shared";
import "./LobbyScreen.css";

interface GameSummary {
  gameId: string;
  host: string;
  playerCount: number;
  gameMode: string;
}

interface LobbyScreenProps {
  state: GameState | null;
  playerId: string;
  playerName: string;
  onCreateGame: (playerName: string) => void;
  onJoinGame: (gameId: string, playerName: string) => void;
  onStartGame: () => void;
  isHost: boolean;
  onShowLeaderboard?: () => void;
  ws?: {
    send: (msg: any) => void;
    on: (event: string, handler: (msg: any) => void) => () => void;
  };
}

export function LobbyScreen({
  state,
  playerId,
  playerName,
  onCreateGame,
  onJoinGame,
  onStartGame,
  isHost,
  onShowLeaderboard,
  ws,
}: LobbyScreenProps) {
  const [joinCode, setJoinCode] = useState("");
  const [inputName, setInputName] = useState(playerName || "");
  const [mode, setMode] = useState<"choose" | "create" | "join" | "browse">(
    "choose"
  );
  const [availableGames, setAvailableGames] = useState<GameSummary[]>([]);

  // Query available games when browse mode is active
  useEffect(() => {
    if (!ws || mode !== "browse") return;

    const unsubscribe = ws.on("gamesList", (msg: any) => {
      setAvailableGames(msg.games || []);
    });

    ws.send({ action: "queryGames" });

    return unsubscribe;
  }, [mode, ws]);

  const handleCreate = () => {
    if (!inputName.trim()) {
      alert("Enter your name");
      return;
    }
    onCreateGame(inputName);
  };

  const handleJoin = (gameId?: string) => {
    const code = gameId || joinCode;
    if (!code.trim()) {
      alert("Enter room code");
      return;
    }
    if (!inputName.trim()) {
      alert("Enter your name");
      return;
    }
    onJoinGame(code.toUpperCase(), inputName);
  };

  if (!state) {
    // Waiting for game state
    if (mode === "choose") {
      return (
        <div className="lobby-screen">
          <h1>Quickeye</h1>
          <div className="lobby-buttons">
            <button onClick={() => setMode("browse")}>Browse Games</button>
            <button onClick={() => setMode("create")}>Create New Room</button>
            <button onClick={() => setMode("join")}>Join with Code</button>
          </div>
          <button className="leaderboard-btn" onClick={onShowLeaderboard}>
            View Leaderboard
          </button>
        </div>
      );
    }

    if (mode === "browse") {
      return (
        <div className="lobby-screen">
          <h1>Available Games</h1>
          <div className="games-list">
            {availableGames.length === 0 ? (
              <p style={{ color: "var(--color-fg)", fontWeight: 600 }}>No games available. Create one!</p>
            ) : (
              availableGames.map((game) => (
                <div
                  key={game.gameId}
                  className="game-card"
                  onClick={() => {
                    setJoinCode(game.gameId);
                    handleJoin(game.gameId, inputName);
                  }}
                >
                  <div className="game-code">{game.gameId}</div>
                  <div className="game-info">
                    <span className="host">Host: {game.host}</span>
                    <span className="players">
                      {game.playerCount} player{game.playerCount > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="join-hint">Click to join →</div>
                </div>
              ))
            )}
          </div>
          <button className="secondary" onClick={() => setMode("choose")}>
            Back
          </button>
        </div>
      );
    }

    if (mode === "create") {
      return (
        <div className="lobby-screen">
          <h1>Create Room</h1>
          <input
            type="text"
            placeholder="Your name"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            autoFocus
          />
          <button onClick={handleCreate}>Create</button>
          <button className="secondary" onClick={() => setMode("choose")}>
            Back
          </button>
        </div>
      );
    }

    if (mode === "join") {
      return (
        <div className="lobby-screen">
          <h1>Join Room</h1>
          <input
            type="text"
            placeholder="Room code (e.g., QCKE)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            autoFocus
            maxLength={4}
          />
          <input
            type="text"
            placeholder="Your name"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
          />
          <button onClick={() => handleJoin()}>Join</button>
          <button className="secondary" onClick={() => setMode("choose")}>
            Back
          </button>
        </div>
      );
    }
  }

  // In lobby with game state
  return (
    <div className="lobby-screen">
      <h1>Room {state.gameId}</h1>
      <div className="players-list">
        <h3>Players ({state.players.length})</h3>
        <ul>
          {state.players.map((player) => (
            <li key={player.playerId}>
              {player.name}
              {player.playerId === playerId && " (you)"}
            </li>
          ))}
        </ul>
      </div>
      {isHost && (
        <button
          className="start-button"
          onClick={onStartGame}
          disabled={state.players.length < 2}
        >
          Start Game
        </button>
      )}
    </div>
  );
}
