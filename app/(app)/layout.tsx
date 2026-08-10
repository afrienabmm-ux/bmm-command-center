import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import BranchSwitcher from "@/components/BranchSwitcher";
import { getCurrentUser, getActiveBranchSelection, canViewAllBranches, canViewAllBranchesAtOnce } from "@/lib/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const activeBranch = await getActiveBranchSelection(user);
  const locked = !canViewAllBranches(user);

  return (
    <div className="flex w-full">
      <Sidebar email={user.email} name={user.name} role={user.role} pages={user.pages} />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-14 border-b border-neutral-200 flex items-center justify-end px-8 shrink-0">
          <BranchSwitcher activeBranch={activeBranch} locked={locked} allowAll={canViewAllBranchesAtOnce(user)} />
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
