import { NextResponse } from "next/server";
import { locationById } from "@/lib/locations";
import { byCaseOrder, sizesFor, type CaseEntry, type Flavor } from "@/lib/domain";
import { resolveVertical } from "@/lib/vertical";
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
 *     boards: [ { key, label, flavors: [ { id, name, description, producer,
 *       abv, allergens, tags, photoUrl, sizes, inCaseSince, low } ] } ],
 *     onDeck: [ { id, name, ... } ]
 *   }
 *
 * v1 is ADDITIVE ONLY: producer, abv, low, and onDeck were added for the
 * second vertical and existing consumers ignore them; boards keeps its
 * exact original shape and members (scooping now, on-deck excluded).
 *
 * CORS is open on purpose, the data is a public menu, and consumers are
 * told to treat the feed as unavailable-tolerant: cache the last good copy.
 *
 * NO SEED HERE, deliberately. This route is public with open CORS, and it
 * used to call seedIfEmpty(), which meant an unauthenticated stranger's GET
 * performed the first write on a fresh database, inside a cached response.
 * The admin surfaces seed (where a new operator actually lands); an empty
 * library here returns an empty board, which is the truth.
 */

function feedFlavor(entry: CaseEntry, flavor: Flavor, shopId: string) {
  return {
    id: flavor.id,
    name: flavor.name,
    description: flavor.description,
    producer: flavor.producer ?? "",
    abv: flavor.abv ?? "",
    allergens: flavor.allergens,
    tags: flavor.tags,
    photoUrl: flavor.photoUrl,
    // This shop's own prices when it has them, the default otherwise.
    sizes: sizesFor(flavor, shopId),
    inCaseSince: entry.addedAt,
    /** Last call: still scooping, but say so before it is gone. */
    low: entry.status === "low",
    position: entry.position ?? null,
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ location: string }> }) {
  const { location: slug } = await ctx.params;
  const location = locationById(slug);
  if (!location) {
    return NextResponse.json({ error: "Unknown location." }, { status: 404 });
  }

  const store = getStore();
  const [entries, flavors, updatedAt] = await Promise.all([
    store.listCase(location.id),
    store.listFlavors(),
    store.caseUpdatedAt(location.id),
  ]);

  const byId = new Map(flavors.map((f) => [f.id, f]));
  const live = entries
    .map((entry) => ({ entry, flavor: byId.get(entry.flavorId) }))
    .filter((x): x is { entry: CaseEntry; flavor: Flavor } => Boolean(x.flavor && !x.flavor.retired));

  const boards = (await resolveVertical()).categories
    .map((c) => ({
      key: c.key,
      label: c.label,
      flavors: live
        .filter((x) => x.entry.status !== "ondeck" && x.flavor.category === c.key)
        .map((x) => feedFlavor(x.entry, x.flavor, location.id))
        .sort(byCaseOrder),
    }))
    .filter((b) => b.flavors.length > 0);

  /** Queued to go on next; a site can render "coming soon", or ignore it. */
  const onDeck = live
    .filter((x) => x.entry.status === "ondeck")
    .map((x) => feedFlavor(x.entry, x.flavor, location.id))
    .sort(byCaseOrder);

  return NextResponse.json(
    { location, updatedAt, boards, onDeck },
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
