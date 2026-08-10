import type { Role } from "./current-user";

export const PAGE_DEFS = [
  { key: "warranty-claims", label: "Warranty Claims", href: "/warranty-claims" },
  { key: "repairs", label: "Workshop Repairs", href: "/repairs" },
  { key: "mechanics", label: "Mechanics", href: "/mechanics" },
  { key: "genblu", label: "GenBlu Registration", href: "/genblu" },
  { key: "catalog", label: "Catalog", href: "/catalog" },
  { key: "packages", label: "Main Packages", href: "/packages" },
  { key: "reports", label: "Reports", href: "/reports" },
] as const;

export type PageKey = (typeof PAGE_DEFS)[number]["key"];

export const ALL_PAGE_KEYS: PageKey[] = PAGE_DEFS.map((p) => p.key);

// Used only when a person's access hasn't been customized (allowed_pages is
// null in the database) — a starting point for what each role can normally
// see, that a Manager can then narrow or widen per person.
const DEFAULT_PAGES_BY_ROLE: Record<Role, PageKey[]> = {
  Manager: ALL_PAGE_KEYS,
  Admin: ALL_PAGE_KEYS,
  "Mechanic PIC": ["warranty-claims", "repairs", "mechanics", "genblu", "packages"],
  IT: [],
};

// Manager always sees every function — access control is theirs to hand out,
// so it can't be narrowed against them by another Manager's edit.
export function resolveAllowedPages(role: Role | null, customPages: string[] | null): PageKey[] {
  if (role === "Manager") return ALL_PAGE_KEYS;
  if (!role) return [];
  if (customPages) return customPages.filter((p): p is PageKey => ALL_PAGE_KEYS.includes(p as PageKey));
  return DEFAULT_PAGES_BY_ROLE[role];
}
