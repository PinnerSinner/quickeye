#!/usr/bin/env node

import { DynamoDBClient, ScanCommand, DeleteCommand } from "@aws-sdk/client-dynamodb";

const tableName = process.env.GAMES_TABLE || "quickeye-games-table";
const client = new DynamoDBClient({});

async function clearAllGames() {
  try {
    console.log(`Scanning table: ${tableName}`);
    const scanResult = await client.send(new ScanCommand({ TableName: tableName }));

    const items = scanResult.Items || [];
    console.log(`Found ${items.length} games. Deleting all...`);

    for (const item of items) {
      const gameId = item.gameId?.S;
      if (gameId) {
        await client.send(
          new DeleteCommand({
            TableName: tableName,
            Key: { gameId: { S: gameId } },
          })
        );
        console.log(`Deleted: ${gameId}`);
      }
    }

    console.log("✓ All games cleared!");
  } catch (err) {
    console.error("Error clearing games:", err);
    process.exit(1);
  }
}

clearAllGames();
