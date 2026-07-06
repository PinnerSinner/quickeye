import { useState } from "react";
import type { GameState } from "@quickeye/shared";
import "./LobbyScreen.css";

interface LobbyScreenProps {
  state: GameState | null;
  playerId: string;
  playerName: string;
  onCreateGame: (playerName: string) => void;
  onJoinGame: (gameId: string, playerName: string) => void;
  onStartGame: () => void;
  isHost: boolean;
}

export function LobbyScreen({
  state,
  playerId,
  playerName,
  onCreateGame,
  onJoinGame,
  onStartGame,
  isHost,
}: LobbyScreenProps) {
  const [joinCode, setJoinCode] = useState("");
  const [inputName, setInputName] = useState(playerName || "");
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");

  const handleCreate = () => {
    if (!inputName.trim()) {
      alert("Enter your name");
      return;
    }
    onCreateGame(inputName);
  };

  const handleJoin = () => {
    if (!joinCode.trim()) {
      alert("Enter room code");
      return;
    }
    if (!inputName.trim()) {
      alert("Enter your name");
      return;
    }
    onJoinGame(joinCode.toUpperCase(), inputName);
  };

  if (!state) {
    // Waiting for game state
    if (mode === "choose") {
      return (
        <div className="lobby-screen">
          <h1>Quickeye</h1>
          <div className="lobby-buttons">
            <button onClick={() => setMode("create")}>Create Room</button>
            <button onClick={() => setMode("join")}>Join Room</button>
          </div>
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
          <button onClick={handleJoin}>Join</button>
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
