// Plain, framework-free logic shared by both the Walk-in Jobsheet form
// (live warning while typing) and the Customer IC Check report (retroactive
// audit) — kept as one function so the two never quietly disagree about
// what counts as a valid Customer Code.
//
// A real Malaysian IC number is exactly 12 digits (YYMMDD-PB-###G),
// written either with the two standard dashes or as one continuous run of
// digits — both are treated as valid. Anything else (blank, a phone
// number, a partial/garbled entry) is flagged.
export type CustomerCodeCheck = "ok" | "no_ic" | "invalid";

export function checkCustomerCode(raw: string): CustomerCodeCheck {
  const trimmed = raw.trim();
  if (!trimmed) return "no_ic";
  const digitsOnly = trimmed.replace(/[\s-]/g, "");
  if (/^\d{12}$/.test(digitsOnly)) return "ok";
  return "invalid";
}

// A Malaysian mobile number: 01 (or 601/+601) followed by 8-9 more digits —
// 10 or 11 digits total. Distinguishes an actual phone number from an
// under-length IC typo that just happens to also be short (e.g. a missing
// digit in the middle of an otherwise IC-shaped entry) — those aren't
// phone-shaped at all and shouldn't be labelled as if they were.
function looksLikePhone(digitsOnly: string): boolean {
  return /^01\d{7,9}$/.test(digitsOnly) || /^601\d{7,9}$/.test(digitsOnly);
}

// Short label for the report's Reason column, matching the branches' own
// manually-kept error sheet's style. A phone number counts as "NO IC" —
// it isn't the customer's IC at all, same as a blank field — rather than
// its own separate reason.
export function customerCodeReason(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "NO IC";
  const digitsOnly = trimmed.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digitsOnly)) return "INVALID FORMAT";
  const n = digitsOnly.length;
  if (n > 12) return "MORE THAN 12 DIGIT";
  if (looksLikePhone(digitsOnly)) return "NO IC";
  return "LESS THAN 12 DIGIT";
}

// Longer, conversational version for the live form warning — says exactly
// what's off instead of guessing "is this a phone number?" every time,
// which is misleading for e.g. a 13-digit IC with one extra typo digit.
export function customerCodeIssueMessage(raw: string): string {
  const trimmed = raw.trim();
  const digitsOnly = trimmed.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digitsOnly)) {
    return "Should be 12 digits (dashes are fine) — this has letters or other characters in it.";
  }
  const n = digitsOnly.length;
  if (n > 12) {
    return `IC number should be exactly 12 digits — this has ${n}, ${n - 12 === 1 ? "one too many" : `${n - 12} too many`}. Please check for a typo.`;
  }
  if (looksLikePhone(digitsOnly)) {
    return `IC number should be exactly 12 digits — this has ${n}. Is this a phone number by mistake?`;
  }
  return `IC number should be exactly 12 digits — this has ${n}, ${12 - n === 1 ? "one short" : `${12 - n} short`}. Please check for a missing digit.`;
}
