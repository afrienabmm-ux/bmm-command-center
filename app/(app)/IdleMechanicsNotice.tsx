"use client";

import { useState } from "react";
import { Bell, X } from "lucide-react";
import { branchLabel } from "@/lib/branch";
import type { IdleMechanic } from "@/lib/dashboard-breakdowns-actions";

export default function IdleMechanicsNotice({ mechanics }: { mechanics: IdleMechanic[] }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || mechanics.length === 0) return null;

  const names = mechanics.map((m) => `${m.fullName} (${branchLabel(m.branch)})`).join(", ");

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 relative">
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-amber-500 hover:text-amber-700 transition-colors"
      >
        <X size={15} />
      </button>
      <div className="flex items-start gap-2.5 pr-6">
        <Bell size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            {mechanics.length} not active today
          </p>
          <p className="text-sm text-amber-700 mt-1">
            No jobs started or finished yet: {names}. Check in with your team.
          </p>
        </div>
      </div>
    </div>
  );
}
