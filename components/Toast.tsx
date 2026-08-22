"use client";

import { useEffect } from "react";
import { AlertCircle, Info, X } from "lucide-react";

// A non-blocking replacement for window.alert() — the native browser
// dialog stops the whole page and looks like an OS error, not part of the
// app. This sits fixed at the top of the screen, auto-dismisses, and can
// be closed early.
export default function Toast({
  message,
  variant = "error",
  onDismiss,
}: {
  message: string | null;
  variant?: "error" | "info";
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  const isError = variant === "error";
  return (
    <div
      role="alert"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-start gap-2.5 max-w-md w-[calc(100%-2rem)] sm:w-auto text-sm font-medium px-4 py-3 rounded-xl shadow-lg border ${
        isError ? "bg-red-50 border-red-200 text-red-800" : "bg-red-50 border-red-200 text-red-800"
      }`}
    >
      {isError ? (
        <AlertCircle size={17} className="shrink-0 mt-0.5" />
      ) : (
        <Info size={17} className="shrink-0 mt-0.5" />
      )}
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X size={15} />
      </button>
    </div>
  );
}
