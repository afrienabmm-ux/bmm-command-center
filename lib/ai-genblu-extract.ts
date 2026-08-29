// Best-effort fallback for when the label-based regex extractors in
// genblu-actions.ts can't find a customer name + points on a screenshot —
// the GenBlu app has several different screens that can show a points
// event (instant award confirmation, transaction history detail,
// redemption/deduction detail, and whatever else it adds later), each with
// its own label wording and layout. Rather than hand-writing a new regex
// for every screen the GenBlu app happens to use, an LLM can read the same
// three things a person would: who it's for, how many points, and when —
// regardless of layout.
//
// Optional: skipped entirely (returns null, not an error) if
// GEMINI_API_KEY isn't configured, so a missing key never breaks a scan
// that the regex alone would've handled fine. Same reasoning as the
// jobsheet item-extraction fallback in ai-item-extract.ts.
export type AiExtractedGenbluEvent = {
  customerName: string;
  points: number;
  membershipNumber: string | null;
  productCategory: string | null;
  transactionDate: string | null;
  transactionTime: string | null;
};

const DEFAULT_MODEL = "gemini-2.0-flash";

export async function extractGenbluEventWithAi(rawText: string): Promise<AiExtractedGenbluEvent | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const prompt =
    "This is raw OCR text from a screenshot of the GenBlu loyalty points app on a phone. It could be any one of several different screens the app shows (an instant award confirmation, a transaction history detail page, etc.) — figure out which fields apply from context, not from fixed labels. Point Allocation here tracks points given to customers, so the points amount is always a plain positive number even if the screen's own wording says something like \"deducted\" (that refers to the store's allocation budget, not the customer being charged). " +
    "Find: the customer's full name (may follow a label like \"Awarded to\", or just be the largest name-like text near the top), the points amount (as a positive number), the membership number (digits and dashes, sometimes in parentheses next to the name), the product/spend category, and the transaction date and time. " +
    "Respond with ONLY JSON (no prose, no markdown fences) in this exact shape: " +
    '{"customerName": string, "points": number, "membershipNumber": string | null, "productCategory": string | null, "transactionDate": string | null (as YYYY-MM-DD if found), "transactionTime": string | null (as HH:MM 24-hour if found)}. ' +
    'If you genuinely cannot find a customer name AND a points number, respond with {"customerName": "", "points": 0, "membershipNumber": null, "productCategory": null, "transactionDate": null, "transactionTime": null}.\n\nOCR TEXT:\n' +
    rawText;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      }
    );
    if (!res.ok) return null;

    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof content !== "string") return null;

    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const customerName = typeof parsed.customerName === "string" ? parsed.customerName.trim() : "";
    const pointsRaw = Number(parsed.points);
    if (!customerName || !Number.isFinite(pointsRaw) || pointsRaw <= 0) return null;

    return {
      customerName,
      points: pointsRaw,
      membershipNumber: typeof parsed.membershipNumber === "string" ? parsed.membershipNumber : null,
      productCategory: typeof parsed.productCategory === "string" ? parsed.productCategory.toUpperCase() : null,
      transactionDate: typeof parsed.transactionDate === "string" ? parsed.transactionDate : null,
      transactionTime: typeof parsed.transactionTime === "string" ? parsed.transactionTime : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
