"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const KEY = "bmm-auto-reload-at";

// Shown instead of "This page couldn't load" on the phone upload pages. The
// usual cause is a page left open while a new version was published: one
// reload fixes it, so it reloads by itself once. If it breaks again within a
// minute it stops and shows a Reload button, so it can never loop.
export default function AutoReloadError({ error }: { error: Error & { digest?: string } }) {
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(KEY) ?? 0);
    } catch {
      // storage blocked: fall through to one reload attempt
    }
    if (Date.now() - last > 60_000) {
      try {
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {
        // ignore
      }
      window.location.reload();
    } else {
      console.error(error);
      // Deferred so the state change happens after this effect, not inside it.
      const t = setTimeout(() => setGaveUp(true), 0);
      return () => clearTimeout(t);
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      {gaveUp ? (
        <>
          <p className="text-base font-medium text-neutral-900">Something went wrong on this page</p>
          <p className="text-sm text-neutral-500">Tap Reload. If it keeps happening, tell IT what you tapped just before.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-base font-medium text-white"
          >
            <RefreshCw size={18} aria-hidden="true" /> Reload
          </button>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> Loading the latest version…
        </p>
      )}
    </div>
  );
}
