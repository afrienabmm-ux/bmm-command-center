// Search match that ignores case, spaces and dashes, so "CFJ466" finds a
// plate saved as "CFJ 466" (and "012-345 6789" finds "0123456789").
function compact(text: string): string {
  return text.toLowerCase().replace(/[\s-]+/g, "");
}

// `query` is expected already trimmed and lower-cased, as every search box
// here does before filtering.
export function looseIncludes(value: string | null | undefined, query: string): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  if (v.includes(query)) return true;
  const q = compact(query);
  return q.length > 0 && compact(v).includes(q);
}
