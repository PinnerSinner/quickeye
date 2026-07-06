import { generateDeck, findMatch } from "@quickeye/shared";
import type { Deck } from "@quickeye/shared";

// Generate deck on first import (deterministic, so same deck every game)
let DECK: Deck | null = null;

try {
  DECK = generateDeck();
  console.log("Deck generated successfully:", {
    deckSize: DECK.cards.length,
    firstCard: DECK.cards[0],
    symbolsPerCard: DECK.symbolsPerCard,
  });
} catch (err) {
  console.error("Failed to generate deck:", err);
  DECK = null;
}

export function getDeck() {
  return DECK;
}

export function getCardSymbols(cardId: number): number[] {
  if (!DECK) {
    console.error("DECK is null or undefined");
    return [];
  }
  const card = DECK.cards[cardId];
  if (!card) {
    console.warn(`Card ${cardId} not found in deck (deck size: ${DECK.cards.length})`);
    return [];
  }
  return card.symbolIds;
}

export function findMatchingSymbol(
  centerCardId: number,
  playerCardId: number
): number | null {
  if (!DECK) return null;

  const centerCard = DECK.cards[centerCardId];
  const playerCard = DECK.cards[playerCardId];

  if (!centerCard || !playerCard) return null;

  const match = findMatch(centerCard.symbolIds, playerCard.symbolIds);
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
