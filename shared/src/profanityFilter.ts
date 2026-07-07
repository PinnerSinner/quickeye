/**
 * Simple profanity filter for player names.
 * Only checks for whole-word matches to avoid false positives in normal names.
 * Examples that should PASS: Marco, Sarah, Mason, Frederick, Alexander
 * Examples that should FAIL: asshole, fuckface, shithead, etc.
 */

const PROFANITIES = [
  // Only multi-word phrases that are clearly intentional
  'asshole', 'bastard', 'bitch', 'bullshit', 'damn', 'dammit', 'damnit',
  'fucked', 'fuckface', 'fucking', 'goddamn', 'goddammed', 'horseshit',
  'motherfucker', 'shite', 'shithead', 'shitty', 'whore', 'asshead',
  'bitches', 'bitching', 'crap', 'crappy', 'fart', 'frick', 'frigg', 'pissed',
  'slut', 'retard', 'retarded', 'twat', 'cunt', 'faggot',
  // Leetspeak/symbol variations of above
  'a55hole', '@sshole', 'b1tch', 'biatch', 'b!tch', 'sh1thead', 'sh!thead',
  'f@g', 'f*ck', 'fvck', 'f**k', 'fcuk',
];

export function containsProfanity(text: string): boolean {
  if (!text) return false;

  const normalized = text.toLowerCase().trim();

  // Only check for whole-word matches using word boundaries
  // This avoids false positives like "Marcus" or "Frederick"
  for (const word of PROFANITIES) {
    // Use word boundaries to match only complete words
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(normalized)) {
      return true;
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
