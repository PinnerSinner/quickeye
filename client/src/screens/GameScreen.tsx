import { useState, useEffect } from "react";
import type { GameState } from "@quickeye/shared";
import {
  getCardSymbols,
  findMatchingSymbol,
} from "../utils/deck";
import { GeometricGlyph } from "../components/GeometricGlyph";
import "./GameScreen.css";

interface GameScreenProps {
  state: GameState;
  playerId: string;
  onSubmitMatch: (symbolId: number) => void;
  onRematch?: () => void;
  onReturnLobby?: () => void;
}

export function GameScreen({
  state,
  playerId,
  onSubmitMatch,
  onRematch,
  onReturnLobby,
}: GameScreenProps) {
  const currentPlayer = state.players.find((p) => p.playerId === playerId);
  const centerCardId = state.centerCardId;
  const playerCardId = currentPlayer?.currentCardId;

  const [matchingSymbolId, setMatchingSymbolId] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Get max time based on game mode
  const getMaxTime = () => {
    const mode = state.gameMode;
    if (mode === "time-attack-60") return 60;
    return 999999; // No timer for 10-rounds and difficulty-scaling
  };

  const maxTime = getMaxTime();
  const [timeRemaining, setTimeRemaining] = useState(maxTime);

  // Debug logging
  useEffect(() => {
    console.log("GameScreen state:", {
      centerCardId,
      playerCardId,
      playerCount: state.players.length,
      status: state.status,
    });
  }, [centerCardId, playerCardId, state.players.length, state.status]);

  // TODO: Fix findMatch to work with client deck structure
  // For now, disable matching symbol highlighting so the game can render
  useEffect(() => {
    setMatchingSymbolId(null);
  }, [centerCardId, playerCardId]);

  // Timer countdown
  useEffect(() => {
    if (state.status !== "playing" || maxTime === 999999) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.status, maxTime]);

  // Detect when time runs out and show game over
  useEffect(() => {
    if (timeRemaining === 0 && state.status === "playing") {
      // Time's up - trigger game over
      // In a real scenario, server would handle this, but for UX we show it immediately
    }
  }, [timeRemaining, state.status]);

  const centerSymbols =
    centerCardId !== null && centerCardId !== undefined
      ? getCardSymbols(centerCardId) || []
      : [];
  const playerSymbols =
    playerCardId !== null && playerCardId !== undefined
      ? getCardSymbols(playerCardId) || []
      : [];

  // Ensure symbols are arrays
  const safeCenter = Array.isArray(centerSymbols) ? centerSymbols : [];
  const safePlayer = Array.isArray(playerSymbols) ? playerSymbols : [];

  const handleSymbolClick = (symbolId: number) => {
    if (submitted) return;
    setSubmitted(true);
    onSubmitMatch(symbolId);
    setTimeout(() => setSubmitted(false), 1000);
  };

  // Calculate scale factor based on time remaining
  // Only applies to time-attack mode; other modes have no shrinking
  const getSymbolScale = () => {
    if (maxTime === 999999) return 1.0; // No shrinking for unlimited-time modes
    const scale = Math.max(0.7, 1 - (maxTime - timeRemaining) * (0.3 / maxTime));
    return scale;
  };

  const symbolScale = getSymbolScale();

  // Show game over when time runs out
  const isTimeUp = timeRemaining === 0 && state.status === "playing";

  return (
    <div className="game-screen">
      <div className="game-header">
        <h1>Quickeye</h1>
        <div className={`timer ${timeRemaining <= 5 ? "danger" : ""}`}>
          <span>{timeRemaining}s</span>
        </div>
      </div>

      <div className="game-board">
        <div className="card-section">
          <h3>Match Board</h3>
          <div className="card center-card">
            <div className="card-symbols" style={{ transform: `scale(${symbolScale})` }}>
              {safeCenter.map((symbolId) => (
                <div
                  key={symbolId}
                  className="symbol-box"
                >
                  <GeometricGlyph symbolId={symbolId} size={52} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card-section">
          <h3>{currentPlayer?.name || "Your Hand"}</h3>
          <div className="card player-card">
            <div className="card-symbols" style={{ transform: `scale(${symbolScale})` }}>
              {safePlayer.map((symbolId) => (
                <button
                  key={symbolId}
                  className={`symbol-button ${
                    matchingSymbolId === symbolId ? "matching" : ""
                  } ${submitted ? "disabled" : ""}`}
                  onClick={() => handleSymbolClick(symbolId)}
                  disabled={submitted}
                >
                  <GeometricGlyph symbolId={symbolId} size={52} />
                </button>
              ))}
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

      {(state.status === "finished" || isTimeUp) && (
        <div className="game-over-overlay">
          <div className="game-over">
            <h2>{isTimeUp ? "Time Up" : "Game Over"}</h2>
            <div className="final-scores">
              <h3>Final Scores</h3>
              {state.players
                .sort((a, b) => b.score - a.score)
                .map((player, idx) => (
                  <div
                    key={player.playerId}
                    className={`score-row ${idx === 0 ? "winner" : ""}`}
                  >
                    <span className="medal">
                      {idx === 0 ? "1st" : idx === 1 ? "2nd" : "3rd"}
                    </span>
                    <span className="name">
                      {player.name}
                      {player.playerId === playerId && " (you)"}
                    </span>
                    <span className="score">{player.score} pts</span>
                  </div>
                ))}
            </div>
            <div className="game-over-buttons">
              <button className="rematch-btn" onClick={onRematch}>
                Play Again
              </button>
              <button className="return-btn" onClick={onReturnLobby}>
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
