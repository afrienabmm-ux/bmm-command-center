"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Package, AlertTriangle } from "lucide-react";
import {
  addCatalogProductAction,
  deleteCatalogProductAction,
  updateCatalogStockAction,
} from "@/lib/catalog-actions";
import { CATALOG_BRANDS, LOW_STOCK_THRESHOLD, type CatalogBrand, type CatalogProduct } from "@/lib/types";
import type { Branch } from "@/lib/branch";

export default function CatalogClient({
  data,
  stockMap,
  branch,
}: {
  data: Record<CatalogBrand, CatalogProduct[]>;
  stockMap: Record<string, number>;
  branch: Branch;
}) {
  const [brand, setBrand] = useState<CatalogBrand>("Yamalube");
  const [modalOpen, setModalOpen] = useState(false);
  const products = data[brand] ?? [];

  const byCategory: Record<string, CatalogProduct[]> = {};
  for (const p of products) {
    const cat = p.category || "General";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1 bg-white border border-neutral-200 rounded-lg p-1">
          {CATALOG_BRANDS.map((b) => (
            <button
              key={b}
              onClick={() => setBrand(b)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                brand === b ? "bg-indigo-500 text-white" : "text-neutral-600 hover:text-neutral-800"
              }`}
            >
              {b} ({data[b]?.length ?? 0})
            </button>
          ))}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> Add Product
        </button>
      </div>

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
                    <th className="font-medium px-5 py-2">Product</th>
                    <th className="font-medium px-5 py-2">Spec</th>
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
            No {brand} products yet. Add your real products with the button above.
          </p>
        )}
      </div>

      {modalOpen && <AddProductModal brand={brand} branch={branch} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function ProductRow({ product, quantity, branch }: { product: CatalogProduct; quantity: number; branch: Branch }) {
  const [value, setValue] = useState(String(quantity));
  const [isPending, startTransition] = useTransition();
  const low = quantity < LOW_STOCK_THRESHOLD;

  function commit() {
    const next = Math.max(0, Number(value) || 0);
    if (next === quantity) return;
    startTransition(() => updateCatalogStockAction(product.id, branch, next));
  }

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="px-5 py-3 text-neutral-800 font-medium whitespace-nowrap">{product.productName}</td>
      <td className="px-5 py-3 text-neutral-500">{product.spec}</td>
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
            className={`w-16 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 ${
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
        branch,
        quantity: Math.max(0, Number(quantity) || 0),
      });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
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
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Product Name *</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Spec / Price <span className="text-neutral-400">(optional)</span>
            </label>
            <input
              type="text"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="e.g. RM 25.00"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Starting Stock (this branch)</label>
            <input
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
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
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Add Product
          </button>
        </div>
      </div>
    </div>
  );
}
