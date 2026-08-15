import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentUser, getActiveBranchSelection, canViewAllBranches, canViewAllBranchesAtOnce } from "@/lib/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const activeBranch = await getActiveBranchSelection(user);
  const locked = !canViewAllBranches(user);

  return (
    <AppShell
      email={user.email}
      name={user.name}
      role={user.role}
      positionTitle={user.positionTitle}
      pages={user.pages}
      activeBranch={activeBranch}
      locked={locked}
      allowAll={canViewAllBranchesAtOnce(user)}
    >
      {children}
    </AppShell>
  );
}
