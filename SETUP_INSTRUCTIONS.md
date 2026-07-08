# 🎯 Quickeye Easter Egg Setup - Complete Instructions

## What You've Got

Your Quickeye game now has:
- ✅ **360° eye tracking** - Eye iris follows cursor smoothly in all directions
- ✅ **Redesigned centered Q logo** - Glowing neon Q at bottom of home screen
- ✅ **Interactive 5-click easter egg** - Eye poke sequence with expressions and sounds
- ✅ **Full audio system** - Ready to play punch, scream, poof, and beep sounds

## Step 1: Run the App

```bash
cd client
npm run dev
```

**Expected output**:
```
  VITE v5.4.21  ready in 370 ms

  ➜  Local:   http://localhost:3000/
```

Visit http://localhost:3000 in your browser.

## Step 2: Verify Visual Features (No Audio Needed)

### ✅ Check Eye Tracking
1. On home screen, move your mouse around
2. Watch the eye iris follow your cursor
3. Move to different edges of the screen - iris should track smoothly
4. Move cursor off-screen - iris should center/reset
5. Hover directly on the eye - iris should center

**Expected behavior**: Smooth 360° tracking, no lag.

### ✅ Check Logo Redesign
1. Look at bottom center of black header section
2. Should see a large glowing "Q" (magenta/cyan neon effect)
3. Eye should be positioned above/overlapping the Q
4. Glow should pulse continuously (brightness shifts)
5. Hover over - logo should scale up slightly with rotation

**Expected colors**: Magenta (#FF00FF) with cyan (#00FFFF) tint.

### ✅ Check Easter Egg (Visual-Only Test)
1. Click the Q logo or eye 5 times rapidly
2. Watch expressions change:
   - Click 1: Eye squints (ouch)
   - Click 2: More squinting (annoyed)
   - Click 3: Tight squint + subtle shake (angry)
   - Click 4: Very tight + intense vibration (furious)
   - Click 5: Turns to 🖕 and shakes, then 😂 appears

**No audio needed** - visual effects should still work!

## Step 3: Set Up Audio Files (For Complete Experience)

### Required Audio Files

You need to copy audio files to:
```
client/public/audio/
```

Create the directory if it doesn't exist:
```bash
mkdir -p client/public/audio
```

### File List & Sources

| Destination | Source | Required |
|-------------|--------|----------|
| `punch-1.mp3` | E:\Downloads\freesound_community-punch-41105.mp3 | Yes |
| `punch-2.mp3` | E:\Downloads\universfield-power-punch-192118.mp3 | Yes |
| `punch-3.mp3` | E:\Downloads\taolao111-punch-knuckle-blunt-medium-503895.mp3 | Yes |
| `punch-4.mp3` | E:\Downloads\dragon-studio-hard-punch-sfx-515251.mp3 | Yes |
| `scream.mp3` | E:\Downloads\u_xg7ssi08yr-screaming-man-389826.mp3 | Yes |
| `censor-beep.mp3` | E:\Downloads\dragon-studio-censor-beep-1-372459.mp3 | Yes |
| `poof.mp3` | Find a whoosh/explosion sound | Yes |

### How to Copy Files

**Option 1: Windows Explorer**
1. Open `E:\Downloads`
2. Open `client\public\audio` in another window
3. Drag files over and rename them to match the list above

**Option 2: Command Line**
```bash
# From Windows (PowerShell as Admin)
Copy-Item "E:\Downloads\freesound_community-punch-41105.mp3" "client\public\audio\punch-1.mp3"
Copy-Item "E:\Downloads\universfield-power-punch-192118.mp3" "client\public\audio\punch-2.mp3"
Copy-Item "E:\Downloads\taolao111-punch-knuckle-blunt-medium-503895.mp3" "client\public\audio\punch-3.mp3"
Copy-Item "E:\Downloads\dragon-studio-hard-punch-sfx-515251.mp3" "client\public\audio\punch-4.mp3"
Copy-Item "E:\Downloads\u_xg7ssi08yr-screaming-man-389826.mp3" "client\public\audio\scream.mp3"
Copy-Item "E:\Downloads\dragon-studio-censor-beep-1-372459.mp3" "client\public\audio\censor-beep.mp3"
# Then find/download poof.mp3 and add it
```

**Option 3: Bash (Git Bash / WSL)**
```bash
cp "E:/Downloads/freesound_community-punch-41105.mp3" "client/public/audio/punch-1.mp3"
cp "E:/Downloads/universfield-power-punch-192118.mp3" "client/public/audio/punch-2.mp3"
cp "E:/Downloads/taolao111-punch-knuckle-blunt-medium-503895.mp3" "client/public/audio/punch-3.mp3"
cp "E:/Downloads/dragon-studio-hard-punch-sfx-515251.mp3" "client/public/audio/punch-4.mp3"
cp "E:/Downloads/u_xg7ssi08yr-screaming-man-389826.mp3" "client/public/audio/scream.mp3"
cp "E:/Downloads/dragon-studio-censor-beep-1-372459.mp3" "client/public/audio/censor-beep.mp3"
# Then find/download poof.mp3 and add it
```

### Finding a "Poof" Sound

The poof sound is the one missing. You need a short explosion/whoosh sound. Options:

1. **Freesound.com**: Search for "explosion", "whoosh", or "poof" 
   - Filter by duration (0.5-2 seconds)
   - Filter by license (free to use)
   
2. **Zapsplat.com**: Free sound effects
   - Search "poof" or "explosion"

3. **YouTube Audio Library**: 
   - Free to use sound effects
   - Search for "explosion" or "poof"

4. **Foley Art**: Record your own!
   - Use Audacity (free) to record a quick whoosh sound
   - Export as MP3

Once you have `poof.mp3`, place it in `client/public/audio/`

## Step 4: Verify Audio Setup

1. **Check Files Exist**:
   ```bash
   ls -la client/public/audio/
   ```
   Should show all 7 files (including the two that were already there):
   ```
   menu-loop.mp3
   gameplay-loop.mp3
   punch-1.mp3
   punch-2.mp3
   punch-3.mp3
   punch-4.mp3
   scream.mp3
   poof.mp3
   censor-beep.mp3
   ```

2. **Test Audio in Browser**:
   - Open http://localhost:3000
   - Open DevTools (F12)
   - Network tab: Click eye 5 times
   - Watch for `.mp3` file requests
   - Check if green ✓ (successful) or red ✗ (404 failed)

3. **Test Audio Playback**:
   - Click eye once → Should hear punch sound
   - Click 4 more times → Should hear progression of punch sounds
   - Last click → Should hear angry scream, then poof/beep

## Testing the Complete Feature

### Full 5-Click Sequence Test

```
Timeline:
─────────────────────────────────────────
0ms      : Click 5 → Scream sound plays
           Eye turns to 🖕
           Starts vibrating intensely
         :
400ms    : Poof sound (explosion whoosh)
         : Censor beep sound (bleeeep)
         :
800ms    : 😂 Laugh emoji appears
         : Bounce animation starts
         :
2000ms   : Back to normal 👁️
         : Ready for next sequence
─────────────────────────────────────────
```

### What You Should See & Hear

| Step | Visual | Audio |
|------|--------|-------|
| Click 1 | Eye squints | Punch (random) |
| Click 2 | Annoyance | Punch (random) |
| Click 3 | Angry squint | Punch (random) |
| Click 4 | Furious + vibration | Punch (random) |
| Click 5 | 🖕 shaking | Angry scream |
| +400ms | (still shaking) | Poof + beep |
| +800ms | 😂 laughing | (silent) |
| +2s | 👁️ normal | (silent) |

## Troubleshooting

### Audio Not Playing
- [ ] Check file names are exactly as listed (case-sensitive)
- [ ] Check files are in `client/public/audio/` not elsewhere
- [ ] Verify file permissions (should be readable)
- [ ] Try refreshing the page (Ctrl+F5)
- [ ] Check browser console for 404 errors

### Eye Not Tracking
- [ ] Try moving mouse slowly across the eye
- [ ] Make sure you're on the home screen (first screen)
- [ ] Refresh page if it doesn't work
- [ ] Check browser console for JavaScript errors

### Easter Egg Not Triggering
- [ ] Make sure you're clicking the Q or eye (not just near them)
- [ ] Count to 5 clicks - may be counting wrong
- [ ] Verify clicks are within 2.8 second timeout window
- [ ] Each click must be on the logo area

### Logo Glow Not Visible
- [ ] Scroll to see the logo at bottom of header
- [ ] Try zooming in (Ctrl + Plus)
- [ ] The glow is subtle - look for magenta/cyan color shifts
- [ ] Might not show well in very bright rooms

## Deployment Notes

When deploying to production:
1. All audio files will be included in the build
2. No additional server configuration needed
3. Audio files will be cached by browser
4. Works over HTTPS (recommended for production)

## File Structure After Setup

```
client/
├── public/
│   ├── audio/
│   │   ├── menu-loop.mp3
│   │   ├── gameplay-loop.mp3
│   │   ├── punch-1.mp3         ← You add these
│   │   ├── punch-2.mp3
│   │   ├── punch-3.mp3
│   │   ├── punch-4.mp3
│   │   ├── scream.mp3
│   │   ├── poof.mp3
│   │   └── censor-beep.mp3
│   └── index.html
├── src/
│   ├── quickeye/
│   │   ├── QuickeyeGame.tsx     ← Updated
│   │   ├── audio.ts             ← Updated
│   │   └── quickeye.css         ← Updated
│   └── App.tsx
└── package.json
```

## Success Checklist

- [ ] Dev server running on http://localhost:3000
- [ ] Eye tracks cursor smoothly
- [ ] Q logo visible and glowing at bottom of header
- [ ] Logo scales on hover
- [ ] Can click eye 5 times
- [ ] Eye expressions change through sequence
- [ ] Audio files copied to `client/public/audio/`
- [ ] Punch sounds play randomly
- [ ] Scream sound plays on 5th click
- [ ] Poof and beep sounds play after middle finger
- [ ] 😂 emoji appears after beep
- [ ] No console errors

## Next Steps

Once verified:
1. Commit changes: `git add . && git commit -m "feat: add interactive eye easter egg with tracking and animations"`
2. Deploy to production (when ready)
3. Share with testers!

---

**Questions?** Review:
- `AUDIO_SETUP.md` - Detailed audio setup
- `TESTING_GUIDE.md` - Feature testing details
- `CHANGES_SUMMARY.md` - Technical implementation details
