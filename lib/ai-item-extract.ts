// Best-effort fallback for when the rule-based item-row regex in
// jobsheet-actions.ts finds nothing — that happens when OCR mangles a row
// badly enough (columns merged, a token dropped entirely) that no fixed
// pattern can safely recover it without risking wrong numbers. An LLM can
// use context to figure out which garbled number is which even when the
// layout is scrambled, at the cost of one API call per scan that would
// otherwise have come back empty.
//
// Optional: skipped entirely (returns null, not an error) if
// ANTHROPIC_API_KEY isn't configured in the environment, so a missing key
// never breaks a scan that the regex alone would've handled fine.
export type AiExtractedItem = { code: string; description: string; quantity: number; price: number };

const MODEL = "claude-haiku-4-5-20251001";

export async function extractItemsWithAi(rawText: string): Promise<AiExtractedItem[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content:
              "This is raw, noisy OCR text from a photographed motorcycle workshop jobsheet. Find the parts/items table and extract every row as JSON. OCR often mangles decimal points (a '.' may read as ',', ':', or a stray space) and sometimes drops the leading row number — use context to recover the real code, description, quantity and unit price anyway. Respond with ONLY a JSON array (no prose, no markdown fences), each item as {\"code\": string, \"description\": string, \"quantity\": number, \"price\": number}. If you can't find any item rows at all, respond with [].\n\nOCR TEXT:\n" +
              rawText,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const json = (await res.json()) as { content?: { text?: string }[] };
    const content = json.content?.[0]?.text;
    if (typeof content !== "string") return null;

    // The model is asked for JSON-only output, but strip markdown fences
    // defensively in case it wraps the array in ```json anyway.
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
