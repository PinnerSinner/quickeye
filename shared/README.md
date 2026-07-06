# @quickeye/shared

Shared game logic for Quickeye: deck generation, match validation, and common types.

## Deck Generation Algorithm

The deck is generated using a **Steiner system S(2, 8, 57)**, the same mathematical structure underlying Dobble/Spot It.

### The Math

For n=7, we construct a projective plane PG(2, 7) with:
- **57 symbols** (points in the plane)
- **57 cards** (lines in the plane)  
- **8 symbols per card** (each line has 8 points)
- **Key property**: Any two cards share exactly one matching symbol (any two lines intersect in exactly one point)

### Symbol Encoding

Symbols are indexed 0–56:

- **Affine points** (0–48): Coordinates (x, y) where x, y ∈ {0..6}
  - Indexed as: `x * 7 + y`
  - Represents regular game symbols

- **Infinite points** (49–56): Abstract directions in the plane
  - Points 0–6: Direction for slopes 0–6 (y = 0·x, y = 1·x, etc.)
  - Point 7: Special "vertical" direction for vertical lines

### Card Encoding

Cards are indexed 0–56:

- **Affine lines with slope** (0–48): y = m·x + b where m, b ∈ {0..6}
  - Indexed as: `m * 7 + b`
  - Contains 7 affine points + 1 infinite point (the slope's direction)

- **Vertical lines** (49–55): x = c where c ∈ {0..6}
  - Indexed as: `49 + c`
  - Contains 7 affine points + 1 special infinite point

- **Line at infinity** (56): Contains all 8 infinite points
  - Indexed as: `56`

### Why This Works

The projective plane guarantees that any two distinct lines (cards) intersect in exactly one point (symbol). This is a fundamental property from finite geometry and is why this construction works for Dobble/Spot It.

## API

### `generateDeck(n?: number): Deck`

Generates a complete 57-card deck. Currently only n=7 is supported.

```typescript
import { generateDeck } from '@quickeye/shared';

const deck = generateDeck(); // n defaults to 7
// deck.cards[0] contains Card { id: 0, symbolIds: [...] }
// deck.totalSymbols === 57
// deck.symbolsPerCard === 8
```

### `findMatch(card1: Card, card2: Card): number | null`

Returns the one matching symbol between two cards, or null if none (shouldn't happen with a valid deck).

```typescript
const matchSymbol = findMatch(deck.cards[0], deck.cards[1]);
// matchSymbol is a number in [0, 56], or null
```

### `isValidMatch(card1: Card, card2: Card, symbolId: number): boolean`

Validates a player's match claim. Returns true only if the symbol exists on both cards. Use this server-side for authoritative validation.

```typescript
const isValid = isValidMatch(card1, card2, 42);
// Server validates all player matches this way — never trust client input
```

## Testing

```bash
npm test                # Run tests once
npm run test:watch     # Run in watch mode
npm run test:coverage  # Generate coverage report
```

All 15 tests verify:
- Correct deck size (57 cards, 57 symbols, 8 per card)
- Core invariant (any two cards share exactly one symbol)
- No duplicate symbols within a card
- Correct symbol distribution (each symbol on exactly 8 cards)
- Edge cases and API functions
