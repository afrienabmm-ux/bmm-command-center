// Plain helpers, not server actions — kept out of genblu-actions.ts (a
// "use server" file, where every export must be an async function) so
// they can also be called directly from a Server Component like
// app/scan/page.tsx without needing a network round-trip for a synchronous
// string comparison.

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// The GenBlu app's own "Awarded to" line sometimes shows a shortened name
// ("FAKHRUDDIN") instead of the full name staff typed in at registration
// ("MOHAMAD FAKHRUDDIN BIN ISMAIL") — an exact-match comparison would never
// tally these as the same customer, silently leaving the points event
// unlinked from their Tracker entry. Treated as the same customer when
// every word of the shorter name appears as a whole word in the longer
// one — word-boundary based, so a short name like "Ali" doesn't wrongly
// match an unrelated "Aliasgar" just because it's a text substring.
export function namesLikelyMatch(a: string, b: string): boolean {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  const wordsA = new Set(normA.split(/\s+/).filter(Boolean));
  const wordsB = new Set(normB.split(/\s+/).filter(Boolean));
  const [shorter, longer] = wordsA.size <= wordsB.size ? [wordsA, wordsB] : [wordsB, wordsA];
  if (shorter.size === 0) return false;
  return [...shorter].every((w) => longer.has(w));
}
