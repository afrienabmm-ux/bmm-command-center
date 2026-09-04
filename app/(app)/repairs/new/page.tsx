import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Restore Bike is hidden for now — this route is disabled rather than
// deleted so the feature (and its data) can come back without rebuilding
// the page.
export default function NewRepairJobPage() {
  redirect("/");
}
