import { createHmac } from "node:crypto";

/**
 * Tell the org's own website that its case changed.
 *
 * Kevin, 8 Sep 2026: a beer added at the bar "seemed to take a while" to
 * reach the site. It did: the site refetched this feed every 60 seconds
 * behind a page that regenerated every 60 seconds, behind an edge cache
 * that could serve the feed stale for five minutes. Three polling layers,
 * each honest on its own, and a keg kicked at the bar was on the website
 * anywhere from one to seven minutes later.
 *
 * So the case pushes. After any write to a case or a flavor, Scooplist
 * POSTs to the org's `siteHook` (set by create-org, e.g.
 * https://copperac.vercel.app/api/scooplist/revalidate) and the site
 * purges its own caches on the spot. The next visitor sees the new list.
 *
 * Signed with the org's handoff key, the same secret the website already
 * holds for the Taps handoff, so no new secret is minted and a site with
 * the key set is a site that can verify the ping:
 *
 *   x-scooplist-org:        {slug}
 *   x-scooplist-timestamp:  {unix seconds}
 *   x-scooplist-signature:  HMAC-SHA256(handoffKey, "{slug}\n{ts}")
 *
 * Runs inside next/server's after(), so the bar's tap gets its response
 * first and a slow or dead hook never adds a second to the board. It is
 * still awaited by the platform, never fire-and-forget, and a failure is
 * logged rather than swallowed. Polling stays as the floor: an org with no
 * hook, or a hook that is down, is exactly as current as it was before.
 */
export async function notifySite(org: { slug: string; handoffKey: string; siteHook: string }): Promise<void> {
  const hook = org.siteHook.trim();
  if (!hook || !org.handoffKey) return;
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", org.handoffKey).update(`${org.slug}\n${ts}`).digest("hex");
  try {
    const res = await fetch(hook, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-scooplist-org": org.slug,
        "x-scooplist-timestamp": ts,
        "x-scooplist-signature": sig,
      },
      body: JSON.stringify({ org: org.slug, ts: Number(ts) }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error(`scooplist: site hook for ${org.slug} answered ${res.status}`);
  } catch (err) {
    console.error(`scooplist: site hook for ${org.slug} failed:`, err instanceof Error ? err.message : err);
  }
}
