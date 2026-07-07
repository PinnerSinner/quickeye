/**
 * QuickeyeGame — the full game UI, ported from the design prototype
 * (Quickeye Prototype v2) into React/TypeScript.
 *
 * Screens: home · solo · multiplayer · leaderboard · browse · create · join ·
 * playing · game-over. Solo play (Marathon / Race the Clock / Power Play) runs
 * entirely client-side with simulated opponents — no server round-trip needed.
 * Multiplayer create/join are wired to the real WebSocket backend via the
 * optional callbacks in QuickeyeGameProps.
 *
 * The prototype was a single imperative DCLogic class; here reactive game state
 * lives in one `st` object (with a mirrored `stateRef` so interval/listener
 * callbacks always read the latest values), and all the canvas/audio work is
 * driven imperatively through refs.
 */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  BLINK_MS,
  COLORS,
  GLYPHS,
  IRIS_CYCLE,
  LB,
  MODE_LABEL,
  OPP_POOL,
  PALETTE,
  POWER_COL,
  SCALE,
  glyphStyle,
  makeRound,
  numCode,
  ordinal,
  pickOpps,
  shuffle,
  textOn,
  type GameModeKey,
  type LeaderTab,
  type PowerType,
  type Round,
} from "./glyphs";
import { drawShape, styleHeaderShape } from "./canvas";
import { QuickeyeAudio } from "./audio";
import { containsProfanity } from "@quickeye/shared";
import "./quickeye.css";

type View =
  | "home"
  | "solo"
  | "multi"
  | "browse"
  | "create"
  | "join"
  | "leaderboard"
  | "lobby"
  | "playing"
  | "over";

interface QState {
  view: View;
  mode: GameModeKey;
  playerName: string;
  nameSaved: boolean;
  colorPos: number;
  colorNoAnim: boolean;
  joinCode: string;
  roomCode: string;
  copyOk: boolean;
  round: Round;
  scores: { you: number; bob: number; charlie: number };
  opps: [string, string];
  timeLeft: number;
  elapsed: number;
  matchedId: number | null;
  wrongId: number | null;
  locked: boolean;
  cullIdx: number[];
  popIdx: number[];
  tokenUsed: boolean;
  plusKey: number;
  irisIdx: number;
  shake: boolean;
  overShake: boolean;
  powerups: { pop: boolean; reveal: boolean; halve: boolean };
  revealUntil: number;
  overCompare: boolean;
  raceTime: number;
  leaderTab: LeaderTab;
  isMultiplayer: boolean;
  gameId: string | null;
  playerId: string | null;
  serverError: string | null;
  browseCodes: { gameId: string; host: string; playerCount: number }[];
  quitConfirm: boolean;
  mousePos: [number, number];
  eyePokes: number;
  eyeExpression: "normal" | "ouch" | "annoyed" | "angry" | "furious" | "middle-finger";
  countdownActive: boolean;
  countdownNumber: 3 | 2 | 1 | null;
  countdownPhase: "idle" | "counting" | "go" | "complete";
  countdownStartTime: number;
}

export interface QuickeyeGameProps {
  /** Called when the player creates a multiplayer room. */
  onCreateMultiplayer?: (playerName: string) => void;
  /** Called when the player joins a room by code. */
  onJoinMultiplayer?: (code: string, playerName: string) => void;
  /** Called when the host starts a multiplayer game. */
  onStartGame?: () => void;
  /** Called when a player submits a symbol match. */
  onSubmitMatch?: (gameId: string, symbolId: number) => void;
  /** Called to query leaderboard data from server. */
  onQueryLeaderboard?: (gameMode: string) => void;
  /** Called to query available games from server. */
  onQueryGames?: () => void;
  /** A server-issued room code to display on the Create screen, if available. */
  serverRoomCode?: string | null;
  /** Server game state (multiplayer games). */
  gameState?: any;
  /** Result of the last match submission. */
  matchResult?: { correct: boolean; symbolId?: number; gameOver?: boolean } | null;
  /** Error message from server. */
  error?: string | null;
  /** Leaderboard data from server. */
  leaderboards?: Record<string, any[]>;
  /** Available games from server to join. */
  availableGames?: Array<{ gameId: string; host: string; playerCount: number; gameMode: string }>;
}

const OPP_INTERVAL_MS = 3000; // "Normal" opponent pace

function initialState(): QState {
  const savedName =
    (typeof localStorage !== "undefined" && localStorage.getItem("quickeye_player_name")) || "You";
  return {
    view: "home",
    mode: "marathon",
    playerName: savedName,
    nameSaved: false,
    colorPos: 46,
    colorNoAnim: false,
    joinCode: "",
    roomCode: numCode(),
    copyOk: false,
    round: makeRound("marathon"),
    scores: { you: 0, bob: 0, charlie: 0 },
    opps: ["Bob", "Charlie"],
    timeLeft: 60,
    elapsed: 0,
    matchedId: null,
    wrongId: null,
    locked: false,
    cullIdx: [],
    popIdx: [],
    tokenUsed: false,
    plusKey: 0,
    irisIdx: 0,
    shake: false,
    overShake: false,
    powerups: { pop: true, reveal: true, halve: true },
    revealUntil: 0,
    overCompare: false,
    raceTime: 0,
    leaderTab: "marathon",
    isMultiplayer: false,
    gameId: null,
    playerId: null,
    serverError: null,
    browseCodes: [], // Games fetched from server
    quitConfirm: false,
    mousePos: [0, 0],
    eyePokes: 0,
    eyeExpression: "normal",
    countdownActive: false,
    countdownNumber: null,
    countdownPhase: "idle",
    countdownStartTime: 0,
  };
}

function bestFor(tab: string): number | null {
  try {
    const v = localStorage.getItem("quickeye_best_" + tab);
    return v == null ? null : parseFloat(v);
  } catch {
    return null;
  }
}
function saveBest(mode: string, val: number): void {
  try {
    const prev = bestFor(mode);
    const nv =
      mode === "race"
        ? prev == null
          ? val
          : Math.min(prev, val)
        : prev == null
        ? val
        : Math.max(prev, val);
    localStorage.setItem("quickeye_best_" + mode, String(nv));
  } catch {
    /* ignore */
  }
}

export function QuickeyeGame(props: QuickeyeGameProps) {
  const [st, setSt] = useState<QState>(initialState);
  const stateRef = useRef<QState>(st);
  stateRef.current = st;

  /** Merge a partial patch into state, keeping stateRef current synchronously. */
  const patch = (u: Partial<QState> | ((s: QState) => Partial<QState>)) => {
    const prev = stateRef.current;
    const delta = typeof u === "function" ? u(prev) : u;
    const next = { ...prev, ...delta };
    stateRef.current = next;
    setSt(next);
  };
  const bump = () => patch({});

  // DOM refs
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const hdrRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overRef = useRef<HTMLCanvasElement | null>(null);

  // audio
  const audioRef = useRef<QuickeyeAudio>();
  if (!audioRef.current) audioRef.current = new QuickeyeAudio();

  // timers / raf
  const tRef = useRef(0);
  const bRef = useRef(0);
  const popTORef = useRef(0);
  const blinkTORef = useRef(0);
  const blinkIntRef = useRef(0);
  const bgRafRef = useRef(0);
  const hdrRafRef = useRef(0);
  const partRafRef = useRef(0);
  const confRafRef = useRef(0);
  const revTORef = useRef(0);
  const shTORef = useRef(0);
  const copyTORef = useRef(0);
  const saveTORef = useRef(0);
  const countdownRef = useRef(0);

  // misc imperative state
  const t0Ref = useRef(0);
  const tensionRef = useRef(0);
  const playerColorRef = useRef(COLORS[0].hex);
  const prevViewRef = useRef<View>("home");
  const bgResizeRef = useRef<(() => void) | null>(null);
  const hdrElRef = useRef<HTMLDivElement | null>(null);
  const hdrMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const hdrLeaveRef = useRef<(() => void) | null>(null);
  const confStartRef = useRef(0);
  const usePowerRef = useRef<(name: PowerType) => void>(() => {});

  // ---- derived, computed each render ----
  const colorSel = (s: QState) => {
    const N = COLORS.length;
    return ((s.colorPos % N) + N) % N;
  };
  const playerColorOf = (s: QState) => COLORS[colorSel(s)].hex;
  const tensionOf = (s: QState) => {
    if (s.mode === "race") return Math.min(1, s.scores.you / 7);
    const tl = s.timeLeft;
    let t = 1 - tl / 60;
    if (tl <= 5) t = Math.max(t, 0.72 + (5 - tl) * 0.055);
    return Math.min(1, Math.max(0, t));
  };
  const ranking = (s: QState) =>
    [
      { id: "you", name: s.playerName || "You", score: s.scores.you },
      { id: "bob", name: s.opps[0], score: s.scores.bob },
      { id: "charlie", name: s.opps[1], score: s.scores.charlie },
    ].sort((a, b) => b.score - a.score);

  const pc = playerColorOf(st);
  playerColorRef.current = pc;
  const tension = tensionOf(st);
  tensionRef.current = tension;
  const iris = IRIS_CYCLE[st.irisIdx % IRIS_CYCLE.length];

  // ---------- background field (all screens) ----------
  const initBg = () => {
    const cv = bgRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const fit = () => {
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
    };
    fit();
    bgResizeRef.current = fit;
    window.addEventListener("resize", fit);
    const types = ["circle", "triangle", "square", "diamond", "ring", "plus", "star", "hexagon"];
    const cols = ["#D02020", "#1040C0", "#F0C020"];
    type BgShape = {
      type: string;
      color: string;
      x: number;
      y: number;
      r: number;
      rot: number;
      rotV: number;
      rise: number;
      phase: number;
      amp: number;
      alpha: number;
    };
    const mk = (init: boolean): BgShape => {
      const big = Math.random() < 0.4;
      return {
        type: types[Math.floor(Math.random() * types.length)],
        color:
          Math.random() < 0.25
            ? playerColorRef.current
            : cols[Math.floor(Math.random() * cols.length)],
        x: Math.random() * cv.width,
        y: init ? Math.random() * cv.height : cv.height + 40,
        r: big ? 26 + Math.random() * 38 : 8 + Math.random() * 15,
        rot: Math.random() * 6.28,
        rotV: (Math.random() * 2 - 1) * 0.02,
        rise: 0.28 + Math.random() * 0.7 + (big ? 0 : 0.35),
        phase: Math.random() * 6.28,
        amp: 14 + Math.random() * 42,
        alpha: big ? 0.05 + Math.random() * 0.06 : 0.13 + Math.random() * 0.16,
      };
    };
    let bg = [...Array(26)].map(() => mk(true));
    const loop = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of bg) {
        p.y -= p.rise;
        p.rot += p.rotV;
        p.x += Math.sin(p.y * 0.008 + p.phase) * p.amp * 0.02;
        if (p.y < -p.r - 12) Object.assign(p, mk(false));
        drawShape(ctx, p.type, p.x, p.y, p.r, p.rot, p.color, p.alpha);
      }
      bgRafRef.current = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(bgRafRef.current);
    loop();
    void bg;
  };

  // ---------- interactive physics header (home only) ----------
  const stopHeader = () => {
    cancelAnimationFrame(hdrRafRef.current);
    const el = hdrElRef.current;
    if (el) {
      if (hdrMoveRef.current) el.removeEventListener("mousemove", hdrMoveRef.current);
      if (hdrLeaveRef.current) el.removeEventListener("mouseleave", hdrLeaveRef.current);
      hdrElRef.current = null;
    }
  };
  const initHeader = () => {
    const c = hdrRef.current;
    if (!c) return;
    stopHeader();
    c.innerHTML = "";
    const W = c.clientWidth || 660;
    const H = 210;
    const types = ["circle", "square", "triangle", "diamond", "ring", "half", "star", "plus", "hexagon"];
    const cols = ["#D02020", "#1040C0", "#F0C020"];
    type Phys = {
      el: HTMLDivElement;
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      a: number;
      av: number;
      size: number;
      max: number;
    };
    const shapes: Phys[] = [];
    for (let i = 0; i < 20; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const color = cols[Math.floor(Math.random() * cols.length)];
      const size = 26 + Math.random() * 54;
      const small = 1 - (size - 26) / 54;
      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.willChange = "transform";
      styleHeaderShape(el, type, color, size);
      c.appendChild(el);
      const fac = 0.45 + small * 0.95;
      shapes.push({
        el,
        x: Math.random() * (W - size),
        y: Math.random() * (H - size),
        vx: (Math.random() * 2 - 1) * 1.7 * fac,
        vy: (Math.random() * 2 - 1) * 1.7 * fac,
        r: size / 2,
        a: Math.random() * 360,
        av: (Math.random() * 2 - 1) * (1.2 + small * 7),
        size,
        max: 2.4 + small * 5.5,
      });
    }
    const mouse = { x: -999, y: -999 };
    const move = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / SCALE;
      mouse.y = (e.clientY - r.top) / SCALE;
    };
    const leave = () => {
      mouse.x = -999;
      mouse.y = -999;
    };
    hdrMoveRef.current = move;
    hdrLeaveRef.current = leave;
    c.addEventListener("mousemove", move);
    c.addEventListener("mouseleave", leave);
    hdrElRef.current = c;
    const step = () => {
      const W2 = c.clientWidth || 660;
      const S = shapes;
      for (const s of S) {
        const cx = s.x + s.r;
        const cy = s.y + s.r;
        const dx = cx - mouse.x;
        const dy = cy - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 150) {
          const f = ((150 - dist) / 150) * 2.4;
          s.vx += (dx / (dist || 1)) * f;
          s.vy += (dy / (dist || 1)) * f;
        }
        s.x += s.vx;
        s.y += s.vy;
        s.a += s.av;
        if (s.x < 0) {
          s.x = 0;
          s.vx = -s.vx;
        }
        if (s.x > W2 - s.size) {
          s.x = W2 - s.size;
          s.vx = -s.vx;
        }
        if (s.y < 0) {
          s.y = 0;
          s.vy = -s.vy;
        }
        if (s.y > H - s.size) {
          s.y = H - s.size;
          s.vy = -s.vy;
        }
        s.vx *= 0.995;
        s.vy *= 0.995;
        const sp = Math.hypot(s.vx, s.vy);
        if (sp < 0.5) {
          const ang = Math.random() * 6.28;
          s.vx += Math.cos(ang) * 0.4;
          s.vy += Math.sin(ang) * 0.4;
        }
        if (sp > s.max) {
          s.vx *= s.max / sp;
          s.vy *= s.max / sp;
        }
      }
      for (let i = 0; i < S.length; i++) {
        for (let j = i + 1; j < S.length; j++) {
          const a = S[i];
          const b = S[j];
          const ax = a.x + a.r;
          const ay = a.y + a.r;
          const bx = b.x + b.r;
          const by = b.y + b.r;
          const dx = bx - ax;
          const dy = by - ay;
          const dist = Math.hypot(dx, dy) || 0.001;
          const min = a.r + b.r;
          if (dist < min) {
            const nx = dx / dist;
            const ny = dy / dist;
            const ov = min - dist;
            a.x -= (nx * ov) / 2;
            a.y -= (ny * ov) / 2;
            b.x += (nx * ov) / 2;
            b.y += (ny * ov) / 2;
            const rvx = b.vx - a.vx;
            const rvy = b.vy - a.vy;
            const vn = rvx * nx + rvy * ny;
            if (vn < 0) {
              a.vx += nx * vn;
              a.vy += ny * vn;
              b.vx -= nx * vn;
              b.vy -= ny * vn;
            }
          }
        }
      }
      for (const s of S) {
        s.el.style.transform = "translate(" + s.x + "px," + s.y + "px) rotate(" + s.a + "deg)";
      }
      hdrRafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(hdrRafRef.current);
    step();
  };

  // ---------- gameplay particles ----------
  const startParticles = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    cv.width = cv.clientWidth;
    cv.height = cv.clientHeight;
    const warm = ["#F97316", "#F0C020", "#D02020"];
    type Part = { x: number; y: number; r: number; v: number; a: number; useWarm: boolean };
    const mk = (): Part => ({
      x: Math.random() * cv.width,
      y: cv.height + Math.random() * cv.height,
      r: 1 + Math.random() * 3,
      v: 0.25 + Math.random() * 0.8,
      a: 0.25 + Math.random() * 0.5,
      useWarm: Math.random() < 0.5,
    });
    let parts: Part[] = [];
    const loop = () => {
      const t = tensionRef.current || 0;
      const target = 8 + Math.round(t * 46);
      while (parts.length < target) parts.push(mk());
      if (parts.length > target) parts.length = target;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.y -= p.v * (0.5 + t * 2.0);
        p.x += Math.sin(p.y * 0.02) * 0.35;
        if (p.y < -8) {
          p.y = cv.height + 8;
          p.x = Math.random() * cv.width;
        }
        ctx.globalAlpha = p.a * (0.35 + t * 0.65);
        ctx.fillStyle = p.useWarm ? warm[Math.floor(p.x + p.y) % 3] : playerColorRef.current;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.29);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      partRafRef.current = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(partRafRef.current);
    loop();
    void parts;
  };
  const stopParticles = () => cancelAnimationFrame(partRafRef.current);

  // ---------- confetti (game over) ----------
  const startConfetti = (win: boolean) => {
    const cv = overRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    const cols = ["#D02020", "#1040C0", "#F0C020", playerColorRef.current, "#22C55E"];
    const types = ["square", "circle", "triangle", "diamond", "star"];
    const cx = cv.width / 2;
    const count = win ? 150 : 70;
    type Conf = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      rot: number;
      rotV: number;
      color: string;
      type: string;
    };
    const parts: Conf[] = [];
    for (let i = 0; i < count; i++)
      parts.push({
        x: cx + (Math.random() * 2 - 1) * 160,
        y: -20 - Math.random() * cv.height * 0.3,
        vx: (Math.random() * 2 - 1) * 6,
        vy: 2 + Math.random() * 5,
        r: 5 + Math.random() * 9,
        rot: Math.random() * 6.28,
        rotV: (Math.random() * 2 - 1) * 0.3,
        color: cols[Math.floor(Math.random() * cols.length)],
        type: types[Math.floor(Math.random() * types.length)],
      });
    confStartRef.current = Date.now();
    const loop = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const age = (Date.now() - confStartRef.current) / 1000;
      for (const p of parts) {
        p.vy += 0.18;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.rot += p.rotV;
        const al = age < 2.4 ? 1 : Math.max(0, 1 - (age - 2.4) / 1.2);
        drawShape(ctx, p.type, p.x, p.y, p.r, p.rot, p.color, al);
      }
      if (age < 4) confRafRef.current = requestAnimationFrame(loop);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    };
    cancelAnimationFrame(confRafRef.current);
    loop();
  };
  const stopConfetti = () => {
    cancelAnimationFrame(confRafRef.current);
    const cv = overRef.current;
    if (cv) {
      const ctx = cv.getContext("2d");
      ctx?.clearRect(0, 0, cv.width, cv.height);
    }
  };

  const stopTimers = () => {
    clearInterval(tRef.current);
    clearInterval(bRef.current);
    clearTimeout(popTORef.current);
    clearTimeout(countdownRef.current);
  };

  const playMenuMusic = () => {
    audioRef.current?.playBGM("/audio/menu-loop.mp3");
    audioRef.current?.setBGMVolume(0.35);
  };

  const playGameplayMusic = () => {
    audioRef.current?.playBGM("/audio/gameplay-loop.mp3");
    audioRef.current?.setBGMVolume(0.4);
  };

  const stopMusic = () => {
    audioRef.current?.stopBGM();
  };


  // ---------- navigation ----------
  const goHome = () => {
    if (st.view === "playing") {
      patch({ quitConfirm: true });
      return;
    }
    audioRef.current?.navigate();
    stopTimers();
    patch({ view: "home" });
  };
  const confirmQuit = () => {
    audioRef.current?.navigate();
    stopTimers();
    patch({ view: "home", quitConfirm: false });
  };
  const cancelQuit = () => {
    patch({ quitConfirm: false });
  };
  const pokeEye = () => {
    const newPokes = stateRef.current.eyePokes + 1;
    let expression: QState["eyeExpression"] = "normal";
    if (newPokes === 1) {
      audioRef.current?.menuClick();
      expression = "ouch";
    } else if (newPokes === 2) {
      audioRef.current?.errorSound();
      expression = "annoyed";
    } else if (newPokes === 3) {
      audioRef.current?.errorSound();
      expression = "angry";
    } else if (newPokes === 4) {
      audioRef.current?.errorSound();
      expression = "furious";
    } else if (newPokes >= 5) {
      audioRef.current?.chunk(1);
      expression = "middle-finger";
    }
    patch({ eyePokes: newPokes, eyeExpression: expression });
    clearTimeout(saveTORef.current);
    saveTORef.current = window.setTimeout(() => patch({ eyePokes: 0, eyeExpression: "normal" }), 2800);
  };
  const goSolo = () => {
    audioRef.current?.navigate();
    patch({ view: "solo" });
  };
  const goMulti = () => {
    audioRef.current?.navigate();
    patch({ view: "multi" });
  };
  const goBrowse = () => {
    audioRef.current?.navigate();
    patch({ view: "browse" });
    props.onQueryGames?.();
  };
  const goCreate = () => {
    audioRef.current?.navigate();
    patch({ view: "create", copyOk: false });
    props.onCreateMultiplayer?.(stateRef.current.playerName || "You");
  };
  const goJoin = () => {
    audioRef.current?.navigate();
    patch({ view: "join" });
  };
  const goLobby = () => {
    audioRef.current?.navigate();
    patch({ view: "lobby" });
  };
  const goLeaders = () => {
    audioRef.current?.navigate();
    patch({ view: "leaderboard" });
  };

  const onName = (e: React.ChangeEvent<HTMLInputElement>) =>
    patch({ playerName: e.target.value, nameSaved: false });
  const onSaveName = (e: React.MouseEvent) => {
    e.preventDefault();
    audioRef.current?.menuClick();
    const name = stateRef.current.playerName;
    if (containsProfanity(name)) {
      audioRef.current?.errorSound();
      patch({ playerName: "" });
      return;
    }
    try {
      localStorage.setItem("quickeye_player_name", name);
    } catch {
      /* ignore */
    }
    patch({ nameSaved: true });
    clearTimeout(saveTORef.current);
    saveTORef.current = window.setTimeout(() => patch({ nameSaved: false }), 1800);
  };
  const onCode = (e: React.ChangeEvent<HTMLInputElement>) =>
    patch({ joinCode: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 4) });
  const onCopyCode = () => {
    audioRef.current?.menuClick();
    try {
      navigator.clipboard?.writeText(stateRef.current.roomCode);
    } catch {
      /* ignore */
    }
    patch({ copyOk: true });
    clearTimeout(copyTORef.current);
    copyTORef.current = window.setTimeout(() => patch({ copyOk: false }), 1600);
  };

  // ---------- colour carousel ----------
  const maybeRecenter = () => {
    const N = COLORS.length;
    const REPS = 11;
    const total = N * REPS;
    const pos = stateRef.current.colorPos;
    if (pos < N * 3 || pos > total - N * 3) {
      const mid = N * Math.floor(REPS / 2);
      const shift = Math.round((mid - pos) / N) * N;
      if (shift !== 0) {
        patch({ colorNoAnim: true, colorPos: pos + shift });
        requestAnimationFrame(() => requestAnimationFrame(() => patch({ colorNoAnim: false })));
      }
    }
  };
  const setColorPos = (v: number) => {
    audioRef.current?.menuClick();
    patch({ colorPos: v, colorNoAnim: false });
    setTimeout(maybeRecenter, 340);
  };
  const nudgeColor = (dir: number) => {
    audioRef.current?.menuClick();
    patch((s) => ({ colorPos: s.colorPos + dir, colorNoAnim: false }));
    setTimeout(maybeRecenter, 340);
  };

  // ---------- game loop ----------
  const tick = () => {
    patch((s) => {
      const n = s.timeLeft - 1;
      if (n <= 0) {
        stopTimers();
        stopParticles();
        saveBest(s.mode, s.scores.you);
        return { timeLeft: 0, view: "over" };
      }
      return { timeLeft: n };
    });
  };
  const tickUp = () => patch((s) => ({ elapsed: s.elapsed + 1 }));
  const botTick = () => {
    patch((s) => {
      if (s.view !== "playing") return {};
      if (Math.random() > 0.55) return {};
      const who = Math.random() < 0.5 ? "bob" : "charlie";
      return { scores: { ...s.scores, [who]: s.scores[who] + 1 } };
    });
  };

  const startCountdown = (mode: GameModeKey) => {
    const now = Date.now();
    patch({
      countdownActive: true,
      countdownPhase: "counting",
      countdownStartTime: now,
      countdownNumber: 3,
    });

    // Schedule countdown numbers and sounds
    const times: Array<[number, 3 | 2 | 1 | "go"]> = [
      [500, 3],
      [1500, 2],
      [2500, 1],
      [3500, "go"],
    ];

    times.forEach(([delay, num]) => {
      countdownRef.current = window.setTimeout(() => {
        if (num === "go") {
          audioRef.current?.countdownGo();
          patch({ countdownNumber: null, countdownPhase: "go" });
          // After GO completes, transition to actual gameplay
          countdownRef.current = window.setTimeout(() => {
            const isRace = mode === "race";
            const state = stateRef.current;
            patch({
              countdownActive: false,
              countdownPhase: "complete",
              locked: false,
            });
            // Unlock game for play
            tRef.current = window.setInterval(isRace ? tickUp : tick, 1000);
            bRef.current = window.setInterval(botTick, OPP_INTERVAL_MS);
            setTimeout(startParticles, 70);
            playGameplayMusic();
          }, 500);
        } else {
          audioRef.current?.countdownBeep(num);
          patch({ countdownNumber: num });
        }
      }, delay);
    });
  };

  const begin = (mode: GameModeKey) => {
    audioRef.current?.ensure();
    stopTimers();
    t0Ref.current = Date.now();
    const isRace = mode === "race";
    patch({
      view: "playing",
      mode,
      scores: { you: 0, bob: 0, charlie: 0 },
      opps: pickOpps(),
      timeLeft: 60,
      elapsed: 0,
      round: makeRound(mode),
      matchedId: null,
      wrongId: null,
      locked: true,
      cullIdx: [],
      popIdx: [],
      tokenUsed: false,
      plusKey: 0,
      overCompare: false,
      revealUntil: 0,
      powerups: { pop: true, reveal: true, halve: true },
    });
    startCountdown(mode);
  };
  const startMarathon = () => {
    audioRef.current?.menuClick();
    begin("marathon");
  };
  const startRace = () => {
    audioRef.current?.menuClick();
    begin("race");
  };
  const startPower = () => {
    audioRef.current?.menuClick();
    begin("power");
  };
  const startFromMulti = () => {
    audioRef.current?.menuClick();
    if (stateRef.current.isMultiplayer) {
      props.onStartGame?.();
    } else {
      begin("marathon");
    }
  };
  const onPlayAgain = () => {
    audioRef.current?.menuClick();
    begin(stateRef.current.mode || "marathon");
  };

  // ---------- powerups ----------
  const popSeq = (list: number[], k: number) => {
    if (k >= list.length || stateRef.current.view !== "playing") return;
    audioRef.current?.popSound();
    patch((s) => ({ popIdx: [...s.popIdx, list[k]] }));
    popTORef.current = window.setTimeout(() => popSeq(list, k + 1), 200);
  };
  const restorePower = (type: PowerType | null) => {
    if (!type) return;
    audioRef.current?.blip(true);
    patch((s) => ({ powerups: { ...s.powerups, [type]: true }, tokenUsed: true }));
  };
  const usePower = (name: PowerType) => {
    const s = stateRef.current;
    if (s.view !== "playing" || s.mode !== "power") return;
    if (!s.powerups[name]) return;
    const pu = { ...s.powerups, [name]: false };
    const r = s.round;
    if (name === "reveal") {
      audioRef.current?.blip(true);
      patch({ powerups: pu, revealUntil: Date.now() + 1600 });
      clearTimeout(revTORef.current);
      revTORef.current = window.setTimeout(bump, 1660);
    } else if (name === "halve") {
      audioRef.current?.blip(true);
      const cand = r.player
        .map((_id, i) => i)
        .filter((i) => r.player[i] !== r.shared && i !== r.tokenIdx && !s.popIdx.includes(i));
      patch({ powerups: pu, cullIdx: shuffle(cand).slice(0, Math.ceil(cand.length / 2)) });
    } else if (name === "pop") {
      patch({ powerups: pu });
      const cand = r.player
        .map((_id, i) => i)
        .filter((i) => r.player[i] !== r.shared && i !== r.tokenIdx && !s.cullIdx.includes(i));
      popSeq(shuffle(cand), 0);
    }
  };
  usePowerRef.current = usePower;

  const pick = (id: number, i: number) => {
    const s = stateRef.current;
    if (s.locked) return;
    const r = s.round;
    if (s.mode === "power" && r.tokenIdx === i && !s.tokenUsed) {
      restorePower(r.tokenType);
      return;
    }
    if (s.cullIdx.includes(i) || s.popIdx.includes(i)) return;

    // In multiplayer, submit to server instead of handling locally
    if (s.isMultiplayer && s.gameId) {
      patch({ locked: true });
      props.onSubmitMatch?.(s.gameId, id);
      return;
    }

    if (id === r.shared) {
      const ns = s.scores.you + 1;
      audioRef.current?.chunk(ns);
      if (s.mode === "race" && ns >= 7) {
        const time = Math.max(0.1, (Date.now() - t0Ref.current) / 1000);
        stopTimers();
        stopParticles();
        saveBest("race", time);
        patch((s2) => ({
          scores: { ...s2.scores, you: ns },
          matchedId: id,
          locked: true,
          raceTime: time,
          view: "over",
        }));
        return;
      }
      const extra = s.mode === "power" ? 3 : 0;
      patch((s2) => ({
        scores: { ...s2.scores, you: ns },
        matchedId: id,
        locked: true,
        timeLeft: s2.timeLeft + extra,
        plusKey: extra ? Date.now() : s2.plusKey,
      }));
      setTimeout(
        () =>
          patch({
            round: makeRound(stateRef.current.mode),
            matchedId: null,
            locked: false,
            cullIdx: [],
            popIdx: [],
            tokenUsed: false,
          }),
        440
      );
    } else {
      audioRef.current?.wrongTone();
      patch({ wrongId: id, locked: true, shake: true });
      setTimeout(() => patch({ shake: false }), 340);
      setTimeout(() => patch({ wrongId: null, locked: false }), 400);
    }
  };

  const showStandings = () => patch({ overCompare: false });
  const showCompare = () => patch({ overCompare: true });

  // ---------- lifecycle ----------
  // mount: bg field, blink cycle, key handler, initial header
  useEffect(() => {
    blinkTORef.current = window.setTimeout(() => {
      patch((s) => ({ irisIdx: (s.irisIdx + 1) % IRIS_CYCLE.length }));
      blinkIntRef.current = window.setInterval(
        () => patch((s) => ({ irisIdx: (s.irisIdx + 1) % IRIS_CYCLE.length })),
        BLINK_MS
      );
    }, Math.round(BLINK_MS * 0.96));
    initBg();
    const keyHandler = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.view !== "playing" || s.mode !== "power") return;
      if (e.key === "1") usePowerRef.current("pop");
      else if (e.key === "2") usePowerRef.current("reveal");
      else if (e.key === "3") usePowerRef.current("halve");
    };
    window.addEventListener("keydown", keyHandler);
    const hdrTO = window.setTimeout(initHeader, 80);
    return () => {
      stopTimers();
      stopParticles();
      stopHeader();
      stopConfetti();
      cancelAnimationFrame(bgRafRef.current);
      clearTimeout(blinkTORef.current);
      clearInterval(blinkIntRef.current);
      clearTimeout(hdrTO);
      window.removeEventListener("keydown", keyHandler);
      if (bgResizeRef.current) window.removeEventListener("resize", bgResizeRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mouse tracking for logo eye animation
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      patch({ mousePos: [e.clientX, e.clientY] });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // view transitions (mirrors componentDidUpdate)
  useEffect(() => {
    const v = st.view;
    const prev = prevViewRef.current;
    if (prev !== "home" && v === "home") {
      setTimeout(initHeader, 60);
    }
    if (prev === "home" && v !== "home") stopHeader();

    // Only switch music when entering/leaving gameplay, not on menu transitions
    if (v === "playing" && prev !== "playing") {
      playGameplayMusic();
    } else if (v !== "playing" && prev === "playing") {
      stopParticles();
      playMenuMusic();
    }

    // First-time menu music on mount
    if (prev === "home" && v === "home" && st.view === "home") {
      playMenuMusic();
    }

    if (prev !== "over" && v === "over") {
      const rank = ranking(stateRef.current);
      const win = rank[0] && rank[0].id === "you";
      audioRef.current?.fanfare(!!win);
      patch({ overShake: true });
      clearTimeout(shTORef.current);
      shTORef.current = window.setTimeout(() => patch({ overShake: false }), 560);
      setTimeout(() => startConfetti(!!win), 40);
    }
    if (prev === "over" && v !== "over") stopConfetti();

    // Query leaderboard when entering leaderboard view
    if (prev !== "leaderboard" && v === "leaderboard") {
      props.onQueryLeaderboard?.(st.leaderTab);
    }

    prevViewRef.current = v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.view]);

  // sync server game state and match results
  useEffect(() => {
    if (props.gameState) {
      const gs = props.gameState;
      patch((s) => ({
        isMultiplayer: true,
        gameId: gs.gameId,
        playerId: gs.playerId,
        view: s.view === "join" || s.view === "browse" ? "lobby" : s.view,
      }));
    }
    if (props.matchResult) {
      if (props.matchResult.correct) {
        audioRef.current?.chunk((stateRef.current.scores.you || 0) + 1);
        patch((s) => ({ scores: { ...s.scores, you: s.scores.you + 1 }, locked: false }));
      } else {
        audioRef.current?.wrongTone();
        patch({ wrongId: props.matchResult.symbolId ?? -1, locked: true, shake: true });
        setTimeout(() => patch({ shake: false }), 340);
        setTimeout(() => patch({ wrongId: null, locked: false }), 400);
      }
    }
    if (props.error) {
      patch({ serverError: props.error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.gameState, props.matchResult, props.error]);

  // Query leaderboard when tab changes
  useEffect(() => {
    if (st.view === "leaderboard") {
      props.onQueryLeaderboard?.(st.leaderTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.leaderTab]);

  // ============================ sub-renders ============================
  const logoMark = (
    discSize: number,
    irisSize: number,
    tail: [number, number],
    withPupil: boolean,
    tracking: boolean = false,
    interactive: boolean = false
  ) => {
    const expr = st.eyeExpression;
    const isMiddleFinger = expr === "middle-finger";

    if (isMiddleFinger) {
      return (
        <div
          style={{
            width: discSize,
            height: discSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: discSize * 0.8,
            cursor: interactive ? "pointer" : "default",
            animation: expr === "furious" ? "qe-shake 0.2s ease-in-out" : undefined,
          }}
          onClick={interactive ? pokeEye : undefined}
        >
          🖕
        </div>
      );
    }

    let irisOffset = [0, 0];
    let irisScale = 1;
    let pupilScale = 1;
    let eyeLidTop = 0;

    if (tracking && withPupil) {
      const maxOffset = (discSize - irisSize) / 2 * 0.6;
      const dx = st.mousePos[0] - (discSize / 2);
      const dy = st.mousePos[1] - (discSize / 2);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const angle = Math.atan2(dy, dx);
      irisOffset = [Math.cos(angle) * maxOffset, Math.sin(angle) * maxOffset];
    }

    if (expr === "ouch") {
      irisScale = 0.7;
      pupilScale = 0.5;
      eyeLidTop = -3;
    } else if (expr === "annoyed") {
      eyeLidTop = -5;
      pupilScale = 0.3;
    } else if (expr === "angry") {
      eyeLidTop = -8;
      pupilScale = 0.2;
      irisScale = 0.8;
    } else if (expr === "furious") {
      eyeLidTop = -10;
      pupilScale = 0.1;
      irisScale = 0.6;
    }

    return (
      <div
        style={{
          position: "relative",
          width: discSize,
          height: discSize,
          cursor: interactive ? "pointer" : "default",
        }}
        onClick={interactive ? pokeEye : undefined}
      >
        <div
          style={{
            width: discSize,
            height: discSize,
            borderRadius: "50%",
            background: "#fff",
            border: `${Math.max(3, Math.round(discSize * 0.1))}px solid #000`,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "qe-blink 3.4s ease-in-out infinite",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {eyeLidTop !== 0 && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: discSize * 0.35,
                background: "#000",
                transform: `translateY(${eyeLidTop}px)`,
                zIndex: 10,
                transition: "transform 200ms ease",
              }}
            />
          )}
          <div
            style={{
              width: irisSize * irisScale,
              height: irisSize * irisScale,
              borderRadius: "50%",
              background: iris,
              transition: tracking ? "none" : "background 240ms ease, width 200ms ease, height 200ms ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: tracking ? `translate(${irisOffset[0]}px, ${irisOffset[1]}px)` : undefined,
            }}
          >
            {withPupil && (
              <div
                style={{
                  width: Math.round(irisSize * 0.37 * pupilScale),
                  height: Math.round(irisSize * 0.37 * pupilScale),
                  borderRadius: "50%",
                  background: "#121212",
                  transition: "width 200ms ease, height 200ms ease",
                }}
              />
            )}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: tail[0],
            height: tail[1],
            background: "#000",
            transform: "rotate(42deg)",
          }}
        />
      </div>
    );
  };

  const smallHeader = (title: string, onBack: () => void) => (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button className="qhov" onClick={onBack} style={backBtnStyle}>
          ‹
        </button>
        <div
          className="qlogo"
          onClick={goHome}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
        >
          {logoMark(34, 14, [14, 5], false)}
          <div
            style={{
              font: "900 22px 'Outfit',sans-serif",
              textTransform: "uppercase",
              letterSpacing: "-1px",
              color: "#F0F0F0",
            }}
          >
            {title}
          </div>
        </div>
      </div>
    </div>
  );

  const colorCarousel = () => {
    const STEP = 66;
    const VW = 330;
    const cx = VW / 2;
    const N = COLORS.length;
    const REPS = 11;
    const total = N * REPS;
    const pos = st.colorPos;
    const swatches = [];
    for (let v = 0; v < total; v++) {
      const ci = ((v % N) + N) % N;
      const selected = v === pos;
      const size = selected ? 52 : 32;
      swatches.push(
        <button
          key={v}
          onClick={() => setColorPos(v)}
          aria-label={COLORS[ci].name}
          style={{
            position: "absolute",
            left: v * STEP + STEP / 2,
            top: "50%",
            transform: "translate(-50%,-50%)",
            width: size,
            height: size,
            borderRadius: "50%",
            background: COLORS[ci].hex,
            cursor: "pointer",
            padding: 0,
            border: "4px solid #000",
            transition:
              "width 260ms cubic-bezier(.34,1.3,.5,1),height 260ms cubic-bezier(.34,1.3,.5,1),box-shadow 260ms",
            boxShadow: selected ? "0 0 0 4px #121212, 5px 5px 0 0 #000" : "3px 3px 0 0 #000",
          }}
        />
      );
    }
    const tx = cx - (pos + 0.5) * STEP;
    return (
      <div style={{ position: "relative", height: 80, maxWidth: VW }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: 1,
              transform: `translateX(${tx}px)`,
              transition: st.colorNoAnim ? "none" : "transform 320ms cubic-bezier(.34,1.2,.5,1)",
            }}
          >
            {swatches}
          </div>
        </div>
        <button onClick={() => nudgeColor(-1)} style={carouselArrow("left")}>
          ‹
        </button>
        <button onClick={() => nudgeColor(1)} style={carouselArrow("right")}>
          ›
        </button>
      </div>
    );
  };

  const browseList = () => {
    const games = props.availableGames || [];
    if (games.length === 0) {
      return (
        <div
          style={{
            textAlign: "center",
            color: "#666",
            font: "600 1rem 'Outfit',sans-serif",
            padding: "2rem",
          }}
        >
          No games available. Create one or check back later.
        </div>
      );
    }
    const joinBrowseGame = (gameId: string) => {
      audioRef.current?.menuClick();
      props.onJoinMultiplayer?.(gameId, stateRef.current.playerName || "You");
    };
    return games.map((game, i) => (
      <button
        key={i}
        className="qhov"
        onClick={() => joinBrowseGame(game.gameId)}
        style={{
          background: "#fff",
          border: "4px solid #000",
          padding: "1rem",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "4px 4px 0 0 #000",
          textAlign: "left",
        }}
      >
        <span
          style={{
            font: "900 1.4rem 'Outfit',sans-serif",
            color: "#1040C0",
            minWidth: 70,
            letterSpacing: "2px",
          }}
        >
          {game.gameId}
        </span>
        <span
          style={{
            flex: 1,
            margin: "0 14px",
            font: "600 0.9rem 'Outfit',sans-serif",
            color: "#121212",
          }}
        >
          Host: {game.host} · {game.playerCount} player{game.playerCount > 1 ? "s" : ""}
        </span>
        <span
          style={{
            color: "#D02020",
            font: "700 0.85rem 'Outfit',sans-serif",
            textTransform: "uppercase",
          }}
        >
          Join →
        </span>
      </button>
    ));
  };

  const globalBoard = () => {
    const tab = st.leaderTab;
    const race = tab === "race";
    const best = bestFor(tab);
    const serverEntries = props.leaderboards?.[tab] || [];
    const rows = [
      ...serverEntries.map((r: any) => ({ name: r.name || r.n, v: r.score as number | null, you: false })),
      { name: st.playerName || "You", v: best == null ? (race ? null : 0) : best, you: true },
    ];
    rows.sort((a, b) => {
      const av = a.v == null ? (race ? Infinity : -1) : a.v;
      const bv = b.v == null ? (race ? Infinity : -1) : b.v;
      return race ? av - bv : bv - av;
    });
    const medal = ["#F0C020", "#E0E0E0", "#F97316"];
    const fmt = (v: number | null) => (v == null ? "—" : race ? v.toFixed(1) + "s" : String(v));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.map((p, idx) => (
          <div
            key={idx}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 13,
              padding: "12px 15px",
              background: "#F0F0F0",
              border: "4px solid #000",
              boxShadow: "4px 4px 0 0 #000",
            }}
          >
            {p.you && <div style={glowStyle(pc, -6, "1.6s")} />}
            <div
              style={{
                width: 28,
                height: 28,
                flex: "none",
                background: p.you ? pc : idx < 3 ? medal[idx] : "#E0E0E0",
                color: p.you ? textOn(pc) : "#121212",
                font: "900 13px 'Outfit',sans-serif",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {idx + 1}
            </div>
            <span
              style={{
                flex: 1,
                font: `${p.you ? "900" : "700"} 15px 'Outfit',sans-serif`,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "#121212",
              }}
            >
              {p.name}
              {p.you ? " (you)" : ""}
            </span>
            <span style={{ font: "900 20px 'Outfit',sans-serif", color: "#121212" }}>{fmt(p.v)}</span>
          </div>
        ))}
      </div>
    );
  };

  const gridBox = (id: number, s: number, rot: number) => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `rotate(${rot}deg)`,
        transition: "transform 300ms ease",
      }}
    >
      <div style={glyphStyle(id, s)} />
    </div>
  );

  const centerGrid = (d: number) => {
    const r = st.round;
    const sc = 1 - d * 0.26;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 10,
          transform: `scale(${sc.toFixed(3)})`,
          transition: "transform 400ms ease",
        }}
      >
        {r.center.map((id, i) => (
          <div
            key={i}
            style={{
              aspectRatio: "1",
              background: "#F0F0F0",
              border: "3px solid #121212",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {gridBox(id, 50, d * (i % 2 ? 18 : -18))}
          </div>
        ))}
      </div>
    );
  };

  const playerGrid = (d: number, revealActive: boolean) => {
    const r = st.round;
    const { matchedId, wrongId, cullIdx, popIdx, tokenUsed } = st;
    const sc = 1 - d * 0.26;
    const shared = r.shared;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 10,
          transform: `scale(${sc.toFixed(3)})`,
          transition: "transform 400ms ease",
        }}
      >
        {r.player.map((id, i) => {
          if (st.mode === "power" && r.tokenIdx === i && !tokenUsed) {
            const tt = r.tokenType!;
            const tcol = POWER_COL[tt];
            return (
              <button
                key={i}
                className="qtile"
                onClick={() => pick(id, i)}
                style={{
                  aspectRatio: "1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  border: "3px solid #121212",
                  cursor: "pointer",
                  padding: 0,
                  background: tcol,
                  color: textOn(tcol),
                  boxShadow: "3px 3px 0 0 #121212",
                  animation: "qe-tokenpulse 0.9s ease-in-out infinite",
                }}
              >
                <div style={{ font: "900 16px 'Outfit',sans-serif" }}>★</div>
                <div
                  style={{
                    font: "800 8px 'Outfit',sans-serif",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {tt}
                </div>
              </button>
            );
          }
          if (popIdx.includes(i)) {
            const col = PALETTE[GLYPHS[id % GLYPHS.length].c];
            const shards = [...Array(6)].map((_, k) => {
              const ang = (k / 6) * 6.28;
              return (
                <div
                  key={k}
                  style={
                    {
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: 9,
                      height: 9,
                      marginLeft: -4,
                      marginTop: -4,
                      background: col,
                      borderRadius: "2px",
                      "--tx": Math.cos(ang) * 26 + "px",
                      "--ty": Math.sin(ang) * 26 + "px",
                      animation: "qe-shard 0.5s ease-out forwards",
                    } as CSSProperties
                  }
                />
              );
            });
            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  aspectRatio: "1",
                  background: "#f7f7f7",
                  border: "3px solid #eee",
                  overflow: "visible",
                }}
              >
                {shards}
              </div>
            );
          }
          if (cullIdx.includes(i)) {
            return (
              <div
                key={i}
                style={{ aspectRatio: "1", background: "#ececec", border: "3px dashed #cccccc" }}
              />
            );
          }
          const isMatch = matchedId === id;
          const isWrong = wrongId === id;
          const isReveal = revealActive && id === shared;
          return (
            <button
              key={i}
              className="qtile"
              onClick={() => pick(id, i)}
              style={{
                aspectRatio: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "3px solid #121212",
                cursor: "pointer",
                padding: 0,
                background: isMatch ? pc : isWrong ? "#D02020" : "#fff",
                boxShadow: isMatch ? "4px 4px 0 0 #121212" : "3px 3px 0 0 #121212",
                animation: isMatch
                  ? "qe-pulse 0.45s ease-out"
                  : isWrong
                  ? "qe-shake 0.4s ease-in-out"
                  : isReveal
                  ? "qe-reveal 0.6s ease-in-out infinite"
                  : "none",
              }}
            >
              {gridBox(id, 50, d * (i % 2 ? -18 : 18))}
            </button>
          );
        })}
      </div>
    );
  };

  const liveLeaderboard = () => {
    const rank = ranking(st);
    const CARD = 246;
    const GAP = 11;
    const STEP = CARD + GAP;
    const H = 56;
    return (
      <div style={{ position: "relative", height: H, width: CARD * 3 + GAP * 2 }}>
        {(["you", "bob", "charlie"] as const).map((pid) => {
          const idx = rank.findIndex((r) => r.id === pid);
          const p = rank[idx];
          const first = idx === 0;
          const isYou = pid === "you";
          return (
            <div
              key={pid}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: CARD,
                height: H,
                boxSizing: "border-box",
                transform: `translateX(${idx * STEP}px)`,
                transition: "transform 480ms cubic-bezier(0.34,1.3,0.5,1)",
                background: first ? "#F0C020" : "#fff",
                border: "4px solid #000",
                boxShadow: "5px 5px 0 0 #000",
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "0 14px",
              }}
            >
              {isYou && <div style={glowStyle(pc, -5, "1.5s")} />}
              <div
                style={{
                  width: 26,
                  height: 26,
                  flex: "none",
                  background: isYou ? pc : first ? "#121212" : "#E0E0E0",
                  color: isYou ? textOn(pc) : first ? "#fff" : "#121212",
                  font: "900 13px 'Outfit',sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {idx + 1}
              </div>
              <span
                style={{
                  flex: 1,
                  font: `${first ? "900" : "700"} 14px 'Outfit',sans-serif`,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "#121212",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name}
              </span>
              <span style={{ font: "900 22px 'Outfit',sans-serif", color: "#121212" }}>
                {p.score}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const finalBoard = () => {
    const rank = ranking(st);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rank.map((p, idx) => (
          <div
            key={p.id}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              background: idx === 0 ? "#F0C020" : "#F0F0F0",
              border: "4px solid #121212",
              boxShadow: idx === 0 ? "6px 6px 0 0 #121212" : "4px 4px 0 0 #121212",
              animation: "qe-pop 0.4s ease-out both",
              animationDelay: `${idx * 0.08}s`,
            }}
          >
            {p.id === "you" && <div style={glowStyle(pc, -6, "1.6s")} />}
            <div
              style={{
                width: 34,
                height: 34,
                flex: "none",
                background: p.id === "you" ? pc : "#121212",
                color: p.id === "you" ? textOn(pc) : "#fff",
                font: "900 15px 'Outfit',sans-serif",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {idx + 1}
            </div>
            <span
              style={{
                flex: 1,
                font: "900 16px 'Outfit',sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "#121212",
              }}
            >
              {p.name}
              {p.id === "you" ? " (you)" : ""}
            </span>
            <span style={{ font: "900 24px 'Outfit',sans-serif", color: "#121212" }}>{p.score}</span>
          </div>
        ))}
      </div>
    );
  };

  const compareView = () => {
    const rank = ranking(st);
    const max = Math.max(1, rank[0].score);
    const youIdx = rank.findIndex((r) => r.id === "you");
    const you = rank[youIdx];
    const leader = rank[0];
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              font: "700 11px 'Outfit',sans-serif",
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            You placed
          </div>
          <div
            style={{
              font: "900 30px 'Outfit',sans-serif",
              textTransform: "uppercase",
              letterSpacing: "-1px",
              color: "#121212",
              lineHeight: 1,
            }}
          >
            {ordinal(youIdx + 1)} of {rank.length}
          </div>
          <div style={{ font: "600 13px 'Outfit',sans-serif", color: "#555", marginTop: 4 }}>
            {youIdx === 0
              ? `Leading by ${you.score - (rank[1] ? rank[1].score : 0)} pts`
              : `${leader.score - you.score} pts behind ${leader.name}`}
          </div>
        </div>
        <div>
          {rank.map((p) => {
            const isYou = p.id === "you";
            return (
              <div
                key={p.id}
                style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 11 }}
              >
                <div
                  style={{
                    width: 74,
                    font: `${isYou ? "900" : "700"} 13px 'Outfit',sans-serif`,
                    textTransform: "uppercase",
                    color: "#121212",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 30,
                    background: "#F0F0F0",
                    border: "3px solid #121212",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${Math.round((p.score / max) * 100)}%`,
                      minWidth: p.score > 0 ? 8 : 0,
                      background: isYou ? pc : "#121212",
                      transition: "width 520ms cubic-bezier(.34,1.2,.5,1)",
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 30,
                    textAlign: "right",
                    font: "900 18px 'Outfit',sans-serif",
                    color: "#121212",
                  }}
                >
                  {p.score}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const powerHud = () => {
    const pu = st.powerups;
    const defs: [PowerType, string, string, string][] = [
      ["pop", "1", "Pop", "#1040C0"],
      ["reveal", "2", "Reveal", "#22C55E"],
      ["halve", "3", "Halve", "#F0C020"],
    ];
    return (
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {defs.map(([key, num, label, col]) => {
          const avail = pu[key];
          return (
            <button
              key={key}
              onClick={() => usePower(key)}
              disabled={!avail}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                border: "3px solid #000",
                cursor: avail ? "pointer" : "default",
                background: avail ? col : "#2a2a2a",
                color: avail ? textOn(col) : "#666",
                boxShadow: avail ? "3px 3px 0 0 #000" : "none",
                opacity: avail ? 1 : 0.6,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#121212",
                  color: "#fff",
                  font: "900 12px 'Outfit',sans-serif",
                }}
              >
                {num}
              </span>
              <span
                style={{
                  font: "900 12px 'Outfit',sans-serif",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                {avail ? label : label + " ✓"}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  // ============================ screen JSX ============================
  const isRace = st.mode === "race";
  const d = tension;
  const revealActive = !!(st.revealUntil && Date.now() < st.revealUntil);
  const danger = isRace ? st.scores.you >= 6 : st.timeLeft <= 5;
  const barW = isRace ? (st.scores.you / 7) * 100 : (st.timeLeft / 60) * 100;
  const boardColor = pc.toUpperCase() === "#D02020" ? "#1040C0" : "#D02020";
  const rank = ranking(st);
  const showPlus = st.plusKey && Date.now() - st.plusKey <= 900;

  return (
    <>
      <canvas ref={bgRef} className="qe-bg" />
      <div className="qe-root">
        {/* ===== HOME ===== */}
        {st.view === "home" && (
          <div style={panelStyle(720, true)}>
            <div style={{ position: "relative" }}>
              <div
                ref={hdrRef}
                style={{ height: 210, background: "#000", overflow: "hidden", cursor: "crosshair" }}
              />
              <div
                className="qlogo"
                onClick={goHome}
                style={{
                  position: "absolute",
                  left: 30,
                  bottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                {logoMark(100, 40, [40, 13], true, true, true)}
                <div
                  style={{
                    font: "900 48px/1 'Outfit',sans-serif",
                    textTransform: "uppercase",
                    letterSpacing: "-2px",
                    color: "#fff",
                  }}
                >
                  uickeye
                </div>
              </div>
            </div>
            <div style={{ padding: "26px 30px 30px", display: "flex", gap: 30, alignItems: "stretch" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={labelStyle}>Your name</div>
                <div style={{ position: "relative", marginBottom: 22 }}>
                  <input
                    className="qe-input"
                    value={st.playerName}
                    onChange={onName}
                    placeholder="Player name"
                    maxLength={14}
                    style={{
                      width: "100%",
                      padding: "0.85rem 6.2rem 0.85rem 1rem",
                      font: "700 1.05rem 'Outfit',sans-serif",
                      border: "4px solid #000",
                      background: "#F0F0F0",
                      boxSizing: "border-box",
                      color: "#121212",
                      transition: "background 200ms ease",
                    }}
                  />
                  <button
                    className="qhov"
                    onMouseDown={onSaveName}
                    style={{
                      position: "absolute",
                      right: 7,
                      top: "50%",
                      transform: "translateY(-50%)",
                      padding: "0.5rem 0.8rem",
                      font: "800 12px 'Outfit',sans-serif",
                      background: st.nameSaved ? "#22C55E" : "#121212",
                      color: "#fff",
                      border: "3px solid #000",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      transition: "background 200ms",
                    }}
                  >
                    {st.nameSaved ? "✓ Saved" : "Save"}
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <div style={labelStyle}>Player colour</div>
                  <div
                    style={{
                      font: "900 12px 'Outfit',sans-serif",
                      color: pc,
                      transition: "color 240ms",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {COLORS[colorSel(st)].name}
                  </div>
                </div>
                {colorCarousel()}
              </div>
              <div
                style={{ width: 268, flex: "none", display: "flex", flexDirection: "column", gap: 12 }}
              >
                <button
                  className="qhov"
                  onClick={goSolo}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    padding: "1rem 1.15rem",
                    font: "900 1.15rem 'Outfit',sans-serif",
                    background: pc,
                    color: textOn(pc),
                    border: "4px solid #000",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    boxShadow: "5px 5px 0 0 #000",
                    transition: "background 240ms",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "0.9em" }}>▶</span> Play Solo
                  </span>
                </button>
                <button className="qhov" onClick={goMulti} style={darkMenuBtn}>
                  <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ display: "flex", gap: 4 }}>
                      <span style={dot("#D02020")} />
                      <span style={dot("#F0C020")} />
                      <span style={dot("#1040C0")} />
                    </span>{" "}
                    Multiplayer
                  </span>
                  <span style={{ fontSize: "1.2rem" }}>→</span>
                </button>
                <button className="qhov" onClick={goLeaders} style={yellowMenuBtn}>
                  <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 16 }}>
                      <span style={{ width: 5, height: 8, background: "#121212" }} />
                      <span style={{ width: 5, height: 16, background: "#121212" }} />
                      <span style={{ width: 5, height: 11, background: "#121212" }} />
                    </span>{" "}
                    Leaderboard
                  </span>
                  <span style={{ fontSize: "1.2rem" }}>→</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== SOLO ===== */}
        {st.view === "solo" && (
          <div style={panelStyle(680)}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
              <button className="qhov" onClick={goHome} style={backBtnStyle}>
                ‹
              </button>
              <div
                className="qlogo"
                onClick={goHome}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
              >
                {logoMark(34, 14, [14, 5], false)}
                <div
                  style={{
                    font: "900 22px 'Outfit',sans-serif",
                    textTransform: "uppercase",
                    letterSpacing: "-1px",
                    color: "#F0F0F0",
                  }}
                >
                  Solo
                </div>
              </div>
            </div>
            <div
              style={{
                font: "500 14px/1.5 'Outfit',sans-serif",
                color: "#bbb",
                margin: "0 0 20px 58px",
              }}
            >
              Choose how you want to play.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              <button className="qhov" onClick={startMarathon} style={modeCard("#D02020", "#fff")}>
                {marathonDiagram()}
                <span style={modeTitle}>Marathon</span>
                <span style={modeSub}>60 seconds</span>
                <span style={{ ...modeDesc, opacity: 0.9 }}>Rack up as many matches as you can</span>
              </button>
              <button className="qhov" onClick={startRace} style={modeCard("#F0C020", "#121212")}>
                {raceDiagram()}
                <span style={modeTitle}>Race the Clock</span>
                <span style={modeSub}>First to 7</span>
                <span style={{ ...modeDesc, opacity: 0.75 }}>
                  Hit 7 matches as fast as you can
                </span>
              </button>
              <button className="qhov" onClick={startPower} style={modeCard("#1040C0", "#fff")}>
                {powerPlayDiagram()}
                <span style={modeTitle}>Power Play</span>
                <span style={modeSub}>60 seconds</span>
                <span style={{ ...modeDesc, opacity: 0.9 }}>Use power-ups to win fast</span>
              </button>
            </div>
          </div>
        )}

        {/* ===== MULTIPLAYER ===== */}
        {st.view === "multi" && (
          <div style={panelStyle(640)}>
            {smallHeader("Multiplayer", goHome)}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              <button className="qhov" onClick={goBrowse} style={multiCard("#D02020", "#fff")}>
                <span
                  style={{ width: 30, height: 30, borderRadius: "50%", border: "5px solid #fff", boxSizing: "border-box" }}
                />
                <span style={multiLabel}>
                  Browse
                  <br />
                  Games
                </span>
              </button>
              <button className="qhov" onClick={goCreate} style={multiCard("#1040C0", "#fff")}>
                <span style={{ width: 30, height: 30, background: "#fff" }} />
                <span style={multiLabel}>
                  Create
                  <br />
                  Game
                </span>
              </button>
              <button className="qhov" onClick={goJoin} style={multiCard("#F0C020", "#121212")}>
                <span
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "17px solid transparent",
                    borderRight: "17px solid transparent",
                    borderBottom: "30px solid #121212",
                  }}
                />
                <span style={multiLabel}>
                  Join
                  <br />
                  with Code
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ===== LEADERBOARD ===== */}
        {st.view === "leaderboard" && (
          <div style={panelStyle(560)}>
            {smallHeader("Leaderboard", goHome)}
            <div style={{ display: "flex", gap: 0, border: "3px solid #3a3a3a", width: "fit-content", marginBottom: 16 }}>
              <button onClick={() => patch({ leaderTab: "marathon" })} style={seg(st.leaderTab === "marathon")}>
                Marathon
              </button>
              <button onClick={() => patch({ leaderTab: "race" })} style={seg(st.leaderTab === "race")}>
                Race
              </button>
              <button onClick={() => patch({ leaderTab: "power" })} style={seg(st.leaderTab === "power")}>
                Power
              </button>
            </div>
            <div
              style={{
                font: "700 10px 'Outfit',sans-serif",
                color: "#666",
                textTransform: "uppercase",
                letterSpacing: "2px",
                marginBottom: 10,
              }}
            >
              {st.leaderTab === "race" ? "Fastest time to 7" : "Best round score"}
            </div>
            {globalBoard()}
          </div>
        )}

        {/* ===== BROWSE ===== */}
        {st.view === "browse" && (
          <div style={panelStyle(560)}>
            {smallHeader("Available Games", goMulti)}
            <button
              className="qhov"
              onClick={() => {
                audioRef.current?.menuClick();
                props.onQueryGames?.();
              }}
              style={{
                background: "#121212",
                color: "#fff",
                border: "3px solid #121212",
                padding: "0.5rem 1rem",
                font: "600 0.9rem 'Outfit',sans-serif",
                cursor: "pointer",
                marginBottom: 12,
                width: "fit-content",
              }}
            >
              ↻ Refresh Games
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 300, overflowY: "auto" }}>{browseList()}</div>
          </div>
        )}

        {/* ===== CREATE ===== */}
        {st.view === "create" && (
          <div style={panelStyle(520)}>
            {smallHeader("Create Game", goMulti)}
            <div style={labelStyle}>Your room code</div>
            <div style={{ display: "flex", gap: 12, alignItems: "stretch", marginBottom: 20, marginTop: 10 }}>
              <div
                style={{
                  flex: 1,
                  background: "#F0C020",
                  border: "4px solid #000",
                  boxShadow: "5px 5px 0 0 #000",
                  padding: "1.2rem",
                  textAlign: "center",
                }}
              >
                <span style={{ font: "900 3rem/1 'Outfit',sans-serif", color: "#121212", letterSpacing: "10px" }}>
                  {props.gameState?.gameId || "..."}
                </span>
              </div>
              <button
                className="qhov"
                onClick={onCopyCode}
                style={{
                  flex: "none",
                  width: 110,
                  font: "900 0.95rem 'Outfit',sans-serif",
                  background: st.copyOk ? "#22C55E" : "#121212",
                  color: "#fff",
                  border: "4px solid #000",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  boxShadow: "5px 5px 0 0 #000",
                  transition: "background 200ms",
                }}
              >
                {st.copyOk ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <div style={{ font: "500 13px/1.5 'Outfit',sans-serif", color: "#bbb", marginBottom: 20 }}>
              Share the code so friends can join. Start whenever you're ready.
            </div>
            <button className="qhov" onClick={startFromMulti} style={primaryWide}>
              Start Game
            </button>
          </div>
        )}

        {/* ===== LOBBY ===== */}
        {st.view === "lobby" && (
          <div style={panelStyle(520)}>
            {smallHeader("Waiting Room", goMulti)}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ font: "500 13px 'Outfit',sans-serif", color: "#999", marginBottom: 10 }}>
                GAME CODE
              </div>
              <div style={{ font: "900 3.5rem 'Outfit',sans-serif", color: "#F0C020", letterSpacing: "12px", marginBottom: 20 }}>
                {props.gameState?.gameId || st.roomCode}
              </div>
              <div style={{ font: "500 13px 'Outfit',sans-serif", color: "#999", marginBottom: 10 }}>
                PLAYERS
              </div>
              <div style={{ font: "500 13px/1.8 'Outfit',sans-serif", color: "#bbb", marginBottom: 20 }}>
                {props.gameState?.players?.map((p: any) => p.name).join(", ") || "Waiting for players..."}
              </div>
              {st.playerId !== props.gameState?.hostId && (
                <div style={{ font: "500 13px/1.5 'Outfit',sans-serif", color: "#bbb" }}>
                  Waiting for host to start...
                </div>
              )}
            </div>
            {st.playerId === props.gameState?.hostId && (
              <button
                className="qhov"
                onClick={() => {
                  audioRef.current?.menuClick();
                  props.onStartGame?.();
                }}
                style={primaryWide}
              >
                Start Game
              </button>
            )}
            <button
              className="qhov"
              onClick={goMulti}
              style={{...primaryWide, background: "#666", marginTop: st.playerId === props.gameState?.hostId ? 10 : 0}}
            >
              Back to Menu
            </button>
          </div>
        )}

        {/* ===== JOIN ===== */}
        {st.view === "join" && (
          <div style={panelStyle(520)}>
            {smallHeader("Join Room", goMulti)}
            <div style={labelStyle}>Room code (4 characters)</div>
            <input
              className="qe-input"
              value={st.joinCode}
              onChange={onCode}
              inputMode="numeric"
              placeholder="0000"
              maxLength={4}
              style={{
                width: "100%",
                padding: "1rem",
                font: "900 1.8rem 'Outfit',sans-serif",
                letterSpacing: "10px",
                textAlign: "center",
                border: "4px solid #000",
                background: "#F0C020",
                boxSizing: "border-box",
                color: "#121212",
                margin: "10px 0 20px",
                outline: "none",
              }}
            />
            <button
              className="qhov"
              onClick={() => {
                audioRef.current?.menuClick();
                props.onJoinMultiplayer?.(stateRef.current.joinCode, stateRef.current.playerName || "You");
              }}
              style={primaryWide}
            >
              Join Game
            </button>
          </div>
        )}

        {/* ===== PLAYING ===== */}
        {st.view === "playing" && (
          <div style={st.shake ? { animation: "qe-screenshake 0.34s cubic-bezier(.36,.07,.19,.97)" } : undefined}>
            <div style={{ transform: "scale(1.06)", transformOrigin: "center center" }}>
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  width: 820,
                  background: "#121212",
                  border: "4px solid #000",
                  boxShadow: "10px 10px 0 0 #000",
                  padding: 26,
                  boxSizing: "border-box",
                }}
              >
                <canvas
                  ref={canvasRef}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 0,
                    pointerEvents: "none",
                    background:
                      "radial-gradient(130% 100% at 50% 118%, rgba(255,96,20,0.9), rgba(255,40,0,0) 62%)",
                    opacity: Number((tension * 0.6).toFixed(3)),
                    transition: "opacity 900ms linear",
                  }}
                />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <div
                      className="qlogo"
                      onClick={goHome}
                      style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                      title="Back to home"
                    >
                      {logoMark(48, 19, [19, 6], true, true)}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div
                          style={{
                            font: "900 28px/0.9 'Outfit',sans-serif",
                            textTransform: "uppercase",
                            letterSpacing: "-1.5px",
                            color: "#F0F0F0",
                          }}
                        >
                          Quickeye
                        </div>
                        <div
                          style={{
                            font: "700 10px 'Outfit',sans-serif",
                            color: "#888",
                            textTransform: "uppercase",
                            letterSpacing: "2px",
                            marginTop: 3,
                          }}
                        >
                          {MODE_LABEL[st.mode]}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <button
                        className="qhov"
                        onClick={goHome}
                        style={{
                          padding: "8px 14px",
                          background: "transparent",
                          color: "#999",
                          border: "3px solid #3a3a3a",
                          font: "700 11px 'Outfit',sans-serif",
                          textTransform: "uppercase",
                          letterSpacing: "1.5px",
                          cursor: "pointer",
                        }}
                      >
                        ‹ Quit
                      </button>
                      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div
                          style={{
                            font: "900 48px 'Outfit',sans-serif",
                            color: danger ? "#D02020" : "#fff",
                            animation: danger ? "qe-num-pulse 0.6s ease-in-out infinite" : "none",
                            lineHeight: 1,
                            textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          }}
                        >
                          {isRace ? st.elapsed.toFixed(1) : st.timeLeft}
                        </div>
                        <div
                          style={{
                            font: "700 11px 'Outfit',sans-serif",
                            color: danger ? "#D02020" : "#888",
                            textTransform: "uppercase",
                            letterSpacing: "1.5px",
                          }}
                        >
                          {isRace ? `sec · ${st.scores.you}/7` : "sec remaining"}
                        </div>
                        {showPlus ? (
                          <div
                            key={st.plusKey}
                            style={{
                              position: "absolute",
                              right: 0,
                              top: -26,
                              font: "900 18px 'Outfit',sans-serif",
                              color: "#22C55E",
                              animation: "qe-floatup 0.9s ease-out forwards",
                              pointerEvents: "none",
                            }}
                          >
                            +3s
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      height: 16,
                      background: "#000",
                      border: "3px solid #000",
                      marginBottom: 18,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: `${Math.max(0, Math.min(100, barW))}%`,
                        background: danger ? "#D02020" : isRace ? pc : "#F0C020",
                        animation: danger ? "qe-bar-pulse 0.6s ease-in-out infinite" : "none",
                        transition: "width 700ms ease",
                      }}
                    />
                  </div>
                  {st.mode === "power" && powerHud()}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 22,
                      alignItems: "start",
                      marginBottom: 22,
                    }}
                  >
                    <div style={{ border: "4px solid #000", background: "#fff", boxShadow: "6px 6px 0 0 #000" }}>
                      <div style={cardHeader(boardColor, "#fff")}>Match Board</div>
                      <div style={{ padding: 20, overflow: "hidden" }}>{centerGrid(d)}</div>
                    </div>
                    <div style={{ border: "4px solid #000", background: "#fff", boxShadow: "6px 6px 0 0 #000" }}>
                      <div style={cardHeader(pc, textOn(pc))}>
                        {(st.playerName || "You") + " · tap to match"}
                      </div>
                      <div style={{ padding: 20, overflow: "hidden" }}>{playerGrid(d, revealActive)}</div>
                    </div>
                  </div>
                  <div
                    style={{
                      font: "700 10px 'Outfit',sans-serif",
                      color: "#888",
                      textTransform: "uppercase",
                      letterSpacing: "2px",
                      marginBottom: 8,
                    }}
                  >
                    Live standings
                  </div>
                  {liveLeaderboard()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== QUIT CONFIRMATION ===== */}
        {st.quitConfirm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
            }}
            onClick={cancelQuit}
          >
            <div
              style={{
                background: "#fff",
                border: "4px solid #000",
                borderRadius: "8px",
                padding: "32px",
                maxWidth: 400,
                boxShadow: "12px 12px 0 0 #000",
                textAlign: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  font: "900 24px 'Outfit',sans-serif",
                  marginBottom: 16,
                  color: "#121212",
                }}
              >
                Quit Game?
              </div>
              <div
                style={{
                  font: "500 14px 'Outfit',sans-serif",
                  color: "#666",
                  marginBottom: 24,
                }}
              >
                Your progress will be lost. Are you sure?
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <button
                  onClick={cancelQuit}
                  style={{
                    padding: "12px",
                    font: "700 14px 'Outfit',sans-serif",
                    background: "#f0f0f0",
                    border: "2px solid #000",
                    cursor: "pointer",
                    borderRadius: "4px",
                  }}
                >
                  Keep Playing
                </button>
                <button
                  onClick={confirmQuit}
                  style={{
                    padding: "12px",
                    font: "700 14px 'Outfit',sans-serif",
                    background: "#D02020",
                    color: "#fff",
                    border: "2px solid #000",
                    cursor: "pointer",
                    borderRadius: "4px",
                  }}
                >
                  Quit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== COUNTDOWN OVERLAY ===== */}
        {st.countdownActive && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: st.countdownPhase === "complete" ? "none" : "auto",
            }}
          >
            {/* Tutorial spotlight overlay - dims everything except spotlit area */}
            {(st.countdownNumber === 3 || st.countdownNumber === 2 || st.countdownNumber === 1) && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    st.countdownNumber === 3
                      ? "radial-gradient(ellipse 280px 220px at 50% 35%, transparent 0%, rgba(0,0,0,0.8) 100%)"
                      : st.countdownNumber === 2
                      ? "radial-gradient(ellipse 280px 220px at 50% 65%, transparent 0%, rgba(0,0,0,0.8) 100%)"
                      : "radial-gradient(ellipse 350px 260px at 50% 50%, transparent 0%, rgba(0,0,0,0.8) 100%)",
                  transition: "background 800ms ease-out",
                  zIndex: 5,
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Background dimming */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0, 0, 0, 0.5)",
                opacity:
                  st.countdownPhase === "go"
                    ? 0
                    : st.countdownNumber === 3
                    ? 0.4
                    : st.countdownNumber === 2
                    ? 0.35
                    : st.countdownNumber === 1
                    ? 0.25
                    : 0.5,
                transition: "opacity 600ms ease-out",
                zIndex: 3,
                pointerEvents: "none",
              }}
            />
            {st.countdownNumber !== null && (
              <div
                style={{
                  fontSize: "clamp(8rem, 25vw, 18rem)",
                  fontWeight: "900",
                  fontFamily: "'Outfit', sans-serif",
                  color:
                    st.countdownNumber === 3
                      ? "#D02020"
                      : st.countdownNumber === 2
                      ? "#F0C020"
                      : "#3366FF",
                  textShadow: "0 0 40px rgba(0, 0, 0, 0.8)",
                  animation: "qe-countdown-scale 0.6s cubic-bezier(0.34, 1.2, 0.5, 1)",
                  zIndex: 1,
                }}
              >
                {st.countdownNumber}
              </div>
            )}
            {st.countdownPhase === "go" && (
              <div
                style={{
                  fontSize: "clamp(6rem, 20vw, 14rem)",
                  fontWeight: "900",
                  fontFamily: "'Outfit', sans-serif",
                  color: "#22C55E",
                  textShadow: "0 0 50px rgba(34, 197, 94, 0.6)",
                  animation: "qe-countdown-scale 0.8s cubic-bezier(0.34, 1.2, 0.5, 1)",
                  zIndex: 1,
                }}
              >
                GO!
              </div>
            )}
          </div>
        )}

        {/* ===== GAME OVER ===== */}
        {st.view === "over" && (
          <div
            style={{
              width: 500,
              background: "#fff",
              border: "4px solid #000",
              boxShadow: "12px 12px 0 0 #000",
              padding: "38px 34px",
              position: "relative",
              boxSizing: "border-box",
              animation: st.overShake ? "qe-screenshake 0.5s cubic-bezier(.36,.07,.19,.97)" : "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -28,
                left: -28,
                width: 88,
                height: 88,
                background: "#D02020",
                border: "4px solid #000",
                transform: "rotate(45deg)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -34,
                right: -34,
                width: 104,
                height: 104,
                border: "4px solid #000",
                borderRadius: "50%",
                background: "#F0C020",
              }}
            />
            <div style={{ position: "relative" }}>
              <div
                style={{
                  font: "700 12px 'Outfit',sans-serif",
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: "3px",
                  marginBottom: 4,
                }}
              >
                {isRace ? "Race complete" : "Time up"}
              </div>
              <h2
                style={{
                  margin: "0 0 18px",
                  font: "900 clamp(2rem,6.5vw,2.8rem)/0.9 'Outfit',sans-serif",
                  textTransform: "uppercase",
                  letterSpacing: "-2px",
                  color: "#121212",
                }}
              >
                {isRace ? `${st.raceTime.toFixed(1)}s` : `${rank[0] ? rank[0].name : ""} wins`}
              </h2>
              <div style={{ display: "flex", gap: 0, marginBottom: 18, border: "3px solid #121212", width: "fit-content" }}>
                <button onClick={showStandings} style={seg(!st.overCompare)}>
                  Standings
                </button>
                <button onClick={showCompare} style={seg(st.overCompare)}>
                  Compare
                </button>
              </div>
              <div style={{ marginBottom: 24 }}>{st.overCompare ? compareView() : finalBoard()}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <button
                  className="qhov"
                  onClick={onPlayAgain}
                  style={{
                    padding: "1.1rem",
                    font: "900 0.95rem 'Outfit',sans-serif",
                    background: "#D02020",
                    color: "#fff",
                    border: "4px solid #000",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    boxShadow: "5px 5px 0 0 #000",
                  }}
                >
                  Play Again
                </button>
                <button
                  className="qhov"
                  onClick={goHome}
                  style={{
                    padding: "1.1rem",
                    font: "900 0.95rem 'Outfit',sans-serif",
                    background: "#1040C0",
                    color: "#fff",
                    border: "4px solid #000",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    boxShadow: "5px 5px 0 0 #000",
                  }}
                >
                  Home
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <canvas ref={overRef} className="qe-over-canvas" />
    </>
  );
}

// ---------- shared inline-style helpers ----------
function panelStyle(width: number, overflowHidden = false): CSSProperties {
  return {
    width,
    background: "#121212",
    border: "4px solid #000",
    boxShadow: "12px 12px 0 0 #000",
    padding: overflowHidden ? 0 : "22px 28px 30px",
    overflow: overflowHidden ? "hidden" : undefined,
    boxSizing: "border-box",
  };
}
const labelStyle: CSSProperties = {
  font: "700 11px 'Outfit',sans-serif",
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: "2px",
  marginBottom: 8,
};
const backBtnStyle: CSSProperties = {
  width: 44,
  height: 44,
  flex: "none",
  background: "transparent",
  color: "#fff",
  border: "3px solid #3a3a3a",
  font: "900 18px 'Outfit',sans-serif",
  cursor: "pointer",
};
function carouselArrow(side: "left" | "right"): CSSProperties {
  return {
    position: "absolute",
    [side]: -8,
    top: "50%",
    transform: "translateY(-50%)",
    width: 50,
    height: 50,
    background: "#D02020",
    color: "#fff",
    border: "4px solid #000",
    borderRadius: "4px",
    font: "900 28px 'Outfit',sans-serif",
    cursor: "pointer",
    zIndex: 2,
    boxShadow: "4px 4px 0 0 #000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 150ms",
    padding: 0,
  };
}
const darkMenuBtn: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1rem 1.15rem",
  font: "900 1.05rem 'Outfit',sans-serif",
  background: "#121212",
  color: "#fff",
  border: "4px solid #000",
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "1px",
  boxShadow: "5px 5px 0 0 #000",
};
const yellowMenuBtn: CSSProperties = { ...darkMenuBtn, background: "#F0C020", color: "#121212" };
function dot(color: string): CSSProperties {
  return { width: 10, height: 10, borderRadius: "50%", background: color };
}
// Mode diagram components
const marathonDiagram = () => (
  <div
    style={{
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 0",
    }}
  >
    <div
      style={{
        flex: 1,
        height: 8,
        background: "rgba(255,255,255,0.3)",
        border: "1px solid rgba(255,255,255,0.8)",
        borderRadius: 4,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          height: "100%",
          background: "currentColor",
          width: "50%",
          animation: "qe-marathon-fill 2s ease-in-out infinite",
        }}
      />
    </div>
    <div style={{ font: "700 11px 'Outfit',sans-serif", whiteSpace: "nowrap" }}>60s</div>
  </div>
);

const raceDiagram = () => (
  <div
    style={{
      width: "100%",
      display: "flex",
      gap: 4,
      padding: "6px 0",
      justifyContent: "space-between",
    }}
  >
    {Array.from({ length: 7 }).map((_, i) => (
      <div
        key={i}
        style={{
          flex: 1,
          height: 12,
          background: "rgba(255,255,255,0.2)",
          border: "1px solid rgba(255,255,255,0.7)",
          borderRadius: 2,
          animation: `qe-race-fill 2.2s ease-in-out infinite`,
          animationDelay: `${i * 180}ms`,
        }}
      />
    ))}
  </div>
);

const powerPlayDiagram = () => (
  <div
    style={{
      width: "100%",
      display: "flex",
      gap: 10,
      padding: "8px 0",
      justifyContent: "space-around",
      alignItems: "center",
    }}
  >
    {[
      { symbol: "💥", color: "#1040C0", label: "Pop" },
      { symbol: "✓", color: "#22C55E", label: "Reveal" },
      { symbol: "⚡", color: "#F0C020", label: "Halve" },
    ].map((power, i) => (
      <div
        key={i}
        style={{
          textAlign: "center",
          animation: "qe-power-pulse 1.8s ease-in-out infinite",
          animationDelay: `${i * 200}ms`,
        }}
      >
        <div
          style={{
            fontSize: "1.4rem",
            marginBottom: 2,
          }}
        >
          {power.symbol}
        </div>
        <div
          style={{
            font: "700 9px 'Outfit',sans-serif",
            opacity: 0.8,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {power.label}
        </div>
      </div>
    ))}
  </div>
);

function modeCard(bg: string, color: string): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
    padding: "1.3rem 1.2rem",
    background: bg,
    color,
    border: "4px solid #000",
    cursor: "pointer",
    boxShadow: "5px 5px 0 0 #000",
    textAlign: "left",
    minHeight: 210,
  };
}
const modeTitle: CSSProperties = {
  font: "900 1.2rem 'Outfit',sans-serif",
  textTransform: "uppercase",
  letterSpacing: "-0.5px",
};
const modeSub: CSSProperties = { marginTop: 6, font: "900 1rem 'Outfit',sans-serif", letterSpacing: "-0.3px" };
const modeDesc: CSSProperties = { font: "500 12.5px/1.4 'Outfit',sans-serif" };
function multiCard(bg: string, color: string): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
    padding: "1.3rem 1.2rem",
    background: bg,
    color,
    border: "4px solid #000",
    cursor: "pointer",
    boxShadow: "5px 5px 0 0 #000",
    textAlign: "left",
  };
}
const multiLabel: CSSProperties = {
  font: "900 1.05rem 'Outfit',sans-serif",
  textTransform: "uppercase",
  letterSpacing: "-0.5px",
};
const primaryWide: CSSProperties = {
  width: "100%",
  padding: "1.1rem",
  font: "900 1.05rem 'Outfit',sans-serif",
  background: "#D02020",
  color: "#fff",
  border: "4px solid #000",
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "1px",
  boxShadow: "5px 5px 0 0 #000",
};
function seg(active: boolean): CSSProperties {
  return {
    padding: "8px 16px",
    font: "800 12px 'Outfit',sans-serif",
    textTransform: "uppercase",
    letterSpacing: "1px",
    cursor: "pointer",
    border: "none",
    background: active ? "#121212" : "#fff",
    color: active ? "#fff" : "#121212",
  };
}
function cardHeader(bg: string, color: string): CSSProperties {
  return {
    background: bg,
    color,
    padding: "11px 16px",
    borderBottom: "4px solid #121212",
    font: "900 12px 'Outfit',sans-serif",
    textTransform: "uppercase",
    letterSpacing: "2px",
  };
}
function glowStyle(color: string, inset: number, dur: string): CSSProperties {
  return {
    position: "absolute",
    inset,
    background: color,
    filter: "blur(11px)",
    zIndex: -1,
    animation: `qe-glowpulse ${dur} ease-in-out infinite`,
  };
}
