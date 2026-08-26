import { NextResponse } from "next/server";
import { hashPin, safeEqual } from "@/lib/auth";
import { SLUG_RE, orgMode, validOrgSlug } from "@/lib/org";
import { configFromPreset, presetByKey, type Category } from "@/lib/presets";
import { invalidateVertical } from "@/lib/vertical";
import { resetSeedGuard, seedIfEmpty } from "@/lib/seed";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Org creation, the operator's door, driven by tools/create-org.mjs. No
 * admin UI on purpose: Kevin is the only caller, he already lives in a
 * terminal for this repo, and a page would need its own auth surface for
 * an action that happens a few times a year. Upsert semantics make a
 * re-run the way a PIN gets rotated or a location list gets edited.
 *
 * Auth is the SCOOPLIST_MASTER header, compared timing-safe. Outside org
 * mode the route claims not to exist (404, same as any unknown path), so
 * probing a legacy install teaches nothing.
 */

type Body = {
  slug?: string;
  name?: string;
  pin?: string;
  preset?: string;
  locations?: { id?: string; name?: string }[];
  categories?: { key?: string; label?: string }[];
  nouns?: { item?: string; surface?: string; prep?: string };
  firstBoard?: string;
  /**
   * The flip: this org inherits every pre-org row on the deployment
   * (flavors, case, the whole history) instead of seeding. For turning a
   * single-tenant install into the org deployment without its data ever
   * leaving the database. Idempotent, and a partially applied run
   * completes on re-run (the store moves rows in place).
   */
  adoptLegacy?: boolean;
};

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  if (!orgMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const master = process.env.SCOOPLIST_MASTER ?? "";
  const given = request.headers.get("x-scooplist-master") ?? "";
  if (!master || !given || !safeEqual(given, master)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let b: Body;
  try {
    b = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const slug = clean(b.slug, 40).toLowerCase();
  if (!validOrgSlug(slug)) {
    return NextResponse.json(
      { error: "Slug must be 2-31 lowercase letters, digits, or hyphens, and not a reserved word." },
      { status: 400 },
    );
  }

  const name = clean(b.name, 80);
  if (!name) return NextResponse.json({ error: "The org needs a name." }, { status: 400 });

  const pin = clean(b.pin, 12);
  if (pin.length < 4) {
    return NextResponse.json({ error: "PIN must be 4 to 12 characters." }, { status: 400 });
  }

  const preset = presetByKey(String(b.preset ?? ""));
  if (!preset) {
    return NextResponse.json({ error: "Pick a preset: scoops, tavern, coffee, or other." }, { status: 400 });
  }

  const locations = Array.isArray(b.locations)
    ? b.locations
        .map((l) => ({ id: clean(l?.id, 40).toLowerCase(), name: clean(l?.name, 80) }))
        .filter((l) => l.id)
        .map((l) => ({ id: l.id, name: l.name || l.id }))
    : [];
  if (locations.length < 1 || locations.length > 12) {
    return NextResponse.json({ error: "Give 1 to 12 locations as {id, name}." }, { status: 400 });
  }
  for (const l of locations) {
    if (!SLUG_RE.test(l.id)) {
      return NextResponse.json({ error: `Location id "${l.id}" is not a valid slug.` }, { status: 400 });
    }
  }

  /*
    Optional custom board list: real installs keep needing boards no preset
    carries (Cascarelli's runs ten, Copper AC runs taps + cocktails), and
    an override at creation beats inventing a preset per client.
  */
  let categories: Category[] | undefined;
  if (b.categories !== undefined) {
    if (!Array.isArray(b.categories)) {
      return NextResponse.json({ error: "categories must be a list of {key, label}." }, { status: 400 });
    }
    categories = b.categories
      .map((c) => ({ key: clean(c?.key, 40).toLowerCase(), label: clean(c?.label, 60) }))
      .filter((c) => c.key)
      .map((c) => ({ key: c.key, label: c.label || c.key }));
    if (categories.length === 0 || categories.some((c) => !SLUG_RE.test(c.key))) {
      return NextResponse.json({ error: "Every category key must be a valid slug." }, { status: 400 });
    }
  }

  const config = configFromPreset(preset, { categories });
  if (preset.key === "other") {
    const item = clean(b.nouns?.item, 24).toLowerCase();
    const surface = clean(b.nouns?.surface, 24).toLowerCase();
    config.nouns = {
      item: item || preset.nouns.item,
      surface: surface || preset.nouns.surface,
      prep: b.nouns?.prep === "in" ? "in" : "on",
    };
    const firstBoard = clean(b.firstBoard, 40);
    if (!categories && firstBoard) config.categories = [{ key: "menu", label: firstBoard }];
  }

  const store = getStore();
  await store.upsertOrg({
    slug,
    name,
    pinHash: hashPin(pin),
    data: { locations, createdAt: Date.now() },
  });
  await store.setSetting(slug, "vertical", config);
  invalidateVertical(slug);
  resetSeedGuard(slug);
  if (b.adoptLegacy === true) {
    // Adoption replaces seeding entirely: the org's library IS the
    // legacy library, and demo rows on top of a real one would be the
    // exact pollution the seed guards exist to prevent.
    await store.adoptDefaultOrg(slug);
    invalidateVertical(slug);
  } else {
    // Presets that seed fill an empty library now; a re-run against a
    // non-empty one is a no-op (seedIfEmpty's own guards).
    await seedIfEmpty(slug).catch((err) => {
      console.error("scooplist: org creation seed failed:", err);
    });
  }

  // Never the pin, never the hash: the response is a receipt, not a secret.
  return NextResponse.json({
    ok: true,
    slug,
    urls: {
      login: `/login/${slug}`,
      boards: locations.map((l) => `/board/${slug}/${l.id}`),
      feeds: locations.map((l) => `/api/v1/orgs/${slug}/case/${l.id}`),
    },
  });
}
