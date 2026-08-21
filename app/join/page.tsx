import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";

export default function JoinPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 bg-neutral-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/bmm-logo.png" alt="Berjaya Mega Motors" className="w-16 h-16 rounded-full object-cover mb-3" />
          <p className="text-base font-semibold text-neutral-900">Membership</p>
          <p className="text-xs text-neutral-500 text-center mt-1">Berjaya Mega Motors — After-Sales</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <h1 className="text-sm font-semibold text-neutral-900 mb-1.5">Join our membership</h1>
          <p className="text-xs text-neutral-500 mb-5">
            Enter your name and phone number to get your digital membership card — no app needed.
          </p>
          <JoinForm />
        </div>
      </div>
    </div>
  );
}
