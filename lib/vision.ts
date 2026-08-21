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
    // Use the smaller of this word's height and the row's own word height as the
    // reference for tolerance, not just this word's height alone — a single
    // oversized/noisy bounding box (common on tightly-packed label rows like
    // "Page" / "User ID") would otherwise get an inflated merge radius and pull
    // in the next physical row's text.
    const row = rows.find((r) => Math.abs(r.yCenter - word.yCenter) < Math.min(word.height, r.words[0].height) * 0.6);
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

// A raw pixel-variance check (the previous approach) can't tell a pen
// stroke from a shadow — a hand/arm holding the phone casting a shadow
// across the signature box produces just as much variance as ink does.
// The fix: compare each region against a heavily blurred copy of itself.
// Blurring erases fine detail (pen strokes) but barely touches a shadow,
// since a shadow is already a smooth gradient over a much larger area —
// so the *difference* between the original and the blurred version
// isolates fine texture and mostly cancels out lighting/shadow.
const INK_RESIDUAL_THRESHOLD = 4;
const BLUR_SIGMA = 5;

function meanAbsDiff(a: Buffer, b: Buffer): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

// Score for one region: how much fine (pen-stroke-scale) detail it has,
// with smooth lighting/shadow gradients subtracted out. Returns null if
// this particular region couldn't be cropped/read at all.
async function inkResidualScore(buffer: Buffer, left: number, top: number, width: number, height: number): Promise<number | null> {
  try {
    const region = sharp(buffer)
      .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) })
      .greyscale();
    const [{ data: sharpBytes }, { data: blurredBytes }] = await Promise.all([
      region.clone().raw().toBuffer({ resolveWithObject: true }),
      region.clone().blur(BLUR_SIGMA).raw().toBuffer({ resolveWithObject: true }),
    ]);
    return meanAbsDiff(sharpBytes, blurredBytes);
  } catch {
    return null;
  }
}

export type SignatureCheck = { result: boolean | null; debug: string };

// Best-effort check for a customer signature on a scanned jobsheet: finds
// the "Signature" label via OCR word positions, then looks for actual
// pen-stroke texture near it — not just whether the printed label itself
// was read (that's always there, signed or not), and not fooled by a
// shadow across the page either. Checks a box both above and below the
// label, since where the blank signature line sits relative to the label
// varies by jobsheet template, and goes with whichever side scores
// higher. Returns a null result when the label itself can't be found, or
// neither region could be checked (different layout, bad crop, OCR miss)
// — the caller should ask the PIC to confirm by hand in that case rather
// than treating it as "not signed". Also returns the raw scores/threshold
// as a debug string — this heuristic has been miscalibrated twice
// already, so surfacing the actual numbers is how it gets fixed for real
// instead of guessed at a third time.
async function detectSignature(buffer: Buffer, words: PositionedWord[], imageWidth: number, imageHeight: number): Promise<SignatureCheck> {
  const label = words.find((w) => /signature/i.test(w.text));
  if (!label) return { result: null, debug: "no 'Signature' label found by OCR" };

  // Wide enough to cover writing that drifts either side of where the
  // label starts, clamped to the image so a label near an edge doesn't
  // overflow.
  const boxWidth = Math.min(imageWidth, label.height * 14);
  const left = Math.max(0, Math.min(label.x - boxWidth * 0.3, imageWidth - boxWidth));
  if (boxWidth < 10) return { result: null, debug: "label found but box too narrow to check" };

  const regionHeight = Math.max(label.height * 4, 30);
  const candidates: { name: string; top: number; height: number }[] = [
    { name: "above", top: label.yCenter - label.height / 2 - regionHeight, height: regionHeight },
    { name: "below", top: label.yCenter + label.height / 2, height: regionHeight },
  ];

  let maxScore = 0;
  let checkedAny = false;
  const scoreLog: string[] = [];
  for (const region of candidates) {
    const top = Math.max(0, Math.min(region.top, imageHeight - 1));
    const height = Math.min(region.height, imageHeight - top);
    if (height < 10) {
      scoreLog.push(`${region.name}=skipped(offscreen)`);
      continue;
    }
    const score = await inkResidualScore(buffer, left, top, boxWidth, height);
    if (score === null) {
      scoreLog.push(`${region.name}=skipped(crop failed)`);
      continue;
    }
    scoreLog.push(`${region.name}=${score.toFixed(2)}`);
    maxScore = Math.max(maxScore, score);
    checkedAny = true;
  }
  const debug = `label@(${Math.round(label.x)},${Math.round(label.yCenter)}) box=${Math.round(boxWidth)}x${Math.round(regionHeight)} scores: ${scoreLog.join(", ")} threshold=${INK_RESIDUAL_THRESHOLD}`;
  if (!checkedAny) return { result: null, debug };
  return { result: maxScore > INK_RESIDUAL_THRESHOLD, debug };
}

export type JobsheetScanResult = { text: string; signatureDetected: boolean | null; signatureDebug: string };

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
  const signatureCheck: SignatureCheck =
    metadata.width && metadata.height
      ? await detectSignature(buffer, words, metadata.width, metadata.height)
      : { result: null, debug: "image had no readable dimensions" };
  return { text, signatureDetected: signatureCheck.result, signatureDebug: signatureCheck.debug };
}

// PDFs aren't supported by the free local OCR path (no card-free way to
// rasterize a PDF page server-side without extra heavy dependencies) —
// callers should ask for a photo instead.
export async function extractTextFromPdf(_base64Pdf: string): Promise<string> {
  throw new Error("PDF scanning isn't supported — please upload a photo (JPG or PNG) instead.");
}
