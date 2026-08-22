// Best-effort fallback for when the rule-based item-row regex in
// jobsheet-actions.ts finds nothing — that happens when OCR mangles a row
// badly enough (columns merged, a token dropped entirely) that no fixed
// pattern can safely recover it without risking wrong numbers. An LLM can
// use context to figure out which garbled number is which even when the
// layout is scrambled, at the cost of one API call per scan that would
// otherwise have come back empty.
//
// Optional: skipped entirely (returns null, not an error) if
// GEMINI_API_KEY isn't configured in the environment, so a missing key
// never breaks a scan that the regex alone would've handled fine. Uses
// Gemini rather than a paid-only API since its free tier needs no card on
// file — same reasoning as OCR.space being the primary OCR engine below.
export type AiExtractedItem = { code: string; description: string; quantity: number; price: number };

const DEFAULT_MODEL = "gemini-2.0-flash";

export async function extractItemsWithAi(rawText: string): Promise<AiExtractedItem[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const prompt =
    "This is raw, noisy OCR text from a photographed motorcycle workshop jobsheet. Find the parts/items table and extract every row as JSON. OCR often mangles decimal points (a '.' may read as ',', ':', or a stray space) and sometimes drops the leading row number — use context to recover the real code, description, quantity and unit price anyway. Respond with ONLY a JSON array (no prose, no markdown fences), each item as {\"code\": string, \"description\": string, \"quantity\": number, \"price\": number}. If you can't find any item rows at all, respond with [].\n\nOCR TEXT:\n" +
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

    // responseMimeType above should guarantee clean JSON, but strip
    // markdown fences defensively in case the model wraps it anyway.
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const parsed: unknown = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;

    return parsed
      .filter((it): it is Record<string, unknown> => !!it && typeof it === "object" && typeof it.description === "string" && it.description.trim() !== "")
      .map((it) => ({
        code: typeof it.code === "string" ? it.code.trim() : "",
        description: String(it.description).trim(),
        quantity: Number(it.quantity) || 1,
        price: Number(it.price) || 0,
      }));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
