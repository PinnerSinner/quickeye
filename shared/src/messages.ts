/**
 * WebSocket message protocol for Quickeye.
 *
 * Two directions:
 *  - ClientMessage: browser -> server. Routed by API Gateway using the `action`
 *    field (the WebSocket route selection expression is `$request.body.action`).
 *  - ServerMessage: server -> browser (pushed over the open socket).
 *
 * Keeping these as discriminated unions means TypeScript forces us to handle
 * every case, on both ends.
 */

import type { GameState, GameMode, LeaderboardEntry } from "./gameTypes";

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------

export interface CreateGameMessage {
  action: "createGame";
  playerName: string;
  gameMode?: GameMode;
  gameType?: "single" | "multiplayer";
}

export interface JoinGameMessage {
  action: "joinGame";
  gameId: string;
  playerName: string;
}

export interface StartGameMessage {
  action: "startGame";
  gameId: string;
}

export interface SubmitMatchMessage {
  action: "submitMatch";
  gameId: string;
  /** The symbol the player believes matches between their card and the center. */
  symbolId: number;
}

export interface QueryLeaderboardMessage {
  action: "queryLeaderboard";
  gameMode: GameMode;
  period: "daily" | "all-time";
  limit?: number;
}

export interface QueryGamesMessage {
  action: "queryGames";
}

export type ClientMessage =
  | CreateGameMessage
  | JoinGameMessage
  | StartGameMessage
  | SubmitMatchMessage
  | QueryLeaderboardMessage
  | QueryGamesMessage;

export type ClientAction = ClientMessage["action"];

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

/**
 * Sent to the player who just created or joined, so their client knows its own
 * identity (playerId) for subsequent actions.
 */
export interface JoinedMessage {
  type: "joined";
  gameId: string;
  playerId: string;
  state: GameState;
}

/** Broadcast whenever game state changes (player joined, game started, match made). */
export interface StateUpdateMessage {
  type: "stateUpdate";
  state: GameState;
}

/** Result of a submitMatch attempt, sent to the submitting player. */
export interface MatchResultMessage {
  type: "matchResult";
  correct: boolean;
  /** Present when correct — the symbol that matched. */
  symbolId?: number;
  /** Present when the match ended the game. */
  gameOver?: boolean;
}

/** Any recoverable error (bad room code, game full, not your turn to start, etc.). */
export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
}

/** Leaderboard entries for a specific game mode and period. */
export interface LeaderboardMessage {
  type: "leaderboard";
  gameMode: GameMode;
  period: "daily" | "all-time";
  entries: LeaderboardEntry[];
}

/** List of available lobby games. */
export interface GamesListMessage {
  type: "gamesList";
  games: {
    gameId: string;
    host: string;
    playerCount: number;
    gameMode: GameMode;
  }[];
}

export type ServerMessage =
  | JoinedMessage
  | StateUpdateMessage
  | MatchResultMessage
  | ErrorMessage
  | LeaderboardMessage
  | GamesListMessage;
