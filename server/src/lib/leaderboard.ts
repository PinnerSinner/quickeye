/**
 * Pure leaderboard rules: how a finished game turns into leaderboard rows,
 * and how those rows are keyed.
 *
 * Table layout (LEADERBOARD_TABLE):
 *   pk    (string)  "<gameMode>#all-time" or "<gameMode>#daily#YYYY-MM-DD"
 *   sk    (number)  unique row id: epoch millis * 1000 + a 0-999 offset
 *   score (number)  the player's final score
 *
 * GSI "ByScore": partition key pk, sort key score. Querying it newest-to-
 * oldest (ScanIndexForward: false) returns the genuine top scores directly,
 * so we never have to read the whole board and sort it ourselves.
 */

import type { GameMode, GameState, LeaderboardEntry } from "@quickeye/shared";

export const LEADERBOARD_SCORE_INDEX = "ByScore";
export const LEADERBOARD_MAX_LIMIT = 100;

export type LeaderboardPeriod = "daily" | "all-time";

export interface LeaderboardItem extends LeaderboardEntry {
  pk: string;
  sk: number;
}

/** UTC calendar date, YYYY-MM-DD. */
export function utcDate(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function leaderboardPk(gameMode: GameMode, period: LeaderboardPeriod, date: string): string {
  return period === "all-time" ? `${gameMode}#all-time` : `${gameMode}#daily#${date}`;
}

/** Keep client-supplied limits sane: whole number between 1 and 100. */
export function clampLimit(limit: unknown, fallback = 50): number {
  const n = typeof limit === "number" && Number.isFinite(limit) ? Math.floor(limit) : fallback;
  return Math.min(LEADERBOARD_MAX_LIMIT, Math.max(1, n));
}

/**
 * Build the rows to write when a game finishes. Scores come straight from the
 * server's own GameState (never from the client). Bots and players who didn't
 * score are left off. Each player gets a daily row and an all-time row.
 *
 * sk has to be unique within a pk, otherwise rows overwrite each other. The
 * old code used the epoch-seconds timestamp, so every player in the same game
 * collided and only one score survived. Now each row gets millis * 1000 plus
 * a distinct offset, which is unique within a game and practically unique
 * across games (and still well inside JS's safe-integer range).
 */
export function leaderboardItemsForGame(
  state: GameState,
  nowMs: number,
  random: () => number = Math.random
): LeaderboardItem[] {
  const gameMode: GameMode = state.gameMode || "time-attack-60";
  const date = utcDate(nowMs);
  const timestamp = Math.floor(nowMs / 1000);
  const base = Math.floor(random() * 1000);

  const scorers = state.players.filter((p) => !p.isBot && p.score > 0);

  return scorers.flatMap((p, i) => {
    const sk = nowMs * 1000 + ((base + i) % 1000);
    const entry: LeaderboardEntry = {
      playerId: p.playerId,
      playerName: p.name,
      score: p.score,
      gameMode,
      timestamp,
      date,
    };
    return [
      { ...entry, pk: leaderboardPk(gameMode, "daily", date), sk },
      { ...entry, date: "all-time", pk: leaderboardPk(gameMode, "all-time", date), sk },
    ];
  });
}
