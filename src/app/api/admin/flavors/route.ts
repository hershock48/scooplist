import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { locations } from "@/lib/locations";
import { newId, type Allergen, type CategoryKey, type Flavor, type Size } from "@/lib/domain";
import { allergens as configuredAllergens, categories, defaultSizesFor } from "@/lib/vertical";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function cleanSizes(v: unknown): Size[] | null {
  if (!Array.isArray(v)) return null;
  const sizes = v
    .map((s) => ({ label: clean(s?.label, 40), price: clean(s?.price, 20) }))
    .filter((s) => s.label && s.price);
  return sizes.length > 0 ? sizes : null;
}

/**
 * Per-shop price overrides. Only known shops are kept, a shop mapped to an
 * empty list means "back on the default price", and every list runs through
 * the same cleaner as the default so a shop cannot smuggle in a size with a
 * blank price.
 */
function cleanShopSizes(v: unknown): Record<string, Size[]> | undefined {
  if (v === null) return {};
  if (typeof v !== "object" || Array.isArray(v)) return undefined;
  const known = new Set(locations().map((l) => l.id));
  const out: Record<string, Size[]> = {};
  for (const [shop, list] of Object.entries(v as Record<string, unknown>)) {
    if (!known.has(shop)) continue;
    const sizes = cleanSizes(list);
    if (sizes) out[shop] = sizes;
  }
  return out;
}

/**
 * Create or edit a library flavor. New flavors get the category's default
 * sizes so "add Blue Moon mid-rush" is two fields, not a pricing exercise.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const store = getStore();
  const existing = b.id ? await store.getFlavor(clean(b.id, 60)) : null;

  const name = clean(b.name, 80) || existing?.name || "";
  if (!name) return NextResponse.json({ error: "The flavor needs a name." }, { status: 400 });

  /*
   * photoUrl is REJECTED over the cap, never truncated, a sliced data: URL
   * saves "ok" and renders as a broken image everywhere. The cap clears the
   * photo route's inline maximum (1.5M base64 + the data: prefix) with room.
   */
  let photoUrl = existing?.photoUrl ?? "";
  if (b.photoUrl !== undefined) {
    if (typeof b.photoUrl !== "string" || b.photoUrl.length > 2_000_000) {
      return NextResponse.json(
        { error: "That photo is too large to store, try uploading it again." },
        { status: 413 },
      );
    }
    photoUrl = b.photoUrl.trim();
  }

  // Validated against the CONFIGURED vertical, not a hardcoded ice cream
  // list; the deployment's env decides what a legal category or allergen is.
  const cats = categories();
  const category = (cats.some((c) => c.key === b.category)
    ? (b.category as CategoryKey)
    : existing?.category) ?? cats[0].key;

  const legalAllergens = configuredAllergens();
  const allergens = Array.isArray(b.allergens)
    ? (b.allergens.filter((a) => legalAllergens.includes(String(a))) as Allergen[])
    : existing?.allergens ?? [];

  const tags = Array.isArray(b.tags)
    ? b.tags.map((t) => clean(t, 30)).filter(Boolean).slice(0, 8)
    : existing?.tags ?? [];

  // ABV keeps only what a number needs; "5.2%" typed with the sign is fine.
  const abv =
    b.abv !== undefined ? clean(b.abv, 10).replace(/[^\d.]/g, "") : existing?.abv ?? "";

  const flavor: Flavor = {
    id: existing?.id ?? newId("flv"),
    name,
    description: b.description !== undefined ? clean(b.description, 300) : existing?.description ?? "",
    category,
    allergens,
    tags,
    producer: b.producer !== undefined ? clean(b.producer, 80) : existing?.producer ?? "",
    abv,
    photoUrl,
    sizes: cleanSizes(b.sizes) ?? existing?.sizes ?? defaultSizesFor(category),
    sizesByShop: cleanShopSizes(b.sizesByShop) ?? existing?.sizesByShop,
    retired: typeof b.retired === "boolean" ? b.retired : existing?.retired ?? false,
    /*
      Stamped the moment it is retired and cleared the moment it comes back,
      so the recovery shelf measures from the actual decision, not from
      whenever the row was last touched for an unrelated edit.
    */
    retiredAt:
      typeof b.retired === "boolean"
        ? b.retired
          ? existing?.retired && existing?.retiredAt
            ? existing.retiredAt
            : Date.now()
          : null
        : existing?.retiredAt ?? null,
    createdAt: existing?.createdAt ?? Date.now(),
  };

  await store.upsertFlavor(flavor);
  return NextResponse.json({ ok: true, flavor });
}
