/**
 * Real-time multiplayer board.
 *
 * Unlike the solo screen (which invents its own rounds locally), everything
 * here is drawn from the server's GameState: the center card, your card and
 * every player's score. Clicking a symbol only *asks* the server; the server
 * decides whether it matched (CLAUDE.md: never trust the client) and pushes
 * the new state to everyone.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { GAME_CONFIG, generateDeck, type GameState } from "@quickeye/shared";
import { deckGlyphStyle } from "./glyphs";

const DECK = generateDeck(GAME_CONFIG.deckN);

/** Stable per-card shuffle so a card's layout doesn't jump around on re-render. */
function layoutFor(cardId: number): number[] {
  const ids = [...(DECK.cards[cardId]?.symbolIds ?? [])];
  let seed = cardId * 7919 + 17;
  for (let i = ids.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export interface MatchFeedback {
  correct: boolean;
  symbolId?: number;
  /** Changes on every result so the same outcome twice still re-triggers. */
  nonce: number;
}

interface Props {
  state: GameState;
  myPlayerId: string | null;
  feedback: MatchFeedback | null;
  playerColor: string;
  onPick: (symbolId: number) => void;
  onLeave: () => void;
  onLeaderboard: () => void;
}

export function MultiplayerBoard({
  state,
  myPlayerId,
  feedback,
  playerColor,
  onPick,
  onLeave,
  onLeaderboard,
}: Props) {
  const me = state.players.find((p) => p.playerId === myPlayerId) ?? null;
  const centerIds = useMemo(
    () => (state.centerCardId === null ? [] : layoutFor(state.centerCardId)),
    [state.centerCardId]
  );
  const myIds = useMemo(
    () => (me?.currentCardId == null ? [] : layoutFor(me.currentCardId)),
    [me?.currentCardId]
  );

  // Wait for the server's verdict before allowing another click, and flash
  // red briefly on a miss (or when someone else beat you to it).
  const [pending, setPending] = useState(false);
  const [wrong, setWrong] = useState(false);
  useEffect(() => {
    if (!feedback) return;
    setPending(false);
    if (!feedback.correct) {
      setWrong(true);
      const t = window.setTimeout(() => setWrong(false), 400);
      return () => window.clearTimeout(t);
    }
  }, [feedback]);
  // A new center card means the round moved on; unlock.
  useEffect(() => setPending(false), [state.centerCardId]);

  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  const finished = state.status === "finished";

  const pick = (symbolId: number) => {
    if (pending || finished || !me || me.currentCardId === null) return;
    setPending(true);
    onPick(symbolId);
  };

  return (
    <div style={shell} data-testid="mp-board">
      <div style={topRow}>
        <div>
          <div style={eyebrow}>Live multiplayer · room</div>
          <div style={roomCode}>{state.gameId}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={eyebrow}>Cards left</div>
          <div style={{ ...roomCode, color: "#fff" }} data-testid="mp-cards-left">
            {state.drawPile.length}
          </div>
        </div>
      </div>

      <div style={scoreRow}>
        {ranked.map((p) => (
          <div
            key={p.playerId}
            style={{
              ...scorePill,
              background: p.playerId === myPlayerId ? playerColor : "#F0F0F0",
              opacity: p.connectionId ? 1 : 0.45,
            }}
            title={p.connectionId ? undefined : "Disconnected"}
          >
            <span style={{ fontWeight: 800 }}>
              {p.name}
              {p.playerId === myPlayerId ? " (you)" : ""}
              {p.connectionId ? "" : " · left"}
            </span>
            <span style={{ fontWeight: 900, fontSize: 20 }} data-testid={`mp-score-${p.name}`}>
              {p.score}
            </span>
          </div>
        ))}
      </div>

      {finished ? (
        <div style={card} data-testid="mp-results">
          <div style={cardHead("#F0C020", "#121212")}>Game over</div>
          <div style={{ padding: 20 }}>
            <div style={{ font: "900 28px 'Outfit',sans-serif", marginBottom: 12, color: "#121212" }}>
              {ranked[0]?.playerId === myPlayerId ? "You win!" : `${ranked[0]?.name ?? "Someone"} wins`}
            </div>
            {ranked.map((p, i) => (
              <div key={p.playerId} style={resultRow}>
                <span>
                  {i + 1}. {p.name}
                </span>
                <span>{p.score}</span>
              </div>
            ))}
            <div style={{ font: "500 13px 'Outfit',sans-serif", color: "#555", margin: "14px 0" }}>
              Scores were recorded on the Marathon leaderboard by the server.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="qhov" style={btn("#1040C0")} onClick={onLeaderboard}>
                Leaderboard
              </button>
              <button className="qhov" style={btn("#666")} onClick={onLeave}>
                Back to menu
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          <div style={card}>
            <div style={cardHead("#121212", "#fff")}>Match board</div>
            <div style={grid} data-testid="mp-center">
              {centerIds.map((id) => (
                <div key={id} style={tile} data-symbol={id}>
                  <div style={deckGlyphStyle(id, 50)} />
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              ...card,
              animation: wrong ? "qe-screenshake 0.34s cubic-bezier(.36,.07,.19,.97)" : undefined,
            }}
          >
            <div style={cardHead(wrong ? "#D02020" : playerColor, "#fff")}>
              {me?.currentCardId == null ? "Out of cards" : pending ? "Checking…" : "Your card · tap the match"}
            </div>
            <div style={grid} data-testid="mp-mine">
              {myIds.map((id) => (
                <button
                  key={id}
                  className="qtile"
                  style={{ ...tile, cursor: pending ? "wait" : "pointer", padding: 0 }}
                  data-symbol={id}
                  onClick={() => pick(id)}
                >
                  <div style={deckGlyphStyle(id, 50)} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!finished && (
        <button className="qhov" style={{ ...btn("transparent"), border: "3px solid #3a3a3a", marginTop: 18 }} onClick={onLeave}>
          ‹ Leave game
        </button>
      )}
    </div>
  );
}

const shell: CSSProperties = {
  width: 820,
  maxWidth: "calc(100vw - 32px)",
  background: "#121212",
  border: "4px solid #000",
  boxShadow: "10px 10px 0 0 #000",
  padding: 26,
  boxSizing: "border-box",
  color: "#fff",
};
const topRow: CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 16 };
const eyebrow: CSSProperties = {
  font: "700 11px 'Outfit',sans-serif",
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: "2px",
};
const roomCode: CSSProperties = { font: "900 36px 'Outfit',sans-serif", color: "#F0C020", letterSpacing: "6px" };
const scoreRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 };
const scorePill: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: "8px 14px",
  border: "3px solid #000",
  boxShadow: "3px 3px 0 0 #000",
  color: "#121212",
  font: "14px 'Outfit',sans-serif",
  textTransform: "uppercase",
};
const card: CSSProperties = { border: "4px solid #000", background: "#fff", boxShadow: "6px 6px 0 0 #000" };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, padding: 20 };
const tile: CSSProperties = {
  aspectRatio: "1",
  background: "#F0F0F0",
  border: "3px solid #121212",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const resultRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  font: "800 16px 'Outfit',sans-serif",
  color: "#121212",
  padding: "6px 0",
  borderBottom: "2px solid #E0E0E0",
  textTransform: "uppercase",
};
function cardHead(bg: string, color: string): CSSProperties {
  return {
    background: bg,
    color,
    padding: "11px 16px",
    borderBottom: "4px solid #121212",
    font: "900 12px 'Outfit',sans-serif",
    textTransform: "uppercase",
    letterSpacing: "2px",
  };
}
function btn(bg: string): CSSProperties {
  return {
    flex: 1,
    padding: "0.9rem 1.2rem",
    font: "900 0.95rem 'Outfit',sans-serif",
    background: bg,
    color: "#fff",
    border: "4px solid #000",
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: "1px",
    boxShadow: bg === "transparent" ? "none" : "5px 5px 0 0 #000",
  };
}
