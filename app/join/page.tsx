import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";

export default function JoinPage() {
  return (
    <div className="min-h-dvh w-full relative overflow-hidden bg-gradient-to-br from-red-800 via-red-600 to-rose-500 flex items-center justify-center px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bmm-storefront.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover opacity-20"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-red-800/90 via-red-600/85 to-rose-500/85" />
      <div className="absolute -top-24 -left-20 w-72 h-72 bg-rose-400/30 rounded-full blur-3xl" />
      <div className="absolute -bottom-28 -right-20 w-80 h-80 bg-red-900/30 rounded-full blur-3xl" />
      <div className="absolute top-1/3 -right-10 w-48 h-48 bg-orange-300/20 rounded-full blur-3xl" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/bmm-logo.png"
            alt="Berjaya Mega Motors"
            className="w-16 h-16 rounded-full object-cover mb-3 ring-4 ring-white/30 shadow-lg animate-pop"
          />
          <p className="text-2xl font-bold text-white tracking-tight">Services Card</p>
          <p className="text-xs text-white/70 text-center mt-1">BERJAYA MEGA MOTORS</p>
        </div>

        <div className="bg-white/95 backdrop-blur rounded-3xl p-6 shadow-2xl">
          <h1 className="text-lg font-bold text-neutral-900 mb-1.5">Check your services card 🏍️</h1>
          <p className="text-xs text-neutral-500 mb-5">
            Enter the phone number or plate number on file to see your card and stamp progress.
          </p>
          <JoinForm />
        </div>
      </div>
    </div>
  );
}
