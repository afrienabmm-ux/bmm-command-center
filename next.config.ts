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

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Jobsheet photos sent to the Scan Jobsheet server action, base64
    // encoded, comfortably exceed Next's 1MB default body limit.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  outputFileTracingIncludes: {
    "/api/scan-jobsheet": TESSERACT_TRACE_INCLUDES,
    "/repairs/walk-in/new": TESSERACT_TRACE_INCLUDES,
    "/repairs/walk-in/[id]/edit": TESSERACT_TRACE_INCLUDES,
  },
};

export default nextConfig;
