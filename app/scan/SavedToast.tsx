"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

// After a save redirects back here with ?saved=1 (jobsheet) or
// ?genblu_saved=1 (GenBlu screenshot upload), show a brief confirmation
// toast — the phone flow has no other feedback once the page navigates
// away and back, so without this staff have no way to tell the save
// actually went through. Reads pathname rather than hardcoding "/scan" so
// this works the same on /genblu-upload too, which renders this same
// component.
export default function SavedToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const jobsheetSaved = searchParams.get("saved") === "1";
  const genbluSaved = searchParams.get("genblu_saved") === "1";
  const [visible, setVisible] = useState<"jobsheet" | "genblu" | null>(
    jobsheetSaved ? "jobsheet" : genbluSaved ? "genblu" : null
  );

  useEffect(() => {
    if (!jobsheetSaved && !genbluSaved) return;
    setVisible(jobsheetSaved ? "jobsheet" : "genblu");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("saved");
    params.delete("genblu_saved");
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    const timer = setTimeout(() => setVisible(null), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-xl">
      <CheckCircle2 size={18} /> {visible === "jobsheet" ? "Jobsheet saved successfully" : "Screenshot uploaded successfully"}
    </div>
  );
}
