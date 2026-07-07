/**
 * cleanupGames — delete all lobby games (emergency clean slate).
 * Removes all games with status "lobby" to wipe the lobbying system clean.
 * WARNING: This is destructive and unrecoverable.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const GAMES_TABLE = process.env.GAMES_TABLE!;

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  console.log("CLEANUP INITIATED: Removing all lobby games");

  try {
    // Scan for all lobby games
    const res = await doc.send(
      new ScanCommand({
        TableName: GAMES_TABLE,
        FilterExpression: "#status = :lobby",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":lobby": "lobby",
        },
      })
    );

    const games = res.Items ?? [];
    console.log(`Found ${games.length} lobby games to delete`);

    // Delete each game
    let deleted = 0;
    for (const game of games) {
      try {
        await doc.send(
          new DeleteCommand({
            TableName: GAMES_TABLE,
            Key: { gameId: game.gameId },
          })
        );
        deleted++;
      } catch (err) {
        console.error(`Failed to delete game ${game.gameId}:`, err);
      }
    }

    console.log(`Successfully deleted ${deleted}/${games.length} lobby games`);
    return { statusCode: 200, body: JSON.stringify({ deleted, total: games.length }) };
  } catch (err) {
    console.error("Cleanup failed", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Cleanup failed" }) };
  }
};
