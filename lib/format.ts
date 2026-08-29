export function formatCurrency(value: number): string {
  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

export function daysBetween(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso);
  const end = new Date(endIso);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}
