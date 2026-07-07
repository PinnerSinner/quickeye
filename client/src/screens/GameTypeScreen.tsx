import "./GameTypeScreen.css";

interface GameTypeScreenProps {
  onSelectType: (type: "solo" | "vs-ai" | "multiplayer") => void;
  onCancel: () => void;
}

export function GameTypeScreen({ onSelectType, onCancel }: GameTypeScreenProps) {
  return (
    <div className="game-type-screen">
      <h1>Game Mode</h1>
      <p className="game-type-subtitle">Choose how you want to play</p>

      <div className="game-type-grid">
        <button
          className="game-type-card solo-card"
          onClick={() => onSelectType("solo")}
        >
          <div className="game-type-icon">🏃</div>
          <h2>Solo</h2>
          <p>Race against the clock. No opponents, just you.</p>
          <div className="game-type-hint">⏱️ Pure speed challenge</div>
        </button>

        <button
          className="game-type-card ai-card"
          onClick={() => onSelectType("vs-ai")}
        >
          <div className="game-type-icon">🤖</div>
          <h2>vs AI</h2>
          <p>Compete against simulated opponents. Can you beat them?</p>
          <div className="game-type-hint">👥 3 AI players</div>
        </button>

        <button
          className="game-type-card multiplayer-card"
          onClick={() => onSelectType("multiplayer")}
        >
          <div className="game-type-icon">👥</div>
          <h2>Multiplayer</h2>
          <p>Play with friends online. Real competition, real stakes.</p>
          <div className="game-type-hint">🌐 2-6 players</div>
        </button>
      </div>

      <button className="game-type-cancel" onClick={onCancel}>
        Back
      </button>
    </div>
  );
}
