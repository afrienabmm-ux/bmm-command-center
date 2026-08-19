import type { MetadataRoute } from "next";

// Scoped to the /scan segment only — Next.js links this manifest just on
// pages under this route, so the main dashboard doesn't get an "Add to
// Home Screen" prompt of its own.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BMM Field Upload",
    short_name: "BMM Upload",
    description: "Scan a jobsheet or upload a GenBlu points screenshot straight from your phone",
    start_url: "/scan",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon.png", sizes: "2917x2917", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "2917x2917", type: "image/png", purpose: "maskable" },
    ],
  };
}
