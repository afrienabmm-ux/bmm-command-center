// The physical stamp card: 10 stamps fill one card, ticked by hand by
// admin on the Services Card page — not derived from visit counts.
const STAMP_CARD_SIZE = 10;

export function stampCardSize(): number {
  return STAMP_CARD_SIZE;
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
