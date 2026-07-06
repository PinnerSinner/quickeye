#!/usr/bin/env npx ts-node
/**
 * Local test client for the Quickeye WebSocket API.
 *
 * Simulates a full game flow:
 *  1. Player A creates a game
 *  2. Player B joins
 *  3. A starts the game
 *  4. A and B exchange matches
 *
 * Usage:
 *   npx ts-node server/test-client.ts wss://your-api-gateway-url/prod
 *
 * You get the wss:// URL from `cdk deploy` output.
 */

import WebSocket from "ws";
import type {
  ClientMessage,
  ServerMessage,
  JoinedMessage,
  StateUpdateMessage,
  MatchResultMessage,
} from "@quickeye/shared";

interface Player {
  name: string;
  ws: WebSocket;
  gameId?: string;
  playerId?: string;
  currentCardId?: number | null;
}

const log = (player: string, msg: string) =>
  console.log(`[${player}] ${msg}`);

function connect(url: string, player: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on("open", () => {
      log(player, "connected");
      resolve(ws);
    });
    ws.on("error", reject);
  });
}

function send(ws: WebSocket, msg: ClientMessage): void {
  ws.send(JSON.stringify(msg));
}

function onMessage(
  ws: WebSocket,
  handler: (msg: ServerMessage) => void
): void {
  ws.on("message", (data: string) => {
    try {
      handler(JSON.parse(data));
    } catch (err) {
      console.error("Failed to parse message:", data, err);
    }
  });
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error(
      "Usage: npx ts-node server/test-client.ts wss://your-api-gateway-url/prod"
    );
    process.exit(1);
  }

  const playerA: Player = { name: "Alice", ws: new WebSocket("") };
  const playerB: Player = { name: "Bob", ws: new WebSocket("") };

  try {
    // Connect both players
    log("SETUP", "connecting players...");
    playerA.ws = await connect(url, playerA.name);
    playerB.ws = await connect(url, playerB.name);

    // --- Player A creates a game ---
    log("TEST", "Player A creates a game");
    await new Promise<void>((resolve) => {
      onMessage(playerA.ws, (msg: ServerMessage) => {
        if (msg.type === "joined") {
          const m = msg as JoinedMessage;
          playerA.gameId = m.gameId;
          playerA.playerId = m.playerId;
          log(playerA.name, `created game ${m.gameId}, playerId=${m.playerId}`);
          resolve();
        } else if (msg.type === "error") {
          log(playerA.name, `error: ${msg.message}`);
        }
      });
      send(playerA.ws, { action: "createGame", playerName: "Alice" });
    });

    if (!playerA.gameId) throw new Error("A failed to create game");

    // --- Player B joins ---
    log("TEST", `Player B joins game ${playerA.gameId}`);
    await new Promise<void>((resolve) => {
      onMessage(playerB.ws, (msg: ServerMessage) => {
        if (msg.type === "joined") {
          const m = msg as JoinedMessage;
          playerB.gameId = m.gameId;
          playerB.playerId = m.playerId;
          log(playerB.name, `joined game ${m.gameId}, playerId=${m.playerId}`);
          resolve();
        } else if (msg.type === "stateUpdate") {
          // B also gets the initial state before the joined message
          log(playerB.name, `state: ${msg.state.players.length} players`);
        }
      });
      send(playerB.ws, {
        action: "joinGame",
        gameId: playerA.gameId!,
        playerName: "Bob",
      });
    });

    if (!playerB.gameId) throw new Error("B failed to join game");

    // --- Player A starts the game ---
    log("TEST", "Player A starts the game");
    await new Promise<void>((resolve) => {
      let updates = 0;
      onMessage(playerA.ws, (msg: ServerMessage) => {
        if (msg.type === "stateUpdate") {
          const m = msg as StateUpdateMessage;
          updates++;
          if (updates === 2) {
            // We get two updates: one for B joining, one for game start
            playerA.currentCardId = m.state.players.find(
              (p) => p.playerId === playerA.playerId
            )?.currentCardId;
            log(
              playerA.name,
              `game started, dealing done. Your card: ${playerA.currentCardId}, center: ${m.state.centerCardId}`
            );
            resolve();
          }
        }
      });
      send(playerA.ws, {
        action: "startGame",
        gameId: playerA.gameId!,
      });
    });

    // B should also get the playing state
    await new Promise<void>((resolve) => {
      onMessage(playerB.ws, (msg: ServerMessage) => {
        if (msg.type === "stateUpdate") {
          const m = msg as StateUpdateMessage;
          if (m.state.status === "playing") {
            playerB.currentCardId = m.state.players.find(
              (p) => p.playerId === playerB.playerId
            )?.currentCardId;
            log(
              playerB.name,
              `game started. Your card: ${playerB.currentCardId}, center: ${m.state.centerCardId}`
            );
            resolve();
          }
        }
      });
    });

    // --- Player A submits a match ---
    log("TEST", "Player A submits a match attempt");
    await new Promise<void>((resolve) => {
      onMessage(playerA.ws, (msg: ServerMessage) => {
        if (msg.type === "matchResult") {
          const m = msg as MatchResultMessage;
          if (m.correct) {
            log(
              playerA.name,
              `CORRECT! symbolId=${m.symbolId}, score now 1. Game over: ${m.gameOver}`
            );
          } else {
            log(playerA.name, "incorrect guess");
          }
          resolve();
        }
      });
      // Submit the first symbol on A's card (we don't validate it's actually
      // the match — the server does that authoritatively)
      send(playerA.ws, {
        action: "submitMatch",
        gameId: playerA.gameId!,
        symbolId: 0, // Just try the first symbol; server validates
      });
    });

    log("SUCCESS", "test flow completed without errors");
    process.exit(0);
  } catch (err) {
    log("ERROR", String(err));
    process.exit(1);
  }
}

main();
