import type { Role } from "./current-user";

export const PAGE_DEFS = [
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "walk-in", label: "Jobsheet", href: "/repairs/walk-in" },
  { key: "sales-performance", label: "Sales Performance", href: "/sales-performance" },
  { key: "repairs", label: "Restore Bike", href: "/repairs" },
  { key: "genblu", label: "GenBlu Tracker", href: "/genblu" },
  { key: "warranty-claims", label: "Claims", href: "/warranty-claims" },
  { key: "mechanics", label: "Mechanics", href: "/mechanics" },
  { key: "catalog", label: "Catalog", href: "/catalog" },
  { key: "packages", label: "Services Combo", href: "/packages" },
  { key: "customers", label: "Services Card", href: "/customers" },
  { key: "reports", label: "Reports", href: "/reports" },
] as const;

export type PageKey = (typeof PAGE_DEFS)[number]["key"];

export const ALL_PAGE_KEYS: PageKey[] = PAGE_DEFS.map((p) => p.key);

// Every approved person sees every page — access is controlled by branch
// scope (Branch PIC vs Management/Administrator), not by per-page
// permissions. Mechanic, Front Desk, and Sales Advisor are the exceptions:
// narrow, fixed access levels. Mechanic only ever scans/saves jobsheets —
// no GenBlu, that's not their task. Front Desk's real job is ticking
// stamps on the Services Card page; it also sees Jobsheet (read-only —
// see WalkInClient's canEdit prop) and GenBlu for context, but can't touch
// either. Sales Advisor's only task is registering GenBlu customers — no
// jobsheet, no services card, nothing else.
export function resolveAllowedPages(role: Role | null): PageKey[] {
  if (!role) return [];
  if (role === "Mechanic") return ["walk-in"];
  if (role === "Front Desk") return ["customers", "walk-in", "genblu"];
  if (role === "Sales Advisor") return ["genblu"];
  return ALL_PAGE_KEYS;
}
