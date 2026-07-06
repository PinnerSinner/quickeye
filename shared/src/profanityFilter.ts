/**
 * Simple profanity filter for player names.
 * Checks for common profanities and inappropriate words.
 */

const PROFANITIES = [
  // Common profanities (comprehensive list)
  'asshole', 'bastard', 'bitch', 'bloody', 'crap', 'damn', 'dammit', 'damnit',
  'fart', 'fck', 'frick', 'hell', 'piss', 'shit', 'shite', 'whore', 'motherfucker',
  'ass', 'damn', 'cock', 'dick', 'pussy', 'twat', 'cunt', 'bullshit', 'horseshit',
  'goddamn', 'goddammed', 'hell', 'f u', 'f*', 'f-', 'wtf', 'stfu', 'fu',
  'nigga', 'nigger', 'faggot', 'fag', 'slut', 'whore', 'retard', 'retarded',
  // Variations with numbers/symbols
  'a55', '@ss', '@sshole', 'b1tch', 'biatch', 'b!tch', 'sh1t', 'sh!t',
  'f@g', 'f*ck', 'fvck', 'f**k', 'fcuk', 'frick', 'frigg',
];

export function containsProfanity(text: string): boolean {
  if (!text) return false;

  const normalized = text.toLowerCase();

  // Check for whole words and variations
  for (const word of PROFANITIES) {
    // Exact word match (bounded by word boundaries)
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(normalized)) {
      return true;
    }

    // Also check for the word as a substring (catches some variations)
    if (normalized.includes(word)) {
      // But avoid false positives (e.g., "bass" contains "ass")
      if (word.length >= 4 || !normalized.match(new RegExp(`[a-z]${word}[a-z]`, 'i'))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Sanitize a player name by removing/replacing profanities.
 * If it contains profanities, returns empty string to reject the name.
 */
export function sanitizePlayerName(name: string): string {
  if (containsProfanity(name)) {
    return '';
  }

  // Also remove extra whitespace and trim
  return name.trim().replace(/\s+/g, ' ').substring(0, 20);
}
