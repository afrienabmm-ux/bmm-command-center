import type { MetadataRoute } from "next";

// Scoped to the /genblu-upload segment only — Next.js links this manifest
// just on pages under this route, so the main dashboard doesn't get an
// "Add to Home Screen" prompt of its own.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BMM GenBlu Upload",
    short_name: "BMM GenBlu",
    description: "Register a GenBlu customer straight from your phone",
    start_url: "/genblu-upload",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#4f46e5",
    icons: [
      { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
