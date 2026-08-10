import { Clock, ShieldOff } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { signOutAction } from "@/lib/auth-actions";

export default async function PendingPage() {
  const user = await getCurrentUser();
  const revoked = user?.status === "revoked";

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-11 h-11 rounded-lg bg-white border border-neutral-200 flex items-center justify-center mx-auto mb-5">
          {revoked ? (
            <ShieldOff size={20} className="text-red-700" />
          ) : (
            <Clock size={20} className="text-amber-700" />
          )}
        </div>

        {revoked ? (
          <>
            <h1 className="text-base font-semibold text-neutral-900 mb-2">Access revoked</h1>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Your access to this system has been removed. Contact your manager if you think this is a mistake.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-base font-semibold text-neutral-900 mb-2">Waiting for approval</h1>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Your account ({user?.email}) is created. A manager needs to approve you before you can access the
              system.
            </p>
          </>
        )}

        <form action={signOutAction} className="mt-6">
          <button
            type="submit"
            className="text-sm font-medium text-neutral-600 hover:text-neutral-800 transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
