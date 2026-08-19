import { notFound } from "next/navigation";
import { requirePage } from "@/lib/current-user";
import { getWarrantyClaimById } from "@/lib/claims-actions";
import { formatDate } from "@/lib/format";
import PrintButton from "../../../repairs/[id]/print/PrintButton";

export const dynamic = "force-dynamic";

export default async function PrintWarrantyClaimPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("warranty-claims");
  const { id } = await params;
  const claim = await getWarrantyClaimById(id);
  if (!claim) notFound();

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-3 flex justify-end">
        <PrintButton />
      </div>

      <div className="max-w-3xl mx-auto bg-white p-8 print:p-0 print:max-w-none text-black">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-[10px] font-bold">WARRANTY CLAIM</p>
            <img src="/bmm-logo-full.png" alt="Berjaya Mega Motors" className="h-16 mt-1" />
          </div>
          <div className="text-sm text-right pt-2 space-y-0.5">
            <p>
              <span className="font-semibold">TICKET ID :</span> {claim.ticketId}
            </p>
            <p>
              <span className="font-semibold">NO PLATE :</span> {claim.plateNo}
            </p>
            <p>
              <span className="font-semibold">MODEL :</span> {claim.model || "—"}
            </p>
          </div>
        </div>

        <h1 className="text-sm font-bold underline mb-3">WARRANTY CLAIM</h1>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-4">
          <p>
            <span className="font-semibold">Customer Name :</span> {claim.customerName}
          </p>
          <p>
            <span className="font-semibold">Phone No :</span> {claim.phone || "—"}
          </p>
          <p>
            <span className="font-semibold">Bike Make :</span> {claim.bikeMake}
          </p>
          <p>
            <span className="font-semibold">PIC :</span> {claim.pic || "—"}
          </p>
          <p>
            <span className="font-semibold">Submitted Date :</span> {formatDate(claim.submittedDate)}
          </p>
          <p>
            <span className="font-semibold">Stock Status :</span> {claim.stockStatus}
          </p>
          <p>
            <span className="font-semibold">Status :</span> {claim.status}
          </p>
        </div>

        <div className="text-xs mb-4">
          <p className="font-semibold mb-1">Issue / Description :</p>
          <p className="border border-neutral-400 rounded px-3 py-2 min-h-[60px]">{claim.description}</p>
        </div>

        <div className="text-xs mb-6">
          <p className="font-semibold mb-1">Latest Status :</p>
          <p className="border border-neutral-400 rounded px-3 py-2 min-h-[40px]">{claim.latestStatus || "—"}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-10 text-xs">
          <div>
            <div className="border-t border-neutral-400 w-48 mb-1" />
            <p className="font-semibold">Customer Signature</p>
          </div>
          <div>
            <div className="border-t border-neutral-400 w-48 mb-1" />
            <p className="font-semibold">PIC Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
