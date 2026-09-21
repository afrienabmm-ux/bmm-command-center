// Deliberately its own tiny module, not part of genblu-actions.ts: that
// file imports lib/vision.ts (tesseract.js + sharp — genuinely huge, OCR
// engine + native image processing) for its screenshot-scanning features.
// repairs-actions.ts needs to know which plates already have GenBlu on
// every Jobsheet/report page load — importing genblu-actions.ts for that
// one query dragged the entire OCR/vision toolchain into every one of
// those serverless functions' bundles, which is exactly what made report
// pages so slow to cold-start. This file has none of that.
import { cache } from "react";
import { supabaseAdmin } from "./supabase-server";
import { normalizePlate } from "./plate";

// Every plate number with a GenBlu registration on file, mapped to the
// points it was awarded — across every branch and all of history.
// Memoized per request: the active/completed job lists are fetched
// separately (and per-branch, for "All Branches"), and each needs this
// same map — cache() means only the first call actually queries.
export type GenbluPlateInfo = { points: number; name: string };

export const getGenbluPlatePoints = cache(async (): Promise<Map<string, GenbluPlateInfo>> => {
  const { data, error } = await supabaseAdmin
    .from("cc_genblu_registrations")
    .select("customer_plate_no, customer_name, points_accrued");
  if (error) throw new Error(error.message);
  const map = new Map<string, GenbluPlateInfo>();
  for (const r of data ?? []) {
    const plate = normalizePlate(r.customer_plate_no ?? "");
    if (plate) map.set(plate, { points: r.points_accrued ?? 0, name: r.customer_name ?? "" });
  }
  return map;
});

export type GenbluTxLite = { words: string[]; points: number; date: string };

// Prefixes that lead many Malay names and say nothing about who it is —
// "MOHD KHAIRUL REFDEY" on the GenBlu app is just "KHAIRUL" on the jobsheet.
const NAME_FILLER = new Set(["MOHD", "MUHD", "MD", "MOHAMAD", "MOHAMED", "MOHAMMAD", "MUHAMMAD", "MUHAMAD", "NUR", "NURUL", "SITI", "BIN", "BINTI", "B", "BT", "A", "L", "AL", "AP", "ANAK"]);

function nameWords(name: string): string[] {
  return name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
}

// Per-transaction points (one row per points award) — a customer's
// registration only carries one points figure, but each visit earns its
// own, roughly equal to that visit's cost. Small table, memoized per request.
export const getGenbluTxLite = cache(async (): Promise<GenbluTxLite[]> => {
  const { data, error } = await supabaseAdmin.from("cc_genblu_transactions").select("customer_name, points, transaction_date");
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    words: nameWords(t.customer_name ?? ""),
    points: Number(t.points ?? 0),
    date: t.transaction_date ?? "",
  }));
});

// The points this specific job earned: the transaction whose name contains
// the job customer's first real name word (the GenBlu app spells names
// differently — shortened, or with a MOHD in front) and whose points equal
// the job's cost total, on or near the job's date. Null when none lines
// up, so a second job on the same bike doesn't inherit the first job's points.
export function matchGenbluPoints(txs: GenbluTxLite[], customerName: string, revenue: number, jobDate: string | null): number | null {
  const key = nameWords(customerName).find((w) => !NAME_FILLER.has(w));
  if (!key) return null;
  const wanted = new Set([Math.floor(revenue), Math.round(revenue)]);
  const jobMs = jobDate ? Date.parse(jobDate) : NaN;
  let best: { points: number; gap: number } | null = null;
  for (const t of txs) {
    if (!t.words.includes(key) || !wanted.has(t.points)) continue;
    const gap = Number.isNaN(jobMs) || !t.date ? 0 : Math.abs(Date.parse(t.date) - jobMs) / 86400000;
    if (gap > 3) continue;
    if (!best || gap < best.gap) best = { points: t.points, gap };
  }
  return best ? best.points : null;
}

// The one place that decides whether a job has GenBlu (and its points) —
// shared by the Jobsheet/reports and the daily Telegram summary so they can
// never disagree. The plate finds the customer's registration even when the
// jobsheet name and the GenBlu-side name don't line up; the registration's
// own points are the fallback when they equal the job's cost.
export function jobGenbluPoints(
  plates: Map<string, GenbluPlateInfo>,
  txs: GenbluTxLite[],
  job: { customerName: string; plateNo: string; cost: number; date: string | null },
): number | null {
  const reg = plates.get(normalizePlate(job.plateNo ?? ""));
  const fromTx =
    matchGenbluPoints(txs, job.customerName ?? "", job.cost, job.date) ??
    (reg ? matchGenbluPoints(txs, reg.name, job.cost, job.date) : null);
  if (fromTx !== null) return fromTx;
  return reg !== undefined && (reg.points === Math.floor(job.cost) || reg.points === Math.round(job.cost)) ? reg.points : null;
}
