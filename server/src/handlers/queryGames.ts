/**
 * queryGames route handler (action: "queryGames").
 *
 * Returns a list of available lobby games that players can join.
 * Scans the GAMES_TABLE for all games with status "lobby".
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import type { GameState } from "@quickeye/shared";
import { sendToConnection, endpointFromEvent } from "../lib/apigw";
import { ok, fail } from "../lib/util";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const GAMES_TABLE = process.env.GAMES_TABLE!;

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const endpoint = endpointFromEvent(event.requestContext);

  try {
    // Scan for all lobby games (skip finished/playing games)
    const res = await doc.send(
      new ScanCommand({
        TableName: GAMES_TABLE,
        FilterExpression: "#status = :lobby AND #created > :recent",
        ExpressionAttributeNames: { "#status": "status", "#created": "createdAt" },
        ExpressionAttributeValues: {
          ":lobby": "lobby",
          ":recent": Math.floor(Date.now() / 1000) - 1800, // Last 30 minutes
        },
      })
    );

    const games = (res.Items as GameState[]) ?? [];

    // Extract summary info (gameId, host name, player count)
    // Only include games where:
    // 1. Host is still connected (connectionId is not null)
    // 2. At least one other player can join
    const gameSummaries = games
      .filter((game) => {
        const host = game.players.find((p) => p.playerId === game.hostId);
        return (
          host &&
          host.connectionId !== null && // Host must be connected
          game.players.length > 0 // At least 1 player (the host)
        );
      })
      .map((game) => ({
        gameId: game.gameId,
        host: game.players[0].name,
        playerCount: game.players.length,
        gameMode: game.gameMode,
      }));

    await sendToConnection(endpoint, connectionId, {
      type: "gamesList",
      games: gameSummaries,
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
