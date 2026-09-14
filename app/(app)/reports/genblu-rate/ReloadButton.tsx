"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

// Server-rendered page — the data doesn't refetch on its own if a new
// delivery from the Sales Dashboard arrives while this page is already
// open. router.refresh() re-runs the page's own server-side fetch for the
// exact same URL, without a full browser reload or changing any of the
// date-range/branch selection already in place.
export default function ReloadButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function handleReload() {
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 600);
  }

  return (
    <button
      onClick={handleReload}
      title="Reload"
      aria-label="Reload"
      className="flex items-center justify-center bg-white border border-neutral-200 hover:border-red-300 rounded-lg p-2 text-neutral-600 hover:text-neutral-800 transition-colors"
    >
      <RefreshCw size={15} className={spinning ? "animate-spin" : ""} />
    </button>
  );
}
