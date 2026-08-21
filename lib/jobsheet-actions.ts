// Not a "use server" module — this is called from the /api/scan-jobsheet
// route handler (a plain multipart upload), not directly from the client.
// Passing a jobsheet photo's base64 as a Server Action argument hits
// Next's RSC flight-protocol nesting limit on large strings; a normal HTTP
// route has no such limit.
import { requireApproved } from "./current-user";
import { scanJobsheetImage, extractTextFromPdf } from "./vision";
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
  // Best-effort check for a customer signature in the jobsheet photo —
  // true/false when the "Signature" label was found and checked, null
  // when it couldn't be located at all (different layout, bad photo).
  signatureDetected: boolean | null;
  // Raw scores/threshold behind signatureDetected — shown in the scan
  // troubleshooting panel so miscalibration can be diagnosed from a real
  // photo instead of guessed at.
  signatureDebug: string;
};

function toIsoDate(raw: string): string | null {
  // OCR often reads the dashes/slashes in a date with stray spaces around
  // them ("19 - 08 - 2026" instead of "19-08-2026") — the \s* here tolerates
  // that instead of silently failing to match at all.
  const m = raw.match(/(\d{1,2})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{2,4})/);
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
//
// Labels are matched fuzzily, word by word, using edit distance rather
// than an exact or prefix regex — OCR mangles labels unpredictably
// ("Mileage" -> "Mlleage", "Sales" -> "Saies", "User ID" -> "User 1D"),
// and a fixed prefix like /Sal\w*/ still misses "Saies" (the "l" read as
// "i" changes a letter prefix matches expect exactly). Comparing each
// observed word's edit distance to the expected word tolerates a
// substitution/insertion/deletion anywhere in the word, not just after a
// clean prefix — trading a little precision for actually filling the
// field, since the PIC is expected to check every scanned value before
// saving anyway.
const FIELD_LABELS: { key: string; words: string[]; excludeIfPrecededBy?: string; firstLetterWords?: number[] }[] = [
  // "Code" gets misread badly and unpredictably ("Coop", "Cade", "Ccde" —
  // edit distance too far for the normal fuzzy match), but "Customer Name"
  // is the only other "Customer ___" label and it doesn't start with "c",
  // so once "Customer" itself matches, just checking the next word starts
  // with "c" is enough to tell these two labels apart safely.
  { key: "customerCode", words: ["customer", "code"], firstLetterWords: [1] },
  { key: "customerName", words: ["customer", "name"] },
  { key: "salesNo", words: ["sales", "no"] },
  { key: "salesDate", words: ["sales", "date"] },
  { key: "plateNo", words: ["vehicle", "no"] },
  { key: "model", words: ["model"] },
  { key: "colour", words: ["colour"] },
  { key: "engineNo", words: ["engine", "no"] },
  { key: "chassisNo", words: ["chassis", "no"] },
  { key: "warrantyCardNo", words: ["warranty", "card", "no"] },
  { key: "jobsheetNo", words: ["job", "no"] },
  { key: "jobDate", words: ["job", "date"] },
  { key: "mechanicCode", words: ["mechanic", "code"] },
  { key: "jobsheetUserId", words: ["user", "id"] },
  { key: "nextMileageKm", words: ["next", "mileage", "km"] },
  // The two Mileage fields are told apart by the word before them, not by
  // spelling — skip a match here if it's really the tail end of "Next
  // Mileage (KM)" (already claimed by nextMileageKm above).
  { key: "mileageKm", words: ["mileage", "km"], excludeIfPrecededBy: "next" },
  { key: "serviceType", words: ["service", "type"] },
  { key: "nextServiceDate", words: ["next", "service", "date"] },
  // These three aren't fields the form needs (their values are never read
  // below) — they're here purely as boundary markers. The jobsheet's
  // two columns get merged onto the same reconstructed row (e.g. "Sales
  // No." lines up with "Page", "Chassis No." lines up with
  // "Dealer/Manufacture"), so without a recognized label to stop at, the
  // real field on that row swallows the other column's label and value
  // too — which is how "Warranty Card No." ended up reading
  // "Dealer / Manufacture".
  { key: "page", words: ["page"] },
  { key: "dealerManufacture", words: ["dealer", "manufacture"] },
  // Standalone fallback for the boundary above — a real scan misread
  // "Dealer" as "Dasier" (edit distance too far from "dealer" to match),
  // which let it through as a boundary and "Manufacture" alone still read
  // fine. "Manufacture" alone is unusual enough elsewhere on the page that
  // it's safe as its own trigger.
  { key: "manufacture", words: ["manufacture"] },
  { key: "complaints", words: ["complaints"] },
];

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j - 1], dp[j]);
      prev = tmp;
    }
  }
  return dp[n];
}

function normalizeWord(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// How many character edits a scanned word may be off from the expected
// label word and still count as a match — roughly a third of the word's
// length (min 1), which absorbs a typical single OCR misread without
// letting the word drift into something unrelated.
function wordMatchesLoosely(observed: string, canonical: string): boolean {
  if (!observed) return false;
  const threshold = Math.max(1, Math.floor(canonical.length * 0.34));
  return levenshtein(observed, canonical) <= threshold;
}

type PositionedToken = { text: string; start: number; end: number };

function tokenize(text: string): PositionedToken[] {
  const tokens: PositionedToken[] = [];
  for (const m of text.matchAll(/\S+/g)) {
    if (m.index === undefined) continue;
    const normalized = normalizeWord(m[0]);
    // Punctuation-only tokens (like the "/" in "Dealer / Manufacture")
    // carry no signal and would otherwise sit between two label words and
    // break their adjacency, so they're dropped rather than compared.
    if (!normalized) continue;
    tokens.push({ text: normalized, start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

function findLabelMatches(tokens: PositionedToken[]): { key: string; start: number; end: number }[] {
  const matches: { key: string; start: number; end: number }[] = [];
  for (const label of FIELD_LABELS) {
    const wordCount = label.words.length;
    for (let i = 0; i + wordCount <= tokens.length; i++) {
      let matchesAllWords = true;
      for (let w = 0; w < wordCount; w++) {
        const observed = tokens[i + w].text;
        const canonical = label.words[w];
        const wordMatches = label.firstLetterWords?.includes(w)
          ? observed.length > 0 && observed[0] === canonical[0]
          : wordMatchesLoosely(observed, canonical);
        if (!wordMatches) {
          matchesAllWords = false;
          break;
        }
      }
      if (!matchesAllWords) continue;
      if (label.excludeIfPrecededBy && i > 0 && wordMatchesLoosely(tokens[i - 1].text, label.excludeIfPrecededBy)) {
        continue;
      }
      matches.push({ key: label.key, start: tokens[i].start, end: tokens[i + wordCount - 1].end });
    }
  }
  return matches;
}

function extractFields(text: string): Record<string, string> {
  const matches = findLabelMatches(tokenize(text)).sort((a, b) => a.start - b.start);

  const values: Record<string, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const { key, end } = matches[i];
    if (values[key]) continue;
    const lineEnd = text.indexOf("\n", end);
    const nextLabelStart = matches[i + 1]?.start ?? Infinity;
    const to = Math.min(lineEnd === -1 ? text.length : lineEnd, nextLabelStart, text.length);
    // The ")" here matters for labels like "Mileage (KM)" — the label
    // match ends right after "KM", so the value slice starts with the
    // printed ")" from the label itself unless it's stripped too.
    const value = text
      .slice(end, to)
      .replace(/^[\s:.=\-)\]]+/, "")
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
  // "KAPA" (not the full "KAPAR") — OCR has read it as "KAPAIT" on a real
  // scan, and nothing else on a bike jobsheet plausibly starts with those
  // 4 letters, so the shorter prefix is safe and more tolerant of misreads.
  if (upper.includes("SETIA ALAM")) branch = "setia_alam";
  else if (upper.includes("PUNCAK ALAM")) branch = "puncak_alam";
  else if (upper.includes("KAPA")) branch = "kapar";

  // Item rows look like: "1  9OO00000023  OIL ROCK OIL SYNTHESIS ...  1.00  UNIT  96.00  96.00"
  // (No., Code, Description, Qty, UOM, Unit Price, Amount, ...). Lines that
  // don't follow that shape (discount lines, blank rows) are skipped rather
  // than guessed at.
  const items: ScannedJobsheetItem[] = [];
  // [.,] instead of a plain "." on the decimal parts — OCR sometimes reads
  // the decimal point as a comma (observed: "1.00" -> "1,00").
  const itemLinePattern = /^\d+\s+(\S+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+\S+\s+(\d+(?:[.,]\d{2}))\s+\d+(?:[.,]\d{2})/;
  for (const line of text.split("\n")) {
    const m = line.match(itemLinePattern);
    if (!m) continue;
    const [, code, description, qty, unitPrice] = m;
    items.push({
      code: code.trim(),
      description: description.trim(),
      quantity: Number(qty.replace(",", ".")) || 1,
      price: Number(unitPrice.replace(",", ".")) || 0,
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
    signatureDetected: null,
    signatureDebug: "",
  };
}

export async function scanJobsheet(
  base64File: string,
  mimeType: string
): Promise<{ data: ScannedJobsheet } | { error: string }> {
  await requireApproved();
  try {
    if (mimeType === "application/pdf") {
      const text = await extractTextFromPdf(base64File);
      if (!text.trim()) {
        return { error: "Couldn't read any text from that file — try a clearer, well-lit photo." };
      }
      return { data: parseJobsheetText(text) };
    }
    const { text, signatureDetected, signatureDebug } = await scanJobsheetImage(base64File);
    if (!text.trim()) {
      return { error: "Couldn't read any text from that file — try a clearer, well-lit photo." };
    }
    return { data: { ...parseJobsheetText(text), signatureDetected, signatureDebug } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/deadline/i.test(message)) {
      return { error: "The scanning service timed out — please try uploading the jobsheet again." };
    }
    return { error: message || "Something went wrong reading the jobsheet." };
  }
}
