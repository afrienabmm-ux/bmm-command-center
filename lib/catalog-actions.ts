"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";
import type { CatalogProduct, CatalogBrand } from "./types";
import type { Branch } from "./branch";
import { LOW_STOCK_THRESHOLD } from "./types";

type Row = { id: string; brand: CatalogBrand; category: string; product_name: string; spec: string; price: number };

function toProduct(r: Row): CatalogProduct {
  return {
    id: r.id,
    brand: r.brand,
    category: r.category,
    productName: r.product_name,
    spec: r.spec,
    price: Number(r.price),
  };
}

export async function getCatalogProducts(brand: CatalogBrand): Promise<CatalogProduct[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_catalog_products")
    .select("*")
    .eq("brand", brand)
    .order("category")
    .order("product_name");
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toProduct);
}

export async function addCatalogProductAction(input: {
  brand: CatalogBrand;
  category: string;
  productName: string;
  spec: string;
  price: number;
  branch: Branch;
  quantity: number;
}): Promise<void> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_catalog_products")
    .insert({
      brand: input.brand,
      category: input.category,
      product_name: input.productName,
      spec: input.spec,
      price: input.price,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const { error: stockError } = await supabaseAdmin
    .from("cc_catalog_stock")
    .insert({ product_id: data.id, branch: input.branch, quantity: input.quantity });
  if (stockError) throw new Error(stockError.message);

  revalidatePath("/catalog");
  revalidatePath("/");
}

export async function updateCatalogPriceAction(id: string, price: number): Promise<void> {
  await requireApproved();
  const { error } = await supabaseAdmin
    .from("cc_catalog_products")
    .update({ price: Math.max(0, price) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalog");
}

export async function deleteCatalogProductAction(id: string): Promise<void> {
  await requireApproved();
  const { error } = await supabaseAdmin.from("cc_catalog_products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalog");
  revalidatePath("/");
}

export async function getCatalogStockMap(branch: Branch): Promise<Record<string, number>> {
  await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_catalog_stock")
    .select("product_id, quantity")
    .eq("branch", branch);
  if (error) throw new Error(error.message);
  const map: Record<string, number> = {};
  for (const row of data ?? []) map[row.product_id] = row.quantity;
  return map;
}

export async function updateCatalogStockAction(productId: string, branch: Branch, quantity: number): Promise<void> {
  await requireApproved();
  const safeQuantity = Math.max(0, quantity);
  const { error } = await supabaseAdmin
    .from("cc_catalog_stock")
    .upsert(
      { product_id: productId, branch, quantity: safeQuantity, updated_at: new Date().toISOString() },
      { onConflict: "product_id,branch" }
    );
  if (error) throw new Error(error.message);
  revalidatePath("/catalog");
  revalidatePath("/");
}

export type LowStockItem = {
  productId: string;
  brand: CatalogBrand;
  productName: string;
  quantity: number;
};

export async function getLowStockProducts(branch: Branch): Promise<LowStockItem[]> {
  await requireApproved();
  const [{ data: products, error: productsError }, stockMap] = await Promise.all([
    supabaseAdmin.from("cc_catalog_products").select("id, brand, product_name"),
    getCatalogStockMap(branch),
  ]);
  if (productsError) throw new Error(productsError.message);

  return (products ?? [])
    .map((p) => ({
      productId: p.id,
      brand: p.brand as CatalogBrand,
      productName: p.product_name,
      quantity: stockMap[p.id] ?? 0,
    }))
    .filter((p) => p.quantity < LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.quantity - b.quantity);
}
