import type { Branch } from "./branch";

// Fixed name lists per branch for the Services Card "Salesperson Name"
// dropdown. "Other (type manually)" is always offered alongside the list
// so a name missing from it can still be typed in by hand.
export const SALESPEOPLE_BY_BRANCH: Partial<Record<Branch, string[]>> = {
  kapar: ["FARAH", "AWIN", "ADRIANA", "AISYAH", "LINA", "FAHMI", "JIMMY"],
  puncak_alam: ["LINA", "FAZLIN", "VINCENT", "SHAFIQ", "IRFAN"],
  setia_alam: ["NAJWA", "IMAN", "RAYMOND"],
};
