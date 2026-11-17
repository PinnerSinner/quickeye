# @quickeye/server

Lambda handlers and helpers for the Quickeye WebSocket API backend.

## Structure

```
src/
  handlers/            Lambda entry points
    connect.ts         $connect: new socket opened, record it
    disconnect.ts      $disconnect: socket closed; host leaving a lobby deletes it,
                       otherwise the player is marked disconnected
    default.ts         $default: unknown action, replies UNKNOWN_ACTION
    createGame.ts      action "createGame": new room, caller is host
    joinGame.ts        action "joinGame": join a lobby by room code
    startGame.ts       action "startGame": host only, deals cards
    submitMatch.ts     action "submitMatch": authoritative match check (anti-cheat);
                       at game over it writes the leaderboard rows
    queryGames.ts      action "queryGames": lobby browser list
    queryLeaderboard.ts action "queryLeaderboard": top N scores, highest first
    cleanupGames.ts    NOT a WebSocket route. EventBridge runs it every 15 min
  lib/
    dynamo.ts          DynamoDB access (tables, GSIs, optimistic locking)
    apigw.ts           pushes messages to clients via the Management API
    lobby.ts           pure lobby rules: what's listed, what's stale
    leaderboard.ts     pure leaderboard rules: row building, keys, limits
    util.ts            response codes, TTL, random ids

local/devServer.ts     the whole backend locally, no AWS needed (see below)
test-client.ts         smoke test against a live or local backend
__tests__/             unit tests (run from the repo root with npm test)
```

## How cleanupGames is triggered

It's wired to an EventBridge rule (`CleanupGamesSchedule` in
`infra/lib/quickeye-stack.ts`) that fires every 15 minutes. It is deliberately
not a WebSocket route: anything routed on the API can be sent by anyone with the
wss:// URL straight from browser devtools, and a cleanup job has no business
being callable like that. Only EventBridge has permission to invoke it.

Each run deletes only lobby games that are stale, meaning older than
`STALE_LOBBY_SECONDS` (10 minutes) or whose host's socket is gone. Games in
progress are never touched; DynamoDB TTL expires those after 6 hours. Deletes are
conditional on the game still being in the lobby, so a game that starts during
the cleanup survives.

To run it by hand in AWS, use "Test" on the CleanupGamesFn function in the Lambda
console (any test event will do). Locally, see below.

## Building

```bash
npm run build       # TypeScript -> JavaScript
npm run typecheck   # check types without emitting
```

In AWS the handlers are bundled by CDK (esbuild), which also pulls in
`@quickeye/shared`.

## Running the backend locally

```bash
npm -w server run dev:local
```

That starts the real handlers behind a local WebSocket server on
`ws://localhost:3001`, with an in-memory DynamoDB (dynalite) set up with the
same tables and indexes as the CDK stack. Point the client at it:

```bash
cd client && VITE_WSS_URL=ws://localhost:3001 npx vite
```

Run the scheduled cleanup on demand with
`curl -X POST http://localhost:3002/_cleanup`. Data disappears when you stop the
server.

## Smoke test

```bash
npm -w server run test-client wss://your-api-id.execute-api.us-east-1.amazonaws.com/prod
npm -w server run test-client ws://localhost:3001 -- --full
```

It plays as two players, Alice and Bob, and checks: the game shows in the lobby
browser, joining and starting work, a bogus symbol is rejected, the real match
(worked out from the shared deck) is accepted, and `cleanupGames` can't be called
over the socket. `--full` also plays to game over and checks both final scores
are on the leaderboard in the right order. On the live stack that puts Alice and
Bob on the real leaderboard, so leave `--full` off there unless you want that.

## Notes on the handlers

- **`submitMatch` is the anti-cheat path**: the client sends only a `symbolId`;
  the server re-derives both cards and re-validates using the shared `applyMatch`.
- **Leaderboard scores are written only by the server**, from its own game state
  at game over. There is no client message that carries a score.
- **Optimistic locking**: two simultaneous correct matches can't both advance the
  game. The first write wins; the second is told it wasn't correct.
- **Broadcasting**: handlers that change state push the new state to every player.
- **Known gaps**: no reconnection (a dropped socket can't rejoin its game), no
  explicit `leaveGame` action, and the full state, draw pile included, is
  broadcast. See PROGRESS.md.
