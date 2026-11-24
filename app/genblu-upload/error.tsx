"use client";

import AutoReloadError from "@/components/AutoReloadError";

// Page left open while a new version went live: reload by itself once.
export default function Error({ error }: { error: Error & { digest?: string } }) {
  return <AutoReloadError error={error} />;
}
