/**
 * Canvas / imperative-DOM drawing helpers for the Quickeye animations.
 * Ported from the prototype. Kept separate from React so the render loops
 * stay plain and fast.
 */

import { CLIPS } from "./glyphs";

/** Draw one geometric shape centred at (x,y) onto a 2D canvas context. */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  type: string,
  x: number,
  y: number,
  r: number,
  rot: number,
  color: string,
  alpha: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.beginPath();
  if (type === "circle") {
    ctx.arc(0, 0, r, 0, 6.283);
    ctx.fill();
  } else if (type === "ring") {
    ctx.lineWidth = Math.max(3, r * 0.3);
    ctx.arc(0, 0, r * 0.82, 0, 6.283);
    ctx.stroke();
  } else if (type === "square") {
    ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
  } else if (type === "diamond") {
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fill();
  } else if (type === "triangle") {
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.87, r * 0.55);
    ctx.lineTo(-r * 0.87, r * 0.55);
    ctx.closePath();
    ctx.fill();
  } else if (type === "plus") {
    const a = r * 0.36;
    ctx.fillRect(-a, -r, 2 * a, 2 * r);
    ctx.fillRect(-r, -a, 2 * r, 2 * a);
  } else if (type === "star") {
    for (let i = 0; i < 10; i++) {
      const ang = (Math.PI / 5) * i - Math.PI / 2;
      const rad = i % 2 ? r * 0.44 : r;
      const px = Math.cos(ang) * rad;
      const py = Math.sin(ang) * rad;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else if (type === "hexagon") {
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i;
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.arc(0, 0, r, 0, 6.283);
    ctx.fill();
  }
  ctx.restore();
}

/** Style a plain <div> element as a geometric shape (used by the header physics field). */
export function styleHeaderShape(
  el: HTMLElement,
  type: string,
  color: string,
  size: number
): void {
  el.style.width = size + "px";
  el.style.height = size + "px";
  if (type === "circle") {
    el.style.borderRadius = "50%";
    el.style.background = color;
  } else if (type === "ring") {
    el.style.borderRadius = "50%";
    el.style.border = Math.max(4, size * 0.18) + "px solid " + color;
    el.style.boxSizing = "border-box";
  } else if (type === "square") {
    el.style.background = color;
  } else if (type === "half") {
    el.style.height = size * 0.55 + "px";
    el.style.borderRadius = size + "px " + size + "px 0 0";
    el.style.background = color;
  } else {
    el.style.background = color;
    const clip = CLIPS[type] || CLIPS.diamond;
    el.style.clipPath = clip;
    (el.style as CSSStyleDeclaration & { webkitClipPath?: string }).webkitClipPath = clip;
  }
}
