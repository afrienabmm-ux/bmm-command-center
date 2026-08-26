"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { signUpAction, type AuthResult } from "@/lib/auth-actions";

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState<AuthResult, FormData>(
    (_prev, formData) => signUpAction(formData),
    undefined
  );
  const [showPassword, setShowPassword] = useState(false);

  if (state && "needsEmailConfirmation" in state) {
    return (
      <p className="text-sm text-neutral-700 leading-relaxed">
        Check your email to confirm your account, then come back and sign in.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Your Name</label>
        <input
          type="text"
          name="name"
          required
          placeholder="e.g. Ahmad Faizal"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Email</label>
        <input
          type="email"
          name="email"
          required
          placeholder="you@company.com"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            required
            minLength={6}
            placeholder="At least 6 characters"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
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

      {state && "error" in state ? <p className="text-sm text-red-700">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-sm text-neutral-500 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-red-600 hover:text-red-700">
          Sign in
        </Link>
      </p>
    </form>
  );
}
