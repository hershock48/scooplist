import { NextResponse } from "next/server";
import { orgBySlug } from "@/lib/org";
import { buildCaseFeed } from "@/lib/feed";

export const runtime = "nodejs";

/**
 * The org-scoped feed: GET /api/v1/orgs/{org}/case/{location}. Same JSON
 * shape, headers, and additive-only contract as the legacy v1 route; the
 * builder in lib/feed.ts is shared so they cannot drift.
 *
 * Unknown org and unknown location answer identically: a public menu URL
 * already reveals the org exists, but this route must not become a cheaper
 * enumeration oracle than the menu itself (same 404 body either way). On a
 * legacy install orgBySlug only knows the implicit org, so every org slug
 * 404s here, which is correct: those installs serve /api/v1/case/{location}.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ org: string; location: string }> },
) {
  const { org: orgSlug, location } = await ctx.params;
  const org = await orgBySlug(orgSlug);
  if (!org) {
    return NextResponse.json({ error: "Unknown location." }, { status: 404 });
  }
  return buildCaseFeed(org, location);
}
