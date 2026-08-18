import { notFound } from "next/navigation";
import { requirePage } from "@/lib/current-user";
import { getRepairJobById } from "@/lib/repairs-actions";
import { formatDate } from "@/lib/format";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function PrintRepairJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("repairs");
  const { id } = await params;
  const job = await getRepairJobById(id);
  if (!job) notFound();

  const itemsTotal = job.items.reduce((sum, it) => sum + it.quantity * it.price, 0);

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-3 flex justify-end">
        <PrintButton />
      </div>

      <div className="max-w-3xl mx-auto bg-white p-8 print:p-0 print:max-w-none text-black">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-[10px] font-bold">ESTIMATED COST 2ND FOR REPAIRS</p>
            <img src="/bmm-logo-full.png" alt="Berjaya Mega Motors" className="h-16 mt-1" />
          </div>
          <div className="text-sm text-right pt-2">
            <p>
              <span className="font-semibold">MODEL :</span> {job.model || "—"}
            </p>
            <p>
              <span className="font-semibold">NO PLATE :</span> {job.plateNo}
            </p>
            <p>
              <span className="font-semibold">MILEAGE :</span> {job.mileageKm ? `${job.mileageKm} km` : "—"}
            </p>
          </div>
        </div>

        <h1 className="text-sm font-bold underline mb-3">ESTIMATED COST 2ND FOR REPAIRS</h1>

        <div className="grid grid-cols-[1fr_260px] gap-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-indigo-100">
                <th className="border border-neutral-400 px-2 py-1 text-left w-8">#</th>
                <th className="border border-neutral-400 px-2 py-1 text-left">DESCRIPTION</th>
                <th className="border border-neutral-400 px-2 py-1 w-16">QUANTITY</th>
                <th className="border border-neutral-400 px-2 py-1 w-20">PRICE</th>
              </tr>
            </thead>
            <tbody>
              {job.items.map((item, i) => (
                <tr key={item.id}>
                  <td className="border border-neutral-400 px-2 py-1 text-center">{i + 1}</td>
                  <td className="border border-neutral-400 px-2 py-1 uppercase">{item.description}</td>
                  <td className="border border-neutral-400 px-2 py-1 text-center">{item.quantity}</td>
                  <td className="border border-neutral-400 px-2 py-1 text-right">{item.price.toFixed(2)}</td>
                </tr>
              ))}
              {job.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="border border-neutral-400 px-2 py-3 text-center text-neutral-500">
                    No items
                  </td>
                </tr>
              )}
              <tr className="bg-neutral-100 font-semibold">
                <td className="border border-neutral-400 px-2 py-1" colSpan={2} />
                <td className="border border-neutral-400 px-2 py-1 text-right">TOTAL COST</td>
                <td className="border border-neutral-400 px-2 py-1 text-right">{itemsTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div className="text-xs space-y-3">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-neutral-400 px-2 py-1 bg-neutral-100 text-left">Stock Order</th>
                  <th className="border border-neutral-400 px-2 py-1 bg-neutral-100 text-left">Restore</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-neutral-400 px-2 py-1 align-top">
                    Order date : {job.stockOrderDate ? formatDate(job.stockOrderDate) : ""}
                  </td>
                  <td className="border border-neutral-400 px-2 py-1 align-top">
                    Start Date : {job.startedDate ? formatDate(job.startedDate) : ""}
                  </td>
                </tr>
                <tr>
                  <td className="border border-neutral-400 px-2 py-1 align-top">
                    Arrival date : {job.stockArriveDate ? formatDate(job.stockArriveDate) : ""}
                  </td>
                  <td className="border border-neutral-400 px-2 py-1 align-top">
                    End date : {job.completedDate ? formatDate(job.completedDate) : ""}
                  </td>
                </tr>
              </tbody>
            </table>

            <p>
              <span className="font-semibold">PIC :</span> {job.picName || ""}
            </p>
            <p>
              <span className="font-semibold">REMARK :</span> {job.description || ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-10 text-xs">
          <div>
            <p className="font-semibold">PREPARE BY : {job.preparedBy || ""}</p>
          </div>
          <div>
            <p className="font-semibold mb-8">APPROVE/NOT APPROVE : {job.approvalStatus}</p>
            <div className="border-t border-neutral-400 w-48 mb-1" />
            <p className="font-semibold mt-4">DATE:</p>
          </div>
        </div>
      </div>
    </div>
  );
}
