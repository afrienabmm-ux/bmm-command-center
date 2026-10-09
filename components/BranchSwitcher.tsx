"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Layers } from "lucide-react";
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
    <>
    {/* Phone: one compact dropdown — four pill buttons don't fit beside
        the logo on a narrow screen. */}
    <div className="md:hidden relative shrink-0">
      {activeBranch === "all" ? (
        <Layers size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none" />
      ) : (
        <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none" />
      )}
      <select
        value={activeBranch}
        onChange={(e) => select(e.target.value as BranchSelection)}
        disabled={isPending}
        aria-label="Branch"
        className="appearance-none bg-white border border-neutral-200 rounded-lg pl-8 pr-7 py-2 text-sm font-medium text-neutral-800 disabled:opacity-50 focus:outline-none focus:border-red-400"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.value === "all" ? "All Branches" : opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
    </div>
    <div className="hidden md:flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-lg p-1 overflow-x-auto max-w-full">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => select(opt.value)}
          disabled={isPending}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
            activeBranch === opt.value ? "bg-red-500 text-white" : "text-neutral-600 hover:text-neutral-800"
          }`}
        >
          {opt.value === "all" ? <Layers size={12} /> : <Building2 size={12} />}
          {opt.label}
        </button>
      ))}
    </div>
    </>
  );
}
