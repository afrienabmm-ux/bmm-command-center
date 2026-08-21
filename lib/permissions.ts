import type { Role } from "./current-user";

export const PAGE_DEFS = [
  { key: "walk-in", label: "Jobsheet", href: "/repairs/walk-in" },
  { key: "sales-performance", label: "Sales Performance", href: "/sales-performance" },
  { key: "repairs", label: "Restore Bike", href: "/repairs" },
  { key: "genblu", label: "GenBlu Tracker", href: "/genblu" },
  { key: "warranty-claims", label: "Claims", href: "/warranty-claims" },
  { key: "mechanics", label: "Mechanics", href: "/mechanics" },
  { key: "catalog", label: "Catalog", href: "/catalog" },
  { key: "packages", label: "Services Combo", href: "/packages" },
  { key: "customers", label: "Memberships", href: "/customers" },
] as const;

export type PageKey = (typeof PAGE_DEFS)[number]["key"];

export const ALL_PAGE_KEYS: PageKey[] = PAGE_DEFS.map((p) => p.key);

// Every approved person sees every page — access is controlled by branch
// scope (Branch PIC vs Management), not by per-page permissions.
export function resolveAllowedPages(role: Role | null): PageKey[] {
  return role ? ALL_PAGE_KEYS : [];
}
