import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { safeEqual, setAuthCookie } from "@/lib/auth";
import { orgBySlug, orgMode, validOrgSlug } from "@/lib/org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signed handoff: the org's own website signs its owner into Scooplist.
 *
 * Kevin's ask (2 Sep 2026): the planner should reach the tap board from
 * her workroom without a second login. The website's workroom, already
 * behind its own passcode, mints
 *
 *   /api/handoff?org={slug}&exp={unix seconds}&sig={hmac}
 *
 * with sig = HMAC-SHA256(handoffKey, "{slug}\n{exp}") and redirects the
 * browser here. This route checks the signature against the key on the
 * org row, that the link is at most two minutes old, and sets the same
 * cookie /api/login sets. The PIN is never involved, so the workroom
 * never holds it and rotating it never breaks the button.
 *
 * What a link is worth: two minutes of "sign in as this org", replayable
 * within that window. The link travels in a redirect between two sites
 * the studio runs, over HTTPS, and lands in the user's own browser; a
 * captured one expires before it can be used at leisure. Single-use
 * would need a store round trip per handoff for a threat the window
 * already contains. The key itself is a 256-bit random value that lives
 * in two places: the org row here and the website's env.
 *
 * Failures all land on the org's login page with the ordinary "bad"
 * flag: a forged or stale link should look exactly like a wrong PIN.
 */
const MAX_AGE_S = 120;

export async function GET(request: Request) {
  if (!orgMode()) return new NextResponse("Not found", { status: 404 });
  const url = new URL(request.url);
  const slug = url.searchParams.get("org") ?? "";
  const exp = Number(url.searchParams.get("exp") ?? "");
  const sig = url.searchParams.get("sig") ?? "";

  const fail = (where: string) => NextResponse.redirect(new URL(where, request.url), 303);
  if (!validOrgSlug(slug)) return fail("/login?bad=1");

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(exp) || exp < now || exp > now + MAX_AGE_S) return fail(`/login/${slug}?bad=1`);

  const org = await orgBySlug(slug);
  if (!org || !org.pinHash || !org.handoffKey) return fail(`/login/${slug}?bad=1`);

  const expected = createHmac("sha256", org.handoffKey).update(`${slug}\n${exp}`).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(sig) || !safeEqual(sig, expected)) return fail(`/login/${slug}?bad=1`);

  await setAuthCookie({ slug: org.slug, pinHash: org.pinHash });
  return NextResponse.redirect(new URL("/case", request.url), 303);
}
