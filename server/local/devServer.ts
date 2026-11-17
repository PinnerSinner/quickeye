/**
 * Local stand-in for the whole AWS backend, for development and testing
 * without deploying anything.
 *
 * It runs the REAL Lambda handlers from src/handlers, unchanged, and fakes
 * the three AWS pieces around them:
 *
 *   API Gateway WebSocket API  ->  a `ws` server on WS_PORT. Each socket gets
 *                                  a connectionId; $connect / $disconnect /
 *                                  action routes call the matching handler.
 *   Management API (replies)   ->  an HTTP server on MGMT_PORT that accepts the
 *                                  handlers' POST /@connections/{id} calls and
 *                                  forwards them down the right socket.
 *   DynamoDB                   ->  dynalite, an in-memory DynamoDB emulator,
 *                                  with the same tables + GSIs as the CDK stack.
 *
 * Usage:   npm -w server run dev:local
 * Then:    VITE_WSS_URL=ws://localhost:3001 npm -w client run dev
 *
 * Extra (local only): POST http://localhost:3002/_cleanup runs cleanupGames,
 * which in AWS is only ever triggered by the EventBridge schedule.
 *
 * Data lives in memory and vanishes when you stop the server.
 */

import http from "http";
import { randomBytes } from "crypto";
import { WebSocketServer, WebSocket } from "ws";

const WS_PORT = Number(process.env.WS_PORT ?? 3001);
const MGMT_PORT = Number(process.env.MGMT_PORT ?? 3002);
const DYNAMO_PORT = Number(process.env.DYNAMO_PORT ?? 4567);
const STAGE = "local";

// Env the handlers expect. Must be set BEFORE the handler modules load,
// because lib/dynamo.ts reads table names at import time.
Object.assign(process.env, {
  AWS_REGION: "us-east-1",
  AWS_ACCESS_KEY_ID: "local",
  AWS_SECRET_ACCESS_KEY: "local",
  AWS_ENDPOINT_URL_DYNAMODB: `http://localhost:${DYNAMO_PORT}`,
  CONNECTIONS_TABLE: "Connections",
  GAMES_TABLE: "Games",
  LEADERBOARD_TABLE: "Leaderboard",
  QUICKEYE_LOCAL_MGMT_ENDPOINT: `http://localhost:${MGMT_PORT}/${STAGE}`,
});

type Handler = (event: any, context?: any) => Promise<any>;

async function startDynamo(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dynalite = require("dynalite");
  const server = dynalite({ createTableMs: 0, deleteTableMs: 0, updateTableMs: 0 });
  await new Promise<void>((resolve) => server.listen(DYNAMO_PORT, resolve));

  const { DynamoDBClient, CreateTableCommand } = await import("@aws-sdk/client-dynamodb");
  const db = new DynamoDBClient({});
  const S = "S" as const;
  const N = "N" as const;

  // Keep in step with infra/lib/quickeye-stack.ts.
  await db.send(
    new CreateTableCommand({
      TableName: "Connections",
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [{ AttributeName: "connectionId", AttributeType: S }],
      KeySchema: [{ AttributeName: "connectionId", KeyType: "HASH" }],
    })
  );
  await db.send(
    new CreateTableCommand({
      TableName: "Games",
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "gameId", AttributeType: S },
        { AttributeName: "status", AttributeType: S },
        { AttributeName: "createdAt", AttributeType: N },
      ],
      KeySchema: [{ AttributeName: "gameId", KeyType: "HASH" }],
      GlobalSecondaryIndexes: [
        {
          IndexName: "ByStatus",
          KeySchema: [
            { AttributeName: "status", KeyType: "HASH" },
            { AttributeName: "createdAt", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    })
  );
  await db.send(
    new CreateTableCommand({
      TableName: "Leaderboard",
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: S },
        { AttributeName: "sk", AttributeType: N },
        { AttributeName: "score", AttributeType: N },
      ],
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "ByScore",
          KeySchema: [
            { AttributeName: "pk", KeyType: "HASH" },
            { AttributeName: "score", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    })
  );
}

async function main() {
  await startDynamo();

  // Load the real handlers now that env is in place.
  // (Plain require() calls so esbuild bundles them but runs them lazily, here.)
  /* eslint-disable @typescript-eslint/no-var-requires */
  const routes: Record<string, Handler> = {
    createGame: require("../src/handlers/createGame").handler,
    joinGame: require("../src/handlers/joinGame").handler,
    startGame: require("../src/handlers/startGame").handler,
    submitMatch: require("../src/handlers/submitMatch").handler,
    queryGames: require("../src/handlers/queryGames").handler,
    queryLeaderboard: require("../src/handlers/queryLeaderboard").handler,
  };
  const onConnect: Handler = require("../src/handlers/connect").handler;
  const onDisconnect: Handler = require("../src/handlers/disconnect").handler;
  const onDefault: Handler = require("../src/handlers/default").handler;
  const cleanup: Handler = require("../src/handlers/cleanupGames").handler;
  /* eslint-enable @typescript-eslint/no-var-requires */

  const sockets = new Map<string, WebSocket>();

  const event = (connectionId: string, routeKey: string, body?: string) => ({
    requestContext: {
      connectionId,
      routeKey,
      domainName: `localhost:${WS_PORT}`,
      stage: STAGE,
    },
    body,
  });

  // --- Fake management API: handlers POST replies here --------------------
  const mgmt = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/_cleanup") {
      cleanup({}, {}).then(
        () => res.writeHead(200).end("cleanup ran\n"),
        (err) => res.writeHead(500).end(String(err))
      );
      return;
    }
    const m = req.url?.match(/^\/[^/]+\/@connections\/([^/?]+)/);
    const id = m ? decodeURIComponent(m[1]) : null;
    const ws = id ? sockets.get(id) : undefined;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      res.writeHead(410, { "content-type": "application/json" }).end('{"message":"Gone"}');
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (req.method === "POST") ws.send(Buffer.concat(chunks).toString("utf8"));
      else if (req.method === "DELETE") ws.close();
      res.writeHead(200).end();
    });
  });
  await new Promise<void>((resolve) => mgmt.listen(MGMT_PORT, resolve));

  // --- Fake API Gateway WebSocket API --------------------------------------
  const wss = new WebSocketServer({ port: WS_PORT });
  wss.on("connection", async (ws) => {
    const connectionId = randomBytes(9).toString("base64url");
    sockets.set(connectionId, ws);

    // Queue messages so they're handled in order, after $connect finishes,
    // like API Gateway does per connection.
    let chain: Promise<unknown> = onConnect(event(connectionId, "$connect"));

    ws.on("message", (data) => {
      const body = data.toString("utf8");
      let action = "";
      try {
        action = JSON.parse(body).action ?? "";
      } catch {
        /* not JSON: falls through to $default */
      }
      const route = routes[action];
      chain = chain
        .then(() => (route ?? onDefault)(event(connectionId, route ? action : "$default", body)))
        .catch((err) => console.error(`[${action || "$default"}]`, err));
    });

    ws.on("close", () => {
      chain = chain
        .then(() => onDisconnect(event(connectionId, "$disconnect")))
        .catch((err) => console.error("[$disconnect]", err))
        .finally(() => sockets.delete(connectionId));
    });
  });

  console.log(`Quickeye local backend ready
  WebSocket:  ws://localhost:${WS_PORT}
  Mgmt API:   http://localhost:${MGMT_PORT}/${STAGE}
  DynamoDB:   http://localhost:${DYNAMO_PORT} (in-memory)
  Cleanup:    curl -X POST http://localhost:${MGMT_PORT}/_cleanup`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
