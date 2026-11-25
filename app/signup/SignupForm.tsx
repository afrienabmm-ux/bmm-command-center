"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { signUpAction, type AuthResult } from "@/lib/auth-actions";
import RobotCheck, { ROBOT_CHECK_KEY, type RobotCheckHandle } from "@/components/RobotCheck";

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState<AuthResult, FormData>(
    async (_prev, formData) => {
      const result = await signUpAction(formData);
      // Each robot-check token works once; get a fresh one for the next try.
      if (result && "error" in result) robot.current?.reset();
      return result;
    },
    undefined
  );
  const robot = useRef<RobotCheckHandle>(null);
  const [robotToken, setRobotToken] = useState<string | null>(null);
  // If the Cloudflare box can't load, don't lock people out: let them try,
  // and the sign-in itself says so if the robot check is required.
  const [robotFailed, setRobotFailed] = useState(false);
  const waitingForRobot = !!ROBOT_CHECK_KEY && !robotToken && !robotFailed;
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-600 transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <input type="hidden" name="captchaToken" value={robotToken ?? ""} />
      <RobotCheck ref={robot} onToken={setRobotToken} onFail={() => setRobotFailed(true)} />

      {state && "error" in state ? <p className="text-sm text-red-700">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending || waitingForRobot}
        className="w-full bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        {isPending ? "Creating account…" : waitingForRobot ? "Checking you’re not a robot…" : "Create account"}
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
