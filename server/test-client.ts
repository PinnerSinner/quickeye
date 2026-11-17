#!/usr/bin/env npx ts-node
/**
 * Smoke test for the Quickeye WebSocket API (live AWS or the local dev server).
 *
 * Two fake players, Alice and Bob, run through the real game flow:
 *   1. both connect
 *   2. Alice creates a game; Bob sees it in the lobby browser (queryGames)
 *   3. Bob joins, Alice starts
 *   4. Bob submits a symbol that isn't on his card -> server must reject it
 *   5. Alice submits the real match (worked out from the shared deck) -> accepted
 *   6. cleanupGames sent as a WebSocket action -> must NOT be a route
 *   7. with --full: they play to game over, then the leaderboard is checked
 *
 * Usage:
 *   npm -w server run test-client wss://xxxx.execute-api.us-east-1.amazonaws.com/prod
 *   npm -w server run test-client ws://localhost:3001 --full
 *
 * --full writes Alice's and Bob's scores to the leaderboard, so on the live
 * stack those names will show up on the real board. Leave it off there unless
 * you want that.
 */

import WebSocket from "ws";
import type { ClientMessage, ServerMessage, GameState } from "@quickeye/shared";
// Imported from source (not the package) so ts-node can run it directly.
import { generateDeck } from "../shared/src/deckGeneration";
import { GAME_CONFIG } from "../shared/src/gameTypes";

const DECK = generateDeck(GAME_CONFIG.deckN);
const TIMEOUT_MS = 15000;

class Bot {
  ws!: WebSocket;
  playerId = "";
  gameId = "";
  state: GameState | null = null;
  private waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];

  constructor(public name: string) {}

  log(msg: string) {
    console.log(`[${this.name}] ${msg}`);
  }

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.on("open", () => {
        this.log("connected");
        resolve();
      });
      this.ws.on("error", reject);
      this.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as ServerMessage;
        if (msg.type === "stateUpdate" || msg.type === "joined") this.state = msg.state;
        if (msg.type === "joined") {
          this.playerId = msg.playerId;
          this.gameId = msg.gameId;
        }
        this.waiters = this.waiters.filter((w) => {
          if (!w.pred(msg)) return true;
          w.resolve(msg);
          return false;
        });
      });
    });
  }

  /** Send, then wait for the first message matching `pred`. */
  request<T extends ServerMessage>(msg: ClientMessage | Record<string, unknown>, pred: (m: ServerMessage) => boolean, what: string): Promise<T> {
    const p = this.waitFor<T>(pred, what);
    this.ws.send(JSON.stringify(msg));
    return p;
  }

  waitFor<T extends ServerMessage>(pred: (m: ServerMessage) => boolean, what: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.name}: timed out waiting for ${what}`)), TIMEOUT_MS);
      this.waiters.push({
        pred,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m as T);
        },
      });
    });
  }

  me() {
    return this.state?.players.find((p) => p.playerId === this.playerId);
  }

  /** The one symbol shared by my card and the center card. */
  realMatch(): number {
    const mine = DECK.cards[this.me()!.currentCardId!].symbolIds;
    const center = DECK.cards[this.state!.centerCardId!].symbolIds;
    return mine.find((s) => center.includes(s))!;
  }

  /** A symbol that is definitely NOT on my card. */
  wrongSymbol(): number {
    const mine = DECK.cards[this.me()!.currentCardId!].symbolIds;
    return DECK.cards.flatMap((c) => c.symbolIds).find((s) => !mine.includes(s))!;
  }
}

function check(cond: unknown, msg: string) {
  if (!cond) throw new Error(`CHECK FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  const args = process.argv.slice(2);
  const full = args.includes("--full");
  const url = (args.find((a) => !a.startsWith("--")) || process.env.WSS_URL || "").trim();
  if (!url) {
    console.error("Usage: npm -w server run test-client <wss-url> [--full]");
    process.exit(1);
  }

  const alice = new Bot("Alice");
  const bob = new Bot("Bob");

  console.log(`[SETUP] ${url}${full ? " (full game)" : ""}`);
  await alice.connect(url);
  await bob.connect(url);

  console.log("[TEST] Alice creates a game");
  await alice.request({ action: "createGame", playerName: "Alice", gameType: "multiplayer" }, (m) => m.type === "joined", "joined");
  alice.log(`created ${alice.gameId}`);

  console.log("[TEST] Bob looks in the lobby browser");
  const list = await bob.request<Extract<ServerMessage, { type: "gamesList" }>>(
    { action: "queryGames" },
    (m) => m.type === "gamesList",
    "gamesList"
  );
  check(list.games.some((g) => g.gameId === alice.gameId && g.host === "Alice"), `lobby lists ${alice.gameId} hosted by Alice`);

  console.log("[TEST] Bob joins");
  await bob.request({ action: "joinGame", gameId: alice.gameId, playerName: "Bob" }, (m) => m.type === "joined", "joined");
  check(bob.gameId === alice.gameId, `Bob is in ${bob.gameId}`);

  console.log("[TEST] Alice starts");
  const started = (m: ServerMessage) => m.type === "stateUpdate" && m.state.status === "playing";
  const bobSeesStart = bob.waitFor(started, "Bob sees playing state");
  await alice.request({ action: "startGame", gameId: alice.gameId }, started, "playing state");
  await bobSeesStart;
  check(alice.me()?.currentCardId != null && bob.me()?.currentCardId != null, "both players were dealt a card");

  console.log("[TEST] Bob tries a symbol that isn't on his card");
  const wrong = await bob.request<Extract<ServerMessage, { type: "matchResult" }>>(
    { action: "submitMatch", gameId: bob.gameId, symbolId: bob.wrongSymbol() },
    (m) => m.type === "matchResult",
    "matchResult"
  );
  check(wrong.correct === false, "server rejected the bogus match");

  console.log("[TEST] Alice submits the real match");
  const before = alice.me()!.score;
  const right = await alice.request<Extract<ServerMessage, { type: "matchResult" }>>(
    { action: "submitMatch", gameId: alice.gameId, symbolId: alice.realMatch() },
    (m) => m.type === "matchResult",
    "matchResult"
  );
  check(right.correct === true, `server accepted symbol ${right.symbolId}`);
  await alice.waitFor((m) => m.type === "stateUpdate" && m.state.players.some((p) => p.playerId === alice.playerId && p.score === before + 1), "score update").catch(() => undefined);
  check(alice.me()!.score === before + 1, `Alice's score is now ${alice.me()!.score}`);

  console.log("[TEST] cleanupGames is not reachable over the socket");
  const notRoute = await alice.request<Extract<ServerMessage, { type: "error" }>>(
    { action: "cleanupGames" },
    (m) => m.type === "error",
    "error"
  );
  check(notRoute.code === "UNKNOWN_ACTION", "cleanupGames hits $default (UNKNOWN_ACTION)");

  if (full) {
    console.log("[TEST] Playing to game over");
    let turn = 0;
    while (alice.state!.status === "playing") {
      const p = turn++ % 3 === 2 ? bob : alice; // Alice wins ~2 rounds in 3
      if (p.me()!.currentCardId === null) continue;
      const centerBefore = p.state!.centerCardId;
      await p.request({ action: "submitMatch", gameId: p.gameId, symbolId: p.realMatch() }, (m) => m.type === "matchResult", "matchResult");
      for (const b of [alice, bob]) {
        if (b.state!.centerCardId === centerBefore && b.state!.status === "playing") {
          await b.waitFor((m) => m.type === "stateUpdate" && m.state.centerCardId !== centerBefore, "next round");
        }
      }
    }
    const final = alice.state!;
    const a = final.players.find((x) => x.name === "Alice")!;
    const b = final.players.find((x) => x.name === "Bob")!;
    check(final.status === "finished", `game finished: Alice ${a.score}, Bob ${b.score}`);

    console.log("[TEST] Leaderboard (all-time, time-attack-60)");
    // GSI reads are eventually consistent; give it a moment.
    await new Promise((r) => setTimeout(r, 1500));
    const lb = await alice.request<Extract<ServerMessage, { type: "leaderboard" }>>(
      { action: "queryLeaderboard", gameMode: "time-attack-60", period: "all-time", limit: 100 },
      (m) => m.type === "leaderboard",
      "leaderboard"
    );
    const mine = (id: string) => lb.entries.find((e) => e.playerId === id);
    check(mine(a.playerId)?.score === a.score, "Alice's final score is on the board");
    check(mine(b.playerId)?.score === b.score, "Bob's final score is on the board too (no overwrite)");
    const scores = lb.entries.map((e) => e.score);
    check(scores.every((s, i) => i === 0 || scores[i - 1] >= s), "board is sorted highest first");
  }

  console.log("[SUCCESS] all checks passed");
  alice.ws.close();
  bob.ws.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(`[ERROR] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
