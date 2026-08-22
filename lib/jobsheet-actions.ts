// Not a "use server" module — this is called from the /api/scan-jobsheet
// route handler (a plain multipart upload), not directly from the client.
// Passing a jobsheet photo's base64 as a Server Action argument hits
// Next's RSC flight-protocol nesting limit on large strings; a normal HTTP
// route has no such limit.
import { requireApproved } from "./current-user";
import { scanJobsheetImage, extractTextFromPdf } from "./vision";
import { extractItemsWithAi } from "./ai-item-extract";
import type { Branch } from "./branch";

export type ScannedJobsheetItem = { code: string; description: string; quantity: number; price: number };

export type ScannedJobsheet = {
  customerCode: string;
  customerName: string;
  customerPhone: string;
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

// The Sales No. field on this jobsheet actually has the customer's phone
// number printed right after the sales/invoice number, space-separated
// (e.g. "IVP001568 01139026813") — pull it out into its own field without
// touching salesNo itself, which stays exactly as scanned.
function extractPhoneNumber(raw: string): string {
  const m = raw.match(/\b01\d{8,9}\b/);
  return m ? m[0] : "";
}

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
  // Fallback for the line above — "Next" gets misread unpredictably ("ext",
  // "Let", dropped entirely) since it's the first word run together with
  // whatever's above it on the form. "Service Date" alone doesn't collide
  // with anything else on the jobsheet (Sales Date and Service Type are
  // both spelled differently), so it's safe to trigger on its own.
  { key: "nextServiceDate", words: ["service", "date"] },
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
  // Customer Code is a dash-separated run of number groups, e.g.
  // "801206 - 10 - 5757" — but the raw captured value often keeps running
  // on into trailing text further down the same line ("... 5757 JOB CARD")
  // since that text has no recognized label of its own to cut the value
  // off at. Every leading digit group and its dash separators are kept;
  // anything after the last one (like "JOB CARD") is dropped.
  const customerCode = (f.customerCode ?? "").match(/^\d+(?:\s*-\s*\d+)*/)?.[0]?.trim() ?? "";
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
  const customerPhone = extractPhoneNumber(salesNo);
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
  // (No., Code, Description, Qty, UOM, Unit Price, Amount, ...).
  //
  // Parsed by scanning tokens left-to-right for a clean "<number> <UOM
  // word>" pair rather than one big regex over the whole line — a single
  // pattern turned out to backtrack past real noise (a stray extra digit,
  // a misread punctuation mark standing in for a missing column) and lock
  // onto entirely the wrong tokens as qty/price instead of just failing to
  // match. That's worse than skipping the row: it silently saves a wrong
  // quantity or price instead of leaving the row for the mechanic to type
  // in by hand.
  const items: ScannedJobsheetItem[] = [];
  const UOM_WORDS = /^(UNIT|UNI|PCS?|SET|PKT|PAIR|PRS|LTRS?|L|KG|BTL|BOX|TIN|ROLL|PAIL|EA|NOS)$/i;

  function isNumericToken(tok: string): boolean {
    return /^\d+(?:[.,:]\d+)?$/.test(tok);
  }
  function tokenToNumber(tok: string): number {
    return Number(tok.replace(/[,:]/g, ".")) || 0;
  }

  for (const rawLine of text.split("\n")) {
    // OCR sometimes reads a decimal point as a colon with stray spaces on
    // both sides ("14.50" -> "14 : 50") — merged back into one token
    // before splitting, so it isn't mistaken for two unrelated numbers.
    const line = rawLine.replace(/(\d+)\s*:\s*(\d{2})(?!\d)/g, "$1.$2");
    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length < 4) continue;

    // A leading row number is a separate token from the code that
    // follows it, and — unlike a product code — never runs more than two
    // digits, so a genuinely numeric code (e.g. "9000000013") doesn't get
    // mistaken for one and swallowed.
    let i = /^\d{1,2}$/.test(tokens[0]) ? 1 : 0;
    const code = tokens[i];
    const descStart = i + 1;

    // The first "<clean number> <UOM word>" pair after the code is Qty
    // followed by UOM. Requiring the word to be a real UOM (not just any
    // run of letters) matters here specifically — motor oil descriptions
    // are full of "<number> <ALL-CAPS spec>" pairs like "40 API" or "40
    // SN" that would otherwise get mistaken for the quantity.
    let qtyIndex = -1;
    for (let j = descStart; j < tokens.length - 1; j++) {
      if (isNumericToken(tokens[j]) && UOM_WORDS.test(tokens[j + 1])) {
        qtyIndex = j;
        break;
      }
    }
    if (qtyIndex === -1) continue;

    const description = tokens.slice(descStart, qtyIndex).join(" ").trim();
    const quantity = tokenToNumber(tokens[qtyIndex]) || 1;
    const afterUom = tokens
      .slice(qtyIndex + 2)
      .filter(isNumericToken)
      .map(tokenToNumber);
    if (afterUom.length === 0) continue;

    // Unit Price is whichever candidate, multiplied by Qty, actually
    // matches a later number on the same row (Amount) — real rows are
    // internally consistent that way, which is what lets a spurious extra
    // number OCR sometimes inserts get skipped instead of mistaken for
    // the real price. Falls back to the first candidate if nothing lines
    // up (still better than leaving the row out entirely).
    let price = afterUom[0];
    for (let k = 0; k < afterUom.length - 1; k++) {
      if (Math.abs(quantity * afterUom[k] - afterUom[k + 1]) < 0.5) {
        price = afterUom[k];
        break;
      }
    }

    items.push({ code: code.trim(), description, quantity, price });
  }

  return {
    customerCode,
    customerName,
    customerPhone,
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
      const parsed = parseJobsheetText(text);
      if (parsed.items.length === 0) {
        const aiItems = await extractItemsWithAi(text);
        if (aiItems && aiItems.length > 0) parsed.items = aiItems;
      }
      return { data: parsed };
    }
    const { text, signatureDetected, signatureDebug } = await scanJobsheetImage(base64File);
    if (!text.trim()) {
      return { error: "Couldn't read any text from that file — try a clearer, well-lit photo." };
    }
    const parsed = parseJobsheetText(text);
    // The regex-based parser above skips rows it can't safely match rather
    // than guess — if that leaves zero items despite the raw text almost
    // certainly containing an items table, this is a best-effort second
    // pass that lets an LLM use context to recover what the regex couldn't.
    // No-ops (parsed.items stays empty) if GEMINI_API_KEY isn't set.
    if (parsed.items.length === 0) {
      const aiItems = await extractItemsWithAi(text);
      if (aiItems && aiItems.length > 0) parsed.items = aiItems;
    }
    return { data: { ...parsed, signatureDetected, signatureDebug } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/deadline/i.test(message)) {
      return { error: "The scanning service timed out — please try uploading the jobsheet again." };
    }
    return { error: message || "Something went wrong reading the jobsheet." };
  }
}
