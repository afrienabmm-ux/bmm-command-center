"use client";

import { useRouter } from "next/navigation";

export type JobsheetOption = { id: string; jobNo: string; customerName: string; plateNo: string };

// Switches the page between "add a new jobsheet" and "open an existing one
// to set its End Date" — picking an existing job re-navigates to /scan
// with ?job=<id>, which the server page reads to load that job into the
// same WalkInJobForm in edit mode.
export default function JobsheetPicker({ jobs, selectedId }: { jobs: JobsheetOption[]; selectedId?: string }) {
  const router = useRouter();

  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Jobsheet</label>
      <select
        value={selectedId ?? "new"}
        onChange={(e) => router.push(e.target.value === "new" ? "/scan" : `/scan?job=${e.target.value}`)}
        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
      >
        <option value="new">+ New Jobsheet</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.jobNo} · {j.customerName || "—"} · {j.plateNo}
          </option>
        ))}
      </select>
      {jobs.length === 0 && selectedId === undefined && (
        <p className="text-xs text-neutral-500 mt-1.5">No jobsheets waiting on an End Date right now.</p>
      )}
    </div>
  );
}
