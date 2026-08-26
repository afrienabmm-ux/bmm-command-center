"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { requestPasswordResetAction, resetPasswordWithCodeAction } from "@/lib/password-reset-actions";

const inputClass =
  "w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50";

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSendCode() {
    setError(null);
    startTransition(async () => {
      const res = await requestPasswordResetAction(email);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setStep("reset");
    });
  }

  function handleReset() {
    setError(null);
    startTransition(async () => {
      const res = await resetPasswordWithCodeAction(email, code, newPassword);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setStep("done");
    });
  }

  if (step === "done") {
    return (
      <div className="text-center py-2">
        <p className="text-sm text-neutral-700 mb-5">
          Your password has been reset. You can sign in with your new password now.
        </p>
        <Link
          href="/login"
          className="inline-block w-full bg-red-500 hover:bg-red-400 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          Back to Sign in
        </Link>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <div className="space-y-4">
        <p className="text-xs text-neutral-500">
          If an account exists for <span className="font-medium text-neutral-800">{email}</span>, we sent a 6-digit
          code there. Enter it below along with your new password.
        </p>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Code</label>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          onClick={handleReset}
          disabled={isPending || !code.trim() || newPassword.length < 8}
          className="w-full bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          {isPending ? "Resetting…" : "Reset Password"}
        </button>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <button type="button" onClick={() => setStep("email")} className="hover:text-neutral-700">
            Change email
          </button>
          <button type="button" onClick={handleSendCode} disabled={isPending} className="hover:text-neutral-700">
            Resend code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">Enter your account email and we&apos;ll send a code to reset your password.</p>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        onClick={handleSendCode}
        disabled={isPending || !email.trim()}
        className="w-full bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        {isPending ? "Sending…" : "Send Reset Code"}
      </button>
      <p className="text-sm text-neutral-500 text-center">
        <Link href="/login" className="text-red-600 hover:text-red-700">
          Back to Sign in
        </Link>
      </p>
    </div>
  );
}
