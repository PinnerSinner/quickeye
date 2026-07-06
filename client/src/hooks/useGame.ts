import { useState, useCallback } from "react";
import type { GameState, Player, GameMode } from "@quickeye/shared";

interface UseGameState {
  gameId: string | null;
  playerId: string | null;
  playerName: string;
  state: GameState | null;
  error: string | null;
  gameMode: GameMode;
}

interface UseGameMethods {
  setGameId: (id: string) => void;
  setPlayerId: (id: string) => void;
  setPlayerName: (name: string) => void;
  setState: (state: GameState) => void;
  setError: (error: string | null) => void;
  setGameMode: (mode: GameMode) => void;
  clear: () => void;
}

export function useGame(): UseGameState & UseGameMethods {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>("time-attack-60");

  const clear = useCallback(() => {
    setGameId(null);
    setPlayerId(null);
    setPlayerName("");
    setState(null);
    setError(null);
  }, []);

  return {
    gameId,
    setGameId,
    playerId,
    setPlayerId,
    playerName,
    setPlayerName,
    state,
    setState,
    error,
    setError,
    gameMode,
    setGameMode,
    clear,
  };
}
