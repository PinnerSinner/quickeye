/**
 * $default route handler.
 *
 * Catches any message whose `action` doesn't match a defined route (typo,
 * unsupported action, malformed body). Replies with a friendly error rather
 * than silently dropping it.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { sendToConnection, endpointFromEvent } from "../lib/apigw";
import { ok } from "../lib/util";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const endpoint = endpointFromEvent(event.requestContext);

  let action = "unknown";
  try {
    action = JSON.parse(event.body ?? "{}").action ?? "unknown";
  } catch {
    /* body wasn't JSON */
  }

  await sendToConnection(endpoint, connectionId, {
    type: "error",
    code: "UNKNOWN_ACTION",
    message: `Unrecognized action: ${action}`,
  });
  return ok();
};
