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
    // Only include games with at least 1 player (host must be waiting) and active connections
    const gameSummaries = games
      .filter(
        (game) =>
          game.players.length > 0 &&
          game.players.some((p) => p.connectionId !== null) // At least one player connected
      )
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
