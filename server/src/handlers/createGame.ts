/**
 * createGame route handler (action: "createGame").
 *
 * The player who creates a game becomes the host. We:
 *  1. Generate a unique 4-char room code.
 *  2. Create a lobby-state game with the host as its first player.
 *  3. Link this connection to the new game/player.
 *  4. Reply with "joined" so the creator's client learns its playerId + state.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import {
  GAME_CONFIG,
  generateRoomCode,
  containsProfanity,
  type CreateGameMessage,
  type GameState,
  type Player,
} from "@quickeye/shared";
import { getGame, putGame, putConnection } from "../lib/dynamo";
import { sendToConnection, endpointFromEvent } from "../lib/apigw";
import { ok, fail, ttlFromNow, randomId } from "../lib/util";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const endpoint = endpointFromEvent(event.requestContext);

  try {
    const body = JSON.parse(event.body ?? "{}") as CreateGameMessage;
    let playerName = (body.playerName ?? "").trim() || "Player";
    const gameMode = body.gameMode ?? "time-attack-60";
    const gameType = body.gameType ?? "multiplayer";

    // Check for profanity in player name
    if (containsProfanity(playerName)) {
      await sendToConnection(endpoint, connectionId, {
        type: "error",
        code: "INVALID_NAME",
        message: "Player name contains inappropriate content.",
      });
      return ok();
    }

    // Find an unused room code (retry a few times on the rare collision).
    let gameId = generateRoomCode();
    for (let i = 0; i < 5 && (await getGame(gameId)); i++) {
      gameId = generateRoomCode();
    }

    const playerId = randomId();
    const host: Player = {
      playerId,
      name: playerName,
      connectionId,
      score: 0,
      currentCardId: null,
    };

    // For solo/vs-ai, add bot players
    const players: Player[] = [host];
    if (gameType === "vs-ai") {
      const botNames = ["Marco", "Jeff", "Walter", "Donny"];
      botNames.forEach((name) => {
        players.push({
          playerId: randomId(),
          name,
          connectionId: null,
          score: 0,
          currentCardId: null,
          isBot: true,
          botResponseTime: 800 + Math.random() * 400, // 800-1200ms
        });
      });
    }

    const state: GameState = {
      gameId,
      status: gameType === "solo" ? "playing" : "lobby", // Solo starts immediately
      hostId: playerId,
      players,
      centerCardId: null,
      drawPile: [],
      gameMode,
      gameType,
      createdAt: Math.floor(Date.now() / 1000),
      ttl: ttlFromNow(GAME_CONFIG.gameTtlHours),
    };

    await putGame(state);
    await putConnection({
      connectionId,
      gameId,
      playerId,
      ttl: ttlFromNow(GAME_CONFIG.gameTtlHours),
    });

    await sendToConnection(endpoint, connectionId, {
      type: "joined",
      gameId,
      playerId,
      state,
    });
    return ok();
  } catch (err) {
    console.error("createGame failed", err);
    await sendToConnection(endpoint, connectionId, {
      type: "error",
      code: "CREATE_FAILED",
      message: "Could not create game.",
    });
    return fail();
  }
};
