import type { Metadata } from "next";
import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BMM E-Service Card",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "E-Service Card" },
};

export default function JoinPage() {
  return (
    <div className="h-dvh w-full relative overflow-hidden bg-gradient-to-br from-red-800 via-red-600 to-rose-500 flex items-center justify-center px-4 py-6">
      <div className="absolute -top-24 -left-20 w-72 h-72 bg-rose-400/30 rounded-full blur-3xl" />
      <div className="absolute -bottom-28 -right-20 w-80 h-80 bg-red-900/30 rounded-full blur-3xl" />
      <div className="absolute top-1/3 -right-10 w-48 h-48 bg-orange-300/20 rounded-full blur-3xl" />

      {/* Capped to the screen's own height and laid out as a column, header
          pinned at the top, so only the card below ever scrolls — and only
          within itself — once its content (the stamp card, after a lookup)
          runs taller than the space left for it. Centering the whole block
          like the page used to do would have pushed the pinned header
          partly off-screen the moment total content ran longer than the
          screen, instead of just growing the page like a normal page is
          allowed to; anchoring from the top avoids that and reads closer to
          how a native app screen is laid out besides. */}
      <div className="w-full max-w-sm h-full relative z-10 flex flex-col">
        <div className="flex flex-col items-center mb-3 shrink-0">
          <img
            src="/bmm-eservice-card-logo.png"
            alt="Berjaya Mega Motors — E-Service Card"
            className="w-11 h-11 rounded-full object-cover mb-1.5 ring-4 ring-white/30 shadow-lg animate-pop"
          />
          <p className="text-lg font-bold text-white tracking-tight">Services Card</p>
          <p className="text-[11px] text-white/70 text-center">BERJAYA MEGA MOTORS</p>
        </div>

        <div className="bg-white/95 backdrop-blur rounded-3xl p-5 shadow-2xl min-h-0 overflow-y-auto">
          <JoinForm />
        </div>
      </div>
    </div>
  );
}
