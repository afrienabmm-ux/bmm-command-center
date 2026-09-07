import type { MetadataRoute } from "next";

// Scoped to the /genblu-signup segment only — the public, no-login link
// salespeople use to register a new GenBlu customer themselves.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BMM GenBlu Sign-Up",
    short_name: "GenBlu Sign-Up",
    description: "Register a new Berjaya Mega Motors GenBlu customer",
    start_url: "/genblu-signup",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#dc2626",
    icons: [
      { src: "/pwa-icon-genblu-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-genblu-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-genblu-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
