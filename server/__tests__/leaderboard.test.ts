import type { GameState, Player } from "@quickeye/shared";
import {
  clampLimit,
  leaderboardItemsForGame,
  leaderboardPk,
  utcDate,
  LEADERBOARD_SCORE_INDEX,
} from "../src/lib/leaderboard";

const NOW_MS = Date.UTC(2026, 10, 17, 23, 59, 30, 123); // 2026-11-17

function player(id: string, score: number, extra: Partial<Player> = {}): Player {
  return { playerId: id, name: id.toUpperCase(), connectionId: `c-${id}`, score, currentCardId: 1, ...extra };
}

function finished(players: Player[]): GameState {
  return {
    gameId: "WXYZ",
    status: "finished",
    hostId: players[0]?.playerId ?? "",
    players,
    centerCardId: 3,
    drawPile: [],
    gameMode: "ten-rounds",
    gameType: "multiplayer",
    createdAt: 0,
    ttl: 0,
  };
}

describe("leaderboard keys", () => {
  it("uses the UTC date for daily boards", () => {
    expect(utcDate(NOW_MS)).toBe("2026-11-17");
    expect(leaderboardPk("ten-rounds", "daily", "2026-11-17")).toBe("ten-rounds#daily#2026-11-17");
    expect(leaderboardPk("ten-rounds", "all-time", "2026-11-17")).toBe("ten-rounds#all-time");
  });

  it("clamps the client-supplied limit", () => {
    expect(clampLimit(undefined)).toBe(50);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(5000)).toBe(100);
    expect(clampLimit(12.7)).toBe(12);
    expect(clampLimit("lots" as unknown)).toBe(50);
  });
});

describe("leaderboardItemsForGame", () => {
  it("writes a daily and an all-time row per scoring human, from server state", () => {
    const items = leaderboardItemsForGame(
      finished([player("alice", 30), player("bob", 24)]),
      NOW_MS,
      () => 0.5
    );
    expect(items).toHaveLength(4);
    expect(items.map((i) => [i.pk, i.playerId, i.score, i.date])).toEqual([
      ["ten-rounds#daily#2026-11-17", "alice", 30, "2026-11-17"],
      ["ten-rounds#all-time", "alice", 30, "all-time"],
      ["ten-rounds#daily#2026-11-17", "bob", 24, "2026-11-17"],
      ["ten-rounds#all-time", "bob", 24, "all-time"],
    ]);
  });

  it("gives every player in the same game a distinct sort key (old bug: they collided)", () => {
    const six = [1, 2, 3, 4, 5, 6].map((n) => player(`p${n}`, n));
    // Offset base near the wrap-around point to prove the modulo keeps them unique.
    const items = leaderboardItemsForGame(finished(six), NOW_MS, () => 0.998);
    const daily = items.filter((i) => i.pk.includes("#daily#"));
    expect(new Set(daily.map((i) => i.sk)).size).toBe(6);
    for (const i of items) expect(Number.isSafeInteger(i.sk)).toBe(true);
  });

  it("leaves out bots and players who didn't score", () => {
    const items = leaderboardItemsForGame(
      finished([player("alice", 5), player("zero", 0), player("marco", 9, { isBot: true })]),
      NOW_MS
    );
    expect([...new Set(items.map((i) => i.playerId))]).toEqual(["alice"]);
  });

  it("defaults a missing game mode", () => {
    const g = { ...finished([player("alice", 1)]), gameMode: undefined } as unknown as GameState;
    expect(leaderboardItemsForGame(g, NOW_MS)[0].gameMode).toBe("time-attack-60");
  });
});

describe("getLeaderboard (DynamoDB query shape)", () => {
  let send: jest.SpyInstance;
  let getLeaderboard: typeof import("../src/lib/dynamo").getLeaderboard;

  beforeAll(() => {
    process.env.LEADERBOARD_TABLE = "lb-table";
    const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
    send = jest.spyOn(DynamoDBDocumentClient.prototype, "send");
    getLeaderboard = require("../src/lib/dynamo").getLeaderboard;
  });
  afterAll(() => send.mockRestore());

  it("queries the score index highest-first with the exact limit, so top N is genuine", async () => {
    send.mockResolvedValueOnce({
      Items: [
        { pk: "ten-rounds#all-time", sk: 1, playerId: "a", playerName: "A", score: 40, gameMode: "ten-rounds", timestamp: 1, date: "all-time" },
        { pk: "ten-rounds#all-time", sk: 2, playerId: "b", playerName: "B", score: 12, gameMode: "ten-rounds", timestamp: 2, date: "all-time" },
      ],
    });

    const out = await getLeaderboard("ten-rounds", "all-time", 10, NOW_MS);

    const input = send.mock.calls[0][0].input;
    expect(input).toMatchObject({
      TableName: "lb-table",
      IndexName: LEADERBOARD_SCORE_INDEX,
      ScanIndexForward: false,
      Limit: 10,
      ExpressionAttributeValues: { ":pk": "ten-rounds#all-time" },
    });
    expect(out.map((e) => e.score)).toEqual([40, 12]);
    expect(out[0]).not.toHaveProperty("pk");
    expect(out[0]).not.toHaveProperty("sk");
  });

  it("targets today's partition for the daily board", async () => {
    send.mockResolvedValueOnce({ Items: [] });
    await getLeaderboard("ten-rounds", "daily", 50, NOW_MS);
    expect(send.mock.calls[1][0].input.ExpressionAttributeValues).toEqual({
      ":pk": "ten-rounds#daily#2026-11-17",
    });
  });
});
