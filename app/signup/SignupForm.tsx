"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type AuthResult } from "@/lib/auth-actions";

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState<AuthResult, FormData>(
    (_prev, formData) => signUpAction(formData),
    undefined
  );

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
          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Email</label>
        <input
          type="email"
          name="email"
          required
          placeholder="you@company.com"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Password</label>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          placeholder="At least 6 characters"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      {state && "error" in state ? <p className="text-sm text-red-700">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-sm text-neutral-500 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-600 hover:text-indigo-700">
          Sign in
        </Link>
      </p>
    </form>
  );
}
