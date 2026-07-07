/**
 * Geometric Bauhaus glyphs for Quickeye symbols.
 * Replaces emoji with pure CSS shapes.
 */

type GlyphType = "circle" | "square" | "diamond" | "ring" | "half-circle" | "triangle";
type GlyphColor = "red" | "blue" | "yellow" | "black";

interface GeometricGlyphProps {
  symbolId: number;
  size?: number; // in pixels
}

// Map symbol IDs to (type, color) pairs
// 56 symbols total from the S(2,8,57) deck
const SYMBOL_MAP: { [key: number]: [GlyphType, GlyphColor] } = {
  0: ["circle", "red"],
  1: ["triangle", "yellow"],
  2: ["diamond", "blue"],
  3: ["ring", "black"],
  4: ["square", "black"],
  5: ["half-circle", "red"],
  6: ["triangle", "blue"],
  7: ["circle", "yellow"],
  8: ["square", "blue"],
  9: ["circle", "blue"],
  10: ["diamond", "red"],
  11: ["ring", "blue"],
  12: ["triangle", "red"],
  13: ["circle", "black"],
  14: ["half-circle", "blue"],
  15: ["diamond", "yellow"],
  16: ["square", "red"],
  17: ["ring", "yellow"],
  18: ["triangle", "black"],
  19: ["half-circle", "yellow"],
  20: ["diamond", "black"],
  21: ["circle", "red"],
  22: ["square", "yellow"],
  23: ["ring", "red"],
  24: ["triangle", "yellow"],
  25: ["half-circle", "black"],
  26: ["diamond", "yellow"],
  27: ["circle", "blue"],
  28: ["square", "black"],
  29: ["ring", "blue"],
  30: ["triangle", "red"],
  31: ["half-circle", "red"],
  32: ["diamond", "red"],
  33: ["square", "blue"],
  34: ["circle", "yellow"],
  35: ["ring", "yellow"],
  36: ["triangle", "blue"],
  37: ["half-circle", "yellow"],
  38: ["diamond", "blue"],
  39: ["square", "red"],
  40: ["circle", "black"],
  41: ["ring", "black"],
  42: ["triangle", "black"],
  43: ["half-circle", "blue"],
  44: ["diamond", "black"],
  45: ["square", "yellow"],
  46: ["circle", "red"],
  47: ["ring", "red"],
  48: ["triangle", "yellow"],
  49: ["half-circle", "black"],
  50: ["diamond", "yellow"],
  51: ["square", "blue"],
  52: ["circle", "blue"],
  53: ["ring", "yellow"],
  54: ["triangle", "blue"],
  55: ["half-circle", "red"],
};

const COLOR_MAP: { [key in GlyphColor]: string } = {
  red: "#D02020",
  blue: "#1040C0",
  yellow: "#F0C020",
  black: "#121212",
};

function getGlyph(symbolId: number): [GlyphType, GlyphColor] {
  return SYMBOL_MAP[symbolId] || ["circle", "red"];
}

function renderCircle(s: number, color: string): JSX.Element {
  const size = s * 0.58;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
      }}
    />
  );
}

function renderSquare(s: number, color: string): JSX.Element {
  const size = s * 0.56;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: color,
      }}
    />
  );
}

function renderDiamond(s: number, color: string): JSX.Element {
  const size = s * 0.5;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: color,
        transform: "rotate(45deg)",
      }}
    />
  );
}

function renderRing(s: number, color: string): JSX.Element {
  const size = s * 0.56;
  const borderWidth = Math.round(s * 0.13);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `${borderWidth}px solid ${color}`,
      }}
    />
  );
}

function renderHalfCircle(s: number, color: string): JSX.Element {
  const width = s * 0.6;
  const height = s * 0.3;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: `${s} ${s} 0 0`,
        background: color,
      }}
    />
  );
}

function renderTriangle(s: number, color: string): JSX.Element {
  const side = s * 0.29;
  const bottom = s * 0.5;
  return (
    <div
      style={{
        width: 0,
        height: 0,
        borderLeft: `${side}px solid transparent`,
        borderRight: `${side}px solid transparent`,
        borderBottom: `${bottom}px solid ${color}`,
      }}
    />
  );
}

export function GeometricGlyph({
  symbolId,
  size = 48,
}: GeometricGlyphProps): JSX.Element {
  const [type, colorKey] = getGlyph(symbolId);
  const color = COLOR_MAP[colorKey];

  const renderer = (type: GlyphType) => {
    switch (type) {
      case "circle":
        return renderCircle(size, color);
      case "square":
        return renderSquare(size, color);
      case "diamond":
        return renderDiamond(size, color);
      case "ring":
        return renderRing(size, color);
      case "half-circle":
        return renderHalfCircle(size, color);
      case "triangle":
        return renderTriangle(size, color);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
      }}
    >
      {renderer(type)}
    </div>
  );
}
