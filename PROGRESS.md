# Quickeye — Progress Log

A running record of what's built, why, and what's next. Newest phase at the top.
See [CLAUDE.md](CLAUDE.md) for the project brief and locked-in decisions.

---

## Status at a glance

| Area | State |
| --- | --- |
| Deck generation (`/shared`) | ✅ Done, 15 tests |
| Game logic — deal/match/scoring (`/shared`) | ✅ Done, 10 tests |
| Real-time backend (`/server` + `/infra`) | ✅ Built & synthesizes; ⏳ not yet deployed |
| Frontend (`/client`) | ⛔ Not started |

**Total tests passing: 25.**

---

## Phase 2 — Real-time multiplayer plumbing (WebSocket + Lambda + DynamoDB)

**Goal (v1 priority #2):** get real-time game-state sync working over serverless
infrastructure with placeholder UI to come later.

### What the architecture is (plain English)
- **API Gateway WebSocket API** — a persistent two-way "phone line" so the server
  can *push* game updates to every player instantly (normal HTTP can't do that).
  It routes each incoming message to a Lambda based on the message's `action` field.
- **Lambda functions** — one small function per action; they run only when a
  message arrives (pay-per-use, fits AWS credits).
- **DynamoDB** — two tables holding all state, with TTL auto-cleanup of abandoned
  games:
  - `ConnectionsTable`: `connectionId → { gameId, playerId }` (who is this socket?)
  - `GamesTable`: `gameId (room code) → full GameState` (the authoritative truth).

### What was built

**`/shared` (new game modules — used by server now, client later):**
- `gameTypes.ts` — `GameState`, `Player`, `GameStatus`, and `GAME_CONFIG`
  (tunable params: min/max players 2–6, deck size, TTL, speed-round timing).
- `messages.ts` — the WebSocket message protocol as TypeScript discriminated
  unions (`ClientMessage` browser→server, `ServerMessage` server→browser).
- `gameLogic.ts` — pure functions (no network/db) so server and future client
  practice mode share identical rules:
  - `shuffledCardIds` (Fisher–Yates, injectable RNG for deterministic tests)
  - `dealInitial` (center card + one card per player)
  - `applyMatch` (authoritative match validation + next-state computation)
  - `generateRoomCode` (4-char, ambiguity-free alphabet)
- `gameLogic.test.ts` — 10 tests covering shuffle, deal, correct/incorrect
  matches, unknown players, and game-over on empty pile.

**`/server` (Lambda handlers):**
- `lib/dynamo.ts` — DynamoDB Document-client access layer. Includes
  `putGameIfCenterUnchanged` — **optimistic locking** so two simultaneous correct
  matches can't both advance the game (the loser is told "too slow").
- `lib/apigw.ts` — pushes messages back to clients via the API Gateway Management
  API; `broadcast` fans out to all players, silently dropping dead sockets.
- `lib/util.ts` — response helpers, TTL calculation, random ids.
- `handlers/`:
  - `connect.ts` — records the new socket (identity filled in later).
  - `disconnect.ts` — marks player disconnected, notifies others, cleans up.
  - `createGame.ts` — host creates a room, gets a unique code.
  - `joinGame.ts` — join by code (validates exists / not started / not full).
  - `startGame.ts` — host-only; deals opening layout, broadcasts playing state.
  - `submitMatch.ts` — **authoritative anti-cheat path**: server re-checks the
    match; client's claim is only a hint. Uses optimistic locking on write.
  - `default.ts` — friendly error for unrecognized actions.

**`/infra` (AWS CDK stack):**
- `lib/quickeye-stack.ts` — provisions the 2 DynamoDB tables (on-demand billing,
  TTL enabled), 7 Lambda functions (bundled from TypeScript via esbuild, which
  also pulls in `@quickeye/shared`), and the WebSocket API with all routes wired.
  IAM: each handler gets table read/write; broadcasting handlers get
  `ManageConnections`. Outputs the `wss://` URL for the client.
- `bin/quickeye.ts`, `cdk.json`, `tsconfig.json` — CDK app scaffolding.
- **Verified with `cdk synth`** (dry run) — stack is valid and all Lambdas bundle.

### Game flow (how it fits together)
1. Client opens socket → `$connect` stores the connection.
2. Client sends `createGame` → server makes a room, replies `joined` (with the
   player's `playerId` + initial state).
3. Others send `joinGame` with the code → added to lobby; everyone gets a
   `stateUpdate` broadcast.
4. Host sends `startGame` → `dealInitial` deals cards; `stateUpdate` broadcast.
5. Player sends `submitMatch` with a `symbolId` → server validates via
   `applyMatch`; on success the player's card becomes the new center, they draw
   & score, and everyone gets a `stateUpdate`. Empty draw pile → game finishes.

### Verification done
- `npm test` → 25/25 passing (deck + game logic).
- `npx tsc -p server/tsconfig.json --noEmit` → server typechecks clean.
- `cd infra && npx cdk synth` → stack synthesizes, all 7 Lambdas bundle.

### Known gaps / deferred (prototype-first)
- **Not deployed to AWS yet** — synthesis verified, but `cdk deploy` (and a
  one-time `cdk bootstrap`) still needs to run against the real account.
- **Reconnection handling** — a dropped player is marked disconnected but not
  re-linkable yet (flagged in CLAUDE.md as a post-core-loop item).
- **Speed-variant mechanic** (countdown, shrink/rotate) — config values exist in
  `GAME_CONFIG` but no round timer logic yet.
- **IAM least-privilege** — handlers currently get RW on both tables for
  simplicity; scope down in a later hardening pass.

### How to deploy and test
```bash
# one-time per account/region:
cd infra && npx cdk bootstrap
# deploy (prints the wss:// WebSocket URL on completion):
npx cdk deploy

# Copy the wss:// URL from the output, then test:
npm install -w server
npm -w server run test-client wss://your-api-gateway-url/prod
```

The test client simulates a full game (create → join → start → match), so you
can verify the backend is live and responding before building the UI.

---

## Phase 1 — Deck generation algorithm (`/shared`)

**Goal (v1 priority #1):** the mathematical core — every pair of cards shares
exactly one symbol — unit-tested in isolation.

- Implemented as a **Steiner system S(2, 8, 57)** via a projective plane PG(2, 7):
  57 cards, 8 symbols each, 57-symbol pool, guaranteed one-and-only-one match
  between any two cards.
- `deckGeneration.ts` (`generateDeck`, `findMatch`, `isValidMatch`) +
  `deckGeneration.test.ts` (15 tests) verifying deck size, the core invariant
  across all 1,596 card pairs, symbol distribution, and API behavior.
- See [shared/README.md](shared/README.md) for the full algorithm write-up.

---

## Repo shape (per CLAUDE.md)

```
/client   React SPA (Amplify Hosting)            — not started
/server   Lambda handlers (WebSocket routes)     — built
/shared   deck-gen + game logic + message types  — built, tested
/infra    AWS CDK stack                          — built, synthesizes
```
