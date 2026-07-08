# Quickeye Easter Egg - Testing Guide

## Quick Start

1. **Audio Setup** (Required for full experience):
   - Copy audio files to `client/public/audio/` - see `AUDIO_SETUP.md`
   - Without audio files, visual effects still work, sounds just won't play

2. **Start Dev Server**:
   ```bash
   cd client
   npm run dev
   ```
   - Opens on http://localhost:3000

3. **Open Browser**:
   - Navigate to http://localhost:3000
   - You should see the Quickeye home screen with centered Q and eye logo

## Features to Test

### Eye Tracking (360° Smooth Following)

1. **Test Movement**:
   - Move mouse around the screen
   - Observe the eye iris following your cursor
   - Try moving in circles - iris should smoothly track

2. **Test Centering**:
   - Move cursor away from the eye toward edge of screen
   - Iris should continue tracking smoothly
   - Move cursor completely off-screen (e.g., to taskbar)
   - Iris should center/reset

3. **Test Direct Hover**:
   - Hover directly on the eye
   - Iris should center (not offset)
   - This prevents "crossing eyes" effect

### Logo Redesign

1. **Visual Check**:
   - Logo should be centered at bottom of black header
   - Should show large glowing "Q" (magenta/cyan neon glow)
   - Eye should be positioned above/overlapping the Q
   - Glow should pulse continuously (2-second cycle)

2. **Hover Effect**:
   - Hover over logo area
   - Should scale up slightly and rotate (-2deg)
   - Smooth animation

### Easter Egg (5-Click Sequence)

**Important**: Audio files needed for full experience. Visual effects work without audio.

1. **First Click**:
   - Click the eye or Q logo
   - Expected: Eye squints ("ouch" expression), punch sound plays (or fails gracefully)
   - Eye should be less reactive after 2.8 seconds

2. **Second Click**:
   - Click again within 2.8 seconds
   - Expected: Eye gets more annoyed, punch sound
   - Eye lid pulls up more

3. **Third Click**:
   - Expected: "angry" expression, punch sound, subtle shaking starts

4. **Fourth Click**:
   - Expected: "furious" expression, punch sound, intense vibration/shaking

5. **Fifth Click** (The Payoff!):
   - Expected sequence:
     - Scream sound plays (angry yell)
     - Eye turns to 🖕 middle finger emoji
     - Extremely fast vibration/shaking
     - Logo vibrates at ~125Hz (every 8ms)
   - After ~400ms:
     - Poof sound (explosion whoosh)
     - Censor beep sound (bleeeep)
   - After ~800ms:
     - 😂 laugh emoji replaces middle finger
     - Bounce animation
   - After ~2s:
     - Back to normal eye
     - Ready for next sequence

### Audio Verification

Test each sound plays when expected:

| Click | Expected Sound |
|-------|-----------------|
| 1-4 | Punch (randomly chosen from 4 options) |
| 5+ | Angry scream |
| +400ms | Poof + Censor beep |

**Testing without audio files**:
- Sounds won't play, but visual effects should show timeline:
  - 0ms: Middle finger appears
  - 400ms: (Silent poof moment)
  - 800ms: Laugh emoji appears
  - 2000ms: Normal eye

## Common Issues & Solutions

### Eyes Not Tracking
- **Issue**: Iris stays centered, doesn't follow mouse
- **Solution**: 
  - Check browser console for errors (F12)
  - Try hovering further away from eye
  - Refresh page and try again
  - Eye tracking uses `getBoundingClientRect()` - may need a fresh render

### Audio Files Not Playing
- **Issue**: Sounds don't play at all
- **Solution**: 
  - Check if files exist in `client/public/audio/`
  - Verify filenames match exactly (case-sensitive)
  - Check browser console for 404 errors
  - Browser autoplay may be blocked - try clicking first
  - Some browsers require HTTPS for audio (dev mode may work fine)

### Easter Egg Not Triggering
- **Issue**: Nothing happens when clicking eye
- **Solution**:
  - Make sure you're clicking the eye or Q logo
  - Verify you're on the home screen
  - Count clicks - need 5 within the timeout
  - Check browser console for JavaScript errors
  - Try clicking the Q instead of the eye

### Glow Not Visible
- **Issue**: Q logo isn't glowing or isn't centered
- **Solution**:
  - Refresh page (Ctrl+F5 to clear cache)
  - Check if CSS animation is enabled in browser
  - The glow should pulse - look for magenta/cyan color shift
  - Should be most visible in dark theme

### Eye Expression Transitions Janky
- **Issue**: Eye expressions not smooth
- **Solution**:
  - This is normal - eyelid animations use CSS transitions
  - Check browser performance (might be slow on older machines)
  - Reduce other browser tabs to free resources

## Visual Reference

### Home Screen Layout
```
┌─────────────────────────────────┐
│  [Physics Header with shapes]   │
│                                 │
│              👁️                 │
│              Q                  │
│         (glowing neon)          │
│                                 │
├─────────────────────────────────┤
│  Name Input    │ PLAY SOLO      │
│ Color Carousel │ MULTIPLAYER    │
│                │ LEADERBOARD    │
└─────────────────────────────────┘
```

### Expression States
```
Normal:   ⭕ (normal iris)
Ouch:     ⭕ (smaller iris, squinting)
Annoyed:  ⭕ (more squinting, angry look)
Angry:    ⭕ (very squinted, intense stare)
Furious:  ⭕ (almost closed, tiny pupil)
Middle:   🖕 (vibrating rapidly)
Laugh:    😂 (bounce animation)
```

## Performance Testing

- **Eye Tracking**: Should be smooth at 60fps (requestAnimationFrame)
- **Shaking**: Should feel responsive, not laggy
- **Audio**: Should play immediately (or fail quietly)
- **CSS Glow**: Should pulse smoothly without jank

## Browser Testing

Tested/Compatible with:
- ✅ Chrome/Chromium 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Video Demo Steps

If recording a video of the feature:

1. Show home screen with centered glowing Q
2. Move mouse around - show eye tracking
3. Click eye 5 times in sequence
4. Show progression: ouch → annoyed → angry → furious
5. Final click shows 🖕 then 😂
6. Return to normal

Total demo: ~15 seconds

## Debug Mode

To check if audio is loading, open browser DevTools (F12):
- Console tab: Any 404 errors?
- Network tab: Filter by audio - do .mp3 files show?
- Sources: Is code executing?

Expected console output:
```
(no errors - silent on success)
(or: failed to load /audio/punch-1.mp3 404)
```

---

**Need Help?** Check the code:
- Eye tracking: `client/src/quickeye/QuickeyeGame.tsx` line ~1150
- Easter egg: `client/src/quickeye/QuickeyeGame.tsx` line ~659
- Audio setup: `client/src/quickeye/audio.ts` line ~260
