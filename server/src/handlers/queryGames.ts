/**
 * queryGames route handler (action: "queryGames").
 *
 * Returns the lobby browser list: joinable multiplayer games whose host is
 * still connected. The rules for what counts as joinable live in
 * lib/lobby.ts (lobbyListing) so they're unit tested.
 *
 * Reads the Games table's ByStatus GSI (status = "lobby", createdAt within the
 * listing window) rather than scanning the whole table, then double-checks
 * each host's socket still exists in the Connections table.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { GAME_CONFIG } from "@quickeye/shared";
import { sendToConnection, endpointFromEvent } from "../lib/apigw";
import { listLobbyGames, liveConnectionIds } from "../lib/dynamo";
import { LOBBY_LISTING_WINDOW_SECONDS, hostConnectionId, lobbyListing } from "../lib/lobby";
import { ok, fail } from "../lib/util";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const endpoint = endpointFromEvent(event.requestContext);

  try {
    const now = Math.floor(Date.now() / 1000);
    const games = await listLobbyGames(now - LOBBY_LISTING_WINDOW_SECONDS);

    const hostIds = games
      .map(hostConnectionId)
      .filter((id): id is string => id !== null);
    const live = await liveConnectionIds(hostIds);

    await sendToConnection(endpoint, connectionId, {
      type: "gamesList",
      games: lobbyListing(games, live, now, GAME_CONFIG.maxPlayers),
    });
    return ok();
  } catch (err) {
    console.error("queryGames failed", err);
    await sendToConnection(endpoint, connectionId, {
      type: "error",
      code: "QUERY_FAILED",
      message: "Could not fetch games list.",
    });
    return fail();
  }
};
