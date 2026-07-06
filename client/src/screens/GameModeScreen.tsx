import type { GameMode } from "@quickeye/shared";
import "./GameModeScreen.css";

interface GameModeScreenProps {
  onSelectMode: (mode: GameMode) => void;
  onCancel: () => void;
}

export function GameModeScreen({ onSelectMode, onCancel }: GameModeScreenProps) {
  const modes: { mode: GameMode; title: string; description: string; icon: string }[] = [
    {
      mode: "time-attack-60",
      title: "Time Attack",
      description: "Score as many points as possible in 60 seconds",
      icon: "⚡",
    },
    {
      mode: "ten-rounds",
      title: "10 Rounds",
      description: "How fast can you find 10 matches?",
      icon: "🎯",
    },
    {
      mode: "difficulty-scaling",
      title: "Difficulty Scaling",
      description: "Start easy — every 5 matches adds a symbol",
      icon: "📈",
    },
  ];

  return (
    <div className="game-mode-screen">
      <h1>Select Game Mode</h1>
      <div className="modes-grid">
        {modes.map((m) => (
          <button
            key={m.mode}
            className="mode-card"
            onClick={() => onSelectMode(m.mode)}
          >
            <div className="mode-icon">{m.icon}</div>
            <h2 className="mode-title">{m.title}</h2>
            <p className="mode-description">{m.description}</p>
            <div className="mode-action">Play →</div>
          </button>
        ))}
      </div>
      <button className="cancel-button" onClick={onCancel}>
        Back
      </button>
    </div>
  );
}
