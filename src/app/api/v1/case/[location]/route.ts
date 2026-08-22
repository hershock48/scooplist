import { NextResponse } from "next/server";
import { locationById } from "@/lib/locations";
import { seedIfEmpty } from "@/lib/seed";
import { CATEGORIES, sizesFor } from "@/lib/domain";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * THE FEED. Public, versioned, and the whole point: a shop's website calls
 * this and renders the case without anyone deploying anything.
 *
 *   GET /api/v1/case/marshall
 *   {
 *     location: { id, name },
 *     updatedAt: 1755900000000 | null,
 *     boards: [ { key, label, flavors: [ { id, name, description,
 *       allergens, tags, photoUrl, sizes, inCaseSince } ] } ]
 *   }
 *
 * CORS is open on purpose, the data is a public menu, and consumers are
 * told to treat the feed as unavailable-tolerant: cache the last good copy.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ location: string }> }) {
  const { location: slug } = await ctx.params;
  const location = locationById(slug);
  if (!location) {
    return NextResponse.json({ error: "Unknown location." }, { status: 404 });
  }

  await seedIfEmpty();
  const store = getStore();
  const [entries, flavors, updatedAt] = await Promise.all([
    store.listCase(location.id),
    store.listFlavors(),
    store.caseUpdatedAt(location.id),
  ]);

  const byId = new Map(flavors.map((f) => [f.id, f]));
  const boards = CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    flavors: entries
      .map((e) => ({ entry: e, flavor: byId.get(e.flavorId) }))
      .filter((x) => x.flavor && !x.flavor.retired && x.flavor.category === c.key)
      .map(({ entry, flavor }) => ({
        id: flavor!.id,
        name: flavor!.name,
        description: flavor!.description,
        allergens: flavor!.allergens,
        tags: flavor!.tags,
        photoUrl: flavor!.photoUrl,
        // This shop's own prices when it has them, the default otherwise.
        sizes: sizesFor(flavor!, location.id),
        inCaseSince: entry.addedAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((b) => b.flavors.length > 0);

  return NextResponse.json(
    { location, updatedAt, boards },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        // A menu that can change mid-scoop: cache briefly at the edge,
        // serve stale while refreshing rather than blocking a page.
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      },
    },
  );
}
