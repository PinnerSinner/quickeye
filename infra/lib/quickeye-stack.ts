/**
 * Quickeye backend stack.
 *
 * Provisions everything needed for real-time multiplayer:
 *   - 3 DynamoDB tables (connections, games, leaderboard), with a GSI on games
 *     (lobby browser) and on leaderboard (top scores)
 *   - 9 WebSocket Lambda handlers (one per route) + 1 scheduled cleanup Lambda
 *   - 1 API Gateway WebSocket API routing messages to those functions
 *   - 1 EventBridge schedule that runs the lobby cleanup every 15 minutes
 *
 * Each Lambda is bundled from TypeScript by NodejsFunction (esbuild under the
 * hood), which also pulls in the @quickeye/shared package automatically.
 *
 * IMPORTANT: the construct ids below ("ConnectionsTable", "GamesTable",
 * "QuickeyeWsApi", ...) are what CloudFormation uses to recognise a resource
 * between deploys. Renaming one makes CloudFormation think it's a brand new
 * resource and delete the old one, so don't rename them.
 */

import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

const HANDLERS_DIR = path.join(__dirname, "..", "..", "server", "src", "handlers");

/** What a function is allowed to do to a table. */
type Access = "read" | "write" | "readWrite";

interface FnTables {
  connections?: Access;
  games?: Access;
  leaderboard?: Access;
}

export class QuickeyeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- DynamoDB tables ---------------------------------------------------
    // PAY_PER_REQUEST (on-demand) billing: no capacity planning, pay only for
    // what a prototype actually uses. `timeToLiveAttribute: "ttl"` tells
    // DynamoDB to auto-delete rows once their `ttl` epoch-seconds passes.
    //
    // RETAIN means that if a table is ever removed from this stack (or the
    // whole stack is destroyed), CloudFormation leaves the table and its data
    // in place instead of deleting it. Safer now that there's real data.

    const connectionsTable = new dynamodb.Table(this, "ConnectionsTable", {
      partitionKey: { name: "connectionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const gamesTable = new dynamodb.Table(this, "GamesTable", {
      partitionKey: { name: "gameId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Lobby browser + cleanup index: "all games with status = lobby, by age".
    // Lets queryGames/cleanupGames Query instead of Scan the whole table.
    // Adding a GSI to an existing table is an in-place update (DynamoDB
    // backfills it in the background), not a replacement.
    gamesTable.addGlobalSecondaryIndex({
      indexName: "ByStatus", // must match GAMES_STATUS_INDEX in server/src/lib/dynamo.ts
      partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const leaderboardTable = new dynamodb.Table(this, "LeaderboardTable", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Top-scores index: same partition (mode + period) but sorted by score,
    // so "top 50" is one Query reading exactly 50 items, highest first.
    leaderboardTable.addGlobalSecondaryIndex({
      indexName: "ByScore", // must match LEADERBOARD_SCORE_INDEX in server/src/lib/leaderboard.ts
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "score", type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const tables = {
      connections: { table: connectionsTable, env: "CONNECTIONS_TABLE" },
      games: { table: gamesTable, env: "GAMES_TABLE" },
      leaderboard: { table: leaderboardTable, env: "LEADERBOARD_TABLE" },
    } as const;

    // --- Lambda factory ----------------------------------------------------
    // Each function only gets the table names (env vars) and IAM permissions
    // for the tables it actually touches. Least privilege: if a handler is
    // ever compromised or buggy, the blast radius is just its own tables.

    const makeFn = (name: string, file: string, access: FnTables) => {
      const environment: Record<string, string> = {};
      for (const key of Object.keys(access) as (keyof FnTables)[]) {
        environment[tables[key].env] = tables[key].table.tableName;
      }

      const fn = new NodejsFunction(this, name, {
        entry: path.join(HANDLERS_DIR, file),
        handler: "handler",
        // Node 20 reached end-of-life in April 2026 and Lambda blocks updates
        // to functions on deprecated runtimes, so we're on Node 22.
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        environment,
        bundling: {
          // AWS SDK v3 ships in the Node 22 runtime, so don't bundle it.
          externalModules: ["@aws-sdk/*"],
          minify: true,
          sourceMap: true,
        },
      });

      for (const [key, level] of Object.entries(access) as [keyof FnTables, Access][]) {
        const table = tables[key].table;
        if (level === "read") table.grantReadData(fn);
        else if (level === "write") table.grantWriteData(fn);
        else table.grantReadWriteData(fn);
      }
      return fn;
    };

    // Table access per handler, worked out from what each one imports from
    // server/src/lib/dynamo.ts.
    const connectFn = makeFn("ConnectFn", "connect.ts", {
      connections: "write",
    });
    const disconnectFn = makeFn("DisconnectFn", "disconnect.ts", {
      connections: "readWrite",
      games: "readWrite",
    });
    const defaultFn = makeFn("DefaultFn", "default.ts", {});
    const createGameFn = makeFn("CreateGameFn", "createGame.ts", {
      connections: "write",
      games: "readWrite",
    });
    const joinGameFn = makeFn("JoinGameFn", "joinGame.ts", {
      connections: "write",
      games: "readWrite",
    });
    const startGameFn = makeFn("StartGameFn", "startGame.ts", {
      connections: "read",
      games: "readWrite",
    });
    const submitMatchFn = makeFn("SubmitMatchFn", "submitMatch.ts", {
      connections: "read",
      games: "readWrite",
      leaderboard: "write",
    });
    const queryLeaderboardFn = makeFn("QueryLeaderboardFn", "queryLeaderboard.ts", {
      leaderboard: "read",
    });
    const queryGamesFn = makeFn("QueryGamesFn", "queryGames.ts", {
      connections: "read",
      games: "read",
    });
    const cleanupGamesFn = makeFn("CleanupGamesFn", "cleanupGames.ts", {
      connections: "read",
      games: "readWrite",
    });

    // --- WebSocket API -----------------------------------------------------
    // The route selection expression tells API Gateway which field of the
    // incoming JSON to route on. We use `action`, matching our message protocol.

    const wsApi = new apigwv2.WebSocketApi(this, "QuickeyeWsApi", {
      apiName: "quickeye-ws",
      routeSelectionExpression: "$request.body.action",
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration("ConnectInt", connectFn),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration("DisconnectInt", disconnectFn),
      },
      defaultRouteOptions: {
        integration: new WebSocketLambdaIntegration("DefaultInt", defaultFn),
      },
    });

    // Custom action routes (the `action` values clients send).
    // Note: cleanupGames is deliberately NOT a route. Anything routed here can
    // be called by anyone with the wss:// URL, straight from browser devtools.
    wsApi.addRoute("createGame", {
      integration: new WebSocketLambdaIntegration("CreateGameInt", createGameFn),
    });
    wsApi.addRoute("joinGame", {
      integration: new WebSocketLambdaIntegration("JoinGameInt", joinGameFn),
    });
    wsApi.addRoute("startGame", {
      integration: new WebSocketLambdaIntegration("StartGameInt", startGameFn),
    });
    wsApi.addRoute("submitMatch", {
      integration: new WebSocketLambdaIntegration("SubmitMatchInt", submitMatchFn),
    });
    wsApi.addRoute("queryLeaderboard", {
      integration: new WebSocketLambdaIntegration("QueryLeaderboardInt", queryLeaderboardFn),
    });
    wsApi.addRoute("queryGames", {
      integration: new WebSocketLambdaIntegration("QueryGamesInt", queryGamesFn),
    });

    const stage = new apigwv2.WebSocketStage(this, "ProdStage", {
      webSocketApi: wsApi,
      stageName: "prod",
      autoDeploy: true,
    });

    // Handlers that push messages back to clients need permission to call the
    // management API (execute-api:ManageConnections). Only the handlers that
    // actually broadcast/reply need it.
    for (const fn of [
      disconnectFn,
      defaultFn,
      createGameFn,
      joinGameFn,
      startGameFn,
      submitMatchFn,
      queryLeaderboardFn,
      queryGamesFn,
    ]) {
      wsApi.grantManageConnections(fn);
    }

    // --- Scheduled lobby cleanup -------------------------------------------
    // EventBridge invokes the cleanup Lambda on a timer. Only EventBridge is
    // given permission to invoke it, so players can't trigger it themselves.
    new events.Rule(this, "CleanupGamesSchedule", {
      description: "Delete stale Quickeye lobby games every 15 minutes",
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      targets: [new targets.LambdaFunction(cleanupGamesFn)],
    });

    // --- Outputs -----------------------------------------------------------
    // The wss:// URL the React client connects to. Printed after `cdk deploy`.
    new cdk.CfnOutput(this, "WebSocketUrl", {
      value: stage.url,
      description: "Connect the client to this wss:// URL",
    });
    new cdk.CfnOutput(this, "ConnectionsTableName", {
      value: connectionsTable.tableName,
    });
    new cdk.CfnOutput(this, "GamesTableName", {
      value: gamesTable.tableName,
    });
    new cdk.CfnOutput(this, "LeaderboardTableName", {
      value: leaderboardTable.tableName,
    });
  }
}
