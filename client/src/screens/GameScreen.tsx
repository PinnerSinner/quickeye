import { useState, useEffect } from "react";
import type { GameState } from "@quickeye/shared";
import {
  getCardSymbols,
  findMatchingSymbol,
  getSymbolEmoji,
} from "../utils/deck";
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
  const centerCardId = state.centerCardId;
  const playerCardId = currentPlayer?.currentCardId;

  const [matchingSymbolId, setMatchingSymbolId] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);

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
    if (state.status !== "playing") return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          // Time's up - game should end (server will handle this)
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.status]);

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
          <h3>Center Card</h3>
          <div className="card center-card">
            <div className="card-symbols">
              {safeCenter.map((symbolId) => (
                <div
                  key={symbolId}
                  className="symbol-box"
                >
                  <span className="symbol">{getSymbolEmoji(symbolId)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card-section">
          <h3>Your Card</h3>
          <div className="card player-card">
            <div className="card-symbols">
              {safePlayer.map((symbolId) => (
                <button
                  key={symbolId}
                  className={`symbol-button ${
                    matchingSymbolId === symbolId ? "matching" : ""
                  } ${submitted ? "disabled" : ""}`}
                  onClick={() => handleSymbolClick(symbolId)}
                  disabled={submitted}
                >
                  <span className="symbol">{getSymbolEmoji(symbolId)}</span>
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
