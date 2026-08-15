// Not a "use server" module — this is called from the /api/scan-jobsheet
// route handler (a plain multipart upload), not directly from the client.
// Passing a jobsheet photo's base64 as a Server Action argument hits
// Next's RSC flight-protocol nesting limit on large strings; a normal HTTP
// route has no such limit.
import { requireApproved } from "./current-user";
import { extractTextFromImage, extractTextFromPdf } from "./vision";
import type { Branch } from "./branch";

export type ScannedJobsheetItem = { code: string; description: string; quantity: number; price: number };

export type ScannedJobsheet = {
  customerCode: string;
  customerName: string;
  plateNo: string;
  model: string;
  colour: string;
  engineNo: string;
  chassisNo: string;
  mechanicCode: string;
  branch: Branch | null;
  startedDate: string | null;
  jobsheetNo: string;
  salesNo: string;
  salesDate: string;
  warrantyCardNo: string;
  mileageKm: string;
  nextMileageKm: string;
  serviceType: string;
  nextServiceDate: string;
  jobsheetUserId: string;
  items: ScannedJobsheetItem[];
  rawText: string;
};

function toIsoDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// The jobsheet has two label/value columns side by side, so after row
// reconstruction a single line can read "Customer Code : 123 Job No. : 456"
// — a plain "label ... rest of line" regex would swallow the second
// field's label and value into the first field. Instead, every known
// label is located by position across the whole text, sorted, and each
// value is cut off at whichever comes first: the next label on the same
// line, or the end of the line.
const FIELD_LABELS: { key: string; regex: RegExp }[] = [
  { key: "customerCode", regex: /Customer Code/gi },
  { key: "customerName", regex: /Customer Name/gi },
  { key: "salesNo", regex: /Sales No\.?/gi },
  { key: "salesDate", regex: /Sales Date/gi },
  { key: "plateNo", regex: /Vehicle No\.?/gi },
  { key: "model", regex: /\bModel\b/gi },
  { key: "colour", regex: /Colour/gi },
  { key: "engineNo", regex: /Engine No\.?/gi },
  { key: "chassisNo", regex: /Chassis No\.?/gi },
  { key: "warrantyCardNo", regex: /Warranty Card No\.?/gi },
  { key: "jobsheetNo", regex: /Job No\.?/gi },
  { key: "jobDate", regex: /Job Date/gi },
  { key: "mechanicCode", regex: /Mechanic Code/gi },
  { key: "jobsheetUserId", regex: /User ID/gi },
  { key: "nextMileageKm", regex: /Next Mileage\s*\(?\s*KM\s*\)?/gi },
  { key: "mileageKm", regex: /(?<!Next )Mileage\s*\(?\s*KM\s*\)?/gi },
  { key: "serviceType", regex: /Service Type/gi },
  { key: "nextServiceDate", regex: /Next Service Date/gi },
];

function extractFields(text: string): Record<string, string> {
  const matches: { key: string; start: number; end: number }[] = [];
  for (const { key, regex } of FIELD_LABELS) {
    for (const m of text.matchAll(regex)) {
      if (m.index === undefined) continue;
      matches.push({ key, start: m.index, end: m.index + m[0].length });
    }
  }
  matches.sort((a, b) => a.start - b.start);

  const values: Record<string, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const { key, end } = matches[i];
    if (values[key]) continue;
    const lineEnd = text.indexOf("\n", end);
    const nextLabelStart = matches[i + 1]?.start ?? Infinity;
    const to = Math.min(lineEnd === -1 ? text.length : lineEnd, nextLabelStart, text.length);
    const value = text
      .slice(end, to)
      .replace(/^[\s:.=\-]+/, "")
      .trim();
    if (value) values[key] = value;
  }
  return values;
}

// Best-effort read of the standard BMM job card layout — labelled fields
// plus a parts table. Nothing here is trusted blindly: everything it finds
// is only ever used to pre-fill the Add Job form, which the mechanic still
// has to check and confirm before saving.
function parseJobsheetText(text: string): ScannedJobsheet {
  const f = extractFields(text);
  const customerCode = f.customerCode ?? "";
  const customerName = f.customerName ?? "";
  const plateNo = f.plateNo ?? "";
  const model = f.model ?? "";
  const colour = f.colour ?? "";
  const engineNo = f.engineNo ?? "";
  const chassisNo = f.chassisNo ?? "";
  const mechanicCode = f.mechanicCode ?? "";
  const startedDate = f.jobDate ? toIsoDate(f.jobDate) : null;

  const jobsheetNo = f.jobsheetNo ?? "";
  const salesNo = f.salesNo ?? "";
  const salesDate = f.salesDate ? (toIsoDate(f.salesDate) ?? "") : "";
  const warrantyCardNo = f.warrantyCardNo ?? "";
  const mileageKm = f.mileageKm ?? "";
  const nextMileageKm = f.nextMileageKm ?? "";
  const serviceType = f.serviceType ?? "";
  const nextServiceDate = f.nextServiceDate ? (toIsoDate(f.nextServiceDate) ?? "") : "";
  const jobsheetUserId = f.jobsheetUserId ?? "";

  let branch: Branch | null = null;
  const upper = text.toUpperCase();
  if (upper.includes("SETIA ALAM")) branch = "setia_alam";
  else if (upper.includes("PUNCAK ALAM")) branch = "puncak_alam";
  else if (upper.includes("KAPAR")) branch = "kapar";

  // Item rows look like: "1  9OO00000023  OIL ROCK OIL SYNTHESIS ...  1.00  UNIT  96.00  96.00"
  // (No., Code, Description, Qty, UOM, Unit Price, Amount, ...). Lines that
  // don't follow that shape (discount lines, blank rows) are skipped rather
  // than guessed at.
  const items: ScannedJobsheetItem[] = [];
  const itemLinePattern = /^\d+\s+(\S+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+\S+\s+(\d+(?:\.\d{2}))\s+\d+(?:\.\d{2})/;
  for (const line of text.split("\n")) {
    const m = line.match(itemLinePattern);
    if (!m) continue;
    const [, code, description, qty, unitPrice] = m;
    items.push({
      code: code.trim(),
      description: description.trim(),
      quantity: Number(qty) || 1,
      price: Number(unitPrice) || 0,
    });
  }

  return {
    customerCode,
    customerName,
    plateNo,
    model,
    colour,
    engineNo,
    chassisNo,
    mechanicCode,
    branch,
    startedDate,
    jobsheetNo,
    salesNo,
    salesDate,
    warrantyCardNo,
    mileageKm,
    nextMileageKm,
    serviceType,
    nextServiceDate,
    jobsheetUserId,
    items,
    rawText: text,
  };
}

export async function scanJobsheet(
  base64File: string,
  mimeType: string
): Promise<{ data: ScannedJobsheet } | { error: string }> {
  await requireApproved();
  try {
    const text =
      mimeType === "application/pdf" ? await extractTextFromPdf(base64File) : await extractTextFromImage(base64File);
    if (!text.trim()) {
      return { error: "Couldn't read any text from that file — try a clearer, well-lit photo." };
    }
    return { data: parseJobsheetText(text) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/deadline/i.test(message)) {
      return { error: "Google's scanning service timed out — please try uploading the jobsheet again." };
    }
    return { error: message || "Something went wrong reading the jobsheet." };
  }
}
