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
function findPhoneNumber(text: string): string {
  const local = text.match(/\b01\d{8,9}\b/);
  if (local) return local[0];
  // Sometimes read with the country code instead of the leading 0 ("60"
  // + the rest of the number, no "+") — reconstruct the local 01... form.
  const intl = text.match(/\b60(1\d{7,9})\b/);
  return intl ? `0${intl[1]}` : "";
}

function extractPhoneNumber(raw: string): string {
  // OCR sometimes reads one long digit run as two or three separate
  // whitespace-split pieces ("6011 27236001", or even "011 3902 6813").
  // Blindly rejoining every digit-space-digit gap in the whole string
  // risked merging two genuinely unrelated numbers that just happen to
  // sit next to each other — e.g. the sales/order code's last digit
  // getting glued onto the start of an otherwise-perfectly-readable phone
  // number right after it ("IVA014032 0176615018"), making both
  // unmatchable. Splitting into whitespace tokens first and only ever
  // joining tokens that are ALL digits (a code like "IVA014032" has
  // letters, so it's never a merge candidate) avoids that: try each token
  // alone, then each run of 2-3 consecutive all-digit tokens, until one
  // forms a valid phone number.
  const tokens = raw.split(/\s+/).filter(Boolean);
  for (let windowSize = 1; windowSize <= 3; windowSize++) {
    for (let i = 0; i + windowSize <= tokens.length; i++) {
      const slice = tokens.slice(i, i + windowSize);
      if (!slice.every((t) => /^\d+$/.test(t))) continue;
      const found = findPhoneNumber(slice.join(""));
      if (found) return found;
    }
  }
  return "";
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
  // Mechanic Code is always one short word (e.g. "NJ", "T") — the raw
  // capture sometimes bleeds into whatever comes right after it on the
  // same merged two-column row ("NJ OR ..."), so only the first word is
  // kept rather than the whole captured value.
  const mechanicCode = f.mechanicCode?.match(/^[A-Za-z0-9]+/)?.[0] ?? "";
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
  // User ID is only ever a 3-digit number ("004") or a 2-letter code
  // ("NI") — anything else caught by the label match is OCR noise
  // (trailing text from the next field bleeding onto the same line), not
  // a real ID, so it's dropped rather than filled in wrong.
  const rawUserId = f.jobsheetUserId ?? "";
  const jobsheetUserId = rawUserId.match(/^\d{3}\b/)?.[0] ?? rawUserId.match(/^[A-Za-z]{2}\b/)?.[0] ?? "";

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

  // A dash-suffixed code (e.g. "90793-AHB02", or "157-E3440-09" — the
  // suffix itself can have its own internal dash) sometimes gets read
  // back with the dash split off as its own token, or attached to
  // whichever side it's closer to ("90793 - AHB02", "90793- AHB02",
  // "90793 -AHB02") instead of one unbroken word — left alone, the dash
  // and suffix would get swallowed into the start of the description
  // instead of staying part of the code. A code suffix chunk is short,
  // alphanumeric, and mixes letters with digits — a real description
  // word doesn't.
  function looksLikeCodeSuffix(tok: string): boolean {
    return tok.length <= 12 && /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(tok) && /[A-Za-z]/.test(tok) && /\d/.test(tok);
  }

  // One attempt at reading a single item row out of one physical line (or
  // several merged together — see the loop below) of text. Returns null
  // rather than throwing/skipping-with-a-side-effect, so the caller
  // decides what to do next.
  function tryParseItemLine(rawLine: string): ScannedJobsheetItem | null {
    // OCR sometimes reads a decimal point as a colon with stray spaces on
    // both sides ("14.50" -> "14 : 50") — merged back into one token
    // before splitting, so it isn't mistaken for two unrelated numbers.
    const line = rawLine.replace(/(\d+)\s*:\s*(\d{2})(?!\d)/g, "$1.$2");
    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length < 4) return null;

    // The row-number cell is a separate token from the code that follows
    // it, and — unlike a product code — never runs more than two digits,
    // so a genuinely numeric code (e.g. "9000000013") doesn't get mistaken
    // for one and swallowed. OCR sometimes reads it back as more than one
    // such token (e.g. "23 3" instead of just "3", the row number
    // apparently duplicated) — every leading 1-2 digit token is skipped,
    // not just the first, so the real code right after doesn't get
    // mistaken for a second row number.
    let i = 0;
    while (i < tokens.length - 1 && /^\d{1,2}$/.test(tokens[i])) i++;
    let code = tokens[i];
    let descStart = i + 1;

    // Keeps stitching as long as the next token still looks like another
    // dash-suffix chunk, so a code split into more than two pieces (e.g.
    // "1DB - F414G - 01") gets fully reassembled, not just the first dash.
    for (;;) {
      const next = tokens[descStart] ?? "";
      if (code.endsWith("-") && looksLikeCodeSuffix(next)) {
        code += next;
        descStart += 1;
      } else if (next === "-" && looksLikeCodeSuffix(tokens[descStart + 1] ?? "")) {
        code += "-" + tokens[descStart + 1];
        descStart += 2;
      } else if (next.startsWith("-") && looksLikeCodeSuffix(next.slice(1))) {
        code += next;
        descStart += 1;
      } else {
        break;
      }
    }

    // Quantity is whichever numeric token, scanning left to right from
    // just after the code, is followed later on the row by a number that
    // equals qty * <that later number> (Unit Price -> Amount) — real rows
    // are internally consistent that way. This is deliberately NOT
    // anchored on a UOM word: plenty of real rows print a blank UOM cell
    // (oil sold by count rather than a unit, mainly), and requiring one
    // dropped every one of those rows entirely. A UOM word right after the
    // candidate, when present, is just skipped over rather than required —
    // it still matters for telling a real qty apart from a number that's
    // actually part of the spec ("40 API", "10W-40"), since those never
    // have a later number whose product with them checks out.
    for (let j = descStart; j < tokens.length; j++) {
      if (!isNumericToken(tokens[j])) continue;
      const qty = tokenToNumber(tokens[j]);
      if (qty <= 0) continue;
      let afterQty = j + 1;
      if (UOM_WORDS.test(tokens[afterQty] ?? "")) afterQty++;
      const nums = tokens
        .slice(afterQty)
        .filter(isNumericToken)
        .map(tokenToNumber);
      for (let k = 0; k < nums.length - 1; k++) {
        if (Math.abs(qty * nums[k] - nums[k + 1]) < 0.5) {
          const description = tokens.slice(descStart, j).join(" ").trim();
          if (!description) continue;
          return { code: code.trim(), description, quantity: qty, price: nums[k] };
        }
      }
    }
    return null;
  }

  // Guards the merge-with-later-lines fallback below: only a line that
  // already starts the way every real item row does (a small leading row
  // number) is worth trying to stitch onward. Without this, an ordinary
  // label line the row-number/qty checks happen to reject for other
  // reasons (e.g. "Customer Code : 910517-10-6231") could still
  // accidentally swallow a genuinely clean item row right after it into
  // one bad merged match, corrupting a row that would have parsed fine on
  // its own if left alone.
  function looksLikeItemRowStart(rawLine: string): boolean {
    const tokens = rawLine.trim().split(/\s+/).filter(Boolean);
    return tokens.length >= 2 && /^\d{1,2}$/.test(tokens[0]);
  }

  const lines = text.split("\n");
  for (let li = 0; li < lines.length; li++) {
    const single = tryParseItemLine(lines[li]);
    if (single) {
      items.push(single);
      continue;
    }
    // A wide items table (this jobsheet template runs Item/Code/
    // Description/Qty/UOM/Unit Price/Amount/Discount/GST Amt/I-E/Nett Amt
    // — eleven columns) gives OCR's row-reconstruction more room to split
    // one physical row across two or even three reconstructed lines than
    // a narrower form does — e.g. "1 90793-AH426 YAMALUBE" on one line,
    // "4T RS 200 10W-50 SN WITH ES 2.00 113.50 227.00" on the next, and a
    // stray "I 227.00" on a third. A lone line with no code+description or
    // no qty/price pair can't be recovered on its own — but stitching it
    // to the line(s) right after and trying again catches that without
    // changing anything for the (majority) rows that already read cleanly
    // on one line.
    if (looksLikeItemRowStart(lines[li])) {
      for (let span = 2; span <= 3 && li + span - 1 < lines.length; span++) {
        const merged = tryParseItemLine(lines.slice(li, li + span).join(" "));
        if (merged) {
          items.push(merged);
          li += span - 1;
          break;
        }
      }
    }
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
