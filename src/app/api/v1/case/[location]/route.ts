import { NextResponse } from "next/server";
import { DEFAULT_ORG, legacyAliasSlug, orgBySlug, orgMode } from "@/lib/org";
import { buildCaseFeed } from "@/lib/feed";

export const runtime = "nodejs";

/**
 * The legacy feed route, serving the single-tenant installs (Cascarelli's)
 * exactly as it always has; the body moved to lib/feed.ts so the org route
 * reuses it verbatim and the two can never drift.
 *
 * On the org-mode deployment this path serves the SCOOPLIST_LEGACY_ALIAS
 * org when one is set (True North's site and TV sticks kept these URLs
 * through the flip that made their install the central deployment), and
 * otherwise 404s naming the route that exists. A redirect would guess
 * which org the caller meant, and without the alias there is nothing to
 * guess with.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ location: string }> }) {
  const { location: slug } = await ctx.params;
  if (orgMode()) {
    const alias = legacyAliasSlug();
    const org = alias ? await orgBySlug(alias) : null;
    if (org) return buildCaseFeed(org, slug);
    return NextResponse.json(
      { error: "This deployment serves per-organization feeds. Use /api/v1/orgs/{org}/case/{location}." },
      { status: 404 },
    );
  }
  const org = await orgBySlug(DEFAULT_ORG);
  if (!org) {
    return NextResponse.json({ error: "Unknown location." }, { status: 404 });
  }
  return buildCaseFeed(org, slug);
}
