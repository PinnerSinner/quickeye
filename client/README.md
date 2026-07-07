# @quickeye/client

React SPA client for Quickeye multiplayer game. Connects to the WebSocket API and provides real-time game UI.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Opens http://localhost:3000. Hot-reload enabled.

## Building

```bash
npm run build
```

Outputs optimized bundle to `dist/`.

## Environment Variables

Create a `.env.local` file (or set in Amplify console):

```
VITE_WSS_URL=wss://your-api-gateway-url/prod
```

Get the WebSocket URL from `cdk deploy` output in `/infra`.

## Deployment via AWS Amplify Hosting

1. **Connect repo** — AWS Amplify → New app → Connect GitHub
2. **Build settings** — Set to:
   ```
   Build command:    npm -w client run build
   Build output dir: client/dist
   ```
3. **Environment variables** — In Amplify console, add:
   ```
   VITE_WSS_URL = wss://gkj3douxjj.execute-api.us-east-1.amazonaws.com/prod
   ```
4. **Deploy** — Push to main, Amplify builds and deploys automatically

The client will pre-fill the WebSocket URL from the environment variable but allow users to override it if needed.

## Game Flow

The entire UI is a single game surface (`client/src/quickeye/QuickeyeGame.tsx`)
ported from the design prototype:

1. **Home** — set your name + player colour (both persisted to `localStorage`),
   then choose Play Solo, Multiplayer, or Leaderboard.
2. **Solo** — three client-side modes against simulated opponents:
   - **Marathon** — most matches in 60s
   - **Race the Clock** — first to 7 matches, beat your best time
   - **Power Play** — 60s with shrinking/rotating symbols and Pop / Reveal /
     Halve powerups (keys `1` `2` `3`, or tap powerup tokens on the board)
3. **Multiplayer** — Browse / Create / Join. Create and Join talk to the
   WebSocket backend (real server-issued room codes).
4. **Playing** — spot the one symbol your hand shares with the Match Board;
   live standings animate as scores change.
5. **Game Over** — Standings / Compare views, then Play Again or Home.

> Solo play is intentionally 100% client-side — no server round-trip. Real-time
> **server-driven multiplayer gameplay** is the next integration step; today,
> joining a room falls into the local loop after the backend handshake.

## Architecture

`client/src/quickeye/` — the game, split into pure + imperative pieces:

- **`glyphs.ts`** — palette, the 18-glyph placeholder set, colour carousel data,
  leaderboard seed data, and pure helpers (`makeRound`, `glyphStyle`, `shuffle`).
- **`canvas.ts`** — `drawShape` (2D-canvas geometry) + the header physics-field
  shape styler.
- **`audio.ts`** — `QuickeyeAudio`, a procedural Web Audio engine (no audio
  files): match "chunk", wrong buzz, blip, pop, win/lose fanfare.
- **`quickeye.css`** — keyframes (blink, pulse, screenshake, glow, shard…) and
  hover classes.
- **`QuickeyeGame.tsx`** — reactive state in one `st` object (mirrored to a ref
  so interval/listener callbacks read the latest), all nine screens, and the
  canvas/audio loops driven imperatively through refs.

- **Hooks** (`src/hooks/`) — `useWebSocket` (typed send/on over the socket).
- **Messages** — typed via `@quickeye/shared` discriminated unions.
- **Bauhaus design system** — Outfit type, red `#D02020` / blue `#1040C0` /
  yellow `#F0C020`, 4px black borders, hard offset shadows.
