/**
 * joinGame route handler (action: "joinGame").
 *
 * A player enters a room code to join an existing lobby. We validate:
 *  - the game exists
 *  - it hasn't started yet (can't join mid-game in v1)
 *  - it isn't full (maxPlayers)
 *
 * On success we add the player, link the connection, tell the joiner their
 * identity, and broadcast the updated lobby to everyone.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import {
  GAME_CONFIG,
  containsProfanity,
  type JoinGameMessage,
  type GameState,
  type Player,
} from "@quickeye/shared";
import { getGame, putGame, putConnection } from "../lib/dynamo";
import { sendToConnection, broadcast, endpointFromEvent } from "../lib/apigw";
import { ok, fail, ttlFromNow, randomId } from "../lib/util";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const endpoint = endpointFromEvent(event.requestContext);

  const sendError = (code: string, message: string) =>
    sendToConnection(endpoint, connectionId, { type: "error", code, message });

  try {
    const body = JSON.parse(event.body ?? "{}") as JoinGameMessage;
    const gameId = (body.gameId ?? "").trim().toUpperCase();
    const playerName = (body.playerName ?? "").trim() || "Player";

    // Check for profanity in player name
    if (containsProfanity(playerName)) {
      await sendError("INVALID_NAME", "Player name contains inappropriate content.");
      return ok();
    }

    const game = await getGame(gameId);
    if (!game) {
      await sendError("NOT_FOUND", `No game with code ${gameId}.`);
      return ok();
    }
    if (game.status !== "lobby") {
      await sendError("ALREADY_STARTED", "That game has already started.");
      return ok();
    }
    if (game.players.length >= GAME_CONFIG.maxPlayers) {
      await sendError("FULL", "That game is full.");
      return ok();
    }

    const playerId = randomId();
    const player: Player = {
      playerId,
      name: playerName,
      connectionId,
      score: 0,
      currentCardId: null,
    };

    const updated: GameState = { ...game, players: [...game.players, player] };
    await putGame(updated);
    await putConnection({
      connectionId,
      gameId,
      playerId,
      ttl: ttlFromNow(GAME_CONFIG.gameTtlHours),
    });

    // Tell the joiner who they are...
    await sendToConnection(endpoint, connectionId, {
      type: "joined",
      gameId,
      playerId,
      state: updated,
    });
    // ...and update everyone's lobby view.
    await broadcast(
      endpoint,
      updated.players.map((p) => p.connectionId),
      { type: "stateUpdate", state: updated }
    );
    return ok();
  } catch (err) {
    console.error("joinGame failed", err);
    await sendError("JOIN_FAILED", "Could not join game.");
    return fail();
  }
};
