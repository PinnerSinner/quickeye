/**
 * queryLeaderboard route handler (action: "queryLeaderboard").
 *
 * Returns ranked leaderboard entries for a specific game mode and period.
 * Results come back already ranked: getLeaderboard reads the ByScore GSI
 * highest-score-first, so the top N really are the top N.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import type { QueryLeaderboardMessage } from "@quickeye/shared";
import { sendToConnection, endpointFromEvent } from "../lib/apigw";
import { getLeaderboard } from "../lib/dynamo";
import { clampLimit } from "../lib/leaderboard";
import { ok, fail } from "../lib/util";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const endpoint = endpointFromEvent(event.requestContext);

  try {
    const body = JSON.parse(event.body ?? "{}") as QueryLeaderboardMessage;
    const gameMode = body.gameMode;
    const period = body.period;
    const limit = clampLimit(body.limit);

    if (!gameMode || (period !== "daily" && period !== "all-time")) {
      await sendToConnection(endpoint, connectionId, {
        type: "error",
        code: "INVALID_PARAMS",
        message: "gameMode and period are required",
      });
      return ok();
    }

    const entries = await getLeaderboard(gameMode, period, limit);

    // Add rank to each entry
    const ranked = entries.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));

    await sendToConnection(endpoint, connectionId, {
      type: "leaderboard",
      gameMode,
      period,
      entries: ranked,
    });

    return ok();
  } catch (err) {
    console.error("queryLeaderboard failed", err);
    await sendToConnection(endpoint, connectionId, {
      type: "error",
      code: "LEADERBOARD_FAILED",
      message: "Could not fetch leaderboard.",
    });
    return fail();
  }
};
