/**
 * cleanupGames: scheduled lobby tidy-up.
 *
 * Triggered by an EventBridge schedule every 15 minutes (see the
 * CleanupGamesSchedule rule in infra/lib/quickeye-stack.ts). It is NOT a
 * WebSocket route, so players can't call it from the browser.
 *
 * Deletes only lobby games that are stale: older than STALE_LOBBY_SECONDS, or
 * whose host connection has gone. Live lobbies and games in progress are left
 * alone. Each delete is conditional on the game still being in the lobby, so a
 * game that starts mid-cleanup isn't wiped.
 */

import type { ScheduledHandler } from "aws-lambda";
import type { GameState } from "@quickeye/shared";
import { listLobbyGames, liveConnectionIds, deleteLobbyGame } from "../lib/dynamo";
import { hostConnectionId, isStaleLobbyGame } from "../lib/lobby";

export const handler: ScheduledHandler = async () => {
  const now = Math.floor(Date.now() / 1000);
  const games = await listLobbyGames();

  const hostIds = games
    .map(hostConnectionId)
    .filter((id): id is string => id !== null);
  const live = await liveConnectionIds(hostIds);

  const stale = games.filter((g: GameState) => isStaleLobbyGame(g, live, now));

  let deleted = 0;
  for (const game of stale) {
    try {
      if (await deleteLobbyGame(game.gameId)) deleted++;
    } catch (err) {
      console.error(`cleanup: failed to delete ${game.gameId}`, err);
    }
  }

  console.log(
    `cleanup: ${games.length} lobby games, ${stale.length} stale, ${deleted} deleted`
  );
};
