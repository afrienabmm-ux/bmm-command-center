// Plain helpers, not server actions — kept out of genblu-actions.ts (a
// "use server" file, where every export must be an async function) so
// they can also be called directly from a Server Component like
// app/scan/page.tsx without needing a network round-trip for a synchronous
// string comparison.

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// Malay names connect to a parent's name with "bin" (son of) / "binti"
// (daughter of) — commonly abbreviated "b." or just "b" for bin, and "bt",
// "bte", or "binte" for binti, interchangeably depending on who typed the
// name or how an app happens to render it. Expanding every abbreviated
// form to the same full word before comparing is what makes "NORJULIANA BT
// RUSLEE" and "NORJULIANA BINTI RUSLEE" register as the same customer
// instead of a name mismatch.
const NAME_CONNECTOR_EXPANSIONS: Record<string, string> = {
  b: "bin",
  "b.": "bin",
  bin: "bin",
  bt: "binti",
  "bt.": "binti",
  bte: "binti",
  binte: "binti",
  binti: "binti",
};

export function expandNameConnectors(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => NAME_CONNECTOR_EXPANSIONS[word.toLowerCase()] ?? word)
    .join(" ");
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
  const normA = normalizeName(expandNameConnectors(a));
  const normB = normalizeName(expandNameConnectors(b));
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  const wordsA = new Set(normA.split(/\s+/).filter(Boolean));
  const wordsB = new Set(normB.split(/\s+/).filter(Boolean));
  const [shorter, longer] = wordsA.size <= wordsB.size ? [wordsA, wordsB] : [wordsB, wordsA];
  if (shorter.size === 0) return false;
  return [...shorter].every((w) => longer.has(w));
}

// Leading words that say nothing about who the person is ("MOHD KHAIRUL" is
// just KHAIRUL) — skipped when looking for the name someone goes by.
const NAME_FILLER = new Set(["mohd", "muhd", "md", "mohamad", "mohamed", "mohammad", "mohammed", "muhammad", "muhamad", "nur", "nurul", "siti", "bin", "binti", "b", "bt", "a", "l", "al", "ap", "anak"]);

function firstRealWord(name: string): string {
  return expandNameConnectors(name).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).find((w) => !NAME_FILLER.has(w)) ?? "";
}

// A points screenshot's name can loosely match several registrations —
// "HAZIQ" is inside "AZRIE HAZIQ BIN AZIZI", "SYAHID" inside "SYAHID WAJDI
// BIN ABD AZZIS". Each screenshot belongs to only ONE of them: the closest
// match (exact name, then same first name, then the longer registered name).
// Returns null when nothing matches or two registrations tie (two bikes under
// one name), so a screenshot is never shown on the wrong customer's row.
export function bestRegistrationFor(txName: string, regs: { id: string; customerName: string }[]): string | null {
  const txFirst = firstRealWord(txName);
  const normTx = normalizeName(expandNameConnectors(txName));
  let best: { id: string; score: number; name: string } | null = null;
  let tie = false;
  for (const r of regs) {
    if (!namesLikelyMatch(r.customerName, txName)) continue;
    const normR = normalizeName(expandNameConnectors(r.customerName));
    const score =
      (normR === normTx ? 1000 : 0) +
      (firstRealWord(r.customerName) === txFirst ? 100 : 0) +
      normR.split(/\s+/).length;
    if (!best || score > best.score) {
      best = { id: r.id, score, name: normR };
      tie = false;
    } else if (score === best.score && r.id !== best.id) {
      tie = true;
    }
  }
  return best && !tie ? best.id : null;
}
