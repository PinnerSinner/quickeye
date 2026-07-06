import { generateDeck, findMatch } from "@quickeye/shared";

// Generate deck on first import (deterministic, so same deck every game)
let DECK: number[][] | null = null;

try {
  DECK = generateDeck();
  console.log("Deck generated successfully:", {
    deckSize: DECK.length,
    firstCard: DECK[0],
    secondCard: DECK[1],
  });
} catch (err) {
  console.error("Failed to generate deck:", err);
  DECK = [];
}

export function getDeck() {
  return DECK;
}

export function getCardSymbols(cardId: number): number[] {
  if (!DECK) {
    console.error("DECK is null or undefined");
    return [];
  }
  const symbols = DECK[cardId];
  if (!symbols) {
    console.warn(`Card ${cardId} not found in deck (deck size: ${DECK.length})`);
    return [];
  }
  return symbols;
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
