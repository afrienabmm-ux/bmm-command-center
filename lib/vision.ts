"use server";

import { createWorker, type Worker } from "tesseract.js";
import path from "path";
import sharp from "sharp";

// Last-resort OCR engine (see runOcr below for the full Vision -> OCR.space
// -> Tesseract fallback chain) — free, self-hosted, no account or card
// needed, runs entirely inside this server process. The English language
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
// Less accurate on messy handwriting than the cloud engines above, but
// works fine on printed/typed jobsheets and GenBlu screenshots as a last
// resort if both of those are ever unavailable.
let cachedWorker: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!cachedWorker) {
    const langPath = path.join(process.cwd(), "lib/tesseract-data");
    const workerPath = path.join(process.cwd(), "node_modules/tesseract.js/src/worker-script/node/index.js");
    cachedWorker = createWorker("eng", 1, { langPath, workerPath, cachePath: "/tmp", gzip: false });
  }
  return cachedWorker;
}

export type PositionedWord = { text: string; x: number; yCenter: number; height: number };

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

type VisionVertex = { x?: number; y?: number };
type VisionTextAnnotation = { description?: string; boundingPoly?: { vertices?: VisionVertex[] } };
type VisionResponse = { responses?: { textAnnotations?: VisionTextAnnotation[]; error?: { message?: string } }[] };

// Primary OCR engine when GOOGLE_VISION_API_KEY is set — most accurate of
// the three on real phone photos of handwriting/messy jobsheets. Called
// via a plain API key over REST (no service-account JSON, which is fiddly
// to store as an env var on Vercel) — see GOOGLE_VISION_API_KEY in
// .env.example for how to get one. Returns null on any failure so the
// caller falls back to OCR.space/Tesseract instead of failing the scan.
async function extractViaGoogleVision(buffer: Buffer): Promise<OcrResult | null> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        requests: [{ image: { content: buffer.toString("base64") }, features: [{ type: "TEXT_DETECTION" }] }],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as VisionResponse;
    const result = json.responses?.[0];
    if (!result || result.error) return null;

    // The first annotation is the whole recognized text blob (used only as
    // the fallback if word positions can't be reconstructed into rows);
    // every entry after that is one word with its own bounding box.
    const [full, ...wordAnnotations] = result.textAnnotations ?? [];
    const words: PositionedWord[] = [];
    for (const w of wordAnnotations) {
      const text = w.description?.trim();
      const vertices = w.boundingPoly?.vertices;
      if (!text || !vertices || vertices.length === 0) continue;
      const ys = vertices.map((v) => v.y ?? 0);
      const xs = vertices.map((v) => v.x ?? 0);
      const top = Math.min(...ys);
      const bottom = Math.max(...ys);
      words.push({ text, x: Math.min(...xs), yCenter: (top + bottom) / 2, height: bottom - top || 20 });
    }
    return { text: reconstructRowsFromWords(words, full?.description ?? ""), words };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Secondary engine, tried when Vision isn't configured or fails — a
// hosted API with a genuinely free tier (no card on file). Returns null
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

// Shared by extractTextFromImage and scanJobsheetImage — tries Google
// Vision first, then OCR.space, then falls back to the local Tesseract
// engine if both are unavailable or fail for any reason (missing/exhausted
// API key, network issue, etc.), and returns both the reconstructed text
// and each word's position (needed to locate the signature box on a
// jobsheet).
async function runOcr(buffer: Buffer): Promise<OcrResult> {
  const vision = await extractViaGoogleVision(buffer);
  if (vision !== null && vision.text.trim() !== "") {
    console.log("[runOcr] engine=google-vision");
    return vision;
  }

  const hosted = await extractViaOcrSpace(buffer);
  if (hosted !== null && hosted.text.trim() !== "") {
    console.log("[runOcr] engine=ocr.space");
    return hosted;
  }

  console.log("[runOcr] engine=tesseract");
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer, {}, { blocks: true, text: true });
  const words = collectWordsFromTesseractBlocks(data.blocks);
  return { text: reconstructRowsFromWords(words, data.text ?? ""), words };
}

// Sends a photo (base64, no data: prefix) for OCR — see runOcr for engine
// selection.
export async function extractTextFromImage(base64Image: string): Promise<string> {
  const { text } = await extractTextAndWordsFromImage(base64Image);
  return text;
}

// Same OCR pass as extractTextFromImage, but also hands back each word's
// on-page position — needed when a screen's own layout (e.g. two
// side-by-side info cards) can jumble the linear reading order badly
// enough that text-only heuristics grab the wrong number, and only the
// real geometry (which number sits directly above which label) settles it.
export async function extractTextAndWordsFromImage(base64Image: string): Promise<{ text: string; words: PositionedWord[] }> {
  const rawBuffer = Buffer.from(base64Image, "base64");
  let buffer: Buffer;
  try {
    buffer = await preprocessForOcr(rawBuffer);
  } catch {
    // If preprocessing itself fails for some reason, fall back to the
    // original photo rather than blocking the scan entirely.
    buffer = rawBuffer;
  }
  return runOcr(buffer);
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

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j - 1], dp[j]);
      prev = tmp;
    }
  }
  return dp[n];
}

// Tolerates two different OCR failure modes on a label word: characters
// substituted/missing within it ("Custamer", "Signaturo" — caught by the
// edit-distance check), and it running together with an adjacent word
// with no space in between ("CustomerSignature" — caught by the substring
// check, since edit distance alone would see a whole extra word's worth
// of "difference" and reject it).
function looksLikeWord(raw: string, canonical: string): boolean {
  const normalized = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return false;
  if (normalized.includes(canonical)) return true;
  const threshold = Math.max(1, Math.floor(canonical.length * 0.34));
  return levenshtein(normalized, canonical) <= threshold;
}

// The jobsheet has two signature lines — "Authorised Signature" (staff)
// and "Customer Signature" — and only the customer's matters here.
// Anchoring on any word containing "signature" risked landing on the
// Authorised one instead, which on this form sits right next to dense
// printed text ("This Is Computer Generated Document / No Signature Is
// Required") that reads as pen-stroke texture to the ink check below — a
// real scan came back "detected" on a completely blank customer box for
// exactly that reason. Requiring a "Customer" word immediately to the
// left, on the same line, is how the two get told apart — matched
// loosely so a slightly misread "Customer" doesn't make the whole check
// come back empty-handed.
function findCustomerSignatureLabel(words: PositionedWord[]): PositionedWord | null {
  const customerWords = words.filter((w) => looksLikeWord(w.text, "customer"));
  let best: PositionedWord | null = null;
  let bestDist = Infinity;
  for (const cust of customerWords) {
    for (const w of words) {
      if (!looksLikeWord(w.text, "signature")) continue;
      if (w.x < cust.x) continue;
      if (Math.abs(w.yCenter - cust.yCenter) > cust.height * 0.8) continue;
      const dist = w.x - cust.x;
      if (dist < bestDist) {
        bestDist = dist;
        best = w;
      }
    }
  }
  return best;
}

// Best-effort check for a customer signature on a scanned jobsheet: finds
// the "Customer Signature" label via OCR word positions, then looks for
// actual pen-stroke texture near it — not just whether the printed label
// itself was read (that's always there, signed or not), and not fooled by
// a shadow across the page either. Checks a box both above and below the
// label, since where the blank signature line sits relative to the label
// varies by jobsheet template, and goes with whichever side scores
// higher. Returns a null result when the label itself can't be found, or
// neither region could be checked (different layout, bad crop, OCR miss)
// — the caller should ask the PIC to confirm by hand in that case rather
// than treating it as "not signed". Also returns the raw scores/threshold
// as a debug string — this heuristic has been miscalibrated before, so
// surfacing the actual numbers is how it gets fixed for real instead of
// guessed at again.
async function detectSignature(buffer: Buffer, words: PositionedWord[], imageWidth: number, imageHeight: number): Promise<SignatureCheck> {
  const label = findCustomerSignatureLabel(words);
  if (!label) return { result: null, debug: "no 'Customer Signature' label found by OCR" };

  // Wide enough to cover writing that drifts either side of where the
  // label starts, clamped to the image so a label near an edge doesn't
  // overflow.
  const boxWidth = Math.min(imageWidth, label.height * 14);
  const left = Math.max(0, Math.min(label.x - boxWidth * 0.3, imageWidth - boxWidth));
  if (boxWidth < 10) return { result: null, debug: "label found but box too narrow to check" };

  // How tall the signature box actually is varies by jobsheet template —
  // some have a short blank line right against the label, others (like a
  // real one that came back "not detected" in production) leave several
  // times that much room for a full cursive signature. A fixed multiplier
  // can't fit both: too short misses a real signature on the tall-box
  // template, too tall (previously 4x, uncapped) reaches into the
  // defect-checklist grid some templates print just above the label and
  // misreads its borders/text as ink on a blank line.
  //
  // Fix: let the "above" region grow generously (up to 4x label height),
  // but clamp it at whichever OCR word sits closest above, in roughly the
  // same horizontal band — that's the actual printed content the box
  // needs to stop before, on whichever template has one. No such word
  // (plenty of templates don't) just means the full generous height is
  // used.
  const belowRegionHeight = Math.max(label.height * 1.5, 20);
  const maxAboveHeight = label.height * 4;
  const aboveBottom = label.yCenter - label.height / 2;
  const nearestWordAbove = words.reduce<PositionedWord | null>((nearest, w) => {
    if (w === label) return nearest;
    if (w.x < left - label.height || w.x > left + boxWidth) return nearest;
    const wordBottom = w.yCenter + w.height / 2;
    if (wordBottom >= aboveBottom) return nearest;
    if (!nearest || wordBottom > nearest.yCenter + nearest.height / 2) return w;
    return nearest;
  }, null);
  const aboveMargin = label.height * 0.3;
  const aboveHeight = nearestWordAbove
    ? Math.min(maxAboveHeight, aboveBottom - (nearestWordAbove.yCenter + nearestWordAbove.height / 2) - aboveMargin)
    : maxAboveHeight;

  const candidates: { name: string; top: number; height: number }[] = [
    { name: "above", top: aboveBottom - Math.max(aboveHeight, 20), height: Math.max(aboveHeight, 20) },
    { name: "below", top: label.yCenter + label.height / 2, height: belowRegionHeight },
  ];

  // The "above" and "below" candidates don't depend on each other — scoring
  // them one at a time (the previous version) made this step pay for both
  // crops' latency back to back for no reason.
  const scored = await Promise.all(
    candidates.map(async (region) => {
      const top = Math.max(0, Math.min(region.top, imageHeight - 1));
      const height = Math.min(region.height, imageHeight - top);
      if (height < 10) return { name: region.name, score: null as number | null, reason: "offscreen" };
      const score = await inkResidualScore(buffer, left, top, boxWidth, height);
      return { name: region.name, score, reason: score === null ? "crop failed" : null };
    })
  );

  let maxScore = 0;
  let checkedAny = false;
  const scoreLog: string[] = [];
  for (const { name, score, reason } of scored) {
    if (score === null) {
      scoreLog.push(`${name}=skipped(${reason})`);
      continue;
    }
    scoreLog.push(`${name}=${score.toFixed(2)}`);
    maxScore = Math.max(maxScore, score);
    checkedAny = true;
  }
  const debug = `label@(${Math.round(label.x)},${Math.round(label.yCenter)}) box=${Math.round(boxWidth)}w above=${Math.round(candidates[0].height)}h below=${Math.round(belowRegionHeight)}h scores: ${scoreLog.join(", ")} threshold=${INK_RESIDUAL_THRESHOLD}`;
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
