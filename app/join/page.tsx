import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";

export default function JoinPage() {
  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 flex items-center justify-center px-4 py-10">
      <div className="absolute -top-24 -left-20 w-72 h-72 bg-fuchsia-400/30 rounded-full blur-3xl" />
      <div className="absolute -bottom-28 -right-20 w-80 h-80 bg-indigo-400/30 rounded-full blur-3xl" />
      <div className="absolute top-1/3 -right-10 w-48 h-48 bg-amber-300/20 rounded-full blur-3xl" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/bmm-logo.png"
            alt="Berjaya Mega Motors"
            className="w-16 h-16 rounded-full object-cover mb-3 ring-4 ring-white/30 shadow-lg"
          />
          <p className="text-2xl font-bold text-white tracking-tight">Membership Club</p>
          <p className="text-xs text-white/70 text-center mt-1">BERJAYA MEGA MOTORS</p>
        </div>

        <div className="bg-white/95 backdrop-blur rounded-3xl p-6 shadow-2xl">
          <h1 className="text-lg font-bold text-neutral-900 mb-1.5">Join the club 🏍️</h1>
          <p className="text-xs text-neutral-500 mb-5">
            Get your digital membership card — no app needed. Just your name, phone number, and email.
          </p>
          <JoinForm />
        </div>
      </div>
    </div>
  );
}
