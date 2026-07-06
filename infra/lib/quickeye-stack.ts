/**
 * Quickeye backend stack.
 *
 * Provisions everything needed for real-time multiplayer:
 *   - 2 DynamoDB tables (connections, games) with TTL auto-cleanup
 *   - 7 Lambda functions (one per WebSocket route)
 *   - 1 API Gateway WebSocket API routing messages to those functions
 *
 * Each Lambda is bundled from TypeScript by NodejsFunction (esbuild under the
 * hood), which also pulls in the @quickeye/shared package automatically.
 */

import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

const HANDLERS_DIR = path.join(__dirname, "..", "..", "server", "src", "handlers");

export class QuickeyeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- DynamoDB tables ---------------------------------------------------
    // PAY_PER_REQUEST (on-demand) billing: no capacity planning, pay only for
    // what a prototype actually uses. `timeToLiveAttribute: "ttl"` tells
    // DynamoDB to auto-delete rows once their `ttl` epoch-seconds passes.

    const connectionsTable = new dynamodb.Table(this, "ConnectionsTable", {
      partitionKey: { name: "connectionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // prototype: tear down cleanly
    });

    const gamesTable = new dynamodb.Table(this, "GamesTable", {
      partitionKey: { name: "gameId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const leaderboardTable = new dynamodb.Table(this, "LeaderboardTable", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // --- Lambda factory ----------------------------------------------------
    // Every handler shares the same table env vars and bundling settings, so a
    // small helper keeps the route wiring below readable.

    const makeFn = (name: string, file: string) =>
      new NodejsFunction(this, name, {
        entry: path.join(HANDLERS_DIR, file),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        environment: {
          CONNECTIONS_TABLE: connectionsTable.tableName,
          GAMES_TABLE: gamesTable.tableName,
          LEADERBOARD_TABLE: leaderboardTable.tableName,
        },
        bundling: {
          // AWS SDK v3 ships in the Node 20 runtime — don't bundle it.
          externalModules: ["@aws-sdk/*"],
          minify: true,
          sourceMap: true,
        },
      });

    const connectFn = makeFn("ConnectFn", "connect.ts");
    const disconnectFn = makeFn("DisconnectFn", "disconnect.ts");
    const defaultFn = makeFn("DefaultFn", "default.ts");
    const createGameFn = makeFn("CreateGameFn", "createGame.ts");
    const joinGameFn = makeFn("JoinGameFn", "joinGame.ts");
    const startGameFn = makeFn("StartGameFn", "startGame.ts");
    const submitMatchFn = makeFn("SubmitMatchFn", "submitMatch.ts");
    const queryLeaderboardFn = makeFn("QueryLeaderboardFn", "queryLeaderboard.ts");

    const allFns = [
      connectFn,
      disconnectFn,
      defaultFn,
      createGameFn,
      joinGameFn,
      startGameFn,
      submitMatchFn,
      queryLeaderboardFn,
    ];

    // --- Table permissions -------------------------------------------------
    // Prototype-simple: every handler can read/write all tables. (A hardening
    // pass later would scope each function to only what it touches.)
    for (const fn of allFns) {
      connectionsTable.grantReadWriteData(fn);
      gamesTable.grantReadWriteData(fn);
      leaderboardTable.grantReadWriteData(fn);
    }

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
    ]) {
      wsApi.grantManageConnections(fn);
    }

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
