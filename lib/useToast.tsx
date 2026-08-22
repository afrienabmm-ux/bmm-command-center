"use client";

import { useCallback, useState } from "react";
import Toast from "@/components/Toast";

// Drop {toastNode} anywhere in a client component's JSX, then call
// showError(...)/showInfo(...) instead of window.alert(...) to report what
// went wrong without blocking the whole page.
export function useToast() {
  const [state, setState] = useState<{ message: string; variant: "error" | "info" } | null>(null);

  const showError = useCallback((message: string) => setState({ message, variant: "error" }), []);
  const showInfo = useCallback((message: string) => setState({ message, variant: "info" }), []);
  const dismiss = useCallback(() => setState(null), []);

  const toastNode = <Toast message={state?.message ?? null} variant={state?.variant} onDismiss={dismiss} />;

  return { showError, showInfo, toastNode };
}
