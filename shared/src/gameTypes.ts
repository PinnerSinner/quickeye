/**
 * Core game state types for Quickeye, shared between server and client.
 *
 * The server is the authoritative owner of these — the client renders a copy
 * and never mutates game state directly (it sends actions, the server responds
 * with the new state).
 */

/** Lifecycle of a game room. */
export type GameStatus = "lobby" | "playing" | "finished";

/** A single player in a game. */
export interface Player {
  /** Stable id we generate on join (survives across messages). */
  playerId: string;
  /** Display name chosen when joining. */
  name: string;
  /** The current WebSocket connection id, or null if disconnected. */
  connectionId: string | null;
  /** Number of successful matches so far. */
  score: number;
  /** The card currently in this player's hand (their "pile top"). */
  currentCardId: number | null;
}

/**
 * Full state of one game room.
 *
 * `gameId` doubles as the human-friendly room code (e.g. "QCKE") that players
 * type in to join. Room codes are what CLAUDE.md picks for v1 matchmaking.
 */
export interface GameState {
  gameId: string;
  status: GameStatus;
  /** playerId of the host — the only player allowed to start the game. */
  hostId: string;
  players: Player[];
  /** The shared card in the middle everyone races to match against. */
  centerCardId: number | null;
  /**
   * Card ids not yet dealt, in deal order (we pop from the end).
   * The full deck is deterministic (generateDeck), so we only need to track
   * which ids remain rather than storing symbol arrays.
   */
  drawPile: number[];
  createdAt: number;
  /** Epoch seconds after which DynamoDB auto-deletes this row (abandoned games). */
  ttl: number;
}

/** Tunable game parameters — kept as config, not hardcoded (per CLAUDE.md). */
export const GAME_CONFIG = {
  /** Deck order for the projective-plane construction (n=7 → 57 cards). */
  deckN: 7,
  minPlayers: 2,
  maxPlayers: 6,
  /** Hours of inactivity before a game row is auto-expired by DynamoDB TTL. */
  gameTtlHours: 6,
  /** Speed-variant timing (seconds) — see CLAUDE.md speed mechanic. Not wired to logic yet. */
  roundCountdownSeconds: 30,
} as const;
