# Quickeye — Game Design & Build Log

## Vision
A real-time multiplayer card-matching game inspired by Dobble/Spot It and Balatro's polish.
Target feel: fast, satisfying, social.

## Current Build Phase: Immediate Polish
Goal: Transform "kinda works" → "actually fun to play"

### Features to Add (In Order)
- [ ] Round timer countdown (30s → 0, game over when empty)
- [ ] End-game screen (winner, scores, play again)
- [ ] Browse available games (lobby list instead of code copy-paste)
- [ ] Better visuals (card feedback, symbol sizing, animations)
- [ ] Persistent player names (localStorage)
- [ ] "Leave game" / disconnect handling

### Architecture Notes
- **Client-side only so far** — no server changes needed yet
- Timer uses React state + useEffect interval
- Lobby list is simulated (WebSocket broadcast of active games will come later)
- Player names stored in localStorage under `quickeye_player_name`

### Known Issues (Deferred)
- Card symbol mismatch between players (server/client deck version)
- Speed mechanic (shrinking symbols as timer runs)
- Real artwork (currently using emoji, will replace)

---
