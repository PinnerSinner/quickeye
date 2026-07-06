import { generateDeck, findMatch, isValidMatch, Card } from "../src/deckGeneration";

describe("Deck Generation", () => {
  let deck = generateDeck();

  describe("Deck structure (n=7)", () => {
    test("should generate 57 cards", () => {
      expect(deck.cards.length).toBe(57);
    });

    test("each card should have 8 symbols", () => {
      deck.cards.forEach((card) => {
        expect(card.symbolIds.length).toBe(8);
      });
    });

    test("should use 57 total symbols", () => {
      expect(deck.totalSymbols).toBe(57);
    });

    test("should have no duplicate symbols within a card", () => {
      deck.cards.forEach((card, idx) => {
        const unique = new Set(card.symbolIds);
        expect(unique.size).toBe(8);
      });
    });

    test("all symbol IDs should be in range [0, 56]", () => {
      deck.cards.forEach((card) => {
        card.symbolIds.forEach((symbolId) => {
          expect(symbolId).toBeGreaterThanOrEqual(0);
          expect(symbolId).toBeLessThan(57);
        });
      });
    });
  });

  describe("Core invariant: any two cards share exactly one symbol", () => {
    test("should have exactly 1 intersection for all card pairs", () => {
      const intersectionCounts: number[] = [];

      for (let i = 0; i < deck.cards.length; i++) {
        for (let j = i + 1; j < deck.cards.length; j++) {
          const card1 = deck.cards[i];
          const card2 = deck.cards[j];

          const intersection = card1.symbolIds.filter((s) =>
            card2.symbolIds.includes(s)
          );

          intersectionCounts.push(intersection.length);
          expect(intersection.length).toBe(1);
        }
      }

      // Verify we tested all pairs
      const expectedPairs = (57 * 56) / 2; // n choose 2
      expect(intersectionCounts.length).toBe(expectedPairs);
    });
  });

  describe("findMatch function", () => {
    test("should find the one matching symbol between any two cards", () => {
      const card1 = deck.cards[0];
      const card2 = deck.cards[1];

      const match = findMatch(card1, card2);

      expect(match).not.toBeNull();
      expect(typeof match).toBe("number");
      expect(card1.symbolIds.includes(match!)).toBe(true);
      expect(card2.symbolIds.includes(match!)).toBe(true);
    });

    test("should return null if no match exists (should never happen in valid deck)", () => {
      // Create an artificial card with symbols not in the deck
      const fakeCard: Card = {
        id: 999,
        symbolIds: [-1, -2, -3, -4, -5, -6, -7, -8],
      };

      const match = findMatch(deck.cards[0], fakeCard);
      expect(match).toBeNull();
    });
  });

  describe("isValidMatch function", () => {
    test("should validate matching symbols", () => {
      const card1 = deck.cards[0];
      const card2 = deck.cards[1];

      const match = findMatch(card1, card2)!;

      expect(isValidMatch(card1, card2, match)).toBe(true);
    });

    test("should reject non-matching symbols", () => {
      const card1 = deck.cards[0];
      const card2 = deck.cards[1];

      // Pick a symbol that exists in card1 but not card2
      const nonMatch = card1.symbolIds.find(
        (s) => !card2.symbolIds.includes(s)
      )!;

      expect(isValidMatch(card1, card2, nonMatch)).toBe(false);
    });

    test("should reject invalid symbol IDs", () => {
      const card1 = deck.cards[0];
      const card2 = deck.cards[1];

      expect(isValidMatch(card1, card2, -1)).toBe(false);
      expect(isValidMatch(card1, card2, 999)).toBe(false);
    });
  });

  describe("Deck generation edge cases", () => {
    test("should throw if n !== 7 (only n=7 implemented for v1)", () => {
      expect(() => generateDeck(5)).toThrow();
      expect(() => generateDeck(8)).toThrow();
    });

    test("each card should have consecutive integer IDs", () => {
      deck.cards.forEach((card, idx) => {
        expect(card.id).toBe(idx);
      });
    });
  });

  describe("Symbol distribution", () => {
    test("each symbol should appear on exactly 8 cards", () => {
      // In the Steiner system S(2, 8, 57):
      // Total incidences = 57 cards × 8 symbols/card = 456
      // Each symbol appears 456 / 57 = 8 times
      const symbolCounts = new Map<number, number>();

      deck.cards.forEach((card) => {
        card.symbolIds.forEach((symbolId) => {
          symbolCounts.set(symbolId, (symbolCounts.get(symbolId) ?? 0) + 1);
        });
      });

      symbolCounts.forEach((count, symbolId) => {
        expect(count).toBe(8);
      });
    });

    test("all 57 symbols should be used", () => {
      const usedSymbols = new Set<number>();

      deck.cards.forEach((card) => {
        card.symbolIds.forEach((symbolId) => {
          usedSymbols.add(symbolId);
        });
      });

      expect(usedSymbols.size).toBe(57);
      // Verify no gaps
      for (let i = 0; i < 57; i++) {
        expect(usedSymbols.has(i)).toBe(true);
      }
    });
  });
});
