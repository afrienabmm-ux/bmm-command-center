import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/bmm-logo.png" alt="Berjaya Mega Motors" className="w-16 h-16 rounded-full object-cover mb-3" />
          <p className="text-base font-semibold text-neutral-900">After-Sales</p>
          <p className="text-xs text-neutral-500">Berjaya Mega Motors — After-Sales</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <h1 className="text-sm font-semibold text-neutral-900 mb-5">Reset Password</h1>
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
