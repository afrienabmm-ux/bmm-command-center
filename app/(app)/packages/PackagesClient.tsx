"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Download, Trash2, Pencil, ArrowUpDown } from "lucide-react";
import {
  addPackageAction,
  updatePackageAction,
  deletePackageAction,
  deletePackageSaleAction,
  type PackageSaleWithNames,
} from "@/lib/packages-actions";
import { exportPackageSalesCsv, exportAllBranchesPackageSalesCsv } from "@/lib/export-actions";
import { formatDate } from "@/lib/format";
import { branchLabel, type Branch, type BranchSelection } from "@/lib/branch";
import type { Package } from "@/lib/types";
import ModalPortal from "@/components/ModalPortal";

// Sales are recorded from the Jobsheet form now (mirrors the GenBlu
// toggle there) — this page is sales log + admin package management only,
// no standalone "Record Sale" form of its own.
export default function PackagesClient({
  packages,
  sales,
  soldCounts,
  branch,
  branchSelection,
  isAdmin,
}: {
  packages: Package[];
  sales: PackageSaleWithNames[];
  soldCounts: Record<string, number>;
  branch: Branch;
  branchSelection: BranchSelection;
  isAdmin: boolean;
}) {
  const [addPackageOpen, setAddPackageOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [exporting, setExporting] = useState(false);

  const visibleSales = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? sales.filter((s) => [s.receiptId ?? "", s.packageName, s.mechanicCode].some((f) => f.toLowerCase().includes(q)))
      : sales;
    return [...filtered].sort((a, b) =>
      sortDir === "desc" ? b.saleDate.localeCompare(a.saleDate) : a.saleDate.localeCompare(b.saleDate)
    );
  }, [sales, query, sortDir]);

  async function handleExport() {
    setExporting(true);
    try {
      const showAllBranches = branchSelection === "all";
      const csv = showAllBranches ? await exportAllBranchesPackageSalesCsv() : await exportPackageSalesCsv(branch);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bmm-package-sales-${showAllBranches ? "all" : branch}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end gap-3">
        {isAdmin && (
          <button
            onClick={() => setAddPackageOpen(true)}
            className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Add Package
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {packages.map((p) => (
          <PackageCard key={p.id} pkg={p} soldCount={soldCounts[p.id] ?? 0} isAdmin={isAdmin} />
        ))}
        {packages.length === 0 && (
          <p className="text-sm text-neutral-500 col-span-full text-center py-10">No packages yet.</p>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-semibold text-neutral-900">Recorded Package Sales Log</p>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search receipt, package…"
                className="bg-neutral-50 border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 w-56"
              />
            </div>
            <button
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 hover:border-red-300 text-neutral-700 text-xs font-medium px-3 py-2.5 rounded-lg transition-colors whitespace-nowrap"
              title="Sort by sale date"
            >
              <ArrowUpDown size={13} /> {sortDir === "desc" ? "Newest" : "Oldest"}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-medium px-3.5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download size={13} /> {exporting ? "Exporting…" : "Export to Excel / CSV"}
            </button>
          </div>
        </div>
        <div className="px-5 py-2.5 border-b border-neutral-100">
          <span className="text-xs font-medium bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-full">
            Total: {visibleSales.length} records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                <th className="font-medium px-5 py-3 whitespace-nowrap">Receipt ID</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Package Name</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Mechanic</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Branch</th>
                <th className="font-medium px-5 py-3 whitespace-nowrap">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleSales.map((s) => (
                <SaleRow key={s.id} sale={s} />
              ))}
              {visibleSales.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-neutral-500 text-sm">
                    {query ? `No sales match "${query}".` : "No sales recorded yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addPackageOpen && <AddPackageModal onClose={() => setAddPackageOpen(false)} />}
    </div>
  );
}

function PackageCard({ pkg, soldCount, isAdmin }: { pkg: Package; soldCount: number; isAdmin: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="relative bg-white border border-neutral-200 rounded-xl p-5 pt-4 flex flex-col">
      <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-bl-lg rounded-tr-xl">
        RM {pkg.price % 1 === 0 ? pkg.price : pkg.price.toFixed(2)}
      </div>
      <p className="text-lg font-bold text-neutral-900 pr-16 leading-snug">{pkg.name}</p>
      <p className="text-sm font-semibold text-red-600 mt-1">{pkg.spec}</p>
      {pkg.description && <p className="text-sm text-neutral-500 mt-2 flex-1">{pkg.description}</p>}

      <div className="border-t border-neutral-100 mt-4 pt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-neutral-500">Sold Sets:</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold bg-neutral-100 text-neutral-800 px-2.5 py-1 rounded-lg">
            {soldCount} set{soldCount === 1 ? "" : "s"}
          </span>
          {isAdmin && (
            <>
              <button
                onClick={() => setEditOpen(true)}
                className="text-neutral-300 hover:text-red-600 transition-colors"
                aria-label="Edit package"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-neutral-300 hover:text-red-600 transition-colors"
                aria-label="Delete package"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {editOpen && <EditPackageModal pkg={pkg} onClose={() => setEditOpen(false)} />}

      {confirmDelete && (
        <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Delete package?</h2>
            <p className="text-sm text-neutral-500 mb-6">
              This removes <span className="text-neutral-800 font-medium">{pkg.name}</span> from the package list.
              Past sales records stay.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => startTransition(() => deletePackageAction(pkg.id))}
                disabled={isPending}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div></ModalPortal>
      )}
    </div>
  );
}

function SaleRow({ sale }: { sale: PackageSaleWithNames }) {
  const [isPending, startTransition] = useTransition();
  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3.5 text-neutral-900 font-semibold whitespace-nowrap">{sale.receiptId || "—"}</td>
      <td className="px-5 py-3.5 text-red-600 font-medium whitespace-nowrap">{sale.packageName}</td>
      <td className="px-5 py-3.5 text-neutral-800 font-semibold whitespace-nowrap">{sale.mechanicCode}</td>
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{branchLabel(sale.branch)}</td>
      <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{formatDate(sale.saleDate)}</td>
      <td className="px-5 py-3.5">
        <button
          onClick={() => startTransition(() => deletePackageSaleAction(sale.id, sale.branch))}
          disabled={isPending}
          className="text-neutral-400 hover:text-red-600 disabled:opacity-50 transition-colors"
          aria-label="Delete sale record"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

function EditPackageModal({ pkg, onClose }: { pkg: Package; onClose: () => void }) {
  const [name, setName] = useState(pkg.name);
  const [price, setPrice] = useState(String(pkg.price));
  const [spec, setSpec] = useState(pkg.spec);
  const [description, setDescription] = useState(pkg.description);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSave = name.trim() !== "" && price.trim() !== "";

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      const result = await updatePackageAction(pkg.id, {
        name: name.trim(),
        price: Number(price) || 0,
        spec: spec.trim(),
        description: description.trim(),
      });
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Edit Package</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Package Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Price (RM) *</label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">What's included</label>
            <input
              type="text"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-700 mt-4">{error}</p>}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || isPending}
            className="bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div></ModalPortal>
  );
}

function AddPackageModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [spec, setSpec] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  const canSave = name.trim() !== "" && price.trim() !== "";

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      await addPackageAction({
        name: name.trim(),
        price: Number(price) || 0,
        spec: spec.trim(),
        description: description.trim(),
      });
      onClose();
    });
  }

  return (
    <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Add Package</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Package Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pakej Otai Santai"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Price (RM) *</label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">What's included</label>
            <input
              type="text"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="e.g. RS200+ Oil filter"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || isPending}
            className="bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Add Package
          </button>
        </div>
      </div>
    </div></ModalPortal>
  );
}
