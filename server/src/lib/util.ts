/**
 * Small shared utilities for the Lambda handlers.
 */

import type { APIGatewayProxyResultV2 } from "aws-lambda";

/**
 * API Gateway WebSocket handlers must return a status code. The body is ignored
 * by the client (real data is pushed via the management API), but a 2xx tells
 * API Gateway the message was handled.
 */
export function ok(): APIGatewayProxyResultV2 {
  return { statusCode: 200, body: "" };
}

export function fail(statusCode = 500): APIGatewayProxyResultV2 {
  return { statusCode, body: "" };
}

/** Epoch-seconds timestamp `hours` from now, for DynamoDB TTL attributes. */
export function ttlFromNow(hours: number): number {
  return Math.floor(Date.now() / 1000) + hours * 3600;
}

/** A short random id (not cryptographically strong — fine for player ids). */
export function randomId(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
}
