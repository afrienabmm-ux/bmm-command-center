"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Cloudflare Turnstile "I'm not a robot" check on the login page. Supabase checks the
// token on every sign-in once Bot Protection is on in Supabase.
// The site key is public (it is in every login page anyway), so it lives here
// rather than in Vercel settings. Same Cloudflare widget as the HR dashboard.
export const ROBOT_CHECK_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAGEf_XePVUKAbwFh";

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("robot check failed to load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export type RobotCheckHandle = { reset: () => void };

// onToken gets the one-time token, or null when it expires or fails.
// onFail fires when the check can't run at all (blocked, offline, site not
// allowed), so the login page can let people try without it.
const RobotCheck = forwardRef<RobotCheckHandle, { onToken: (token: string | null) => void; onFail?: () => void }>(function RobotCheck({ onToken, onFail }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  const fail = useRef(onFail);
  fail.current = onFail;

  useImperativeHandle(ref, () => ({
    reset: () => {
      cb.current(null);
      if (id.current && window.turnstile) window.turnstile.reset(id.current);
    },
  }));

  useEffect(() => {
    if (!ROBOT_CHECK_KEY) return;
    let gone = false;
    loadScript()
      .then(() => {
        if (gone || !box.current || !window.turnstile) return;
        id.current = window.turnstile.render(box.current, {
          sitekey: ROBOT_CHECK_KEY,
          theme: "light",
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => {
            cb.current(null);
            fail.current?.();
          },
        });
      })
      .catch(() => {
        cb.current(null);
        fail.current?.();
      });
    return () => {
      gone = true;
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, []);

  if (!ROBOT_CHECK_KEY) return null;
  return <div ref={box} className="flex min-h-[65px] justify-center" />;
});

export default RobotCheck;
