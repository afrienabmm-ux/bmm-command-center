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

type PositionedWord = { text: string; x: number; yCenter: number; height: number };

function collectWordsFromTesseractBlocks(blocks: Tesseract.Block[] | null): PositionedWord[] {
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

// Same reasoning regardless of which OCR engine produced the words: OCR
// groups text into lines/blocks by its own layout heuristics, which for a
// two-column "label ... value" form often separates a label from its
// value — rebuilding rows from each word's actual on-page position (top
// to bottom, left to right within a row) fixes that.
function reconstructRowsFromWords(words: PositionedWord[], fallbackText: string): string {
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
// noise that hurts OCR accuracy (either engine) much more than a clean
// screenshot — grayscale + contrast stretch + a touch of sharpening
// noticeably cuts down on misread characters (which otherwise break the
// label-matching regexes in jobsheet-actions.ts and silently leave a
// field blank rather than obviously wrong). Upscaling small images gives
// the OCR engine more pixels per character to work with. Output is
// normalized to JPEG so file size stays predictable regardless of the
// original photo's format (relevant for OCR.space's upload size limit).
async function preprocessForOcr(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer, { failOn: "none" }).rotate(); // auto-orients using the photo's EXIF tag
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const pipeline = width > 0 && width < 1600 ? image.resize({ width: 1600 }) : image;
  return pipeline.grayscale().normalize().sharpen().jpeg({ quality: 85 }).toBuffer();
}

type OcrSpaceWord = { WordText?: string; Left?: number; Top?: number; Width?: number; Height?: number };
type OcrSpaceResponse = {
  IsErroredOnProcessing?: boolean;
  ParsedResults?: {
    ParsedText?: string;
    TextOverlay?: { Lines?: { Words?: OcrSpaceWord[] }[] };
  }[];
};

type OcrResult = { text: string; words: PositionedWord[] };

// Primary OCR engine — a hosted API with a genuinely free tier (no card
// on file, unlike Google Cloud Vision) that's noticeably more accurate
// than the local Tesseract fallback on real phone photos. Returns null
// (rather than throwing) for any reason it can't be used, so the caller
// falls back to Tesseract instead of failing the whole scan.
async function extractViaOcrSpace(buffer: Buffer): Promise<OcrResult | null> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) return null;

  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("language", "eng");
  form.append("isOverlayRequired", "true");
  form.append("OCREngine", "2");
  form.append("scale", "true");
  form.append("detectOrientation", "true");
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), "scan.jpg");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: form, signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as OcrSpaceResponse;
    if (json.IsErroredOnProcessing) return null;
    const result = json.ParsedResults?.[0];
    if (!result) return null;

    const words: PositionedWord[] = [];
    for (const line of result.TextOverlay?.Lines ?? []) {
      for (const word of line.Words ?? []) {
        const text = word.WordText?.trim();
        if (!text) continue;
        const top = word.Top ?? 0;
        const height = word.Height ?? 20;
        words.push({ text, x: word.Left ?? 0, yCenter: top + height / 2, height });
      }
    }
    return { text: reconstructRowsFromWords(words, result.ParsedText ?? ""), words };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Shared by extractTextFromImage and scanJobsheetImage — runs OCR.space
// first, with the local Tesseract engine as a fallback if that's
// unavailable or fails for any reason (missing/exhausted API key, network
// issue, etc.), and returns both the reconstructed text and each word's
// position (needed to locate the signature box on a jobsheet).
async function runOcr(buffer: Buffer): Promise<OcrResult> {
  const hosted = await extractViaOcrSpace(buffer);
  if (hosted !== null && hosted.text.trim() !== "") return hosted;

  const worker = await getWorker();
  const { data } = await worker.recognize(buffer, {}, { blocks: true, text: true });
  const words = collectWordsFromTesseractBlocks(data.blocks);
  return { text: reconstructRowsFromWords(words, data.text ?? ""), words };
}

// Sends a photo (base64, no data: prefix) for OCR — see runOcr for engine
// selection.
export async function extractTextFromImage(base64Image: string): Promise<string> {
  const rawBuffer = Buffer.from(base64Image, "base64");
  let buffer: Buffer;
  try {
    buffer = await preprocessForOcr(rawBuffer);
  } catch {
    // If preprocessing itself fails for some reason, fall back to the
    // original photo rather than blocking the scan entirely.
    buffer = rawBuffer;
  }
  const { text } = await runOcr(buffer);
  return text;
}

// How much brighter/darker a signature box's pixels vary compared to a
// blank one — blank paper (even with a printed line) is close to uniform,
// so its standard deviation is low; a pen signature's mix of white
// background and dark strokes pushes it well above this. Picked from one
// round of synthetic test images (blank ~15, signed ~36), not real
// jobsheets — expect to retune once this has run against real photos.
const SIGNATURE_STDEV_THRESHOLD = 22;

// Best-effort check for a customer signature on a scanned jobsheet: finds
// the "Signature" label via OCR word positions, then looks for actual
// pen-stroke pixel variation near it — not just whether the printed label
// itself was read (that's always there, signed or not). Checks a box both
// above and below the label, since where the blank signature line sits
// relative to the label varies by jobsheet template, and goes with
// whichever side shows more variation. Returns null when the label itself
// can't be found, or neither region could be checked (different layout,
// bad crop, OCR miss) — the caller should ask the PIC to confirm by hand
// in that case rather than treating it as "not signed".
async function detectSignature(buffer: Buffer, words: PositionedWord[], imageWidth: number, imageHeight: number): Promise<boolean | null> {
  const label = words.find((w) => /signature/i.test(w.text));
  if (!label) return null;

  // Wide enough to cover writing that drifts either side of where the
  // label starts, clamped to the image so a label near an edge doesn't
  // overflow.
  const boxWidth = Math.min(imageWidth, label.height * 14);
  const left = Math.max(0, Math.min(label.x - boxWidth * 0.3, imageWidth - boxWidth));
  if (boxWidth < 10) return null;

  const regionHeight = Math.max(label.height * 4, 30);
  const candidates = [
    { top: label.yCenter - label.height / 2 - regionHeight, height: regionHeight }, // above the label
    { top: label.yCenter + label.height / 2, height: regionHeight }, // below the label
  ];

  let maxStdev = 0;
  let checkedAny = false;
  for (const region of candidates) {
    const top = Math.max(0, Math.min(region.top, imageHeight - 1));
    const height = Math.min(region.height, imageHeight - top);
    if (height < 10) continue;
    try {
      const stats = await sharp(buffer)
        .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(boxWidth), height: Math.round(height) })
        .stats();
      maxStdev = Math.max(maxStdev, stats.channels[0]?.stdev ?? 0);
      checkedAny = true;
    } catch {
      // This region's crop fell outside the image — the other one might
      // still be checkable.
    }
  }
  if (!checkedAny) return null;
  return maxStdev > SIGNATURE_STDEV_THRESHOLD;
}

export type JobsheetScanResult = { text: string; signatureDetected: boolean | null };

// Same OCR pipeline as extractTextFromImage, plus a best-effort signature
// check — kept separate so GenBlu screenshot scanning (which has no
// signature box) doesn't pay for the extra image work.
export async function scanJobsheetImage(base64Image: string): Promise<JobsheetScanResult> {
  const rawBuffer = Buffer.from(base64Image, "base64");
  let buffer: Buffer;
  try {
    buffer = await preprocessForOcr(rawBuffer);
  } catch {
    buffer = rawBuffer;
  }
  const [{ text, words }, metadata] = await Promise.all([runOcr(buffer), sharp(buffer).metadata()]);
  const signatureDetected =
    metadata.width && metadata.height ? await detectSignature(buffer, words, metadata.width, metadata.height) : null;
  return { text, signatureDetected };
}

// PDFs aren't supported by the free local OCR path (no card-free way to
// rasterize a PDF page server-side without extra heavy dependencies) —
// callers should ask for a photo instead.
export async function extractTextFromPdf(_base64Pdf: string): Promise<string> {
  throw new Error("PDF scanning isn't supported — please upload a photo (JPG or PNG) instead.");
}
