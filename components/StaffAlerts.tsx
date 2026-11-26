"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { getStaffAlertBranch, removeStaffAlert, saveStaffAlert, testStaffAlert } from "@/lib/staff-alerts-actions";
import { BRANCHES, type Branch } from "@/lib/branch";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const b = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "install" | "blocked" | "off" | "on";

// "Alerts on this device": a pop-up on this phone or computer when a new booking comes in.
export default function StaffAlerts({ canPickAll, defaultBranch }: { canPickAll: boolean; defaultBranch: Branch | "all" }) {
  const [state, setState] = useState<State>("loading");
  const [branch, setBranch] = useState<Branch | "all">(defaultBranch);
  const [endpoint, setEndpoint] = useState("");
  const [note, setNote] = useState<{ good: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  useEffect(() => {
    (async () => {
      const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const installed =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !publicKey) {
        setState(iphone && !installed ? "install" : "unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const r = await getStaffAlertBranch(sub.endpoint);
          if (r.ok) {
            setEndpoint(sub.endpoint);
            if (r.branch) setBranch(r.branch);
            setState("on");
            return;
          }
        }
        setState(Notification.permission === "denied" ? "blocked" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, [publicKey]);

  function turnOn() {
    setNote(null);
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "blocked" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
        const r = await saveStaffAlert(JSON.parse(JSON.stringify(sub)), branch);
        if (r.error) {
          setNote({ good: false, text: r.error });
          return;
        }
        if (r.branch) setBranch(r.branch);
        setEndpoint(sub.endpoint);
        setState("on");
      } catch {
        setNote({ good: false, text: "Couldn't turn on alerts on this device." });
      }
    });
  }

  function turnOff() {
    setNote(null);
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removeStaffAlert(sub.endpoint);
        await sub.unsubscribe();
      }
      setEndpoint("");
      setState("off");
    });
  }

  function test() {
    setNote(null);
    start(async () => {
      const r = await testStaffAlert(endpoint);
      setNote(r.ok ? { good: true, text: "Test alert sent. It should pop up in a few seconds." } : { good: false, text: r.error ?? "Failed" });
    });
  }

  if (state === "loading") return null;
  const label = branch === "all" ? "all branches" : BRANCHES.find((b) => b.value === branch)?.label ?? branch;

  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-3 text-sm" data-staff-alerts={state}>
      <div className="flex flex-wrap items-center gap-2">
        {state === "on" ? <Bell className="h-4 w-4 text-red-600" /> : <BellOff className="h-4 w-4 text-neutral-400" />}
        <span className="font-medium text-neutral-800">Alerts on this device</span>
        {state === "on" && <span className="text-neutral-600">— new bookings for {label}</span>}
        {state === "off" && (
          <>
            <span className="text-neutral-600">— get a pop-up when a new booking comes in for</span>
            {canPickAll ? (
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value as Branch | "all")}
                className="rounded-md border border-neutral-300 px-2 py-1"
              >
                <option value="all">All branches</option>
                {BRANCHES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-neutral-800">{label}</span>
            )}
          </>
        )}
        <div className="ml-auto flex gap-2">
          {state === "off" && (
            <button onClick={turnOn} disabled={pending} className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50">
              Turn on alerts
            </button>
          )}
          {state === "on" && (
            <>
              <button onClick={test} disabled={pending} className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                Send test alert
              </button>
              <button onClick={turnOff} disabled={pending} className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                Turn off
              </button>
            </>
          )}
        </div>
      </div>
      {state === "blocked" && (
        <p className="mt-2 text-neutral-600">Alerts are blocked for this site. Allow notifications for it in the browser or phone settings, then reload.</p>
      )}
      {state === "install" && (
        <p className="mt-2 text-neutral-600">On iPhone: add this dashboard to your Home Screen first (Share → Add to Home Screen), then open it from there.</p>
      )}
      {state === "unsupported" && <p className="mt-2 text-neutral-600">This browser can&apos;t show alerts. Use Chrome or Edge.</p>}
      {note && <p className={`mt-2 ${note.good ? "text-green-700" : "text-red-600"}`}>{note.text}</p>}
    </div>
  );
}
