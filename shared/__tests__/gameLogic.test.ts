import {
  shuffledCardIds,
  dealInitial,
  cardById,
  applyMatch,
  generateRoomCode,
} from "../src/gameLogic";
import { findMatch } from "../src/deckGeneration";
import type { GameState, Player } from "../src/gameTypes";

/** Deterministic RNG for reproducible tests. */
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    // Simple LCG — good enough for test determinism.
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeLobby(playerCount: number): GameState {
  const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
    playerId: `p${i}`,
    name: `Player ${i}`,
    connectionId: `c${i}`,
    score: 0,
    currentCardId: null,
  }));
  return {
    gameId: "TEST",
    status: "lobby",
    hostId: "p0",
    players,
    centerCardId: null,
    drawPile: [],
    createdAt: 0,
    ttl: 0,
  };
}

describe("shuffledCardIds", () => {
  test("returns all ids exactly once", () => {
    const ids = shuffledCardIds(57, seededRng(1));
    expect(ids.length).toBe(57);
    expect(new Set(ids).size).toBe(57);
    for (let i = 0; i < 57; i++) expect(ids.includes(i)).toBe(true);
  });

  test("is deterministic for a given seed", () => {
    expect(shuffledCardIds(57, seededRng(42))).toEqual(
      shuffledCardIds(57, seededRng(42))
    );
  });
});

describe("dealInitial", () => {
  test("deals one card to center and one to each player", () => {
    const state = dealInitial(makeLobby(4), seededRng(7));
    expect(state.status).toBe("playing");
    expect(state.centerCardId).not.toBeNull();
    state.players.forEach((p) => expect(p.currentCardId).not.toBeNull());
  });

  test("all dealt cards are distinct (center + hands + pile = 57)", () => {
    const state = dealInitial(makeLobby(4), seededRng(7));
    const dealt = [
      state.centerCardId!,
      ...state.players.map((p) => p.currentCardId!),
      ...state.drawPile,
    ];
    expect(dealt.length).toBe(57);
    expect(new Set(dealt).size).toBe(57);
  });

  test("resets scores to zero", () => {
    const lobby = makeLobby(2);
    lobby.players[0].score = 99;
    const state = dealInitial(lobby, seededRng(1));
    state.players.forEach((p) => expect(p.score).toBe(0));
  });
});

describe("applyMatch", () => {
  test("accepts the true matching symbol and advances state", () => {
    const state = dealInitial(makeLobby(2), seededRng(3));
    const player = state.players[0];
    const match = findMatch(
      cardById(player.currentCardId!),
      cardById(state.centerCardId!)
    )!;

    const oldCardId = player.currentCardId!;
    const outcome = applyMatch(state, player.playerId, match);

    expect(outcome.correct).toBe(true);
    // Player's old card becomes the new center.
    expect(outcome.state.centerCardId).toBe(oldCardId);
    // Player scored and drew a new card.
    const updated = outcome.state.players.find((p) => p.playerId === player.playerId)!;
    expect(updated.score).toBe(1);
    expect(updated.currentCardId).not.toBe(oldCardId);
  });

  test("rejects a symbol that is not the match", () => {
    const state = dealInitial(makeLobby(2), seededRng(3));
    const player = state.players[0];
    const match = findMatch(
      cardById(player.currentCardId!),
      cardById(state.centerCardId!)
    )!;
    // Pick a symbol on the player's card that is NOT the match.
    const wrong = cardById(player.currentCardId!).symbolIds.find(
      (s) => s !== match
    )!;

    const outcome = applyMatch(state, player.playerId, wrong);
    expect(outcome.correct).toBe(false);
    expect(outcome.state).toBe(state); // unchanged
  });

  test("rejects an unknown player", () => {
    const state = dealInitial(makeLobby(2), seededRng(3));
    const outcome = applyMatch(state, "ghost", 0);
    expect(outcome.correct).toBe(false);
  });

  test("ends the game when the draw pile empties", () => {
    let state = dealInitial(makeLobby(2), seededRng(3));
    // Force the pile to be nearly empty: only one card left to draw.
    state = { ...state, drawPile: [state.drawPile[0]] };

    const player = state.players[0];
    const match = findMatch(
      cardById(player.currentCardId!),
      cardById(state.centerCardId!)
    )!;
    const outcome = applyMatch(state, player.playerId, match);
    expect(outcome.correct).toBe(true);

    // After drawing the last card, the next match should end the game.
    const p2 = outcome.state.players[0];
    const match2 = findMatch(
      cardById(p2.currentCardId!),
      cardById(outcome.state.centerCardId!)
    )!;
    const outcome2 = applyMatch(outcome.state, p2.playerId, match2);
    expect(outcome2.gameOver).toBe(true);
    expect(outcome2.state.status).toBe("finished");
  });
});

describe("generateRoomCode", () => {
  test("is 4 uppercase chars from the safe alphabet", () => {
    const code = generateRoomCode(seededRng(5));
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });
});
