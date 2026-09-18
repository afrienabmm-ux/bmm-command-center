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
export const getGenbluPlatePoints = cache(async (): Promise<Map<string, number>> => {
  const { data, error } = await supabaseAdmin.from("cc_genblu_registrations").select("customer_plate_no, points_accrued");
  if (error) throw new Error(error.message);
  const map = new Map<string, number>();
  for (const r of data ?? []) {
    const plate = normalizePlate(r.customer_plate_no ?? "");
    if (plate) map.set(plate, r.points_accrued ?? 0);
  }
  return map;
});
