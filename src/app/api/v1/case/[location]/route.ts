import { NextResponse } from "next/server";
import { DEFAULT_ORG, orgBySlug, orgMode } from "@/lib/org";
import { buildCaseFeed } from "@/lib/feed";

export const runtime = "nodejs";

/**
 * The legacy feed route, serving the single-tenant installs (True North,
 * Cascarelli's) exactly as it always has; the body moved to lib/feed.ts so
 * the org route reuses it verbatim and the two can never drift.
 *
 * On the org-mode deployment this path has no org to answer for, so it
 * 404s and names the route that does. A redirect would guess which org the
 * caller meant, and there is nothing to guess with.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ location: string }> }) {
  if (orgMode()) {
    return NextResponse.json(
      { error: "This deployment serves per-organization feeds. Use /api/v1/orgs/{org}/case/{location}." },
      { status: 404 },
    );
  }
  const { location: slug } = await ctx.params;
  const org = await orgBySlug(DEFAULT_ORG);
  if (!org) {
    return NextResponse.json({ error: "Unknown location." }, { status: 404 });
  }
  return buildCaseFeed(org, slug);
}
