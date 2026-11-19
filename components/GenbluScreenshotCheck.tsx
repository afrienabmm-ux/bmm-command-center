"use client";

import { useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { checkGenbluScreenshotAction } from "@/lib/genblu-actions";

type Result = Awaited<ReturnType<typeof checkGenbluScreenshotAction>>;

// Checks a GenBlu screenshot as soon as it's picked and says, before saving,
// whether it will count as a point allocation. Call `run(file)` from the
// file picker's change handler and render <GenbluScreenshotCheck />.
export function useGenbluScreenshotCheck() {
  const [state, setState] = useState<{ checking: boolean; result: Result | null }>({ checking: false, result: null });
  const latest = useRef(0);
  function run(file: File | null) {
    const id = ++latest.current;
    if (!file) {
      setState({ checking: false, result: null });
      return;
    }
    setState({ checking: true, result: null });
    checkGenbluScreenshotAction(file)
      .then((result) => {
        if (id === latest.current) setState({ checking: false, result });
      })
      .catch(() => {
        if (id === latest.current) setState({ checking: false, result: { kind: "unknown", points: null, customerName: null } });
      });
  }
  return { ...state, run };
}

export default function GenbluScreenshotCheck({
  checking,
  result,
  onChangePhoto,
  balanceNote = "It won't count as a point allocation. Take the screen showing the points earned today instead.",
}: {
  checking: boolean;
  result: Result | null;
  onChangePhoto?: () => void;
  // What to say about a home-screen screenshot; sign-ups can soften it.
  balanceNote?: string;
}) {
  if (checking) {
    return (
      <p className="flex items-center gap-2 text-sm text-neutral-500 mt-2">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Checking the screenshot…
      </p>
    );
  }
  if (!result) return null;
  const change = onChangePhoto && (
    <button type="button" onClick={onChangePhoto} className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100">
      Change photo
    </button>
  );
  if (result.kind === "earned") {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 mt-2 text-sm text-emerald-800">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-medium">+{result.points?.toLocaleString()} points earned</span>
          {result.customerName ? ` · ${result.customerName}` : ""}. This goes into GenBlu Allocations.
        </span>
      </p>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mt-2 text-sm text-amber-900">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
      <div>
        {result.kind === "balance" ? (
          <p>
            <span className="font-medium">This is the home screen</span> (balance {result.points?.toLocaleString()} points). {balanceNote}
          </p>
        ) : (
          <p>
            <span className="font-medium">Couldn&apos;t read the points</span> on this screenshot. Check the photo is clear and shows the points earned.
          </p>
        )}
        {change}
      </div>
    </div>
  );
}
