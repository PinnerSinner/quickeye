/**
 * startGame route handler (action: "startGame").
 *
 * Only the host may start, and only with enough players. On start we deal the
 * opening layout (center card + one card per player) via the shared dealInitial
 * logic, then broadcast the playing state to everyone.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import {
  GAME_CONFIG,
  dealInitial,
  type StartGameMessage,
} from "@quickeye/shared";
import { getConnection, getGame, putGame } from "../lib/dynamo";
import { sendToConnection, broadcast, endpointFromEvent } from "../lib/apigw";
import { ok, fail } from "../lib/util";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const endpoint = endpointFromEvent(event.requestContext);

  const sendError = (code: string, message: string) =>
    sendToConnection(endpoint, connectionId, { type: "error", code, message });

  try {
    const body = JSON.parse(event.body ?? "{}") as StartGameMessage;
    const gameId = (body.gameId ?? "").trim().toUpperCase();

    const [conn, game] = await Promise.all([
      getConnection(connectionId),
      getGame(gameId),
    ]);

    if (!game) {
      await sendError("NOT_FOUND", "Game not found.");
      return ok();
    }
    if (!conn || conn.playerId !== game.hostId) {
      await sendError("NOT_HOST", "Only the host can start the game.");
      return ok();
    }
    if (game.status !== "lobby") {
      await sendError("ALREADY_STARTED", "Game already started.");
      return ok();
    }
    // Solo/vs-ai games can start with any number of players (bots fill the gap)
    // Multiplayer games need at least minPlayers
    const isMultiplayer = game.gameType === "multiplayer";
    if (isMultiplayer && game.players.length < GAME_CONFIG.minPlayers) {
      await sendError(
        "NOT_ENOUGH_PLAYERS",
        `Need at least ${GAME_CONFIG.minPlayers} players to start.`
      );
      return ok();
    }

    const started = dealInitial(game);
    await putGame(started);

    await broadcast(
      endpoint,
      started.players.map((p) => p.connectionId),
      { type: "stateUpdate", state: started }
    );
    return ok();
  } catch (err) {
    console.error("startGame failed", err);
    await sendError("START_FAILED", "Could not start game.");
    return fail();
  }
};
