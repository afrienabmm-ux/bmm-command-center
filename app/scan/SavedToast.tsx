"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

// After WalkInJobForm redirects back here with ?saved=1, show a brief
// confirmation toast — the phone flow has no other feedback once the page
// navigates away and back, so without this a PIC has no way to tell the
// save actually went through.
export default function SavedToast() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(searchParams.get("saved") === "1");

  useEffect(() => {
    if (searchParams.get("saved") !== "1") return;
    setVisible(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("saved");
    router.replace(params.size > 0 ? `/scan?${params.toString()}` : "/scan", { scroll: false });
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-xl">
      <CheckCircle2 size={18} /> Jobsheet saved successfully
    </div>
  );
}
