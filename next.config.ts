import type { NextConfig } from "next";

// Next's automatic dependency tracer can't see everything tesseract.js
// needs at runtime: the bundled language data is read dynamically (opened
// inside the library, not via a static import), and the actual OCR engine
// runs in a worker_thread loaded from a runtime file path — tracers can't
// follow either of those, or anything worker-script/index.js itself then
// requires. So every one of tesseract.js's own runtime dependencies
// (its package.json "dependencies", not devDependencies) is force-included
// alongside it. Without this, the deployed function is missing files it
// needs and crashes with "Cannot find module" partway through a scan.
const TESSERACT_TRACE_INCLUDES = [
  "./lib/tesseract-data/**/*",
  "./node_modules/tesseract.js/**/*",
  "./node_modules/tesseract.js-core/**/*",
  "./node_modules/bmp-js/**/*",
  "./node_modules/idb-keyval/**/*",
  "./node_modules/is-url/**/*",
  "./node_modules/node-fetch/**/*",
  "./node_modules/regenerator-runtime/**/*",
  "./node_modules/wasm-feature-detect/**/*",
  "./node_modules/zlibjs/**/*",
];

// Same problem, different library: a scanned PDF's first page is rendered
// to an image (so it can go through the exact same ink-residual signature
// check and OCR as a phone photo) using pdfjs-dist + @napi-rs/canvas.
// pdfjs-dist loads its JBIG2/JPEG2000 decoders' .wasm files from a runtime
// URL, not a static import, so Next's tracer misses them the same way it
// misses tesseract's language data — without this, a scanned (as opposed
// to a "printed to PDF") PDF fails to rasterize once deployed. The canvas
// library's native binary is matched to a napi-rs-canvas-<platform>
// package, and each platform installs only its own — glob covers whichever
// one that turns out to be.
const PDFJS_TRACE_INCLUDES = ["./node_modules/pdfjs-dist/**/*", "./node_modules/@napi-rs/**/*"];

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Jobsheet photos sent to the Scan Jobsheet server action, base64
    // encoded, comfortably exceed Next's 1MB default body limit.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // @napi-rs/canvas's own loader (js-binding.js) does a runtime require()
  // of a platform-specific .node binary in a way Turbopack's bundler can't
  // statically resolve into an ES module chunk ("non-ecmascript placeable
  // asset") — this fails the build for every route that transitively
  // imports lib/vision.ts (nearly all of them), not just the PDF-scanning
  // one. Marking both it and pdfjs-dist external leaves them as plain
  // Node require() calls resolved at runtime instead of being bundled,
  // same as sharp already effectively is by Next's own defaults.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/scan-jobsheet": [...TESSERACT_TRACE_INCLUDES, ...PDFJS_TRACE_INCLUDES],
    "/repairs/walk-in/new": [...TESSERACT_TRACE_INCLUDES, ...PDFJS_TRACE_INCLUDES],
    "/repairs/walk-in/[id]/edit": [...TESSERACT_TRACE_INCLUDES, ...PDFJS_TRACE_INCLUDES],
  },
};

export default nextConfig;
