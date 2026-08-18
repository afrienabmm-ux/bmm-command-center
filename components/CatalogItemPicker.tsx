"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { CatalogProduct } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

// Search-as-you-type box that lets a PIC find a catalog part by name or
// code and drop it straight into a job's item list — used on both the
// Restore Bike and Walk-in forms.
export default function CatalogItemPicker({
  products,
  onSelect,
}: {
  products: CatalogProduct[];
  onSelect: (product: CatalogProduct) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = q
    ? products.filter((p) => p.productName.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)).slice(0, 8)
    : [];

  return (
    <div className="relative mb-2">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search catalog to add a part (optional)…"
          className="w-full bg-indigo-50 border border-indigo-200 rounded-lg pl-8 pr-3 py-2 text-sm text-indigo-800 focus:outline-none focus:border-indigo-500/50 placeholder:text-indigo-400"
        />
      </div>
      {open && q && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-neutral-500">No catalog items match &ldquo;{query}&rdquo;.</p>
          ) : (
            matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(p);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-0"
              >
                <p className="text-sm text-neutral-800">{p.productName}</p>
                <p className="text-xs text-neutral-500">
                  {p.code && `${p.code} · `}
                  {p.brand} — {formatCurrency(p.price)}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
