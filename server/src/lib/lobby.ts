/**
 * Pure lobby rules: which games show up in the lobby browser, and which ones
 * the scheduled cleanup is allowed to delete.
 *
 * Kept free of AWS calls on purpose, so they can be unit tested with plain
 * objects (see server/__tests__/lobby.test.ts).
 */

import type { GameState } from "@quickeye/shared";

/**
 * A lobby game older than this is considered abandoned. Used both as the lobby
 * browser's listing window and as the cleanup's "stale" threshold, so a game
 * never lingers in the lobby list after it's eligible for deletion.
 */
export const STALE_LOBBY_SECONDS = 10 * 60;

/** The host's current socket, or null if they've dropped. */
export function hostConnectionId(game: GameState): string | null {
  return game.players.find((p) => p.playerId === game.hostId)?.connectionId ?? null;
}

/**
 * Is the host still really connected? Their connectionId must be set on the
 * game AND still exist in the Connections table. The second check covers the
 * case where $disconnect never fired (API Gateway doesn't strictly guarantee it).
 */
export function isHostConnected(game: GameState, liveConnectionIds: Set<string>): boolean {
  const id = hostConnectionId(game);
  return id !== null && liveConnectionIds.has(id);
}

/**
 * Should the scheduled cleanup delete this game? Only lobby games, and only if
 * they're older than STALE_LOBBY_SECONDS or the host has gone. Games that are
 * playing or finished are never touched (DynamoDB TTL expires those).
 */
export function isStaleLobbyGame(
  game: GameState,
  liveConnectionIds: Set<string>,
  nowSeconds: number
): boolean {
  if (game.status !== "lobby") return false;
  const tooOld = game.createdAt < nowSeconds - STALE_LOBBY_SECONDS;
  return tooOld || !isHostConnected(game, liveConnectionIds);
}
