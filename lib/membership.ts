// Membership tier is fully automatic — based on how many Walk-in visits a
// customer has, not something staff pick. Ladder: Bronze (new member) ->
// Silver at 10 visits -> Gold at 20 -> Platinum at 30.
const TIER_THRESHOLDS: { tier: string; minVisits: number }[] = [
  { tier: "Platinum", minVisits: 30 },
  { tier: "Gold", minVisits: 20 },
  { tier: "Silver", minVisits: 10 },
  { tier: "Bronze", minVisits: 0 },
];

export function tierForVisits(visitCount: number): string {
  for (const t of TIER_THRESHOLDS) {
    if (visitCount >= t.minVisits) return t.tier;
  }
  return "Bronze";
}

// The old physical stamp card: every 10 visits earns 1 free service, then
// the count starts fresh — visit 10, 20, 30... each land exactly on a free
// service. STAMP_CARD_SIZE visits per card.
const STAMP_CARD_SIZE = 10;

// How many visits into the current 10-visit card the customer is — 10
// itself (not 0) on a visit count that's an exact multiple, so "10/10"
// reads as complete rather than looking like a fresh card.
export function stampsOnCurrentCard(visitCount: number): number {
  if (visitCount <= 0) return 0;
  const remainder = visitCount % STAMP_CARD_SIZE;
  return remainder === 0 ? STAMP_CARD_SIZE : remainder;
}

export function stampCardSize(): number {
  return STAMP_CARD_SIZE;
}

// True right when a visit count lands exactly on a multiple of 10 — the
// visit that just earned a free service.
export function hasFreeServiceReady(visitCount: number): boolean {
  return visitCount > 0 && visitCount % STAMP_CARD_SIZE === 0;
}

export function freeServicesEarned(visitCount: number): number {
  return Math.floor(visitCount / STAMP_CARD_SIZE);
}
