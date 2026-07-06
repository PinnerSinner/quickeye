import { useState, useEffect } from "react";
import type { GameState } from "@quickeye/shared";
import "./GameScreen.css";

interface GameScreenProps {
  state: GameState;
  playerId: string;
  onSubmitMatch: (symbolId: number) => void;
}

export function GameScreen({
  state,
  playerId,
  onSubmitMatch,
}: GameScreenProps) {
  const currentPlayer = state.players.find((p) => p.playerId === playerId);
  const centerCard = state.centerCardId;
  const playerCard = currentPlayer?.currentCardId;

  // Find matching symbol IDs between center and player's card
  const [matchingSymbols, setMatchingSymbols] = useState<number[]>([]);

  useEffect(() => {
    // This will be implemented once we have deck access
    // For now, just show placeholder
  }, [centerCard, playerCard]);

  const handleSymbolClick = (symbolId: number) => {
    onSubmitMatch(symbolId);
  };

  return (
    <div className="game-screen">
      <div className="game-header">
        <h1>Quickeye</h1>
        <div className="timer">
          <span>Round: 30s</span>
        </div>
      </div>

      <div className="game-board">
        <div className="card-section">
          <h3>Center Card</h3>
          <div className="card center-card">
            <div className="card-symbols">
              {/* Symbols will be rendered here */}
              <span className="symbol-placeholder">🔵</span>
              <span className="symbol-placeholder">🟡</span>
              <span className="symbol-placeholder">🟢</span>
              <span className="symbol-placeholder">🔴</span>
              <span className="symbol-placeholder">🟣</span>
              <span className="symbol-placeholder">⭐</span>
              <span className="symbol-placeholder">💎</span>
              <span className="symbol-placeholder">🎯</span>
            </div>
          </div>
        </div>

        <div className="card-section">
          <h3>Your Card</h3>
          <div className="card player-card">
            <div className="card-symbols">
              {/* Your card symbols */}
              <span className="symbol-placeholder">🔵</span>
              <span className="symbol-placeholder">🟠</span>
              <span className="symbol-placeholder">🟢</span>
              <span className="symbol-placeholder">⚫</span>
              <span className="symbol-placeholder">⚪</span>
              <span className="symbol-placeholder">🌟</span>
              <span className="symbol-placeholder">🍕</span>
              <span className="symbol-placeholder">👁️</span>
            </div>
          </div>
        </div>
      </div>

      <div className="scores">
        <h3>Scores</h3>
        <ul>
          {state.players.map((player) => (
            <li key={player.playerId}>
              {player.name}: {player.score}
              {player.playerId === playerId && " ← you"}
            </li>
          ))}
        </ul>
      </div>

      {state.status === "finished" && (
        <div className="game-over">
          <h2>Game Over!</h2>
          <p>
            Winner:{" "}
            {
              state.players.reduce((a, b) =>
                a.score > b.score ? a : b
              ).name
            }
          </p>
        </div>
      )}
    </div>
  );
}
