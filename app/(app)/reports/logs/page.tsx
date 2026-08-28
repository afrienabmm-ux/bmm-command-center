import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage, requireApproved } from "@/lib/current-user";
import { getActivityLogs } from "@/lib/activity-log";
import { canViewLogs } from "@/lib/logs-access";
import PageHeader from "@/components/PageHeader";
import ReportTable, { type ReportColumn } from "@/components/ReportTable";

export const dynamic = "force-dynamic";

// created_at is stored in UTC — the server that runs this app isn't
// necessarily in Malaysia, so displaying the raw timestamp showed a time
// hours behind the real local time it happened at.
const MY_TZ = "Asia/Kuala_Lumpur";

function toMalaysiaDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: MY_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: MY_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { date, time };
}

const COLUMNS: ReportColumn[] = [
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "userName", label: "User" },
  { key: "userEmail", label: "Email" },
  { key: "action", label: "Action" },
  { key: "detail", label: "Detail" },
  { key: "ipAddress", label: "IP Address" },
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
  const rows = logs.map((l) => {
    const { date, time } = toMalaysiaDateTime(l.createdAt);
    return {
      date,
      time,
      userName: l.userName || "—",
      userEmail: l.userEmail || "—",
      action: l.action,
      detail: l.detail || "—",
      ipAddress: l.ipAddress || "—",
    };
  });

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
          dateField="date"
          searchFields={["userName", "userEmail", "action", "detail"]}
          searchPlaceholder="Search user, action, or detail…"
          filename="bmm-activity-logs"
        />
      </div>
    </div>
  );
}
