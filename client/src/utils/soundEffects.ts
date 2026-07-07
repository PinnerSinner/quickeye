/**
 * Sound effects for Quickeye using Web Audio API.
 * Generates simple, crisp tones without external audio files.
 */

interface AudioContext {
  context: any;
  masterGain: any;
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    const masterGain = context.createGain();
    masterGain.connect(context.destination);
    masterGain.gain.value = 0.3; // 30% volume
    audioCtx = { context, masterGain };
  }
  return audioCtx;
}

/**
 * Play a simple sine wave tone.
 * @param frequency Hz (e.g., 440 = A4)
 * @param duration milliseconds
 * @param envelope 'attack' for sharp start, 'decay' for fade
 */
function playTone(frequency: number, duration: number, envelope: "attack" | "decay" = "attack") {
  const { context, masterGain } = getAudioContext();

  const osc = context.createOscillator();
  const gain = context.createGain();

  osc.frequency.value = frequency;
  osc.type = "sine";

  gain.connect(masterGain);
  osc.connect(gain);

  const now = context.currentTime;
  const durationSecs = duration / 1000;

  if (envelope === "attack") {
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + durationSecs);
  } else {
    gain.gain.setValueAtTime(1, now);
    gain.gain.linearRampToValueAtTime(0, now + durationSecs);
  }

  osc.start(now);
  osc.stop(now + durationSecs);
}

/**
 * Correct match sound: ascending two-tone beep
 */
export function playCorrectSound() {
  playTone(523.25, 100, "attack"); // C5
  setTimeout(() => playTone(659.25, 100, "attack"), 120); // E5
}

/**
 * Wrong match sound: descending buzz
 */
export function playWrongSound() {
  playTone(330, 200, "decay"); // E4
}

/**
 * Escalating urgency sound - plays increasingly faster tones
 * Used for countdown timer <5 seconds
 */
export function playUrgencySound() {
  playTone(440, 100, "attack"); // A4
}

/**
 * Game over sound: descending tone
 */
export function playGameOverSound() {
  playTone(440, 150, "decay"); // A4
  setTimeout(() => playTone(330, 150, "decay"), 160); // E4
  setTimeout(() => playTone(220, 200, "decay"), 320); // A3
}

/**
 * Countdown beep (simple tick)
 */
export function playCountdownTick() {
  playTone(800, 50, "attack");
}

/**
 * Enable/disable audio
 */
export function setMasterVolume(volume: number) {
  const ctx = getAudioContext();
  ctx.masterGain.gain.value = Math.max(0, Math.min(1, volume));
}
