// Bare uppercase letters/digits only, so "ABC 1234" and "ABC1234" (or a
// stray extra space from OCR/typing) are treated as the same plate when
// matching a Walk-in job against a GenBlu registration.
export function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/[\s-]/g, "");
}

// Malaysian plate rules (JPJ, as listed for current plates, Nov 2026):
//  - 1–3 letters, then 1–4 digits with no leading zero, then at most one
//    letter at the end: VQK7445, SU6013P, WB9619Y.
//  - I, O and Z are never used (Z is military only).
//  - The first letter is a state/area code: A B C D F J K L M N P R T V W,
//    Q (Sarawak), S (Sabah), H (taxi).
//  - Special series: a word, then digits (PUTRAJAYA 1, GOLD 8742, UITM 7762).
const STATE_FIRST = "ABCDFHJKLMNPQRSTVW";
const SPECIAL_SERIES = ["PUTRAJAYA", "MALAYSIA", "PATRIOT", "GOLD", "VIPS", "VIP", "IIUM", "UITM", "PETRA", "MADANI", "LIMO", "PROTON", "PERODUA", "SATRIA",
  // university series
  "UNIMAS", "UNIMAP", "UNISZA", "UTHM", "UTEM", "UPSI", "USIM", "UPNM", "UIAM", "UKM", "UTM", "UMS", "UPM", "USM", "UUM", "UMP", "UMT", "UMK"];
const SERIES_LETTER = /^[A-HJ-NP-Y]+$/; // A–Y without I and O

export type PlateCheck = {
  plate: string; // tidied: capitals, no spaces, stray text after the plate removed
  valid: boolean; // follows the JPJ pattern
  problem: string | null; // plain-language reason when not valid
};

export function checkPlateNo(raw: string | null | undefined): PlateCheck {
  let t = (raw ?? "").toUpperCase().trim();
  if (!t) return { plate: "", valid: false, problem: "Plate number is missing." };
  // A label or symbol read in front of it ("ER : VNF 9778", "* DFL 4175").
  t = t.replace(/^(?:[A-Z]{1,2}\s*:\s*|[^A-Z0-9]+)+(?=[A-Z]{1,3}\s*\d)/, "");

  for (const word of SPECIAL_SERIES) {
    const m = t.match(new RegExp(`^${word}\\s*([1-9]\\d{0,3})(?:\\s*([A-HJ-NP-Y])(?=\\s|$))?(?![A-Z0-9])`));
    if (m) return { plate: word + m[1] + (m[2] ?? ""), valid: true, problem: null };
  }

  const m = t.match(/^([A-Z]{1,3})\s*(\d{1,4})(?:\s*([A-Z])(?=\s|$))?(?![A-Z0-9])/);
  if (!m) {
    return { plate: normalizePlate(t), valid: false, problem: "Doesn't look like a plate number (letters, then up to 4 numbers)." };
  }
  const [, letters, digits, suffix = ""] = m;
  const plate = letters + digits + suffix;
  if (!STATE_FIRST.includes(letters[0])) return { plate, valid: false, problem: `No Malaysian plate starts with "${letters[0]}".` };
  if (!SERIES_LETTER.test(letters) || (suffix && !SERIES_LETTER.test(suffix)))
    return { plate, valid: false, problem: "Plates never use the letters I, O or Z." };
  if (digits.startsWith("0")) return { plate, valid: false, problem: "Plate numbers never start with 0." };
  return { plate, valid: true, problem: null };
}
