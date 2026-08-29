"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Package, AlertTriangle, Search } from "lucide-react";
import {
  addCatalogProductAction,
  deleteCatalogProductAction,
  updateCatalogStockAction,
  updateCatalogPriceAction,
  addLabourChargeAction,
  updateLabourChargeAction,
  deleteLabourChargeAction,
} from "@/lib/catalog-actions";
import { CATALOG_BRANDS, LOW_STOCK_THRESHOLD, type CatalogBrand, type CatalogProduct, type LabourCharge } from "@/lib/types";
import type { Branch } from "@/lib/branch";
import ModalPortal from "@/components/ModalPortal";

type Tab = CatalogBrand | "Labour Charge";

export default function CatalogClient({
  data,
  stockMap,
  branch,
  labourCharges,
}: {
  data: Record<CatalogBrand, CatalogProduct[]>;
  stockMap: Record<string, number>;
  branch: Branch;
  labourCharges: LabourCharge[];
}) {
  const [tab, setTab] = useState<Tab>("Yamalube");
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const products = tab === "Labour Charge" ? [] : data[tab] ?? [];
  const isSearching = query.trim() !== "";

  function matchesQuery(p: CatalogProduct, q: string) {
    return (
      p.productName.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.spec.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  // Searching looks across every brand at once — not just whichever tab
  // happens to be open — so a PIC doesn't have to guess which brand an
  // item is filed under before they can find it.
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return CATALOG_BRANDS.flatMap((b) => (data[b] ?? []).filter((p) => matchesQuery(p, q)).map((p) => ({ ...p, brand: b })));
  }, [data, query]);

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => matchesQuery(p, q));
  }, [products, query]);

  const byCategory: Record<string, CatalogProduct[]> = {};
  for (const p of visibleProducts) {
    const cat = p.category || "General";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }

  const searchByBrandCategory: Record<string, CatalogProduct[]> = {};
  for (const p of searchResults) {
    const key = `${p.brand} — ${p.category || "General"}`;
    if (!searchByBrandCategory[key]) searchByBrandCategory[key] = [];
    searchByBrandCategory[key].push(p);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1 bg-white border border-neutral-200 rounded-lg p-1 flex-wrap">
          {CATALOG_BRANDS.map((b) => (
            <button
              key={b}
              onClick={() => setTab(b)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === b ? "bg-red-500 text-white" : "text-neutral-600 hover:text-neutral-800"
              }`}
            >
              {b} ({data[b]?.length ?? 0})
            </button>
          ))}
          <button
            onClick={() => setTab("Labour Charge")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "Labour Charge" ? "bg-red-500 text-white" : "text-neutral-600 hover:text-neutral-800"
            }`}
          >
            Labour Charge ({labourCharges.length})
          </button>
        </div>
        {tab !== "Labour Charge" && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Add Product
          </button>
        )}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search every brand by name, code, or spec…"
          className="w-full bg-white border border-neutral-200 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
        />
      </div>

      {isSearching ? (
        <div className="space-y-6">
          {Object.entries(searchByBrandCategory).map(([key, items]) => {
            const itemBrand = items[0].brand as CatalogBrand;
            return (
              <div key={key} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Package size={14} className="text-neutral-500" />
                    <p className="text-sm font-medium text-neutral-800">{key}</p>
                  </span>
                  <button
                    onClick={() => {
                      setTab(itemBrand);
                      setQuery("");
                    }}
                    className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors whitespace-nowrap"
                  >
                    View in {itemBrand} tab
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-neutral-500">
                        <th className="font-medium px-5 py-2 whitespace-nowrap">Code</th>
                        <th className="font-medium px-5 py-2">Product</th>
                        <th className="font-medium px-5 py-2">Spec</th>
                        <th className="font-medium px-5 py-2 whitespace-nowrap">Price (RM)</th>
                        <th className="font-medium px-5 py-2 whitespace-nowrap">In Stock</th>
                        <th className="px-5 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <ProductRow key={p.id} product={p} quantity={stockMap[p.id] ?? 0} branch={branch} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {searchResults.length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-10">No items match &ldquo;{query}&rdquo; in any brand.</p>
          )}
        </div>
      ) : tab === "Labour Charge" ? (
        <LabourChargeSection charges={labourCharges} />
      ) : (
        <div className="space-y-6">
          {Object.entries(byCategory).map(([category, items]) => (
            <div key={category} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-neutral-200 flex items-center gap-2">
              <Package size={14} className="text-neutral-500" />
              <p className="text-sm font-medium text-neutral-800">{category}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-500">
                    <th className="font-medium px-5 py-2 whitespace-nowrap">Code</th>
                    <th className="font-medium px-5 py-2">Product</th>
                    <th className="font-medium px-5 py-2">Spec</th>
                    <th className="font-medium px-5 py-2 whitespace-nowrap">Price (RM)</th>
                    <th className="font-medium px-5 py-2 whitespace-nowrap">In Stock</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <ProductRow key={p.id} product={p} quantity={stockMap[p.id] ?? 0} branch={branch} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
          {products.length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-10">
              No {tab} products yet. Add your real products with the button above.
            </p>
          )}
        </div>
      )}

      {modalOpen && tab !== "Labour Charge" && (
        <AddProductModal brand={tab} branch={branch} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

function ProductRow({ product, quantity, branch }: { product: CatalogProduct; quantity: number; branch: Branch }) {
  const [value, setValue] = useState(String(quantity));
  const [priceValue, setPriceValue] = useState(String(product.price));
  const [isPending, startTransition] = useTransition();
  const low = quantity < LOW_STOCK_THRESHOLD;

  function commit() {
    const next = Math.max(0, Number(value) || 0);
    if (next === quantity) return;
    startTransition(() => updateCatalogStockAction(product.id, branch, next));
  }

  function commitPrice() {
    const next = Math.max(0, Number(priceValue) || 0);
    if (next === product.price) return;
    startTransition(() => updateCatalogPriceAction(product.id, next));
  }

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3 text-neutral-500 font-mono text-xs whitespace-nowrap">{product.code}</td>
      <td className="px-5 py-3 text-neutral-800 font-medium whitespace-nowrap">{product.productName}</td>
      <td className="px-5 py-3 text-neutral-500">{product.spec}</td>
      <td className="px-5 py-3">
        <input
          type="number"
          min={0}
          step="0.01"
          value={priceValue}
          onChange={(e) => setPriceValue(e.target.value)}
          onBlur={commitPrice}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          disabled={isPending}
          className="w-20 rounded-lg border bg-neutral-50 border-neutral-200 text-neutral-800 px-2 py-1.5 text-sm focus:outline-none focus:border-red-500/50 disabled:opacity-50"
        />
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            disabled={isPending}
            className={`w-16 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:border-red-500/50 disabled:opacity-50 ${
              low ? "bg-red-50 border-red-200 text-red-700 font-semibold" : "bg-neutral-50 border-neutral-200 text-neutral-800"
            }`}
          />
          {low && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle size={12} /> Low
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3 w-10">
        <DeleteButton id={product.id} />
      </td>
    </tr>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => deleteCatalogProductAction(id))}
      disabled={isPending}
      className="text-neutral-400 hover:text-red-700 transition-colors disabled:opacity-50"
      aria-label="Delete product"
    >
      <Trash2 size={14} />
    </button>
  );
}

function AddProductModal({ brand, branch, onClose }: { brand: CatalogBrand; branch: Branch; onClose: () => void }) {
  const [category, setCategory] = useState(brand === "Yamalube" ? "Produk Servis 20,000KM Kebawah" : "");
  const [productName, setProductName] = useState("");
  const [spec, setSpec] = useState("");
  const [price, setPrice] = useState("");
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [isPending, startTransition] = useTransition();

  const canSave = productName.trim() !== "";

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      await addCatalogProductAction({
        brand,
        category: category.trim(),
        productName: productName.trim(),
        spec: spec.trim(),
        price: Math.max(0, Number(price) || 0),
        code: code.trim(),
        branch,
        quantity: Math.max(0, Number(quantity) || 0),
      });
      onClose();
    });
  }

  return (
    <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Add {brand} Product</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Oil filters, Spark plugs, Brake pads"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Code / Barcode <span className="text-neutral-400">(optional)</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. B5D-E4450-00"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Product Name *</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Spec <span className="text-neutral-400">(optional)</span>
            </label>
            <input
              type="text"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="e.g. 1L bottle"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Price (RM)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Starting Stock (this branch)</label>
            <input
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
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
            Add Product
          </button>
        </div>
      </div>
    </div></ModalPortal>
  );
}

function LabourChargeSection({ charges }: { charges: LabourCharge[] }) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-800">Reference — not tied to stock, PICs quote from this table</p>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={13} /> Add Row
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="font-medium px-5 py-2">Description</th>
              <th className="font-medium px-5 py-2 whitespace-nowrap">0-125cc</th>
              <th className="font-medium px-5 py-2 whitespace-nowrap">125cc-200cc MT-15</th>
              <th className="font-medium px-5 py-2 whitespace-nowrap">200cc Ke Atas (R25&amp;MT25)</th>
              <th className="px-5 py-2" />
            </tr>
          </thead>
          <tbody>
            {charges.map((c) => (
              <LabourChargeRow key={c.id} charge={c} />
            ))}
          </tbody>
        </table>
      </div>
      {charges.length === 0 && <p className="text-sm text-neutral-500 text-center py-10">No labour charges yet.</p>}
      {addOpen && <LabourChargeModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function LabourChargeRow({ charge }: { charge: LabourCharge }) {
  const [description, setDescription] = useState(charge.description);
  const [p1, setP1] = useState(charge.price0to125cc);
  const [p2, setP2] = useState(charge.price125to200cc);
  const [p3, setP3] = useState(charge.price200ccPlus);
  const [isPending, startTransition] = useTransition();

  function commit() {
    startTransition(() =>
      updateLabourChargeAction(charge.id, {
        description: description.trim(),
        price0to125cc: p1.trim(),
        price125to200cc: p2.trim(),
        price200ccPlus: p3.trim(),
      })
    );
  }

  const inputClass =
    "w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 disabled:opacity-50";

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-2">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commit}
          disabled={isPending}
          className={`${inputClass} font-medium`}
        />
      </td>
      <td className="px-5 py-2 w-32">
        <input type="text" value={p1} onChange={(e) => setP1(e.target.value)} onBlur={commit} disabled={isPending} className={inputClass} />
      </td>
      <td className="px-5 py-2 w-32">
        <input type="text" value={p2} onChange={(e) => setP2(e.target.value)} onBlur={commit} disabled={isPending} className={inputClass} />
      </td>
      <td className="px-5 py-2 w-32">
        <input type="text" value={p3} onChange={(e) => setP3(e.target.value)} onBlur={commit} disabled={isPending} className={inputClass} />
      </td>
      <td className="px-5 py-2 w-10">
        <button
          onClick={() => startTransition(() => deleteLabourChargeAction(charge.id))}
          disabled={isPending}
          className="text-neutral-400 hover:text-red-700 transition-colors disabled:opacity-50"
          aria-label="Delete labour charge"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

function LabourChargeModal({ onClose }: { onClose: () => void }) {
  const [description, setDescription] = useState("");
  const [p1, setP1] = useState("N/A");
  const [p2, setP2] = useState("N/A");
  const [p3, setP3] = useState("N/A");
  const [isPending, startTransition] = useTransition();

  const canSave = description.trim() !== "";

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      await addLabourChargeAction({
        description: description.trim(),
        price0to125cc: p1.trim(),
        price125to200cc: p2.trim(),
        price200ccPlus: p3.trim(),
      });
      onClose();
    });
  }

  return (
    <ModalPortal><div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">Add Labour Charge</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Description *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Plug"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">0-125cc</label>
            <input
              type="text"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              placeholder="e.g. RM 40 or N/A"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">125cc-200cc MT-15</label>
            <input
              type="text"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              placeholder="e.g. RM 40 or N/A"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">200cc Ke Atas (R25&amp;MT25)</label>
            <input
              type="text"
              value={p3}
              onChange={(e) => setP3(e.target.value)}
              placeholder="e.g. RM 80 or N/A"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
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
            Add Row
          </button>
        </div>
      </div>
    </div></ModalPortal>
  );
}
