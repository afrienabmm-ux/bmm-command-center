"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Layers } from "lucide-react";
import { setBranchAction } from "@/lib/branch-actions";
import { BRANCHES, type BranchSelection } from "@/lib/branch";

export default function BranchSwitcher({
  activeBranch,
  locked,
  allowAll,
}: {
  activeBranch: BranchSelection;
  locked: boolean;
  allowAll: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (locked) {
    const label = BRANCHES.find((b) => b.value === activeBranch)?.label ?? activeBranch;
    return (
      <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-700">
        <Building2 size={15} className="text-neutral-500" />
        {label}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-2">
      {activeBranch === "all" ? (
        <Layers size={15} className="text-indigo-600 shrink-0" />
      ) : (
        <Building2 size={15} className="text-neutral-500 shrink-0" />
      )}
      <select
        value={activeBranch}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value as BranchSelection;
          startTransition(async () => {
            await setBranchAction(value);
            router.refresh();
          });
        }}
        className="bg-transparent text-sm text-neutral-800 focus:outline-none disabled:opacity-50"
      >
        {allowAll && (
          <option value="all" className="bg-white">
            All Branches
          </option>
        )}
        {BRANCHES.map((b) => (
          <option key={b.value} value={b.value} className="bg-white">
            {b.label}
          </option>
        ))}
      </select>
    </div>
  );
}
