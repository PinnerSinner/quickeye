# @quickeye/server

Lambda handlers and utilities for the Quickeye WebSocket API backend.

## Structure

```
src/
  handlers/          — Lambda entry points (one per WebSocket route)
    connect.ts       — $connect route (new socket)
    disconnect.ts    — $disconnect route (socket closed)
    default.ts       — $default route (unknown action)
    createGame.ts    — action: "createGame"
    joinGame.ts      — action: "joinGame"
    startGame.ts     — action: "startGame"
    submitMatch.ts   — action: "submitMatch" (authoritative anti-cheat)
  lib/
    dynamo.ts        — DynamoDB Document client access + optimistic locking
    apigw.ts         — API Gateway Management API for pushing to clients
    util.ts          — helpers (response codes, TTL, random ids)

test-client.ts       — Local test script (see below)
```

## Building

```bash
npm run build       # TypeScript → JavaScript
npm run typecheck   # Check types without emitting
```

## Testing with the local client

Once you've deployed the stack (`cdk deploy` in `/infra`), you'll get a `wss://` URL.
Use the test client to verify the full flow:

```bash
npm install         # (one-time; includes ws + ts-node)
npm run test-client wss://your-api-gateway-url/prod
```

The script:
1. Simulates two players (Alice and Bob)
2. A creates a game
3. B joins using the code
4. A starts the game
5. A submits a match attempt
6. Prints results

Example output:
```
[Alice] connected
[Bob] connected
[SETUP] connecting players...
[TEST] Player A creates a game
[Alice] created game QCKE, playerId=abc123...
[TEST] Player B joins game QCKE
[Bob] joined game QCKE, playerId=def456...
[TEST] Player A starts the game
[Alice] game started, dealing done. Your card: 5, center: 42
[Bob] game started. Your card: 13, center: 42
[TEST] Player A submits a match attempt
[Alice] CORRECT! symbolId=0, score now 1. Game over: false
[SUCCESS] test flow completed without errors
```

## Notes on the handlers

- **`submitMatch` is the anti-cheat path**: the client sends only a `symbolId`, and
  the server re-derives both cards and re-validates the match using the shared
  `applyMatch` logic. The client's guess is only a hint — trust the server.
- **Optimistic locking**: two simultaneous correct matches can't both advance the
  game. The first write succeeds; the second is told "too slow".
- **Broadcasting**: all handlers that change state use `broadcast` to push updates
  to every player, so the UI stays in sync without polling.
- **Known gaps** (prototype):
  - Reconnection handling not yet implemented
  - No explicit error recovery (assumes transient errors are rare with Lambda)
