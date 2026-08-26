import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 bg-red-950">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col md:flex-row">
        <div className="md:w-2/5 bg-gradient-to-br from-red-600 to-red-900 text-white p-8 flex flex-col items-center justify-center text-center">
          <img
            src="/bmm-logo.png"
            alt="Berjaya Mega Motors"
            className="w-16 h-16 rounded-full object-cover mb-4 ring-4 ring-white/30 shadow-lg animate-pop"
          />
          <h2 className="text-xl font-bold mb-2 uppercase">Forgot your password?</h2>
          <p className="text-sm text-red-100 leading-relaxed">
            No worries — enter your email and we&apos;ll send you a code to reset it.
          </p>
        </div>

        <div className="md:w-3/5 p-8">
          <h1 className="text-sm font-semibold text-neutral-900 mb-5">Reset Password</h1>
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
