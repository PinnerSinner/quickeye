/**
 * $disconnect route handler.
 *
 * Fires when a socket closes (tab closed, network drop, etc.). We:
 *  1. Look up which game/player this connection belonged to.
 *  2. Mark that player as disconnected (connectionId -> null) so the game state
 *     still shows them but knows they're gone.
 *  3. Notify the remaining players so their UI can update.
 *  4. Delete the connection record.
 *
 * Note (known prototype gap, per CLAUDE.md): we do NOT remove the player from
 * the game or handle reconnection yet — that's deferred until the core loop works.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import type { GameState } from "@quickeye/shared";
import { getConnection, deleteConnection, getGame, putGame } from "../lib/dynamo";
import { broadcast, endpointFromEvent } from "../lib/apigw";
import { ok, fail } from "../lib/util";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  try {
    const conn = await getConnection(connectionId);
    await deleteConnection(connectionId);

    if (conn?.gameId && conn.playerId) {
      const game = await getGame(conn.gameId);
      if (game) {
        const updated: GameState = {
          ...game,
          players: game.players.map((p) =>
            p.playerId === conn.playerId ? { ...p, connectionId: null } : p
          ),
        };
        await putGame(updated);

        const endpoint = endpointFromEvent(event.requestContext);
        await broadcast(
          endpoint,
          updated.players.map((p) => p.connectionId),
          { type: "stateUpdate", state: updated }
        );
      }
    }
    return ok();
  } catch (err) {
    console.error("disconnect failed", err);
    return fail();
  }
};
