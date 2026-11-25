"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { signInAction, type AuthResult } from "@/lib/auth-actions";
import RobotCheck, { ROBOT_CHECK_KEY, type RobotCheckHandle } from "@/components/RobotCheck";

export default function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState<AuthResult, FormData>(
    async (_prev, formData) => {
      const result = await signInAction(formData);
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

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
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
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-neutral-600">Password</label>
          <Link href="/forgot-password" className="text-xs text-red-600 hover:text-red-700">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            required
            placeholder="••••••••"
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

      <label className="flex items-center gap-2 text-sm text-neutral-600">
        <input type="checkbox" name="rememberMe" className="accent-red-500" />
        Remember me on this device
      </label>

      <input type="hidden" name="captchaToken" value={robotToken ?? ""} />
      <RobotCheck ref={robot} onToken={setRobotToken} onFail={() => setRobotFailed(true)} />

      {state && "error" in state ? <p className="text-sm text-red-700">{state.error}</p> : null}

      <button
        type="submit"
        disabled={isPending || waitingForRobot}
        className="w-full bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        {isPending ? "Signing in…" : waitingForRobot ? "Checking you’re not a robot…" : "Sign in"}
      </button>

      <p className="text-sm text-neutral-500 text-center">
        No account yet?{" "}
        <Link href="/signup" className="text-red-600 hover:text-red-700">
          Sign up
        </Link>
      </p>
    </form>
  );
}
