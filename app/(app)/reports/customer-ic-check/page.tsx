import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/current-user";
import { getCustomerCodeErrors, amendCustomerCodeAction } from "@/lib/repairs-actions";
import { branchLabel, type Branch } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import ReportTable, { type ReportColumn } from "@/components/ReportTable";

export const dynamic = "force-dynamic";

// Column order matches the branches' own manually-kept "Jobsheet
// Monitoring" sheet exactly (Bil., Tarikh, No. Jobsheet, Mechanic Code,
// Reason, District, IC Number Untuk Amend, Plate Number, Customer Name,
// Model Motor) — Branch is added at the end since this report, unlike the
// paper sheet, combines every branch into one list.
const columns: ReportColumn[] = [
  { key: "date", label: "Tarikh" },
  { key: "jobsheetNo", label: "No. Jobsheet" },
  { key: "mechanic", label: "Mechanic Code" },
  { key: "reason", label: "Reason" },
  { key: "district", label: "District" },
  { key: "icNumber", label: "IC Number Untuk Amend" },
  { key: "plateNo", label: "Plate Number" },
  { key: "customerName", label: "Customer Name" },
  { key: "model", label: "Model Motor" },
  { key: "branch", label: "Branch" },
];

export default async function CustomerIcCheckPage() {
  await requirePage("reports");
  const errors = await getCustomerCodeErrors();
  // rawBranch keeps the actual Branch value (needed to save an edit) — the
  // displayed/exported "branch" column is the human label instead.
  const rows = errors.map((e) => ({ ...e, branch: branchLabel(e.branch), rawBranch: e.branch }));

  async function saveIc(row: Record<string, string | number>, newValue: string) {
    "use server";
    return amendCustomerCodeAction(String(row.id), row.rawBranch as Branch, newValue);
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Customer Code"
        subtitle="Every Walk-in jobsheet whose Customer Code isn't a valid IC number — all branches, all time. Click IC Number Untuk Amend to fill in the correct one."
        action={
          <Link href="/reports" className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-800">
            <ArrowLeft size={15} /> All Reports
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-8">
        <ReportTable
          columns={columns}
          rows={rows}
          dateField="date"
          rowNumber
          searchFields={["jobsheetNo", "icNumber", "plateNo", "customerName", "mechanic"]}
          searchPlaceholder="Search jobsheet no., IC, plate, name…"
          filename="Customer IC Check"
          selectFilters={[
            { field: "branch", label: "Branches" },
            { field: "reason", label: "Reasons" },
          ]}
          editableField="icNumber"
          onEditValue={saveIc}
        />
      </div>
    </div>
  );
}
