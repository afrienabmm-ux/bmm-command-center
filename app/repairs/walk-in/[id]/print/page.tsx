import { notFound } from "next/navigation";
import { requirePage } from "@/lib/current-user";
import { getRepairJobById } from "@/lib/repairs-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { formatDate } from "@/lib/format";
import PrintButton from "../../../[id]/print/PrintButton";

export const dynamic = "force-dynamic";

export default async function PrintWalkInJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("walk-in");
  const { id } = await params;
  const [job, mechanics] = await Promise.all([getRepairJobById(id), getAllMechanics()]);
  if (!job) notFound();

  const mechanic = mechanics.find((m) => m.id === job.mechanicId);
  const itemsTotal = job.items.reduce((sum, it) => sum + it.quantity * it.price, 0);

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-3 flex justify-end">
        <PrintButton />
      </div>

      <div className="max-w-3xl mx-auto bg-white p-8 print:p-0 print:max-w-none text-black">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-[10px] font-bold">WALK-IN JOB SHEET</p>
            <img src="/bmm-logo-full.png" alt="Berjaya Mega Motors" className="h-16 mt-1" />
          </div>
          <div className="text-sm text-right pt-2 space-y-0.5">
            <p>
              <span className="font-semibold">JOBSHEET NO :</span> {job.jobsheetNo || "—"}
            </p>
            <p>
              <span className="font-semibold">NO PLATE :</span> {job.plateNo}
            </p>
            <p>
              <span className="font-semibold">MODEL :</span> {job.model || "—"}
            </p>
          </div>
        </div>

        <h1 className="text-sm font-bold underline mb-3">WALK-IN JOB SHEET</h1>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-4">
          <p>
            <span className="font-semibold">Customer Name :</span> {job.customerName}
          </p>
          <p>
            <span className="font-semibold">Customer Code :</span> {job.customerCode || "—"}
          </p>
          <p>
            <span className="font-semibold">Colour :</span> {job.colour || "—"}
          </p>
          <p>
            <span className="font-semibold">Engine No :</span> {job.engineNo || "—"}
          </p>
          <p>
            <span className="font-semibold">Chassis No :</span> {job.chassisNo || "—"}
          </p>
          <p>
            <span className="font-semibold">Mileage :</span> {job.mileageKm ? `${job.mileageKm} km` : "—"}
          </p>
          <p>
            <span className="font-semibold">Next Mileage :</span> {job.nextMileageKm ? `${job.nextMileageKm} km` : "—"}
          </p>
          <p>
            <span className="font-semibold">Service Type :</span> {job.serviceType || "—"}
          </p>
          <p>
            <span className="font-semibold">Next Service Date :</span> {job.nextServiceDate ? formatDate(job.nextServiceDate) : "—"}
          </p>
          <p>
            <span className="font-semibold">Sales No :</span> {job.salesNo || "—"}
          </p>
          <p>
            <span className="font-semibold">Sales Date :</span> {job.salesDate ? formatDate(job.salesDate) : "—"}
          </p>
          <p>
            <span className="font-semibold">Warranty Card No :</span> {job.warrantyCardNo || "—"}
          </p>
          <p>
            <span className="font-semibold">Mechanic :</span> {mechanic ? `${mechanic.shortName} (${mechanic.shortCode})` : "—"}
          </p>
          <p>
            <span className="font-semibold">Start Date :</span> {job.startedDate ? formatDate(job.startedDate) : "—"}
          </p>
          <p>
            <span className="font-semibold">End Date :</span> {job.completedDate ? formatDate(job.completedDate) : "—"}
          </p>
        </div>

        <table className="w-full text-xs border-collapse mb-4">
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

        <p className="text-xs mb-6">
          <span className="font-semibold">REMARK :</span> {job.description || ""}
        </p>

        <div className="grid grid-cols-2 gap-4 mt-10 text-xs">
          <div>
            <div className="border-t border-neutral-400 w-48 mb-1" />
            <p className="font-semibold">Customer Signature</p>
          </div>
          <div>
            <div className="border-t border-neutral-400 w-48 mb-1" />
            <p className="font-semibold">Mechanic / PIC Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
