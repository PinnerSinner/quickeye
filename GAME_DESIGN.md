# Quickeye — Game Design & Build Log

## Vision
A real-time multiplayer card-matching game inspired by Dobble/Spot It and Balatro's polish.
Target feel: fast, satisfying, social.

## Current Build Phase: Immediate Polish
Goal: Transform "kinda works" → "actually fun to play"

### Features to Add (In Order)
- [x] Round timer countdown (30s → 0, game over when empty) — Done
- [x] End-game screen (winner, scores, play again) — Done
- [x] Persistent player names (localStorage) — Done
- [x] Browse available games (UI ready, mock data) — Done
- [ ] Better visuals (card feedback, symbol sizing, animations)
- [ ] Connect browse to real server API (broadcast active games)
- [ ] "Leave game" / disconnect handling

### Architecture Notes
- **Client-side only so far** — no server changes needed yet
- Timer uses React state + useEffect interval
- Lobby list is simulated (WebSocket broadcast of active games will come later)
- Player names stored in localStorage under `quickeye_player_name`

## Build Log: Session 2

### Completed (2026-07-06)
1. **Round Timer** — Implemented countdown from 30s, pulses red at ≤5s
   - File: `client/src/screens/GameScreen.tsx`
   - Uses `setInterval` to tick every 1000ms, stops when time reaches 0
   
2. **End-Game Screen** — Added medal leaderboard (🏆🥈🥉)
   - File: `client/src/screens/GameScreen.tsx` + `.css`
   - Shows final scores sorted by rank, "Play Again" button reloads page
   - Dark overlay with centered modal for focus

3. **Persistent Player Names** — Saves to localStorage
   - File: `client/src/App.tsx`
   - Key: `quickeye_player_name` — persists across sessions

4. **Browse Games UI** — Lobby list replaces code copy-paste
   - File: `client/src/screens/LobbyScreen.tsx` + `.css`
   - New "Browse Games" button on main menu
   - Shows mock available games with host name, player count
   - Click to join flow (will wire to real server broadcast later)
   - Styled with hover effects and join hint

### Next Steps
- Gather UI polish feedback on card layout, symbol sizing, spacing
- Wire browse games to server-side game broadcast
- Consider speed mechanic (symbol shrink/rotate as timer runs)

### Known Issues (Deferred)
- Card symbol mismatch between players (server/client deck version)
- Speed mechanic (shrinking symbols as timer runs)
- Real artwork (currently using emoji, will replace)

---
