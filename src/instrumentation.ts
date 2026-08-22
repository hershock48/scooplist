/**
 * Boot-time init. register() runs once per server instance start, which
 * makes it the right home for the first-run seed: the deployment fills its
 * own empty library the moment it boots, with no request involved at all.
 *
 * History, so nobody re-litigates it: the seed used to run from the public
 * feed route (an unauthenticated GET performing the first write - removed),
 * then only from the PIN-gated admin pages - which meant a fresh deployment
 * stayed empty until someone logged in, and the Cascarelli's install sat
 * dark for an evening because of it. Boot-time is the version with no
 * public write AND no login prerequisite. seedIfEmpty's own guards (process
 * flag, cheap probe, advisory lock) make repeated cold-start calls free and
 * race-safe, and a seed failure must never take the server down with it.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { seedIfEmpty } = await import("@/lib/seed");
    await seedIfEmpty().catch((err) => {
      console.error("scooplist: boot seed failed (will retry next cold start):", err);
    });
  }
}
