// Which GenBlu transactions are a salesman's new-bike award rather than a
// service Point Allocation.
//
// Up to October 2026 every 100-point award was treated as a new-bike award
// (that's how the October report was tallied, and it stays that way).
// From 1 November 2026 (owner's rule): anything admin uploads is a service
// Point Allocation whatever the points — new-bike awards come only from the
// Sales Dashboard sign-ups.
export const NEW_BIKE_RULE_ENDS = "2026-11-01";

export function isNewBikeAward(points: number | string, transactionDate: string | null | undefined): boolean {
  return Number(points) === 100 && !!transactionDate && transactionDate < NEW_BIKE_RULE_ENDS;
}
