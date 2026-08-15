import { requirePageContext, requirePage } from "@/lib/current-user";
import { getCatalogProducts, getCatalogStockMap, getLabourCharges } from "@/lib/catalog-actions";
import { CATALOG_BRANDS, type CatalogBrand } from "@/lib/types";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import CatalogClient from "./CatalogClient";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  await requirePage("catalog");
  const { branch } = await requirePageContext();
  const [productsByBrand, stockMap, labourCharges] = await Promise.all([
    Promise.all(CATALOG_BRANDS.map((b) => getCatalogProducts(b))),
    getCatalogStockMap(branch),
    getLabourCharges(),
  ]);
  const data = Object.fromEntries(CATALOG_BRANDS.map((b, i) => [b, productsByBrand[i]])) as Record<
    CatalogBrand,
    Awaited<ReturnType<typeof getCatalogProducts>>
  >;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Catalog"
        subtitle={`${branchLabel(branch)} — Yamalube, Rock Oil, Motul, Yamaha Spare Parts & Labour Charges`}
      />
      <div className="p-8">
        <CatalogClient data={data} stockMap={stockMap} branch={branch} labourCharges={labourCharges} />
      </div>
    </div>
  );
}
