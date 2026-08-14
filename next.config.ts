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
};

export default nextConfig;
