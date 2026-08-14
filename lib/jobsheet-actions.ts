// Not a "use server" module — this is called from the /api/scan-jobsheet
// route handler (a plain multipart upload), not directly from the client.
// Passing a jobsheet photo's base64 as a Server Action argument hits
// Next's RSC flight-protocol nesting limit on large strings; a normal HTTP
// route has no such limit.
import { requireApproved } from "./current-user";
import { extractTextFromImage, extractTextFromPdf } from "./vision";
import type { Branch } from "./branch";

export type ScannedJobsheetItem = { description: string; quantity: number; price: number };

export type ScannedJobsheet = {
  customerName: string;
  plateNo: string;
  model: string;
  mechanicCode: string;
  branch: Branch | null;
  startedDate: string | null;
  items: ScannedJobsheetItem[];
  rawText: string;
};

function matchLine(text: string, label: RegExp): string {
  const line = text.split("\n").find((l) => label.test(l));
  if (!line) return "";
  const match = line.match(label);
  return match?.[1]?.trim() ?? "";
}

// Best-effort read of the standard BMM job card layout — labelled fields
// plus a parts table. Nothing here is trusted blindly: everything it finds
// is only ever used to pre-fill the Add Job form, which the mechanic still
// has to check and confirm before saving.
function parseJobsheetText(text: string): ScannedJobsheet {
  const customerName = matchLine(text, /Customer Name\s*[:.]?\s*(.+)/i);
  const plateNo = matchLine(text, /Vehicle No\.?\s*[:.]?\s*(.+)/i);
  const model = matchLine(text, /^Model\s*[:.]?\s*(.+)/im);
  const mechanicCode = matchLine(text, /Mechanic Code\s*[:.]?\s*(.+)/i);
  const jobDateRaw = matchLine(text, /Job Date\s*[:.]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);

  let startedDate: string | null = null;
  const dateMatch = jobDateRaw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    const year = y.length === 2 ? `20${y}` : y;
    startedDate = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  let branch: Branch | null = null;
  const upper = text.toUpperCase();
  if (upper.includes("SETIA ALAM")) branch = "setia_alam";
  else if (upper.includes("PUNCAK ALAM")) branch = "puncak_alam";
  else if (upper.includes("KAPAR")) branch = "kapar";

  // Item rows look like: "1  9OO00000023  OIL ROCK OIL SYNTHESIS ...  1.00  UNIT  96.00  96.00"
  // (No., Code, Description, Qty, UOM, Unit Price, Amount, ...). Lines that
  // don't follow that shape (discount lines, blank rows) are skipped rather
  // than guessed at.
  const items: ScannedJobsheetItem[] = [];
  const itemLinePattern = /^\d+\s+\S+\s+(.+?)\s+(\d+(?:\.\d+)?)\s+\S+\s+(\d+(?:\.\d{2}))\s+\d+(?:\.\d{2})/;
  for (const line of text.split("\n")) {
    const m = line.match(itemLinePattern);
    if (!m) continue;
    const [, description, qty, unitPrice] = m;
    items.push({
      description: description.trim(),
      quantity: Number(qty) || 1,
      price: Number(unitPrice) || 0,
    });
  }

  return { customerName, plateNo, model, mechanicCode, branch, startedDate, items, rawText: text };
}

export async function scanJobsheet(
  base64File: string,
  mimeType: string
): Promise<{ data: ScannedJobsheet } | { error: string }> {
  await requireApproved();
  try {
    const text =
      mimeType === "application/pdf" ? await extractTextFromPdf(base64File) : await extractTextFromImage(base64File);
    if (!text.trim()) {
      return { error: "Couldn't read any text from that file — try a clearer, well-lit photo." };
    }
    return { data: parseJobsheetText(text) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong reading the jobsheet." };
  }
}
