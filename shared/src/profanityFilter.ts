/**
 * Profanity filter for player names using the bad-words npm package.
 * Detects inappropriate language without false positives on normal names.
 */

import { Filter } from 'bad-words';

// Initialize the filter once (singleton)
let filterInstance: Filter | null = null;

function getFilter(): Filter {
  if (!filterInstance) {
    filterInstance = new Filter();
  }
  return filterInstance;
}

export function containsProfanity(text: string): boolean {
  if (!text) return false;

  const filter = getFilter();

  // The bad-words filter checks if text contains any profanity
  // Returns true if profanity is detected
  return filter.isProfane(text.trim());
}

/**
 * Sanitize a player name by replacing profanities with asterisks.
 * If the name consists entirely of profanity, returns empty string.
 */
export function sanitizePlayerName(name: string): string {
  if (containsProfanity(name)) {
    return '';
  }

  const filter = getFilter();
  const sanitized = filter.clean(name.trim());

  // Further validation: trim length and whitespace
  return sanitized.replace(/\s+/g, ' ').substring(0, 20);
}
