import type { Role } from "./current-user";

export const PAGE_DEFS = [
  { key: "warranty-claims", label: "Warranty Claims", href: "/warranty-claims" },
  { key: "repairs", label: "Restore Bike", href: "/repairs" },
  { key: "walk-in", label: "Walk-in", href: "/repairs/walk-in" },
  { key: "mechanics", label: "Mechanics", href: "/mechanics" },
  { key: "genblu", label: "GenBlu Tracker", href: "/genblu" },
  { key: "catalog", label: "Catalog", href: "/catalog" },
  { key: "packages", label: "Services Combo", href: "/packages" },
] as const;

export type PageKey = (typeof PAGE_DEFS)[number]["key"];

export const ALL_PAGE_KEYS: PageKey[] = PAGE_DEFS.map((p) => p.key);

// Every approved person sees every page — access is controlled by branch
// scope (Branch PIC vs Management), not by per-page permissions.
export function resolveAllowedPages(role: Role | null): PageKey[] {
  return role ? ALL_PAGE_KEYS : [];
}
