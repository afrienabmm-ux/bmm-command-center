"use client";

import { useState } from "react";
import { Coins, UserPlus, ClipboardCheck } from "lucide-react";
import GenbluQuickForm, { type RecentJobsheetCustomer } from "./GenbluQuickForm";
import GenbluTransactionForm from "./GenbluTransactionForm";
import type { BranchSelection } from "@/lib/branch";

type Choice = "log" | "hasJobsheet" | "newCustomer";

const CHOICES: { key: Choice; title: string; detail: string; icon: typeof Coins }[] = [
  { key: "log", title: "Points from a service", detail: "Screenshot after a visit", icon: Coins },
  { key: "hasJobsheet", title: "Sign-up, has a jobsheet", detail: "Customer serviced today", icon: ClipboardCheck },
  { key: "newCustomer", title: "Sign-up, new customer", detail: "No jobsheet", icon: UserPlus },
];

// GenBlu uploads on the phone page: one question ("what are you uploading?")
// instead of two rows of tabs. "Points from a service" logs a Point
// Allocation; the two sign-up choices register the customer (with or
// without a jobsheet to link to).
export default function GenbluPanel({
  recentJobs,
  branchSelection,
  defaultMode = "log",
  onlyMode,
  forceNewCustomer,
}: {
  recentJobs: RecentJobsheetCustomer[];
  branchSelection: BranchSelection;
  defaultMode?: "link" | "log";
  // Sales Advisor's only task is registration: when set, the choice is
  // pinned and the question isn't shown.
  onlyMode?: "link" | "log";
  // Sales Advisor only ever registers brand new customers with no jobsheet.
  forceNewCustomer?: boolean;
}) {
  // Which choices this person gets: everyone sees all three, except
  // registration-only logins (no points), and new-customer-only logins
  // (nothing to choose).
  const visible: Choice[] =
    onlyMode === "log" ? ["log"] : onlyMode === "link" ? (forceNewCustomer ? ["newCustomer"] : ["hasJobsheet", "newCustomer"]) : ["log", "hasJobsheet", "newCustomer"];
  const [choice, setChoice] = useState<Choice>(() => {
    const preferred: Choice = defaultMode === "log" ? "log" : "hasJobsheet";
    return visible.includes(preferred) ? preferred : visible[0];
  });
  const current = visible.includes(choice) ? choice : visible[0];

  return (
    <div className="space-y-4">
      {visible.length > 1 && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-4">
          <p className="text-sm font-medium text-neutral-900 mb-3">What are you uploading?</p>
          <div className={`grid gap-2 ${visible.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {CHOICES.filter((c) => visible.includes(c.key)).map((c) => {
              const on = current === c.key;
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setChoice(c.key)}
                  aria-pressed={on}
                  className={`flex items-center gap-3 sm:flex-col sm:items-start rounded-xl border px-3.5 py-3 text-left transition-colors ${
                    on ? "border-red-600 bg-red-50" : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} aria-hidden="true" className={on ? "text-red-600" : "text-neutral-400"} />
                  <span>
                    <span className={`block text-sm font-medium ${on ? "text-red-800" : "text-neutral-900"}`}>{c.title}</span>
                    <span className="block text-xs text-neutral-500">{c.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {current === "log" ? (
        <GenbluTransactionForm branchSelection={branchSelection} />
      ) : (
        <GenbluQuickForm
          key={current}
          recentJobs={recentJobs}
          branchSelection={branchSelection}
          forceNewCustomer={current === "newCustomer"}
        />
      )}
    </div>
  );
}
