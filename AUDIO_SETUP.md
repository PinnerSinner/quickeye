# Audio Setup for Quickeye Easter Egg

The interactive eye easter egg requires audio files to be placed in `client/public/audio/`.

## Required Audio Files

Copy the following files from `E:\Downloads\` to `client/public/audio/`:

1. **Punch Sounds** (pick 4 from your downloads, rename as indicated):
   - `punch-1.mp3` - e.g., freesound_community-punch-41105.mp3
   - `punch-2.mp3` - e.g., universfield-power-punch-192118.mp3
   - `punch-3.mp3` - e.g., taolao111-punch-knuckle-blunt-medium-503895.mp3
   - `punch-4.mp3` - e.g., dragon-studio-hard-punch-sfx-515251.mp3

2. **Scream Sound**:
   - `scream.mp3` - u_xg7ssi08yr-screaming-man-389826.mp3

3. **Explosion/Poof Sound**:
   - `poof.mp3` - (you'll need to find or add this)

4. **Censor Beep**:
   - `censor-beep.mp3` - dragon-studio-censor-beep-1-372459.mp3

## Directory Structure

```
client/public/audio/
├── menu-loop.mp3          (already exists)
├── gameplay-loop.mp3      (already exists)
├── punch-1.mp3
├── punch-2.mp3
├── punch-3.mp3
├── punch-4.mp3
├── scream.mp3
├── poof.mp3
└── censor-beep.mp3
```

## Easter Egg Behavior

Click the eye logo (bottom center on home screen) 5 times to trigger the sequence:

1. **Clicks 1-4**: Punch sounds, eye gets progressively annoyed
2. **Click 5**: Scream sound, eye turns to middle finger 🖕 and shakes
3. **400ms later**: Poof sound + censor beep 
4. **800ms later**: Laugh emoji 😂
5. **2s total**: Back to normal

The eye is also interactive:
- **360° eye tracking**: The iris follows your cursor smoothly in all directions
- **Hover sensitivity**: Only tracks when cursor is near the eye
- **Auto-center**: Iris recenters when cursor leaves the window or hovers directly on the eye
- **Expression changes**: Eye shows "ouch", "annoyed", "angry", "furious" expressions as you poke

## Home Screen Logo

The Q on the home screen now has:
- Centered, glowing text with animated neon effect
- Magenta/cyan glow that pulses
- Eye positioned above the Q
- Interactive on click (same easter egg)

## Testing Without Audio Files

If you don't have all audio files yet, the app will still work—missing audio files just won't play. The visual effects will still trigger normally.

## Notes

- Audio files are cached after first play for better performance
- All audio plays at browser volume control levels
- Audio loading respects the browser's autoplay policies (requires user gesture)
