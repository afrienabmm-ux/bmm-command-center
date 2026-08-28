"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { requireApproved } from "./current-user";
import type { CatalogProduct, CatalogBrand, LabourCharge } from "./types";
import type { Branch } from "./branch";
import { LOW_STOCK_THRESHOLD } from "./types";
import { logActivity } from "./activity-log";

type Row = { id: string; brand: CatalogBrand; category: string; product_name: string; spec: string; price: number; code: string };

function toProduct(r: Row): CatalogProduct {
  return {
    id: r.id,
    brand: r.brand,
    category: r.category,
    productName: r.product_name,
    spec: r.spec,
    price: Number(r.price),
    code: r.code,
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

// Flat list across every brand — used to search-and-fill a part straight
// into a Restore Bike/Walk-in job's item list from the catalog.
export async function getAllCatalogProducts(): Promise<CatalogProduct[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin.from("cc_catalog_products").select("*").order("product_name");
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toProduct);
}

export async function addCatalogProductAction(input: {
  brand: CatalogBrand;
  category: string;
  productName: string;
  spec: string;
  price: number;
  code: string;
  branch: Branch;
  quantity: number;
}): Promise<void> {
  const user = await requireApproved();
  const { data, error } = await supabaseAdmin
    .from("cc_catalog_products")
    .insert({
      brand: input.brand,
      category: input.category,
      product_name: input.productName,
      spec: input.spec,
      price: input.price,
      code: input.code,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const { error: stockError } = await supabaseAdmin
    .from("cc_catalog_stock")
    .insert({ product_id: data.id, branch: input.branch, quantity: input.quantity });
  if (stockError) throw new Error(stockError.message);

  await logActivity(user, "Added catalog product", `${input.productName} (${input.brand})`);
  revalidatePath("/catalog");
  revalidatePath("/");
}

export async function updateCatalogPriceAction(id: string, price: number): Promise<void> {
  const user = await requireApproved();
  const { data: product } = await supabaseAdmin.from("cc_catalog_products").select("product_name").eq("id", id).single();
  const { error } = await supabaseAdmin
    .from("cc_catalog_products")
    .update({ price: Math.max(0, price) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Updated catalog price", `${product?.product_name ?? id} → RM${price.toFixed(2)}`);
  revalidatePath("/catalog");
}

export async function deleteCatalogProductAction(id: string): Promise<void> {
  const user = await requireApproved();
  const { data: product } = await supabaseAdmin.from("cc_catalog_products").select("product_name").eq("id", id).single();
  const { error } = await supabaseAdmin.from("cc_catalog_products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(user, "Deleted catalog product", product?.product_name ?? id);
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

type LabourRow = {
  id: string;
  description: string;
  price_0_125cc: string;
  price_125_200cc: string;
  price_200cc_plus: string;
};

function toLabourCharge(r: LabourRow): LabourCharge {
  return {
    id: r.id,
    description: r.description,
    price0to125cc: r.price_0_125cc,
    price125to200cc: r.price_125_200cc,
    price200ccPlus: r.price_200cc_plus,
  };
}

export async function getLabourCharges(): Promise<LabourCharge[]> {
  await requireApproved();
  const { data, error } = await supabaseAdmin.from("cc_labour_charges").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data as LabourRow[]).map(toLabourCharge);
}

export async function addLabourChargeAction(input: {
  description: string;
  price0to125cc: string;
  price125to200cc: string;
  price200ccPlus: string;
}): Promise<void> {
  await requireApproved();
  const { error } = await supabaseAdmin.from("cc_labour_charges").insert({
    description: input.description,
    price_0_125cc: input.price0to125cc,
    price_125_200cc: input.price125to200cc,
    price_200cc_plus: input.price200ccPlus,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/catalog");
}

export async function updateLabourChargeAction(
  id: string,
  input: { description: string; price0to125cc: string; price125to200cc: string; price200ccPlus: string }
): Promise<void> {
  await requireApproved();
  const { error } = await supabaseAdmin
    .from("cc_labour_charges")
    .update({
      description: input.description,
      price_0_125cc: input.price0to125cc,
      price_125_200cc: input.price125to200cc,
      price_200cc_plus: input.price200ccPlus,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalog");
}

export async function deleteLabourChargeAction(id: string): Promise<void> {
  await requireApproved();
  const { error } = await supabaseAdmin.from("cc_labour_charges").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalog");
}
