# Quickeye Multiplayer Integration

## What Was Fixed & Wired

### 1. Profanity Filter ✓
**Problem:** Bad words could be saved to localStorage without validation.
**Fix:** 
- Rewrote `profanityFilter.ts` to work client-side (simple word list, no npm deps)
- Added import to `QuickeyeGame.tsx`
- Profanity check on name save clears the field if detected
- Server-side still validates (handlers check `containsProfanity()`)
- Delete any bad records from localStorage manually: `localStorage.removeItem("quickeye_player_name")`

### 2. Shape Visibility ✓
- Brightened palette: cyan, lime, magenta, orange, pink (instead of dark red/blue/yellow)
- Expanded glyphs from 18 → 32 unique symbol/color combinations
- All now highly visible on dark backgrounds

### 3. Room Code Stability ✓
- Fixed code regeneration on `goCreate()` 
- Code now persists for entire game session until new room created

### 4. Leaderboard Scores ✓
- Made realistic and achievable:
  - Marathon: 7–12 (was 11–19)
  - Race: 28–41s (longer = harder; was 12–18s)
  - Power: 8–14 (was 14–24)

### 5. Real-Time Multiplayer Plumbing ✓

#### Client-Side Wiring (`App.tsx`)
```typescript
// Now passes these to QuickeyeGame:
- onStartGame: () void         // Host starts the game
- onSubmitMatch: (gameId, symbolId) => void
- gameState: ServerGameState   // Syncs with server
- matchResult: MatchResult     // Server match validation
- error: string | null         // Server errors
```

#### QuickeyeGame State (`src/quickeye/QuickeyeGame.tsx`)
Added to state tracking:
- `isMultiplayer: boolean` — Are we in a server-driven game?
- `gameId: string | null` — Room code from server
- `playerId: string | null` — Our player ID on server
- `serverError: string | null` — Last server error

#### Match Submission Flow
When a player clicks a symbol:
1. If **solo** → validate locally, update score immediately (existing logic)
2. If **multiplayer** → submit to server via `onSubmitMatch()`
3. Server validates the match server-side
4. Server broadcasts `matchResult` back to all players
5. Client receives result via `matchResult` prop, updates UI accordingly

#### Game State Sync (`useEffect` in QuickeyeGame)
```typescript
- Listens for props.gameState → updates isMultiplayer, gameId, playerId
- Listens for props.matchResult → plays audio, updates scores
- Listens for props.error → displays error to player
```

### 6. Background Music Plumbing ✓
Added to `QuickeyeAudio`:
- `playBGM(src: string)` — Load and loop a track
- `stopBGM()` — Stop playback
- `setBGMVolume(0-1)` — Adjust volume

Wired to game views:
- **Home/Menu screens** → Play menu music at 35% volume
- **Gameplay** → Play gameplay music at 40% volume
- **Game over** → Stop music

Music files expected at:
- `/public/audio/menu-loop.mp3` (30–60s loop)
- `/public/audio/gameplay-loop.mp3` (2–3 min loop)

## What You Need to Do Next

### 1. Add Audio Files
Download open-source tracks from:
- [Freepd.com](https://freepd.com) — curated, CC-licensed
- [Incompetech.com](https://incompetech.com) — royalty-free
- [Freesound.org](https://freesound.org) — user-contributed

Place in `client/public/audio/`:
- `menu-loop.mp3` — upbeat, sets mood, short loop
- `gameplay-loop.mp3` — energetic but not intrusive, long loop

### 2. Verify WebSocket Connection
In `.env.local` (or `amplify.yml`), ensure:
```
VITE_WSS_URL=wss://your-api-gateway-endpoint/prod
```

Test: Open the live game → multiplayer create/join should log "Joined game: XXXX"

### 3. Lambda Handlers Already Exist
Server-side is ready. Check that these handlers are deployed:
- `createGame` — Generate room code, emit `joined` message
- `joinGame` — Add player to room, broadcast state
- `startGame` — Start the game, emit `stateUpdate`
- `submitMatch` — Validate match server-side, emit `matchResult` to all players

These should be live; if not, redeploy the server stack via CDK.

### 4. Test Multiplayer Flow
1. Open game in two browser tabs
2. Tab A: Multiplayer → Create Game (should see room code)
3. Tab B: Multiplayer → Join → Enter code
4. Tab A: Start Game (game begins on both)
5. Tab B: Click a symbol → should see result from server

**Known gap:** Reconnection handling on dropped WebSocket — works for the happy path, gracefully degrades if connection drops.

## Architecture

```
Client (React)
  ├─ App.tsx
  │   └─ Manages WebSocket, routes messages to QuickeyeGame
  │
  ├─ QuickeyeGame.tsx
  │   ├─ Solo: Full local logic (existing)
  │   └─ Multiplayer: Submit actions to server, sync state from props
  │
  └─ audio.ts
      └─ Procedural SFX + BGM playback

Server (Lambda + DynamoDB)
  ├─ $connect → Record connection
  ├─ createGame → Generate room, emit joined
  ├─ joinGame → Add player, broadcast state
  ├─ startGame → Begin, emit stateUpdate
  ├─ submitMatch → Validate, emit matchResult
  └─ $disconnect → Cleanup
```

## Debugging Tips

**WebSocket not connecting?**
- Check `VITE_WSS_URL` is set in build env
- Open DevTools Console → look for connection logs
- Verify API Gateway WebSocket API is deployed

**Match submission not reaching server?**
- In App.tsx, add `console.log("Sending:", msg)` in the `send()` callback
- In Lambda, add CloudWatch logs: `console.log("submitMatch:", event)`

**Match result not coming back?**
- Check Lambda handler returns `ok()` after `sendToConnection()`
- Verify the connection ID is correct (should be in state)

**Music not playing?**
- Check `/public/audio/` files exist and are readable
- Verify browser autoplay policy (user gesture required)
- Open DevTools Network tab → look for 404 on audio files

## Next: Game Design Features

Once multiplayer is stable, consider adding:
1. **Spectate mode** — Watch other players' rounds
2. **Daily challenges** — Same deck each day, global leaderboard
3. **Achievements** — Unlock badges (10-match streak, beat friend, etc.)
4. **Draft mode** — Players pick symbols collaboratively
5. **Difficulty tiers** — Easy/normal/hard with tuned timing

---

**Last updated:** July 7, 2026
**Status:** Multiplayer wiring complete, audio infrastructure ready
**Deploy:** Push to Amplify, verify live at marcoverse.link
