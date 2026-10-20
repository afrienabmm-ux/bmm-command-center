// The physical stamp card: 10 stamps fill one card, ticked by hand by
// admin on the Services Card page — not derived from visit counts.
const STAMP_CARD_SIZE = 10;

export function stampCardSize(): number {
  return STAMP_CARD_SIZE;
}

export type RewardIconName = "oil" | "scannerPlug" | "coolant" | "voucher";
export type StampReward = { stamp: number; label: string; icon: RewardIconName };

// The real physical Yamaha Cares punch card — specific free items/vouchers
// at specific stamps within each 10-visit cycle, not a tier that climbs
// forever. Matches the printed card exactly. Each has its own item icon
// (components/RewardIcon.tsx).
export const STAMP_REWARDS: StampReward[] = [
  { stamp: 1, label: "Free Oil", icon: "oil" },
  { stamp: 4, label: "Free Diagnostic Tool + Plug", icon: "scannerPlug" },
  { stamp: 7, label: "Free Coolant", icon: "coolant" },
  { stamp: 10, label: "RM50 Voucher — Helmet & Apparels", icon: "voucher" },
];

// The reward just earned by landing exactly on this stamp, if any.
export function rewardForStamp(stamp: number): string | null {
  return STAMP_REWARDS.find((r) => r.stamp === stamp)?.label ?? null;
}

// The item icon for a reward stamp, if this stamp has one.
export function rewardIconForStamp(stamp: number): RewardIconName | null {
  return STAMP_REWARDS.find((r) => r.stamp === stamp)?.icon ?? null;
}

// The next reward still ahead on the current card, or null once the
// customer is on/past the last one (stamp 10 — card complete).
export function nextReward(stamps: number): StampReward | null {
  return STAMP_REWARDS.find((r) => r.stamp > stamps) ?? null;
}
