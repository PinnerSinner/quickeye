/**
 * Profanity filter for player names.
 * Works both client-side and server-side.
 */

const PROFANITIES = new Set([
  'shit', 'fuck', 'cunt', 'bitch', 'asshole', 'bastard', 'damn', 'hell',
  'dick', 'cock', 'pussy', 'ass', 'whore', 'slut', 'twat', 'piss', 'tits',
  'boobs', 'crap', 'dang', 'darn', 'gosh', 'goddamn', 'motherfucker',
]);

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  // Check if any profanity word appears as a whole word or substring
  for (const word of PROFANITIES) {
    if (lower.includes(word)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a player name is valid (not purely profanity, reasonable length).
 * Returns empty string if invalid, otherwise returns the name.
 */
export function sanitizePlayerName(name: string): string {
  const trimmed = (name ?? '').trim().substring(0, 20);
  if (!trimmed || containsProfanity(trimmed)) {
    return '';
  }
  return trimmed.replace(/\s+/g, ' ');
}
