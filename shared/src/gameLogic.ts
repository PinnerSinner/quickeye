/**
 * Pure game-logic helpers for Quickeye.
 *
 * These functions never touch the network or a database — they take state in
 * and return new state out. That makes them trivially unit-testable and lets
 * the server (authoritative) and client (practice mode) share identical rules.
 */

import { generateDeck } from "./deckGeneration";
import type { Card } from "./deckGeneration";
import { GAME_CONFIG } from "./gameTypes";
import type { GameState, Player } from "./gameTypes";

/**
 * Fisher-Yates shuffle of card ids [0..count-1].
 *
 * Takes an injected random function so callers can pass a seeded RNG for
 * deterministic tests; defaults to Math.random for real games.
 */
export function shuffledCardIds(
  count: number,
  rng: () => number = Math.random
): number[] {
  const ids = Array.from({ length: count }, (_, i) => i);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/**
 * Deal the opening layout: one card to the center, one to each player.
 * Returns a NEW GameState (does not mutate the input).
 *
 * Throws if there aren't enough cards for everyone (can't happen with the
 * 57-card deck and max 6 players, but guards the invariant anyway).
 */
export function dealInitial(
  state: GameState,
  rng: () => number = Math.random
): GameState {
  const deck = generateDeck(GAME_CONFIG.deckN);
  const order = shuffledCardIds(deck.cards.length, rng);

  const needed = state.players.length + 1; // players + center
  if (order.length < needed) {
    throw new Error(
      `Deck too small: need ${needed} cards, have ${order.length}`
    );
  }

  const drawPile = [...order];
  const centerCardId = drawPile.pop()!;

  const players: Player[] = state.players.map((p) => ({
    ...p,
    score: 0,
    currentCardId: drawPile.pop()!,
  }));

  return {
    ...state,
    status: "playing",
    centerCardId,
    drawPile,
    players,
  };
}

/** Look up the actual Card (with symbol ids) for a card id. */
export function cardById(cardId: number): Card {
  const deck = generateDeck(GAME_CONFIG.deckN);
  const card = deck.cards[cardId];
  if (!card) throw new Error(`No card with id ${cardId}`);
  return card;
}

export interface MatchOutcome {
  /** Whether the submitted symbol was a valid match. */
  correct: boolean;
  /** The state after applying a correct match (unchanged if incorrect). */
  state: GameState;
  /** True if this match emptied the draw pile and ended the game. */
  gameOver: boolean;
}

/**
 * Apply a player's match attempt authoritatively.
 *
 * On a correct match: the player's card becomes the new center, they draw a
 * fresh card from the pile (if any), and their score increments. When the pile
 * is empty the game ends.
 *
 * This is the function the server trusts — the client's claim is only a hint.
 */
export function applyMatch(
  state: GameState,
  playerId: string,
  symbolId: number
): MatchOutcome {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player || player.currentCardId === null || state.centerCardId === null) {
    return { correct: false, state, gameOver: false };
  }

  const playerCard = cardById(player.currentCardId);
  const centerCard = cardById(state.centerCardId);

  const valid =
    playerCard.symbolIds.includes(symbolId) &&
    centerCard.symbolIds.includes(symbolId);

  if (!valid) {
    return { correct: false, state, gameOver: false };
  }

  // Correct: the player's card moves to the center, they draw the next card.
  const drawPile = [...state.drawPile];
  const nextCardId = drawPile.length > 0 ? drawPile.pop()! : null;

  const players = state.players.map((p) =>
    p.playerId === playerId
      ? { ...p, score: p.score + 1, currentCardId: nextCardId }
      : p
  );

  const gameOver = nextCardId === null;

  const newState: GameState = {
    ...state,
    centerCardId: player.currentCardId,
    drawPile,
    players,
    status: gameOver ? "finished" : "playing",
  };

  return { correct: true, state: newState, gameOver };
}

/** Generate a short, human-typable room code (uppercase, no ambiguous chars). */
export function generateRoomCode(rng: () => number = Math.random): string {
  // Excludes 0/O, 1/I to avoid confusion when reading codes aloud.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(rng() * alphabet.length)];
  }
  return code;
}
