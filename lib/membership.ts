// The old physical stamp card: every 10 visits fills one card, then the
// count starts fresh — visit 10, 20, 30... each land exactly on a full
// card. STAMP_CARD_SIZE visits per card.
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
// visit that just filled the card (and earned the stamp-10 reward).
export function hasFreeServiceReady(visitCount: number): boolean {
  return visitCount > 0 && visitCount % STAMP_CARD_SIZE === 0;
}

export function freeServicesEarned(visitCount: number): number {
  return Math.floor(visitCount / STAMP_CARD_SIZE);
}

export type StampReward = { stamp: number; label: string };

// The real physical Yamaha Cares punch card — specific free items/vouchers
// at specific stamps within each 10-visit cycle, not a tier that climbs
// forever. Matches the printed card exactly.
export const STAMP_REWARDS: StampReward[] = [
  { stamp: 1, label: "Free Oil" },
  { stamp: 4, label: "Free Diagnostic Tool + Plug" },
  { stamp: 7, label: "Free Coolant" },
  { stamp: 10, label: "RM50 Voucher — Helmet & Apparels" },
];

// The reward just earned by landing exactly on this stamp, if any.
export function rewardForStamp(stamp: number): string | null {
  return STAMP_REWARDS.find((r) => r.stamp === stamp)?.label ?? null;
}

// The next reward still ahead on the current card, or null once the
// customer is on/past the last one (stamp 10 — card complete).
export function nextReward(stamps: number): StampReward | null {
  return STAMP_REWARDS.find((r) => r.stamp > stamps) ?? null;
}
