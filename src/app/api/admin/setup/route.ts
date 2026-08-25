import { NextResponse } from "next/server";
import { currentOrg } from "@/lib/org";
import { configFromPreset, presetByKey } from "@/lib/presets";
import { invalidateVertical } from "@/lib/vertical";
import { resetSeedGuard, seedIfEmpty } from "@/lib/seed";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Nouns end up inside sentences, so they are lowercased words, not markup. */
const cleanNoun = (v: unknown, max: number) =>
  clean(v, max)
    .toLowerCase()
    .replace(/[^a-z0-9 '-]/g, "")
    .trim();

/**
 * Saves the business-type choice from /setup, then seeds the matching demo
 * data if the library is empty. Env-pinned deployments are refused rather
 * than silently overruled: a save that the next page load ignores would
 * teach the owner the screen is broken. (The env pin cannot exist in org
 * mode, org.ts's mode rule, so the 409 only ever fires on legacy installs.)
 */
export async function POST(request: Request) {
  const org = await currentOrg();
  if (!org) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (process.env.SCOOPLIST_CATEGORIES) {
    return NextResponse.json(
      { error: "This deployment's business type is managed by your web person." },
      { status: 409 },
    );
  }

  let b: { preset?: string; other?: { item?: string; surface?: string; prep?: string; firstBoard?: string } };
  try {
    b = (await request.json()) as typeof b;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const preset = presetByKey(String(b.preset ?? ""));
  if (!preset) {
    return NextResponse.json({ error: "Pick a business type." }, { status: 400 });
  }

  const config = configFromPreset(preset);

  if (preset.key === "other" && b.other) {
    const item = cleanNoun(b.other.item, 24);
    const surface = cleanNoun(b.other.surface, 24);
    const firstBoard = clean(b.other.firstBoard, 40);
    config.nouns = {
      item: item || preset.nouns.item,
      surface: surface || preset.nouns.surface,
      prep: b.other.prep === "in" ? "in" : "on",
    };
    if (firstBoard) {
      config.categories = [{ key: "menu", label: firstBoard }];
    }
  }

  const store = getStore();
  await store.setSetting(org.slug, "vertical", config);
  invalidateVertical(org.slug);
  resetSeedGuard(org.slug);

  // A fresh library gets the preset's demo data (seedIfEmpty resolves the
  // config we just saved and no-ops for presets that start empty, or when
  // real data already exists).
  await seedIfEmpty(org.slug).catch((err) => {
    console.error("scooplist: post-setup seed failed:", err);
  });

  return NextResponse.json({ ok: true });
}
