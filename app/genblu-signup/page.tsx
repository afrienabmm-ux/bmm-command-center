import type { Metadata } from "next";
import GenbluSignupForm from "./GenbluSignupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BMM GenBlu Sign-Up",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "GenBlu Sign-Up" },
};

// Public — no staff login needed, on purpose. Salespeople were sharing one
// /genblu-upload login among the whole team, which meant every
// registration got attributed to whichever account happened to be signed
// in instead of the actual salesperson who made the sale. This page asks
// each of them to type their own name directly, same as a paper sign-up
// sheet — see submitPublicGenbluRegistrationAction in lib/genblu-actions.ts.
export default function GenbluSignupPage() {
  return (
    <div className="min-h-dvh w-full relative overflow-hidden bg-gradient-to-br from-red-800 via-red-600 to-rose-500 flex items-center justify-center px-4 py-10">
      <div className="absolute -top-24 -left-20 w-72 h-72 bg-rose-400/30 rounded-full blur-3xl" />
      <div className="absolute -bottom-28 -right-20 w-80 h-80 bg-red-900/30 rounded-full blur-3xl" />
      <div className="absolute top-1/3 -right-10 w-48 h-48 bg-orange-300/20 rounded-full blur-3xl" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bmm-genblu-signup-logo.png"
            alt="Berjaya Mega Motors — GenBlu Registration"
            className="w-16 h-16 rounded-full object-cover mb-3 ring-4 ring-white/30 shadow-lg animate-pop"
          />
          <p className="text-2xl font-bold text-white tracking-tight">GenBlu Sign-Up</p>
          <p className="text-xs text-white/70 text-center mt-1">BERJAYA MEGA MOTORS</p>
        </div>

        <div className="bg-white/95 backdrop-blur rounded-3xl p-6 shadow-2xl">
          <h1 className="text-lg font-bold text-neutral-900 mb-1.5">Register a new GenBlu customer 📱</h1>
          <p className="text-xs text-neutral-500 mb-5">Upload their points screenshot, add the plate number, and you&apos;re done.</p>
          <GenbluSignupForm />
        </div>
      </div>
    </div>
  );
}
