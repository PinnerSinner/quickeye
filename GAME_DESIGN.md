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
1. **Round Timer** (✓) — Countdown from 30s, pulses red at ≤5s
   - File: `client/src/screens/GameScreen.tsx`
   - Uses `setInterval` to tick every 1000ms
   
2. **End-Game Screen** (✓) — Medal leaderboard (🏆🥈🥉)
   - Sorted rankings with play-again button
   - Dark overlay modal with elegant styling

3. **Persistent Player Names** (✓) — localStorage persistence
   - Key: `quickeye_player_name`
   - Survives page refresh and reconnection

4. **Browse Games UI** (✓) — Mock game list
   - "Browse Games" button on main menu
   - Shows host, player count, click-to-join flow
   - Real server integration pending

5. **Visual Polish Pass** (✓) — Extensive styling overhaul
   - Game board: 4x2 grid layout, larger symbols (2.2rem)
   - Gradients on cards, buttons, inputs; shadows everywhere
   - Cubic-bezier easing on all transitions for "snappy" feel
   - Pulse-match animation for correct selections
   - Consistent color palette: #667eea primary, #764ba2 accent
   
6. **Game Screen** — Enhanced layout & header
   - Larger title (2.5rem), subtle header border
   - Centered board with better spacing (3rem gap)
   - Card labels uppercase with tracking
   - Improved timer display (1.3rem, shadows)

7. **Lobby Screens** — Polished UX
   - Button shadows, improved hover animations
   - Gradient input fields with focus effects
   - Players list with subtle separators
   - Secondary buttons with gray gradients

### Next Steps
- Implement speed mechanic (shrinking/rotating symbols as timer runs)
- Wire browse games to server API
- Real artwork to replace emoji symbols

### Known Issues (Deferred)
- Card symbol mismatch between players (server/client deck version)
- Speed mechanic (shrinking symbols as timer runs)
- Real artwork (currently using emoji, will replace)

---
