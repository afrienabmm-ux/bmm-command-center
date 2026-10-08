import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentUser, getActiveBranchSelection, canViewAllBranches, canViewAllBranchesAtOnce } from "@/lib/current-user";

// Lets staff add the dashboard to a phone's home screen and open it like an
// app (full screen, own icon). Only the dashboard pages link this — the
// /scan and /genblu-upload shortcuts keep their own manifests.
export const metadata: Metadata = {
  manifest: "/dashboard.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "BMM After-Sales" },
};

export const viewport: Viewport = {
  themeColor: "#ef4444",
};

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
