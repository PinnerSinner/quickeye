/**
 * $connect route handler.
 *
 * Fires when a browser opens the WebSocket. At this point we don't yet know
 * who they are (no createGame/joinGame has happened), so we just record the
 * connection id with a TTL. The player/game link is filled in later.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { GAME_CONFIG } from "@quickeye/shared";
import { putConnection } from "../lib/dynamo";
import { ok, fail, ttlFromNow } from "../lib/util";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  try {
    await putConnection({
      connectionId,
      gameId: null,
      playerId: null,
      ttl: ttlFromNow(GAME_CONFIG.gameTtlHours),
    });
    return ok();
  } catch (err) {
    console.error("connect failed", err);
    return fail();
  }
};
