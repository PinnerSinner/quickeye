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

  // Debug logging
  useEffect(() => {
    console.log("GameScreen state:", {
      centerCardId,
      playerCardId,
      playerCount: state.players.length,
      status: state.status,
    });
  }, [centerCardId, playerCardId, state.players.length, state.status]);

  useEffect(() => {
    if (
      centerCardId !== null &&
      centerCardId !== undefined &&
      playerCardId !== null &&
      playerCardId !== undefined
    ) {
      const symbolId = findMatchingSymbol(centerCardId, playerCardId);
      setMatchingSymbolId(symbolId);
    }
  }, [centerCardId, playerCardId]);

  const centerSymbols =
    centerCardId !== null && centerCardId !== undefined
      ? getCardSymbols(centerCardId)
      : [];
  const playerSymbols =
    playerCardId !== null && playerCardId !== undefined
      ? getCardSymbols(playerCardId)
      : [];

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
        <div className="timer">
          <span>Round: 30s</span>
        </div>
      </div>

      <div className="game-board">
        <div className="card-section">
          <h3>Center Card</h3>
          <div className="card center-card">
            <div className="card-symbols">
              {centerSymbols.map((symbolId) => (
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
              {playerSymbols.map((symbolId) => (
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
