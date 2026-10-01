import { COMBO_TYPES, type ComboType } from "@/lib/combo-type";

type Row = Record<string, string | number>;

export type ComboTypeTotal = { type: ComboType; sold: number };
export type MechanicComboCount = { mechanicName: string; mechanicCode: string; byType: Record<ComboType, number>; total: number };

export function comboTypeTotals(rows: Row[]): ComboTypeTotal[] {
  return COMBO_TYPES.map((type) => ({ type, sold: rows.filter((r) => r.comboType === type).length }));
}

export function mechanicComboCounts(rows: Row[]): MechanicComboCount[] {
  const byCode = new Map<string, MechanicComboCount>();
  for (const r of rows) {
    const code = String(r.mechanicCode ?? "");
    if (!code || code === "—") continue;
    const entry = byCode.get(code) ?? {
      mechanicName: String(r.mechanicName ?? code),
      mechanicCode: code,
      byType: { Yamalube: 0, "Rock Oil": 0 },
      total: 0,
    };
    entry.byType[r.comboType as ComboType]++;
    entry.total++;
    byCode.set(code, entry);
  }
  return [...byCode.values()].sort((a, b) => b.total - a.total || a.mechanicName.localeCompare(b.mechanicName));
}

/** The same two tables, shaped for the front of the CSV export. */
export function comboSummarySections(rows: Row[]) {
  const types = comboTypeTotals(rows);
  const mechanics = mechanicComboCounts(rows);
  return [
    {
      title: "Sold by Combo Type",
      columns: ["Type", "Sold"],
      rows: [...types.map((t) => [t.type, t.sold]), ["Total", types.reduce((n, t) => n + t.sold, 0)]],
    },
    {
      title: "Sold by Mechanic",
      columns: ["Mechanic", "Code", ...COMBO_TYPES, "Total"],
      rows: mechanics.map((m) => [m.mechanicName, m.mechanicCode, ...COMBO_TYPES.map((t) => m.byType[t]), m.total]),
    },
  ];
}
