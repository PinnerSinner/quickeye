/**
 * DynamoDB access layer for Quickeye.
 *
 * Two tables (names injected via env vars by the CDK stack):
 *  - CONNECTIONS_TABLE: connectionId -> { gameId, playerId } + ttl
 *      Answers "who is this open socket, and what game are they in?"
 *  - GAMES_TABLE: gameId (room code) -> full GameState + ttl
 *      The authoritative game state.
 *
 * We use the DynamoDB Document client so we work with plain JS objects instead
 * of DynamoDB's low-level attribute-value format.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { GameState } from "@quickeye/shared";

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const GAMES_TABLE = process.env.GAMES_TABLE!;

/** What we store per open WebSocket connection. */
export interface ConnectionRecord {
  connectionId: string;
  gameId: string | null;
  playerId: string | null;
  ttl: number;
}

// --- Connections -----------------------------------------------------------

export async function putConnection(record: ConnectionRecord): Promise<void> {
  await doc.send(
    new PutCommand({ TableName: CONNECTIONS_TABLE, Item: record })
  );
}

export async function getConnection(
  connectionId: string
): Promise<ConnectionRecord | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
    })
  );
  return (res.Item as ConnectionRecord) ?? null;
}

export async function deleteConnection(connectionId: string): Promise<void> {
  await doc.send(
    new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
    })
  );
}

// --- Games ------------------------------------------------------------------

export async function putGame(state: GameState): Promise<void> {
  await doc.send(new PutCommand({ TableName: GAMES_TABLE, Item: state }));
}

/**
 * Write game state only if the center card hasn't changed since we read it.
 *
 * This is optimistic locking: if two players submit a correct match at the same
 * instant, only the first write succeeds — the second sees the condition fail
 * (ConditionalCheckFailedException) and we treat it as "you were too slow".
 * Prevents a race from double-advancing the game.
 *
 * Returns true on success, false if another player won the race.
 */
export async function putGameIfCenterUnchanged(
  state: GameState,
  expectedCenterCardId: number | null
): Promise<boolean> {
  try {
    await doc.send(
      new PutCommand({
        TableName: GAMES_TABLE,
        Item: state,
        ConditionExpression: "centerCardId = :expected",
        ExpressionAttributeValues: { ":expected": expectedCenterCardId },
      })
    );
    return true;
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") return false;
    throw err;
  }
}

export async function getGame(gameId: string): Promise<GameState | null> {
  const res = await doc.send(
    new GetCommand({ TableName: GAMES_TABLE, Key: { gameId } })
  );
  return (res.Item as GameState) ?? null;
}

export async function deleteGame(gameId: string): Promise<void> {
  await doc.send(
    new DeleteCommand({ TableName: GAMES_TABLE, Key: { gameId } })
  );
}
