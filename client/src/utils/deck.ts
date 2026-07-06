import { generateDeck, findMatch } from "@quickeye/shared";

// Generate deck on first import (deterministic, so same deck every game)
const DECK = generateDeck();

export function getDeck() {
  return DECK;
}

export function getCardSymbols(cardId: number): number[] {
  return DECK[cardId] || [];
}

export function findMatchingSymbol(
  centerCardId: number,
  playerCardId: number
): number | null {
  const match = findMatch(DECK[centerCardId], DECK[playerCardId]);
  return match ?? null;
}

// Map symbol IDs to emoji (deterministic, so they're consistent)
const SYMBOLS = [
  "🔵", "🔴", "🟡", "🟢", "🟣", "🟠", "⚫", "⚪",
  "🔶", "🔷", "🔹", "🔸", "💎", "⭐", "🌟", "✨",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
  "❌", "✅", "✔️", "🆗", "💯", "🎯", "🎪", "🎭",
  "🎨", "🎬", "🎤", "🎧", "🎮", "🎲", "🧩", "🎸",
  "🏀", "⚽", "🏈", "⚾", "🥎", "🎾", "🏐", "🏓",
  "👁️", "👀", "👁️‍🗨️", "🐍", "🦉", "🦅", "🦋", "🐝",
];

export function getSymbolEmoji(symbolId: number): string {
  return SYMBOLS[symbolId % SYMBOLS.length];
}
