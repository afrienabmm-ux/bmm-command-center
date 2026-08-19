import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Jobsheet photos sent to the Scan Jobsheet server action, base64
    // encoded, comfortably exceed Next's 1MB default body limit.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Next's automatic dependency tracer can't see everything tesseract.js
  // needs at runtime: the bundled language data is read dynamically
  // (opened inside the library, not via a static import), and the actual
  // OCR engine runs in a worker_thread loaded from a runtime file path —
  // tracers can't follow either of those, so both are force-included here.
  // Without this, the deployed function is missing files it needs and
  // either crashes or falls back to a slow network fetch.
  outputFileTracingIncludes: {
    "/api/scan-jobsheet": [
      "./lib/tesseract-data/**/*",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
    "/repairs/walk-in/new": [
      "./lib/tesseract-data/**/*",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
    "/repairs/walk-in/[id]/edit": [
      "./lib/tesseract-data/**/*",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
  },
};

export default nextConfig;
