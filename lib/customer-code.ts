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

// Matches the wording already used on the branches' own manually-kept
// error sheet ("NO IC" / "WRONG NUMBER PHONE"), so the auto-generated
// report reads the same way staff already expect.
export const CUSTOMER_CODE_REASON: Record<Exclude<CustomerCodeCheck, "ok">, string> = {
  no_ic: "NO IC",
  invalid: "WRONG NUMBER PHONE",
};
