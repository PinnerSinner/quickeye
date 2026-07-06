import { useState, useEffect } from "react";
import type { LeaderboardEntry, GameMode } from "@quickeye/shared";
import "./LeaderboardScreen.css";

interface LeaderboardScreenProps {
  onClose: () => void;
}

export function LeaderboardScreen({ onClose }: LeaderboardScreenProps) {
  const [period, setPeriod] = useState<"daily" | "all-time">("all-time");
  const [gameMode, setGameMode] = useState<GameMode>("time-attack-60");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const gameModes: { value: GameMode; label: string }[] = [
    { value: "time-attack-60", label: "Time Attack - 60s" },
    { value: "ten-rounds", label: "10 Rounds" },
    { value: "difficulty-scaling", label: "Difficulty Scaling" },
  ];

  useEffect(() => {
    // TODO: Query leaderboard from WebSocket
    // For now, show placeholder data
    setEntries([]);
  }, [period, gameMode]);

  return (
    <div className="leaderboard-screen">
      <div className="leaderboard-header">
        <h1>Leaderboard</h1>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="leaderboard-controls">
        <div className="control-group">
          <label>Game Mode:</label>
          <select
            value={gameMode}
            onChange={(e) => setGameMode(e.target.value as GameMode)}
            className="mode-select"
          >
            {gameModes.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="period-tabs">
          <button
            className={`tab ${period === "daily" ? "active" : ""}`}
            onClick={() => setPeriod("daily")}
          >
            Today
          </button>
          <button
            className={`tab ${period === "all-time" ? "active" : ""}`}
            onClick={() => setPeriod("all-time")}
          >
            All Time
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading leaderboard...</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <p>No scores recorded yet.</p>
          <p>Play some games to see the leaderboard!</p>
        </div>
      ) : (
        <div className="entries-list">
          {entries.map((entry, idx) => (
            <div key={`${entry.playerId}-${entry.timestamp}`} className="entry-row">
              <div className="rank">
                <span className="rank-number">
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                </span>
              </div>
              <div className="player-info">
                <span className="player-name">{entry.playerName}</span>
              </div>
              <div className="score">
                <span className="score-value">{entry.score}</span>
                <span className="score-label">pts</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="back-button" onClick={onClose}>
        Back
      </button>
    </div>
  );
}
