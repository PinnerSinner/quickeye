/**
 * DynamoDB access layer for Quickeye.
 *
 * Three tables (names injected via env vars by the CDK stack; each Lambda
 * only gets the env vars for the tables it's allowed to touch):
 *  - CONNECTIONS_TABLE: connectionId -> { gameId, playerId } + ttl
 *      Answers "who is this open socket, and what game are they in?"
 *  - GAMES_TABLE: gameId (room code) -> full GameState + ttl
 *      The authoritative game state.
 *  - LEADERBOARD_TABLE: finished-game scores, written only by the server.
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
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import type { GameState, GameMode, LeaderboardEntry } from "@quickeye/shared";
import {
  LEADERBOARD_SCORE_INDEX,
  clampLimit,
  leaderboardPk,
  utcDate,
  type LeaderboardItem,
  type LeaderboardPeriod,
} from "./leaderboard";

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const GAMES_TABLE = process.env.GAMES_TABLE!;
const LEADERBOARD_TABLE = process.env.LEADERBOARD_TABLE!;

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

/**
 * Which of these connection ids still have a row in the Connections table?
 * BatchGet takes at most 100 keys per call, so we chunk, and we retry any keys
 * DynamoDB hands back as "unprocessed" (it does that under throttling).
 */
export async function liveConnectionIds(ids: string[]): Promise<Set<string>> {
  const live = new Set<string>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 100) {
    let keys: Record<string, unknown>[] | undefined = unique
      .slice(i, i + 100)
      .map((connectionId) => ({ connectionId }));
    for (let attempt = 0; keys && keys.length > 0 && attempt < 5; attempt++) {
      const res = await doc.send(
        new BatchGetCommand({
          RequestItems: {
            [CONNECTIONS_TABLE]: { Keys: keys, ProjectionExpression: "connectionId" },
          },
        })
      );
      for (const item of res.Responses?.[CONNECTIONS_TABLE] ?? []) {
        live.add(item.connectionId as string);
      }
      keys = res.UnprocessedKeys?.[CONNECTIONS_TABLE]?.Keys as
        | Record<string, unknown>[]
        | undefined;
    }
  }
  return live;
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

/** GSI on the Games table: partition key `status`, sort key `createdAt`. */
export const GAMES_STATUS_INDEX = "ByStatus";

/**
 * Lobby games, read from the ByStatus GSI rather than scanning the whole
 * table. Pass `sinceSeconds` to only fetch games created at or after that time.
 *
 * Prototype note: every lobby game shares the one "lobby" partition in this
 * index. That's fine at our scale; at real scale you'd shard it.
 */
export async function listLobbyGames(sinceSeconds?: number): Promise<GameState[]> {
  const games: GameState[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: GAMES_TABLE,
        IndexName: GAMES_STATUS_INDEX,
        KeyConditionExpression:
          sinceSeconds === undefined
            ? "#status = :lobby"
            : "#status = :lobby AND #createdAt >= :since",
        ExpressionAttributeNames:
          sinceSeconds === undefined
            ? { "#status": "status" }
            : { "#status": "status", "#createdAt": "createdAt" },
        ExpressionAttributeValues:
          sinceSeconds === undefined
            ? { ":lobby": "lobby" }
            : { ":lobby": "lobby", ":since": sinceSeconds },
        ScanIndexForward: false,
        ExclusiveStartKey: startKey,
      })
    );
    games.push(...((res.Items as GameState[]) ?? []));
    startKey = res.LastEvaluatedKey;
  } while (startKey);
  return games;
}

/**
 * Delete a game only if it's still in the lobby. Returns false if it had
 * started (or vanished) in the meantime, so the cleanup never kills a live game.
 */
export async function deleteLobbyGame(gameId: string): Promise<boolean> {
  try {
    await doc.send(
      new DeleteCommand({
        TableName: GAMES_TABLE,
        Key: { gameId },
        ConditionExpression: "#status = :lobby",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":lobby": "lobby" },
      })
    );
    return true;
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") return false;
    throw err;
  }
}

// --- Leaderboard -----------------------------------------------------------
// Key layout and the "why" behind it live in ./leaderboard.ts.

/** Write leaderboard rows built by leaderboardItemsForGame (server-side only). */
export async function putLeaderboardItems(items: LeaderboardItem[]): Promise<void> {
  await Promise.all(
    items.map((Item) => doc.send(new PutCommand({ TableName: LEADERBOARD_TABLE, Item })))
  );
}

/**
 * The genuine top N scores for a game mode and period, highest first.
 *
 * Reads the ByScore GSI (sort key = score) in descending order, so DynamoDB
 * hands back exactly the top N and nothing else. Previously this read the N*2
 * NEWEST rows by timestamp and sorted those, so an old high score dropped off
 * the "top" list as soon as enough newer games were played.
 */
export async function getLeaderboard(
  gameMode: GameMode,
  period: LeaderboardPeriod,
  limit: number = 50,
  nowMs: number = Date.now()
): Promise<LeaderboardEntry[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: LEADERBOARD_TABLE,
      IndexName: LEADERBOARD_SCORE_INDEX,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": leaderboardPk(gameMode, period, utcDate(nowMs)) },
      ScanIndexForward: false, // highest score first
      Limit: clampLimit(limit),
    })
  );

  const items = (res.Items as LeaderboardItem[]) ?? [];
  return items.map(({ pk, sk, ...entry }) => entry);
}
