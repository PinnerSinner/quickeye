import { useState, useEffect } from "react";
import type { GameState } from "@quickeye/shared";
import {
  getCardSymbols,
  findMatchingSymbol,
} from "../utils/deck";
import { playCorrectSound, playCountdownTick, playGameOverSound } from "../utils/soundEffects";
import { GeometricGlyph } from "../components/GeometricGlyph";
import { QEyeLogo } from "../components/QEyeLogo";
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
  const [feedbackSymbolId, setFeedbackSymbolId] = useState<number | null>(null);
  const [feedbackType, setFeedbackType] = useState<"correct" | "wrong" | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [lastUrgentTime, setLastUrgentTime] = useState<number>(-1);

  // Get max time based on game mode
  const getMaxTime = () => {
    const mode = state.gameMode;
    if (mode === "time-attack-60") return 60;
    return 999999; // No timer for 10-rounds and difficulty-scaling
  };

  const maxTime = getMaxTime();
  const [timeRemaining, setTimeRemaining] = useState(maxTime);

  // Timer countdown
  useEffect(() => {
    if (state.status !== "playing" || maxTime === 999999) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          playGameOverSound();
          return 0;
        }
        // Play urgency sound every second when <5s remaining
        if (next <= 5 && next > lastUrgentTime) {
          playCountdownTick();
          setLastUrgentTime(next);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.status, maxTime, lastUrgentTime]);

  const centerSymbols =
    centerCardId !== null && centerCardId !== undefined
      ? getCardSymbols(centerCardId) || []
      : [];
  const playerSymbols =
    playerCardId !== null && playerCardId !== undefined
      ? getCardSymbols(playerCardId) || []
      : [];

  const safeCenter = Array.isArray(centerSymbols) ? centerSymbols : [];
  const safePlayer = Array.isArray(playerSymbols) ? playerSymbols : [];

  const handleSymbolClick = (symbolId: number) => {
    if (submitted) return;
    setSubmitted(true);
    setFeedbackSymbolId(symbolId);
    setFeedbackType("correct"); // Optimistic feedback; server will correct if wrong

    // Screen shake + sound on match attempt
    playCorrectSound();
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);

    onSubmitMatch(symbolId);
    setTimeout(() => {
      setSubmitted(false);
      setFeedbackSymbolId(null);
      setFeedbackType(null);
    }, 450);
  };

  const getSymbolScale = () => {
    if (maxTime === 999999) return 1.0;
    const scale = Math.max(0.7, 1 - (maxTime - timeRemaining) * (0.3 / maxTime));
    return scale;
  };

  const symbolScale = getSymbolScale();
  const isTimeUp = timeRemaining === 0 && state.status === "playing";
  const isDanger = timeRemaining <= 5 && timeRemaining > 0;
  const progressPercent = (timeRemaining / maxTime) * 100;

  // Sort players by score for leaderboard
  const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);

  return (
    <div className={`game-screen ${isShaking ? "shake" : ""}`}>
      {/* Header */}
      <div className="game-header">
        <div className="header-left">
          <div className="header-logo">
            <QEyeLogo size="sm" includeWordmark={false} />
          </div>
          <h1>QUICKEYE</h1>
        </div>
        <button className="quit-btn" onClick={onReturnLobby}>✕ QUIT</button>
        {maxTime !== 999999 && (
          <div className={`header-timer ${isDanger ? "danger" : ""}`}>
            <div className="timer-number">{timeRemaining}</div>
            <div className="timer-label">SEC</div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {maxTime !== 999999 && (
        <div className="progress-bar-container">
          <div
            className={`progress-bar-fill ${isDanger ? "danger" : ""}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Game board - two panels */}
      <div className="game-board">
        <div className="game-panel center-panel">
          <div className="panel-header red-header">
            <span>Match Board</span>
          </div>
          <div className="symbol-grid">
            {safeCenter.map((symbolId) => (
              <div
                key={symbolId}
                className="symbol-tile"
                style={{ transform: `scale(${symbolScale})` }}
              >
                <GeometricGlyph symbolId={symbolId} size={52} />
              </div>
            ))}
          </div>
        </div>

        <div className="game-panel player-panel">
          <div className="panel-header blue-header">
            <span>You — tap the match</span>
          </div>
          <div className="symbol-grid">
            {safePlayer.map((symbolId) => (
              <button
                key={symbolId}
                className={`symbol-button ${
                  feedbackSymbolId === symbolId ? `feedback-${feedbackType}` : ""
                } ${submitted ? "disabled" : ""}`}
                onClick={() => handleSymbolClick(symbolId)}
                disabled={submitted}
                style={{ transform: `scale(${symbolScale})` }}
              >
                <GeometricGlyph symbolId={symbolId} size={52} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live leaderboard */}
      <div className="leaderboard">
        <div className="leaderboard-label">Live Standings</div>
        <div className="leaderboard-container">
          {sortedPlayers.map((player, idx) => (
            <div
              key={player.playerId}
              className={`leaderboard-card ${idx === 0 ? "first-place" : ""}`}
              style={{
                transform: `translateX(${idx * 257}px)`,
              }}
            >
              <div className={`rank-chip ${idx === 0 ? "first" : ""}`}>
                {idx + 1}
              </div>
              <div className="player-name">{player.name}</div>
              <div className="player-score">{player.score}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Game over overlay */}
      {(state.status === "finished" || isTimeUp) && (
        <div className="game-over-overlay">
          <div className="game-over-card">
            <div className="game-over-header">{isTimeUp ? "TIME UP" : "GAME OVER"}</div>
            <h2 className="game-over-title">
              {sortedPlayers[0]?.name.toUpperCase()} WINS
            </h2>

            <div className="final-standings">
              {sortedPlayers.map((player, idx) => (
                <div
                  key={player.playerId}
                  className={`standing-row ${idx === 0 ? "winner" : ""}`}
                  style={{
                    animation: `qe-pop 0.4s ease-out ${idx * 0.08}s both`,
                  }}
                >
                  <div className="standing-rank">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</div>
                  <div className="standing-name">{player.name}</div>
                  <div className="standing-score">{player.score} pts</div>
                </div>
              ))}
            </div>

            <div className="game-over-buttons">
              <button className="button-play-again" onClick={onRematch}>
                PLAY AGAIN
              </button>
              <button className="button-menu" onClick={onReturnLobby}>
                MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
