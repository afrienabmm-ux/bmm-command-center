import { requirePageContext, requirePage, canViewAllBranches } from "@/lib/current-user";
import { getGenbluRegistrations, getScreenshotUrl } from "@/lib/genblu-actions";
import { getAllMechanics } from "@/lib/mechanics-actions";
import { branchLabel } from "@/lib/branch";
import PageHeader from "@/components/PageHeader";
import GenbluClient from "./GenbluClient";

export const dynamic = "force-dynamic";

export default async function GenbluPage() {
  await requirePage("genblu");
  const { user, branch } = await requirePageContext();
  const [registrations, mechanics] = await Promise.all([getGenbluRegistrations(branch), getAllMechanics()]);
  const withUrls = await Promise.all(
    registrations.map(async (r) => ({
      ...r,
      screenshotUrl: r.screenshotPath ? await getScreenshotUrl(r.screenshotPath) : null,
    }))
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="GenBlu Registration"
        subtitle={`${branchLabel(branch)} — ${registrations.length} registered`}
      />
      <div className="p-8">
        <GenbluClient registrations={withUrls} mechanics={mechanics} branch={branch} locked={!canViewAllBranches(user)} />
      </div>
    </div>
  );
}
