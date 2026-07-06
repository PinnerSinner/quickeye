/**
 * Deck generation for Quickeye using a Steiner system S(2, 8, 57).
 *
 * This is the mathematical structure behind Dobble/Spot It.
 * For n=7, we generate:
 * - 57 symbols (n²+n+1)
 * - 57 cards
 * - 8 symbols per card (n+1)
 *
 * The key property: any two cards share exactly one symbol.
 * Construction: projective plane PG(2, 7) with 57 points and 57 lines.
 */

export interface Card {
  id: number;
  symbolIds: number[];
}

export interface Deck {
  cards: Card[];
  totalSymbols: number;
  symbolsPerCard: number;
}

/**
 * Generate a complete Quickeye deck using Steiner system S(2, 8, 57).
 *
 * Returns 57 cards with 8 symbols each, drawn from a pool of 57 symbols.
 * Guarantees: any two cards share exactly one matching symbol.
 */
export function generateDeck(n: number = 7): Deck {
  if (n !== 7) {
    throw new Error("Only n=7 (8 symbols/card, 57 cards) is implemented for v1");
  }

  const symbolsPerCard = n + 1; // 8
  const totalCards = n * n + n + 1; // 57
  const totalSymbols = n * n + n + 1; // 57

  const cards: Card[] = [];

  // Generate cards using the standard Steiner system S(2, 8, 57) construction
  // This is based on the projective plane PG(2, 7)

  for (let cardId = 0; cardId < totalCards; cardId++) {
    const symbolIds = getSymbolsForCard(cardId, n);
    cards.push({
      id: cardId,
      symbolIds,
    });
  }

  // Verify the deck (for safety)
  verifyDeckIntegrity(cards, n);

  return {
    cards,
    totalSymbols,
    symbolsPerCard,
  };
}

/**
 * Get the symbols for a given card using the Steiner system construction.
 *
 * Structure: projective plane PG(2, 7) from affine plane AG(2, 7) + line at infinity
 * - Affine points: 49 points with coordinates (x, y) where x, y ∈ {0..6}
 * - Infinite points: 8 points (one per slope direction + one universal)
 * - Total: 57 symbols
 *
 * Cards are:
 * - Affine lines: y = m*x + b for m, b ∈ {0..6} = 49 cards, each with 7 affine + 1 infinite
 * - Vertical lines: x = c for c ∈ {0..6} = 7 cards, each with 7 affine + 1 infinite
 * - Infinite line: contains all 8 infinite points = 1 card
 */
function getSymbolsForCard(cardId: number, n: number): number[] {
  const totalPoints = n * n + n + 1;
  const symbolIds: number[] = [];

  for (let symbolId = 0; symbolId < totalPoints; symbolId++) {
    if (areIncident(cardId, symbolId, n)) {
      symbolIds.push(symbolId);
    }
  }

  return symbolIds;
}

/**
 * Check if a card and symbol are incident (symbol is on the card).
 *
 * In PG(2, 7):
 * - Affine points: (x, y) indexed as x * 7 + y for x, y ∈ {0..6} → indices 0..48
 * - Infinite points: indices 49..56
 *   - Infinite point i (for i ∈ {0..6}) represents the direction of slope i
 *   - Infinite point 7 is the "universal" or "vertical" direction
 *
 * - Affine line card y = m*x + b (cardId = m * 7 + b for cardId < 49)
 *   - Contains affine points (x, m*x + b) for all x ∈ {0..6}
 *   - Contains the infinite point for slope m (index 49 + m)
 *
 * - Vertical line card x = c (cardId = 49 + c for 49 <= cardId < 56)
 *   - Contains affine points (c, y) for all y ∈ {0..6}
 *   - Contains the "vertical" infinite point (index 56)
 *
 * - Infinite line card (cardId = 56)
 *   - Contains all 8 infinite points (indices 49..56)
 */
function areIncident(cardId: number, symbolId: number, n: number): boolean {
  const affinePoints = n * n; // 49
  const infinityStart = affinePoints; // 49

  // Decode symbol
  let symType: string;
  let symX: number = 0;
  let symY: number = 0;
  let symDir: number = 0;

  if (symbolId < affinePoints) {
    symType = "affine";
    symX = Math.floor(symbolId / n);
    symY = symbolId % n;
  } else {
    symType = "infinity";
    symDir = symbolId - infinityStart;
  }

  // Decode card
  const affineSlopes = n * n; // 49
  const verticalStart = affineSlopes; // 49
  const verticalEnd = verticalStart + n; // 56
  const infinityLineId = verticalEnd; // 56

  let cardType: string;
  let cardM: number = 0;
  let cardB: number = 0;
  let cardC: number = 0;

  if (cardId < verticalStart) {
    cardType = "affine_slope";
    cardM = Math.floor(cardId / n);
    cardB = cardId % n;
  } else if (cardId < infinityLineId) {
    cardType = "vertical";
    cardC = cardId - verticalStart;
  } else {
    cardType = "infinity";
  }

  // Check incidence
  if (cardType === "affine_slope") {
    if (symType === "affine") {
      // Affine line y = m*x + b contains point (x, y) if y = (m*x + b) mod n
      return symY === (cardM * symX + cardB) % n;
    } else {
      // Affine line y = m*x + b contains the infinite point for slope m
      return symDir === cardM;
    }
  } else if (cardType === "vertical") {
    if (symType === "affine") {
      // Vertical line x = c contains point (c, y) for all y
      return symX === cardC;
    } else {
      // Vertical line contains the universal infinite point (index 7 relative to infinity)
      return symDir === n; // symDir = 7 when symbolId = 56
    }
  } else {
    // cardType === "infinity"
    // Infinite line contains all infinite points
    return symType === "infinity";
  }
}

/**
 * Verify deck integrity: ensure any two cards share exactly one symbol.
 * Throws if invariant is violated.
 */
function verifyDeckIntegrity(cards: Card[], n: number): void {
  const expectedIntersectionSize = 1;
  const expectedCardSize = n + 1;

  for (let i = 0; i < cards.length; i++) {
    const card1 = cards[i];

    // Check card size
    if (card1.symbolIds.length !== expectedCardSize) {
      throw new Error(
        `Card ${i} has ${card1.symbolIds.length} symbols, expected ${expectedCardSize}`
      );
    }

    // Check for duplicates within card
    const uniqueSymbols = new Set(card1.symbolIds);
    if (uniqueSymbols.size !== expectedCardSize) {
      throw new Error(`Card ${i} contains duplicate symbols`);
    }

    // Check intersection with every other card
    for (let j = i + 1; j < cards.length; j++) {
      const card2 = cards[j];
      const intersection = card1.symbolIds.filter((s) =>
        card2.symbolIds.includes(s)
      );

      if (intersection.length !== expectedIntersectionSize) {
        throw new Error(
          `Cards ${i} and ${j} share ${intersection.length} symbols, expected ${expectedIntersectionSize}`
        );
      }
    }
  }
}

/**
 * Check if two cards contain a matching symbol.
 */
export function findMatch(card1: Card, card2: Card): number | null {
  const match = card1.symbolIds.find((s) => card2.symbolIds.includes(s));
  return match ?? null;
}

/**
 * Validate a player's match submission.
 * Returns true if the symbol exists on both cards.
 */
export function isValidMatch(
  card1: Card,
  card2: Card,
  symbolId: number
): boolean {
  return (
    card1.symbolIds.includes(symbolId) &&
    card2.symbolIds.includes(symbolId)
  );
}
