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

  function select(value: BranchSelection) {
    if (value === activeBranch || isPending) return;
    startTransition(async () => {
      await setBranchAction(value);
      router.refresh();
    });
  }

  const options: { value: BranchSelection; label: string }[] = [
    ...(allowAll ? [{ value: "all" as BranchSelection, label: "All" }] : []),
    ...BRANCHES.map((b) => ({ value: b.value, label: b.label.replace(" (HQ)", "") })),
  ];

  return (
    <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => select(opt.value)}
          disabled={isPending}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50 ${
            activeBranch === opt.value ? "bg-red-500 text-white" : "text-neutral-600 hover:text-neutral-800"
          }`}
        >
          {opt.value === "all" ? <Layers size={12} /> : <Building2 size={12} />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
