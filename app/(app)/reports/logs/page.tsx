import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage, requireApproved } from "@/lib/current-user";
import { getActivityLogs, canViewLogs } from "@/lib/activity-log";
import PageHeader from "@/components/PageHeader";
import ReportTable, { type ReportColumn } from "@/components/ReportTable";

export const dynamic = "force-dynamic";

const COLUMNS: ReportColumn[] = [
  { key: "date", label: "Date" },
  { key: "userName", label: "User" },
  { key: "userEmail", label: "Email" },
  { key: "action", label: "Action" },
  { key: "detail", label: "Detail" },
];

// Gated to two specific people (see canViewLogs), not a role — Administrator
// alone doesn't grant access. Both requirePage("reports") (so an
// unapproved/wrong-role account never gets here) and this explicit email
// check run before any log data is fetched.
export default async function LogsPage() {
  await requirePage("reports");
  const user = await requireApproved();
  if (!canViewLogs(user.email)) redirect("/reports");

  const logs = await getActivityLogs();
  const rows = logs.map((l) => ({
    date: l.createdAt.slice(0, 16).replace("T", " "),
    // Filtering uses just the date portion — the "date" column above also
    // carries the time, which would make the "to" side of a date-range
    // filter exclude same-day entries (e.g. "28 Aug 14:03" > "28 Aug").
    dateOnly: l.createdAt.slice(0, 10),
    userName: l.userName || "—",
    userEmail: l.userEmail || "—",
    action: l.action,
    detail: l.detail || "—",
  }));

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Logs"
        subtitle="Who logged in and every team-management action — visible to Management only."
        action={
          <Link href="/reports" className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-800">
            <ArrowLeft size={15} /> All Reports
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-8">
        <ReportTable
          columns={COLUMNS}
          rows={rows}
          dateField="dateOnly"
          searchFields={["userName", "userEmail", "action", "detail"]}
          searchPlaceholder="Search user, action, or detail…"
          filename="bmm-activity-logs"
        />
      </div>
    </div>
  );
}
