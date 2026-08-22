"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the TV board current without a page reload. router.refresh() re-runs
 * the server component in place, no white flash on a screen customers watch
 * all day, and no meta-refresh (an axe-critical: sighted-keyboard and screen
 * reader users can't stop a timed reload). The no-JS TV stick still gets a
 * plain meta refresh via the <noscript> fallback next to this component.
 *
 * Once every six hours it does a HARD location.reload() instead: a
 * long-lived client app on cheap TV hardware can wedge in ways
 * router.refresh() cannot recover (leaked memory, a stale chunk after a
 * deploy, a hung fetch), and one white flash at 4am removes the whole
 * class of "the board froze on Tuesday" calls.
 */
const HARD_RELOAD_MS = 6 * 60 * 60 * 1000;

export default function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const mounted = Date.now();
    const id = setInterval(() => {
      if (Date.now() - mounted >= HARD_RELOAD_MS) {
        window.location.reload();
        return;
      }
      router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
