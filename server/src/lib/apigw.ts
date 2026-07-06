/**
 * Helper for pushing messages back to clients over their open WebSocket.
 *
 * With a WebSocket API, Lambda doesn't "return" data to the client the way an
 * HTTP handler does. Instead it calls the API Gateway Management API to POST a
 * payload to a specific connectionId. The management endpoint is derived from
 * the incoming event's requestContext (domain + stage).
 */

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type { ServerMessage } from "@quickeye/shared";

/** Build the management-API endpoint from the Lambda event's request context. */
export function endpointFromEvent(requestContext: {
  domainName?: string;
  stage?: string;
}): string {
  return `https://${requestContext.domainName}/${requestContext.stage}`;
}

/**
 * Send one message to one connection.
 *
 * Returns false if the connection is gone (410 Gone) so callers can clean up
 * stale records; re-throws anything unexpected.
 */
export async function sendToConnection(
  endpoint: string,
  connectionId: string,
  message: ServerMessage
): Promise<boolean> {
  const client = new ApiGatewayManagementApiClient({ endpoint });
  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(message)),
      })
    );
    return true;
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 410 || err?.name === "GoneException") {
      // Client already disconnected — not an error, just stale.
      return false;
    }
    throw err;
  }
}

/** Send the same message to many connections, ignoring dead ones. */
export async function broadcast(
  endpoint: string,
  connectionIds: (string | null)[],
  message: ServerMessage
): Promise<void> {
  await Promise.all(
    connectionIds
      .filter((id): id is string => !!id)
      .map((id) => sendToConnection(endpoint, id, message))
  );
}
