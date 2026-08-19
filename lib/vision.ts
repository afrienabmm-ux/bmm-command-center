"use server";

import { createWorker, type Worker } from "tesseract.js";
import path from "path";
import sharp from "sharp";

// Free, self-hosted OCR — no Google Cloud account, no card, no per-scan
// cost. Runs entirely inside this server process. The English language
// data is bundled into the deployment (see next.config.ts's
// outputFileTracingIncludes) and read straight off local disk via
// langPath, instead of being fetched from tesseract.js's default CDN on
// every cold start — that network fetch was slow enough to blow past the
// serverless function's time limit. (Passing the trained-data bytes
// directly via createWorker's Lang-object form looked cleaner but hits a
// bug in this version that corrupts the path used to open it — langPath
// is the well-trodden code path, so that's what's used here.)
//
// workerPath is also set explicitly, using process.cwd() rather than
// leaving tesseract.js to compute it from its own __dirname: Next's
// bundler rewrites __dirname inside compiled server code, so the
// library's default computation resolves to a bogus path (observed in
// production as "Cannot find module '/ROOT/node_modules/...'"). cwd()
// isn't affected by that rewriting, so pointing it at the real on-disk
// package files directly sidesteps the bug.
//
// Less accurate on messy handwriting than a paid cloud OCR service, but
// works fine on printed/typed jobsheets and GenBlu screenshots, which is
// all this app needs it for.
let cachedWorker: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!cachedWorker) {
    const langPath = path.join(process.cwd(), "lib/tesseract-data");
    const workerPath = path.join(process.cwd(), "node_modules/tesseract.js/src/worker-script/node/index.js");
    cachedWorker = createWorker("eng", 1, { langPath, workerPath, cachePath: "/tmp", gzip: false });
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

// A phone photo of a paper form has uneven lighting, shadows, and JPEG
// noise that free/local OCR struggles with much more than a clean
// screenshot — grayscale + contrast stretch + a touch of sharpening
// noticeably cuts down on misread characters (which otherwise break the
// label-matching regexes in jobsheet-actions.ts and silently leave a
// field blank rather than obviously wrong). Upscaling small images gives
// Tesseract more pixels per character to work with.
async function preprocessForOcr(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer, { failOn: "none" }).rotate(); // auto-orients using the photo's EXIF tag
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const pipeline = width > 0 && width < 1600 ? image.resize({ width: 1600 }) : image;
  return pipeline.grayscale().normalize().sharpen().toBuffer();
}

// Sends a photo (base64, no data: prefix) to the local OCR engine. Runs
// tuned for a printed form/table rather than scattered scene text — best
// fit for a jobsheet or GenBlu screenshot photo.
export async function extractTextFromImage(base64Image: string): Promise<string> {
  const worker = await getWorker();
  const rawBuffer = Buffer.from(base64Image, "base64");
  let buffer: Buffer;
  try {
    buffer = await preprocessForOcr(rawBuffer);
  } catch {
    // If preprocessing itself fails for some reason, fall back to the
    // original photo rather than blocking the scan entirely.
    buffer = rawBuffer;
  }
  const { data } = await worker.recognize(buffer, {}, { blocks: true, text: true });
  return reconstructRows(data.blocks, data.text ?? "");
}

// PDFs aren't supported by the free local OCR path (no card-free way to
// rasterize a PDF page server-side without extra heavy dependencies) —
// callers should ask for a photo instead.
export async function extractTextFromPdf(_base64Pdf: string): Promise<string> {
  throw new Error("PDF scanning isn't supported — please upload a photo (JPG or PNG) instead.");
}
