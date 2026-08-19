"use server";

import { createWorker, type Worker } from "tesseract.js";

// Free, self-hosted OCR — no Google Cloud account, no card, no per-scan
// cost. Runs entirely inside this server process (downloads the English
// model to /tmp on first use, then reuses it for the life of the
// instance). Less accurate on messy handwriting than a paid cloud OCR
// service, but works fine on printed/typed jobsheets and GenBlu
// screenshots, which is all this app needs it for.
let cachedWorker: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!cachedWorker) {
    cachedWorker = createWorker("eng", 1, { cachePath: "/tmp" });
  }
  return cachedWorker;
}

type Vertex = { x: number; y: number };
type PositionedWord = { text: string; x: number; yCenter: number; height: number };

function collectWords(blocks: Tesseract.Block[] | null): PositionedWord[] {
  const words: PositionedWord[] = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          const text = word.text?.trim();
          if (!text) continue;
          const { x0, y0, x1, y1 } = word.bbox;
          words.push({ text, x: x0, yCenter: (y0 + y1) / 2, height: y1 - y0 || 20 });
        }
      }
    }
  }
  return words;
}

// Same reasoning as the old Google Vision integration: OCR groups text
// into blocks/paragraphs by its own layout heuristics, which for a
// two-column "label ... value" form often separates a label from its
// value — rebuilding rows from each word's actual on-page position (top
// to bottom, left to right within a row) fixes that.
function reconstructRows(blocks: Tesseract.Block[] | null, fallbackText: string): string {
  const words = collectWords(blocks);
  if (words.length === 0) return fallbackText;

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

// Sends a photo (base64, no data: prefix) to the local OCR engine. Runs
// tuned for a printed form/table rather than scattered scene text — best
// fit for a jobsheet or GenBlu screenshot photo.
export async function extractTextFromImage(base64Image: string): Promise<string> {
  const worker = await getWorker();
  const buffer = Buffer.from(base64Image, "base64");
  const { data } = await worker.recognize(buffer, {}, { blocks: true, text: true });
  return reconstructRows(data.blocks, data.text ?? "");
}

// PDFs aren't supported by the free local OCR path (no card-free way to
// rasterize a PDF page server-side without extra heavy dependencies) —
// callers should ask for a photo instead.
export async function extractTextFromPdf(_base64Pdf: string): Promise<string> {
  throw new Error("PDF scanning isn't supported — please upload a photo (JPG or PNG) instead.");
}
