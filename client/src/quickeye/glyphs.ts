/**
 * Pure constants + helpers for the Quickeye game UI.
 *
 * Ported 1:1 from the design prototype (Quickeye Prototype v2). Everything here
 * is side-effect free so it can be unit-tested and shared across the screens.
 */

import type { CSSProperties } from "react";

export const PALETTE = {
  red: "#D02020",
  blue: "#1040C0",
  yellow: "#F0C020",
  black: "#121212",
} as const;

/** clip-path polygons for the non-primitive shapes. */
export const CLIPS: Record<string, string> = {
  triangle: "polygon(50% 2%,98% 98%,2% 98%)",
  diamond: "polygon(50% 0,100% 50%,50% 100%,0 50%)",
  hexagon: "polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)",
  star: "polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)",
  plus: "polygon(36% 0,64% 0,64% 36%,100% 36%,100% 64%,64% 64%,64% 100%,36% 100%,36% 64%,0 64%,0 36%,36% 36%)",
};

export type GlyphColor = keyof typeof PALETTE;
export interface Glyph {
  t: string;
  c: GlyphColor;
}

/** The 18-symbol placeholder set the prototype draws from. */
export const GLYPHS: Glyph[] = [
  { t: "circle", c: "red" },
  { t: "triangle", c: "yellow" },
  { t: "diamond", c: "blue" },
  { t: "ring", c: "black" },
  { t: "square", c: "black" },
  { t: "half", c: "red" },
  { t: "star", c: "blue" },
  { t: "circle", c: "yellow" },
  { t: "plus", c: "blue" },
  { t: "hexagon", c: "red" },
  { t: "diamond", c: "red" },
  { t: "ring", c: "blue" },
  { t: "triangle", c: "red" },
  { t: "star", c: "yellow" },
  { t: "plus", c: "red" },
  { t: "hexagon", c: "blue" },
  { t: "square", c: "blue" },
  { t: "circle", c: "blue" },
];

/** Iris colours the Q-eye logo cycles through on each blink. */
export const IRIS_CYCLE = [
  "#1040C0",
  "#F0C020",
  "#D02020",
  "#12A594",
  "#E255A1",
  "#8B5CF6",
  "#F97316",
  "#22C55E",
  "#0EA5E9",
];

export const BLINK_MS = 3400;

/** Overall zoom applied to the game surface (matches prototype). */
export const SCALE = 1.16;

export interface ColorOption {
  name: string;
  hex: string;
}

/** The nine player colours in the home-screen carousel. */
export const COLORS: ColorOption[] = [
  { name: "Signal Red", hex: "#D02020" },
  { name: "Klein Blue", hex: "#1040C0" },
  { name: "Sun Yellow", hex: "#F0C020" },
  { name: "Teal", hex: "#12A594" },
  { name: "Magenta", hex: "#E255A1" },
  { name: "Violet", hex: "#8B5CF6" },
  { name: "Orange", hex: "#F97316" },
  { name: "Lime", hex: "#22C55E" },
  { name: "Sky", hex: "#0EA5E9" },
];

/** Placeholder opponent handles for bots / fake lobby rooms. */
export const OPP_POOL = [
  "nova_7",
  "pixld",
  "q_bandit",
  "mira.k",
  "zenith",
  "tofu99",
  "blitzcat",
  "vexo",
  "lumen",
  "dash88",
  "glyphy",
  "k0an",
  "sable",
  "riff",
  "echo9",
];

export type LeaderTab = "marathon" | "race" | "power";

/** Static placeholder global leaderboard values. */
export const LB: Record<LeaderTab, { n: string; v: number }[]> = {
  marathon: [
    { n: "nova_7", v: 19 },
    { n: "sable", v: 17 },
    { n: "k0an", v: 15 },
    { n: "riff", v: 13 },
    { n: "lumen", v: 11 },
  ],
  race: [
    { n: "k0an", v: 12.4 },
    { n: "nova_7", v: 13.9 },
    { n: "echo9", v: 15.2 },
    { n: "sable", v: 16.8 },
    { n: "lumen", v: 18.1 },
  ],
  power: [
    { n: "sable", v: 24 },
    { n: "nova_7", v: 21 },
    { n: "glyphy", v: 19 },
    { n: "k0an", v: 17 },
    { n: "riff", v: 14 },
  ],
};

export type GameModeKey = "marathon" | "race" | "power";

export const MODE_LABEL: Record<GameModeKey, string> = {
  marathon: "Marathon · 60s",
  race: "Race the Clock · first to 7",
  power: "Power Play · 60s",
};

export type PowerType = "pop" | "reveal" | "halve";

export const POWER_COL: Record<PowerType, string> = {
  pop: "#1040C0",
  reveal: "#22C55E",
  halve: "#F0C020",
};

export function ordinal(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : n + "th";
}

/** Pick black or white text for legible contrast on a given background hex. */
export function textOn(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#121212" : "#fff";
}

/** Inline style for a rendered glyph tile of pixel size `s`. */
export function glyphStyle(id: number, s: number): CSSProperties {
  const d = GLYPHS[id % GLYPHS.length];
  const c = PALETTE[d.c];
  const S = Math.round(s * 0.62);
  if (d.t === "circle") return { width: S, height: S, borderRadius: "50%", background: c };
  if (d.t === "square") return { width: S, height: S, background: c };
  if (d.t === "ring")
    return {
      width: S,
      height: S,
      borderRadius: "50%",
      border: `${Math.max(4, Math.round(S * 0.2))}px solid ${c}`,
      boxSizing: "border-box",
    };
  if (d.t === "half")
    return {
      width: S,
      height: Math.round(S * 0.55),
      borderRadius: `${S}px ${S}px 0 0`,
      background: c,
    };
  const clip = CLIPS[d.t] || CLIPS.diamond;
  return { width: S, height: S, background: c, clipPath: clip, WebkitClipPath: clip };
}

/** Fisher-Yates copy-shuffle. */
export function shuffle<T>(a: T[]): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface Round {
  center: number[];
  player: number[];
  shared: number;
  tokenIdx: number;
  tokenType: PowerType | null;
}

/**
 * Build one round: a centre board of 8 glyphs, a player hand of 8 that shares
 * exactly one glyph with the board. In power mode a random hand slot may carry
 * a powerup token.
 */
export function makeRound(mode: GameModeKey): Round {
  const all = shuffle([...Array(GLYPHS.length).keys()]);
  const center = all.slice(0, 8);
  const shared = center[Math.floor(Math.random() * 8)];
  const player = shuffle([shared, ...all.slice(8, 15)]);
  const r: Round = { center, player, shared, tokenIdx: -1, tokenType: null };
  if (mode === "power" && Math.random() < 0.45) {
    const cand = player.map((_id, i) => i).filter((i) => player[i] !== shared);
    r.tokenIdx = cand[Math.floor(Math.random() * cand.length)];
    r.tokenType = (["reveal", "halve", "pop"] as PowerType[])[Math.floor(Math.random() * 3)];
  }
  return r;
}

/** A 4-digit numeric room code (client-side placeholder). */
export function numCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Two distinct random opponent handles. */
export function pickOpps(): [string, string] {
  const s = shuffle(OPP_POOL);
  return [s[0], s[1]];
}
