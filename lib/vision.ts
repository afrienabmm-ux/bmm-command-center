"use server";

import { GoogleAuth } from "google-auth-library";

let cachedAuth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (cachedAuth) return cachedAuth;
  const raw = process.env.GOOGLE_VISION_CREDENTIALS_JSON;
  if (!raw) throw new Error("Jobsheet scanning isn't set up yet — missing Google Vision credentials.");
  const credentials = JSON.parse(raw);
  cachedAuth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-vision"],
  });
  return cachedAuth;
}

type Vertex = { x?: number; y?: number };
type VisionWord = { symbols?: { text?: string }[]; boundingBox?: { vertices?: Vertex[] } };
type VisionParagraph = { words?: VisionWord[] };
type VisionBlock = { paragraphs?: VisionParagraph[] };
type VisionPage = { blocks?: VisionBlock[] };
type FullTextAnnotation = { text?: string; pages?: VisionPage[] };

type PositionedWord = { text: string; x: number; yCenter: number; height: number };

function collectWords(annotation: FullTextAnnotation): PositionedWord[] {
  const words: PositionedWord[] = [];
  for (const page of annotation.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const word of paragraph.words ?? []) {
          const text = (word.symbols ?? []).map((s) => s.text ?? "").join("");
          if (!text) continue;
          const vertices = word.boundingBox?.vertices ?? [];
          const xs = vertices.map((v) => v.x ?? 0);
          const ys = vertices.map((v) => v.y ?? 0);
          if (xs.length === 0 || ys.length === 0) continue;
          const x = Math.min(...xs);
          const top = Math.min(...ys);
          const bottom = Math.max(...ys);
          words.push({ text, x, yCenter: (top + bottom) / 2, height: bottom - top || 20 });
        }
      }
    }
  }
  return words;
}

// Google groups OCR text into blocks/paragraphs by its own layout
// heuristics, which for a two-column "label ... value" form often puts
// every label in one block and every value in another — so a plain
// left-to-right, top-to-bottom text dump never lands "Customer Name" and
// its value on the same line. Rebuilding rows from each word's actual
// on-page position (rather than trusting Vision's grouping) fixes that.
function reconstructRows(annotation: FullTextAnnotation): string {
  const words = collectWords(annotation);
  if (words.length === 0) return annotation.text ?? "";

  const sorted = [...words].sort((a, b) => a.yCenter - b.yCenter);
  const rows: { yCenter: number; count: number; words: PositionedWord[] }[] = [];
  for (const word of sorted) {
    const tolerance = word.height * 0.6;
    const row = rows.find((r) => Math.abs(r.yCenter - word.yCenter) < tolerance);
    if (row) {
      row.yCenter = (row.yCenter * row.count + word.yCenter) / (row.count + 1);
      row.count += 1;
      row.words.push(word);
    } else {
      rows.push({ yCenter: word.yCenter, count: 1, words: [word] });
    }
  }

  return rows
    .sort((a, b) => a.yCenter - b.yCenter)
    .map((r) =>
      r.words
        .sort((a, b) => a.x - b.x)
        .map((w) => w.text)
        .join(" ")
    )
    .join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callVisionOnce(url: string, body: object): Promise<FullTextAnnotation> {
  const auth = getAuth();
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Could not authenticate with Google Vision.");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Vision request failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Google's OCR backend occasionally times out on its own end ("Backend
// deadline exceeded") for no reason tied to the photo itself — a plain
// retry usually goes through fine, so don't make the PIC re-upload for a
// transient hiccup.
async function callVision(url: string, body: object, attempt = 1): Promise<FullTextAnnotation> {
  try {
    return await callVisionOnce(url, body);
  } catch (err) {
    const isDeadline = err instanceof Error && /deadline/i.test(err.message);
    if (isDeadline && attempt < 3) {
      await sleep(500 * attempt);
      return callVision(url, body, attempt + 1);
    }
    throw err;
  }
}

// Sends a photo (base64, no data: prefix) to Google Cloud Vision's
// document text detection, which is tuned for printed forms/tables rather
// than scattered scene text — best fit for a jobsheet photo.
export async function extractTextFromImage(base64Image: string): Promise<string> {
  const data = await callVision("https://vision.googleapis.com/v1/images:annotate", {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      },
    ],
  });
  const result = (data as { responses?: { error?: { message?: string }; fullTextAnnotation?: FullTextAnnotation }[] })
    .responses?.[0];
  if (result?.error) throw new Error(result.error.message ?? "Google Vision returned an error.");
  if (!result?.fullTextAnnotation) return "";
  return reconstructRows(result.fullTextAnnotation);
}

// PDFs go through the separate files:annotate endpoint — only the first
// page is read, since a jobsheet is a single page.
export async function extractTextFromPdf(base64Pdf: string): Promise<string> {
  const data = await callVision("https://vision.googleapis.com/v1/files:annotate", {
    requests: [
      {
        inputConfig: { mimeType: "application/pdf", content: base64Pdf },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        pages: [1],
      },
    ],
  });
  const outer = (
    data as { responses?: { error?: { message?: string }; responses?: { fullTextAnnotation?: FullTextAnnotation }[] }[] }
  ).responses?.[0];
  if (outer?.error) throw new Error(outer.error.message ?? "Google Vision returned an error.");
  const annotation = outer?.responses?.[0]?.fullTextAnnotation;
  if (!annotation) return "";
  return reconstructRows(annotation);
}
