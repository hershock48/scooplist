"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the TV board current without a page reload. router.refresh() re-runs
 * the server component in place, no white flash on a screen customers watch
 * all day, and no meta-refresh (an axe-critical: sighted-keyboard and screen
 * reader users can't stop a timed reload). The no-JS TV stick still gets a
 * plain meta refresh via the <noscript> fallback next to this component.
 */
export default function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
