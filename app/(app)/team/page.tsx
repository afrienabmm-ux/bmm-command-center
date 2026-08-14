import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTeamMembers } from "@/lib/user-actions";
import PageHeader from "@/components/PageHeader";
import TeamClient from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "Management") {
    redirect("/");
  }

  const members = await getTeamMembers();

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Manage Team" subtitle="Approve new sign-ups and manage who can access what" />
      <div className="p-8">
        <TeamClient members={members} currentUserId={user.id} />
      </div>
    </div>
  );
}
