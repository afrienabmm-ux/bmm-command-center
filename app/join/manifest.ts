import type { MetadataRoute } from "next";

// Scoped to the /join segment only — this is the customer-facing "check
// your services card" page shared via the dashboard's "Copy Check-Card
// Link" button, so it gets its own home-screen icon/name distinct from
// the staff-only scan tools.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BMM E-Service Card",
    short_name: "E-Service Card",
    description: "Check your Berjaya Mega Motors services card and stamp progress",
    start_url: "/join",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#dc2626",
    icons: [
      { src: "/pwa-icon-eservice-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-eservice-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-eservice-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
