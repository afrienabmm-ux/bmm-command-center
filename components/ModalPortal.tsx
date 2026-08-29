"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renders its children straight onto document.body instead of wherever
// they'd otherwise sit in the tree. A `fixed inset-0` overlay is supposed
// to cover the whole screen regardless of where it's nested, but some
// browsers clip it to the nearest ancestor that has `overflow: hidden`
// (the rounded-corner table cards this app uses everywhere) — a modal
// opened from a row inside one of those renders squashed into that card's
// box instead of over the full page. A portal sidesteps the whole
// ancestor chain, so it can never happen.
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
