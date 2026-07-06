# Project: Quickeye

## What this is
A fully virtual, browser-based, real-time multiplayer game inspired by Dobble
(Spot It!) — NOT a direct reskin. Quickeye adds a speed-pressure twist: each round
has a visible countdown, and symbols shrink and/or rotate as time runs out, adding
tension beyond pure reflexes. No physical cards — everything (cards, UI, environment,
textures) is designed digitally. This is the owner's first app ever, so favor clear
explanations and incremental steps over dense jargon. Explain *why* before *what*
when introducing a new AWS service or web dev concept for the first time.

## Speed-variant mechanic (core differentiator from Dobble)
- Each round has a visible countdown timer.
- As the timer runs down, symbols on the shared/center card progressively shrink
  and/or rotate, making matches harder to spot the longer a round drags on.
- Design goal: reward fast recognition without making the game unplayable for
  slower/newer players in early rounds — tune shrink/rotate rate so early seconds
  are easy, later seconds are frantic.
- Exact shrink %, rotation speed, and countdown length are tunable parameters —
  not fixed yet, treat as config values rather than hardcoded.
- Future twist under consideration (not v1): deck mutation, where symbols rotate
  in from a larger pool between rounds so the deck can't be memorized. Note for
  later, not part of current scope.

## Core game rule (for the deck algorithm)
Every card has N symbols. Any two cards in the deck share **exactly one** matching
symbol — no more, no less. This is achievable via finite projective plane construction:
for a prime power n, you get n+1 symbols per card and n²+n+1 total cards, using
(n+1)² total symbols. Start with a small, well-tested n (e.g. n=7 → 8 symbols/card,
57 cards) since that matches classic Dobble.

## Scope for v1 (current phase)
- **Playable prototype first.** Placeholder art/shapes/emoji for symbols — no custom
  illustration work yet. Polish (real card art, environment, textures) comes later,
  once the core loop (deal cards, spot match, score, win condition) works end to end
  over real-time multiplayer.
- Priority order: (1) deck-generation algorithm, unit tested in isolation, (2)
  real-time multiplayer plumbing with placeholder UI, (3) game logic/scoring/turns,
  (4) polish pass on art/UI/environment.

## Architecture decisions (already made — don't relitigate without discussion)
- **Hosting:** AWS (owner has an AWS account + credits, and is AWS-certified —
  comfortable with AWS concepts, just new to building apps generally).
- **CI/CD:** AWS Amplify Hosting, for the frontend build/deploy pipeline.
- **Real-time transport:** Serverless — API Gateway WebSocket API + Lambda +
  DynamoDB, rather than a self-managed Socket.io/ECS setup. Rationale: no
  container/scaling decisions needed for a prototype, pay-per-use fits credits,
  DynamoDB naturally models connection state (connectionId → playerId/gameId) with
  TTL cleanup for abandoned sessions. Can migrate to Fargate + Socket.io later if
  Lambda's connection model becomes limiting.
- **Server authority:** All match validation (does this symbol actually match?) happens
  server-side in Lambda. Never trust client-submitted matches — prevents cheating via
  devtools.
- **Frontend:** React SPA, deployed via Amplify Hosting.
- **Repo shape (monorepo):**
  - `/client` — React app
  - `/server` — Lambda handlers ($connect, $disconnect, joinGame, submitMatch, etc.)
  - `/shared` — deck-generation + match-validation logic, used by both client
    (practice mode / instant feedback) and server (authoritative validation)
  - `/infra` — AWS CDK stack (API Gateway WebSocket API, Lambda, DynamoDB, Amplify config)

## Open items / not yet decided
- Exact symbol set / theme for placeholder art
- Matchmaking approach (private room codes vs. public matchmaking) — assume private
  room codes for v1 unless told otherwise
- Player count per match — assume 2–6 for v1 unless told otherwise
- Reconnection handling on dropped connections — flag as a known gap for prototype,
  address after core loop works

## Working style
- Owner is new to building apps — check in plainly at major decision points, don't
  assume familiarity with terms like CDK, WebSocket lifecycle, etc. on first mention.
- Prototype-first: get something playable and ugly before making it pretty.


## Near-term task: real CI (not yet set up)


No automated pipeline exists yet — commits currently land in GitHub with nothing
running against them.
Next step when convenient: add a GitHub Actions workflow (.github/workflows/ci.yml)
that runs npm test on every push/PR, so broken code is caught automatically.
Actual CD (auto-deploy via Amplify) comes later, once there's a frontend worth
deploying — don't set this up prematurely.