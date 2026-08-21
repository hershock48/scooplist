import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import {
  ALLERGENS,
  CATEGORIES,
  DEFAULT_SIZES,
  newId,
  type Allergen,
  type CategoryKey,
  type Flavor,
  type Size,
} from "@/lib/domain";
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

  const category = (CATEGORIES.some((c) => c.key === b.category)
    ? (b.category as CategoryKey)
    : existing?.category) ?? "handscooped";

  const allergens = Array.isArray(b.allergens)
    ? (b.allergens.filter((a) => (ALLERGENS as readonly string[]).includes(String(a))) as Allergen[])
    : existing?.allergens ?? [];

  const tags = Array.isArray(b.tags)
    ? b.tags.map((t) => clean(t, 30)).filter(Boolean).slice(0, 8)
    : existing?.tags ?? [];

  const flavor: Flavor = {
    id: existing?.id ?? newId("flv"),
    name,
    description: b.description !== undefined ? clean(b.description, 300) : existing?.description ?? "",
    category,
    allergens,
    tags,
    photoUrl: b.photoUrl !== undefined ? clean(b.photoUrl, 500_000) : existing?.photoUrl ?? "",
    sizes: cleanSizes(b.sizes) ?? existing?.sizes ?? DEFAULT_SIZES[category],
    retired: typeof b.retired === "boolean" ? b.retired : existing?.retired ?? false,
    createdAt: existing?.createdAt ?? Date.now(),
  };

  await store.upsertFlavor(flavor);
  return NextResponse.json({ ok: true, flavor });
}
