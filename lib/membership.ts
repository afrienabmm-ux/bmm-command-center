// Membership tier is fully automatic — based on how many Walk-in visits a
// customer has, not something staff pick. Ladder: Bronze (new member) ->
// Silver at 5 visits -> Gold at 15 -> Platinum at 30.
const TIER_THRESHOLDS: { tier: string; minVisits: number }[] = [
  { tier: "Platinum", minVisits: 30 },
  { tier: "Gold", minVisits: 15 },
  { tier: "Silver", minVisits: 5 },
  { tier: "Bronze", minVisits: 0 },
];

export function tierForVisits(visitCount: number): string {
  for (const t of TIER_THRESHOLDS) {
    if (visitCount >= t.minVisits) return t.tier;
  }
  return "Bronze";
}
