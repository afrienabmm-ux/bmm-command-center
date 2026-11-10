import type { Branch } from "./branch";

// Every jobsheet number is 3 letters for the branch + 6 digits, e.g.
// JBA009890. JBA = Kapar, JBT = Setia Alam, JBP = Puncak Alam.
export const JOBSHEET_PREFIX: Record<Branch, string> = {
  kapar: "JBA",
  setia_alam: "JBT",
  puncak_alam: "JBP",
};

export const JOBSHEET_FORMAT_HINT = "3 letters + 6 numbers, e.g. JBA009890 (Kapar), JBT017261 (Setia Alam), JBP006539 (Puncak Alam)";

// Tidies what was typed or scanned: upper-cases it, drops spaces/dashes
// inside the number and any stray text after it ("JBA009904 De",
// "JBP006562 1", "jba-009890" all become the clean 9-character number).
// Returns null when there's no valid jobsheet number in it at all.
export function cleanJobsheetNo(raw: string | null | undefined): string | null {
  const m = (raw ?? "").trim().toUpperCase().match(/^(JB[ATP])[\s-]*(\d{6})(?!\d)/);
  return m ? m[1] + m[2] : null;
}

export function branchOfJobsheetNo(no: string): Branch | null {
  const prefix = no.slice(0, 3).toUpperCase();
  return (Object.keys(JOBSHEET_PREFIX) as Branch[]).find((b) => JOBSHEET_PREFIX[b] === prefix) ?? null;
}

// Checks a jobsheet number before saving. Gives back the cleaned number, or
// a plain-language error for the person filling in the form.
export function checkJobsheetNo(raw: string | null | undefined, branch: Branch): { jobNo: string } | { error: string } {
  if (!(raw ?? "").trim()) return { error: `Job No. (jobsheet) is missing. It should be ${JOBSHEET_FORMAT_HINT}.` };
  const jobNo = cleanJobsheetNo(raw);
  if (!jobNo) return { error: `"${(raw ?? "").trim()}" is not a valid jobsheet number. It should be ${JOBSHEET_FORMAT_HINT}.` };
  const expected = JOBSHEET_PREFIX[branch];
  if (!jobNo.startsWith(expected)) {
    return { error: `${jobNo} is not a jobsheet number for this branch — this branch's numbers start with ${expected}.` };
  }
  return { jobNo };
}
