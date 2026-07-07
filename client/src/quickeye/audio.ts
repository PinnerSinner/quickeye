/**
 * Procedural sound engine for Quickeye, ported from the prototype.
 *
 * All sounds are synthesised with the Web Audio API — no audio files. The
 * context is created lazily on first user gesture (browsers block autoplay).
 */

export class QuickeyeAudio {
  private ctx: AudioContext | null = null;
  /** When false, all playback is suppressed. */
  enabled = true;
  private bgm: HTMLAudioElement | null = null;

  /** Create/resume the AudioContext. Call from a user gesture (e.g. game start). */
  ensure(): void {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      /* audio unavailable — silently ignore */
    }
  }

  private noise(gain: number, dur: number, power: number, t: number): void {
    const a = this.ctx!;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, power);
    const src = a.createBufferSource();
    src.buffer = buf;
    const ng = a.createGain();
    ng.gain.value = gain;
    src.connect(ng).connect(a.destination);
    src.start(t);
  }

  /** Success "chunk" — pitch rises with the running score. */
  chunk(score: number): void {
    const a = this.ctx;
    if (!a || !this.enabled) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.19);
    this.noise(0.26, 0.05, 2, t);
    const base = 500 + Math.min(score, 14) * 46;
    const o2 = a.createOscillator();
    const g2 = a.createGain();
    o2.type = "triangle";
    o2.frequency.setValueAtTime(base, t);
    o2.frequency.exponentialRampToValueAtTime(base + 340, t + 0.09);
    g2.gain.setValueAtTime(0.0001, t + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.32, t + 0.03);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o2.connect(g2).connect(a.destination);
    o2.start(t);
    o2.stop(t + 0.22);
  }

  /** Wrong-answer descending buzz. */
  wrongTone(): void {
    const a = this.ctx;
    if (!a || !this.enabled) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.22);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.24, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.26);
  }

  /** UI blip — `up` sweeps upward, otherwise downward. */
  blip(up: boolean): void {
    const a = this.ctx;
    if (!a || !this.enabled) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(up ? 420 : 600, t);
    o.frequency.exponentialRampToValueAtTime(up ? 950 : 300, t + 0.14);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.2);
  }

  /** Bubble "pop" for the Pop powerup. */
  popSound(): void {
    const a = this.ctx;
    if (!a || !this.enabled) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(720, t);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.13);
    this.noise(0.22, 0.03, 1.5, t);
  }

  /** Win/lose sting at game over. */
  fanfare(win: boolean): void {
    const a = this.ctx;
    if (!a || !this.enabled) return;
    const t = a.currentTime;
    const notes = win ? [523, 659, 784, 1047] : [392, 294, 220];
    notes.forEach((f, i) => {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = win ? "triangle" : "sawtooth";
      const tt = t + i * 0.12;
      o.frequency.setValueAtTime(f, tt);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.32, tt + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.34);
      o.connect(g).connect(a.destination);
      o.start(tt);
      o.stop(tt + 0.36);
    });
    this.noise(0.16, 0.25, 2, t);
  }

  /** Load and play background music. Pass null/empty string to stop. */
  playBGM(src: string | null): void {
    try {
      if (!src) {
        if (this.bgm) {
          this.bgm.pause();
          this.bgm.currentTime = 0;
        }
        return;
      }
      if (!this.bgm) {
        this.bgm = new Audio();
        this.bgm.loop = true;
        this.bgm.volume = 0.4;
      }
      if (this.bgm.src !== src) {
        this.bgm.src = src;
      }
      if (this.enabled) {
        this.bgm.play().catch(() => {
          /* audio unavailable */
        });
      }
    } catch {
      /* ignore */
    }
  }

  /** Stop background music. */
  stopBGM(): void {
    this.playBGM(null);
  }

  /** Set background music volume (0-1). */
  setBGMVolume(vol: number): void {
    if (this.bgm) this.bgm.volume = Math.max(0, Math.min(1, vol));
  }
}
