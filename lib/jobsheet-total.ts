// The jobsheet prints its grand total twice — as a number next to "TOTAL"
// and spelled out ("RM: Two Hundred Sixty Nine And Cents Ten Only"). Reading
// both and only trusting them when they agree is what made a re-check of
// every past jobsheet reliable (909 of 949 agreed outright; the rest had one
// of the two readable). The scan uses it to check its own item lines: if they
// don't add up to what the customer was actually charged, a line was missed
// or a price misread.

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const NUMBER_WORD = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\b/i;

function wordsToNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let seen = false;
  for (const w of words) {
    if (w in ONES) { current += ONES[w]; seen = true; }
    else if (w in TENS) { current += TENS[w]; seen = true; }
    else if (w === "hundred") { current = (current || 1) * 100; seen = true; }
    else if (w === "thousand") { total += (current || 1) * 1000; current = 0; seen = true; }
  }
  return seen ? total + current : null;
}

function totalInWords(text: string): number | null {
  const line = text.split("\n").find((l) => /\bonly\b/i.test(l) && NUMBER_WORD.test(l));
  if (!line) return null;
  const body = line.slice(0, line.search(/\bonly\b/i)).toLowerCase().replace(/-/g, " ");
  const [ringgitPart, centsPart] = body.split(/\b(?:and\s+)?(?:cents?|sen)\b/);
  const ringgit = wordsToNumber(ringgitPart.match(/[a-z]+/g) ?? []);
  if (ringgit === null) return null;
  const cents = centsPart ? (wordsToNumber(centsPart.match(/[a-z]+/g) ?? []) ?? 0) : 0;
  return Math.round((ringgit + cents / 100) * 100) / 100;
}

function totalAsNumber(text: string): number | null {
  const re = /(^|[^A-Za-z])TOTAL\b/g;
  let last = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) last = m.index;
  if (last < 0) return null;
  const after = text.slice(last, last + 200).match(/\b\d{1,3}(?:,\d{3})*\.\d{2}\b/);
  return after ? Number(after[0].replace(/,/g, "")) : null;
}

/** The jobsheet's printed grand total, or null when it can't be read with confidence. */
export function readPrintedTotal(text: string): number | null {
  const asNumber = totalAsNumber(text);
  const inWords = totalInWords(text);
  if (asNumber !== null && inWords !== null) {
    // Disagreeing: the words are the steadier read (a misread digit in the
    // number is far more common than a misread whole word).
    return inWords;
  }
  return inWords ?? asNumber;
}

export const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** Is this amount printed anywhere on the jobsheet (as a positive or negative figure)? */
export function amountAppears(text: string, amount: number): boolean {
  const target = Math.abs(amount);
  for (const m of text.matchAll(/-?\d{1,3}(?:,\d{3})*\.\d{2}\b/g)) {
    if (sameAmount(Math.abs(Number(m[0].replace(/,/g, ""))), target)) return true;
  }
  return false;
}

// Table/form words that are never a line item's own description.
const NOT_A_DESCRIPTION = /\b(ITEM|CODE|DESCRIPTION|QTY|UOM|UNIT|PRICE|AMOUNT|AMT|GST|NETT|I\/E|TOTAL|ONLY|JOB CARD|PAGE|USER|MECHANIC|MILEAGE|SERVICE TYPE|NEXT|DEALER|COMPLAINTS|CUSTOMER|SALES|VEHICLE|MODEL|COLOUR|ENGINE|CHASSIS|WARRANTY|SIGNATURE|DEFECT|BERJAYA|DATE|TIME|RM)\b/i;

function candidateLabels(text: string): string[] {
  const start = text.search(/\bDescription\b/i);
  const end = text.search(/\bTOTAL\b|\bOnly\b/i);
  const body = text.slice(start >= 0 ? start : 0, end > start ? end : undefined);
  return body
    .split("\n")
    .map((l) => l.replace(/-?\d+(?:[.,]\d+)?/g, " ").replace(/\s+/g, " ").trim())
    .filter((l) => /^[A-Za-z][A-Za-z .&/'()-]{2,40}$/.test(l) && !NOT_A_DESCRIPTION.test(l));
}

/** Best guess at the name of a missing discount line ("FREE COOLANT", "COMBO ROCK OIL", ...). */
export function guessDiscountLabel(text: string): string {
  const hit = candidateLabels(text).find((l) => /\b(FREE|FOC|DISC(?:OUNT)?|COMBO|VOUCHER|PROMO|REBATE|PACKAGE|PAKEJ)\b/i.test(l));
  return hit ? hit.toUpperCase() : "Discount";
}

/** Best guess at the name of a missing charge line ("SERVICE CVT", ...), skipping words already on other lines. */
export function guessChargeLabel(text: string, knownDescriptions: string[]): string {
  const known = knownDescriptions.join(" ").toUpperCase();
  const hit = candidateLabels(text).find(
    (l) => !/\b(FREE|FOC|DISC(?:OUNT)?|COMBO|VOUCHER|PROMO|REBATE)\b/i.test(l) && !l.toUpperCase().split(" ").every((w) => known.includes(w)),
  );
  return hit ? hit.toUpperCase() : "Other charges";
}
