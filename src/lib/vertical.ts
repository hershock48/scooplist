import "server-only";

import { DEFAULT_ORG, type Size } from "@/lib/domain";
import {
  NEUTRAL_NOUNS,
  PRESETS,
  presetByKey,
  type Category,
  type PresetKey,
  type VerticalConfig,
  type VerticalNouns,
} from "@/lib/presets";
import { orgMode } from "@/lib/org";
import { getStore } from "@/lib/store";

export type { Category, VerticalConfig, VerticalNouns } from "@/lib/presets";

/**
 * THE VERTICAL: what kind of things this deployment lists, resolved from
 * three layers, strongest first:
 *
 *   1. ENV      the operator override (us, in the Vercel dashboard). If
 *               SCOOPLIST_CATEGORIES is set the whole vertical is
 *               env-defined and the setup page never argues. This is how
 *               the live True North and Cascarelli's installs stay pinned
 *               (Kevin's ruling: existing installs do not migrate).
 *               Single-field vars (EXAMPLE, ALLERGENS, SIZES, NOUNS) also
 *               override individual fields of a stored config.
 *   2. STORE    what the owner chose on /setup, one jsonb row the app
 *               owns. This is the product surface; env vars are not.
 *   3. PRESET   the scoops defaults, byte-for-byte the values that used
 *               to be hardcoded, so an unconfigured deployment behaves
 *               exactly as it always has.
 *
 * setupPending is true only when nothing configured it AND the library is
 * empty: a fresh install gets the "what kind of business is this?" step,
 * while True North (unconfigured but full of flavors since before setup
 * existed) never sees it.
 *
 * ORG MODE (org.ts) resolves per org and SKIPS the env layer entirely: the
 * central deployment's dashboard vars must not bleed into every tenant at
 * once, and an org's config always exists (creation writes it), so
 * setupPending is never raised there. The legacy path above is untouched.
 *
 * SERVER-SIDE ONLY (and now enforced with server-only: this file imports
 * the store). Pages and routes resolve once and hand plain fields to the
 * client components as props.
 */

export type ResolvedVertical = VerticalConfig & {
  source: "env" | "store" | "default";
  setupPending: boolean;
};

const SETTING_KEY = "vertical";
const CACHE_MS = 30_000;

type Cache = { value: ResolvedVertical; at: number };

function cacheBox(): Map<string, Cache> {
  const g = globalThis as typeof globalThis & { __scooplistVertical?: Map<string, Cache> };
  // The pre-org shape was a single { current } box; a Map keyed by org id
  // replaces it (instanceof guards the hot-reload seam between versions).
  if (!g.__scooplistVertical || !(g.__scooplistVertical instanceof Map)) {
    g.__scooplistVertical = new Map();
  }
  return g.__scooplistVertical;
}

/** Call after saving the setting so THIS instance re-reads immediately;
    other warm instances catch up within CACHE_MS. */
export function invalidateVertical(orgId: string): void {
  cacheBox().delete(orgId);
}

/* ------------------------------ env layer ------------------------------ */

function envCategories(): Category[] | null {
  const raw = process.env.SCOOPLIST_CATEGORIES;
  if (!raw) return null;
  const parsed = raw
    .split(",")
    .map((pair) => {
      const [key, ...label] = pair.split(":");
      return { key: key.trim(), label: label.join(":").trim() || key.trim() };
    })
    .filter((c) => c.key);
  return parsed.length > 0 ? parsed : null;
}

function envAllergens(): string[] | null {
  const raw = process.env.SCOOPLIST_ALLERGENS;
  if (!raw) return null;
  // "-" = deliberately none; a bar has no allergen chips to offer.
  if (raw.trim() === "-") return [];
  return raw
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Per-category default sizes from SCOOPLIST_SIZES, "-" rules intact:
 * a bare "-" is no defaults anywhere, "taps=-" none for that category,
 * both checked BEFORE the pipe-parse ("-" parses to zero valid sizes and
 * would otherwise fall through, the observed 7%-IPA-priced-Mini bug).
 * Returns null when the var is unset, a full record otherwise.
 */
function envSizes(categoryKeys: string[]): Record<string, Size[]> | null {
  const raw = process.env.SCOOPLIST_SIZES?.trim();
  if (!raw) return null;
  const out: Record<string, Size[]> = {};
  if (raw === "-") return out;
  for (const key of categoryKeys) {
    for (const block of raw.split(";")) {
      const [k, list] = block.split("=");
      if (k?.trim() !== key || list === undefined) continue;
      if (list.trim() === "-") break;
      const sizes = list
        .split("|")
        .map((pair) => {
          const [label, ...price] = pair.split(":");
          return { label: label.trim(), price: price.join(":").trim() };
        })
        .filter((s) => s.label && s.price);
      if (sizes.length > 0) out[key] = sizes;
      break;
    }
  }
  return out;
}

/** SCOOPLIST_NOUNS="drink,cooler,in": the env-pinned installs' way to get
    preset-grade nouns (Cascarelli's cooler) without migrating to the store. */
function envNouns(): VerticalNouns | null {
  const raw = process.env.SCOOPLIST_NOUNS;
  if (!raw) return null;
  const [item, surface, prep] = raw.split(",").map((s) => s.trim().toLowerCase());
  if (!item || !surface) return null;
  return { item, surface, prep: prep === "in" ? "in" : "on" };
}

/* ----------------------------- resolution ------------------------------ */

const SCOOPS = PRESETS.find((p) => p.key === "scoops")!;

function scoopsDefault(): VerticalConfig {
  return {
    preset: "scoops",
    categories: SCOOPS.categories,
    allergens: SCOOPS.allergens,
    sizes: SCOOPS.sizes,
    example: SCOOPS.example,
    voice: SCOOPS.voice,
    nouns: SCOOPS.nouns,
  };
}

/** A stored value is data from a database, so it is validated, not trusted:
    a half-shaped row degrades to the scoops defaults rather than crashing
    every page that renders from it. */
function validStored(v: unknown): VerticalConfig | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Partial<VerticalConfig>;
  if (!Array.isArray(c.categories) || c.categories.length === 0) return null;
  if (!c.nouns?.item || !c.nouns?.surface) return null;
  const preset = (presetByKey(String(c.preset)) ? c.preset : "other") as PresetKey;
  return {
    preset,
    categories: c.categories.filter((x) => x?.key).map((x) => ({ key: String(x.key), label: String(x.label ?? x.key) })),
    allergens: Array.isArray(c.allergens) ? c.allergens.map(String) : [],
    sizes: c.sizes && typeof c.sizes === "object" ? (c.sizes as Record<string, Size[]>) : {},
    example: String(c.example ?? "").trim() || "The Special",
    voice: c.voice === "scoops" ? "scoops" : "neutral",
    nouns: {
      item: String(c.nouns.item),
      surface: String(c.nouns.surface),
      prep: c.nouns.prep === "in" ? "in" : "on",
      // From the preset in code, never the stored row: the row was copied
      // at creation and would pin yesterday's sentences on every business
      // that already exists. "Other" has no preset voice to take it from.
      live: presetByKey(preset)?.nouns.live,
    },
  };
}

export async function resolveVertical(orgId: string): Promise<ResolvedVertical> {
  const box = cacheBox();
  const hit = box.get(orgId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  let value: ResolvedVertical;

  if (orgMode()) {
    /*
      Per-org: the stored config or the scoops defaults, nothing else. No
      env layer (one dashboard var must not restyle every tenant), and no
      setupPending (creation always writes a vertical, so there is no
      first-run limbo to redirect into).
    */
    const store = getStore();
    let stored: VerticalConfig | null = null;
    try {
      stored = validStored(await store.getSetting(orgId, SETTING_KEY));
    } catch {
      stored = null;
    }
    value = stored
      ? { ...stored, source: "store", setupPending: false }
      : { ...scoopsDefault(), source: "default", setupPending: false };
    box.set(orgId, { value, at: Date.now() });
    return value;
  }

  const envCats = envCategories();
  if (envCats) {
    // Fully env-defined: the pinned installs. Neutral voice, neutral nouns
    // unless SCOOPLIST_NOUNS says otherwise.
    const keys = envCats.map((c) => c.key);
    value = {
      preset: "other",
      categories: envCats,
      allergens: envAllergens() ?? [],
      sizes: envSizes(keys) ?? {},
      example: process.env.SCOOPLIST_EXAMPLE?.trim() || "The Special",
      voice: "neutral",
      nouns: envNouns() ?? NEUTRAL_NOUNS,
      source: "env",
      setupPending: false,
    };
  } else {
    // A database blip must not take down every page that asks what kind of
    // business this is: the TV board's whole failure design is "degrade
    // calmly", and this resolver runs before its try/catch. No store =
    // scoops defaults, setup not pending (a broken store is not a fresh
    // install), and the short cache means we re-ask soon.
    const store = getStore();
    let stored: VerticalConfig | null = null;
    let storeDown = false;
    try {
      stored = validStored(await store.getSetting(DEFAULT_ORG, SETTING_KEY));
    } catch {
      storeDown = true;
    }
    if (stored) {
      // Single-field env vars still override a stored config, so we can
      // adjust one thing from the dashboard without retiring the setup.
      value = {
        ...stored,
        allergens: envAllergens() ?? stored.allergens,
        sizes: envSizes(stored.categories.map((c) => c.key)) ?? stored.sizes,
        example: process.env.SCOOPLIST_EXAMPLE?.trim() || stored.example,
        nouns: envNouns() ?? stored.nouns,
        source: "store",
        setupPending: false,
      };
    } else {
      const base = scoopsDefault();
      value = {
        ...base,
        allergens: envAllergens() ?? base.allergens,
        sizes: envSizes(base.categories.map((c) => c.key)) ?? base.sizes,
        example: process.env.SCOOPLIST_EXAMPLE?.trim() || base.example,
        nouns: envNouns() ?? base.nouns,
        source: "default",
        // Setup only greets an EMPTY install: True North predates setup,
        // is unconfigured, and must never be ambushed by it. A store that
        // cannot be asked counts as "not empty" for the same reason.
        setupPending: storeDown ? false : !(await store.hasAnyFlavors(DEFAULT_ORG).catch(() => true)),
      };
    }
  }

  box.set(orgId, { value, at: Date.now() });
  return value;
}

/**
 * The starting price list for a category under this config. The scoops
 * preset keeps its old lenient fallback (an unknown key prices like
 * hand-scooped, the original behavior); every other vertical gets NO
 * guessed prices for a category nobody priced, the placeholder rule.
 */
export function sizesForCategory(v: VerticalConfig, categoryKey: string): Size[] {
  const hit = v.sizes[categoryKey];
  if (hit && hit.length > 0) return hit;
  if (v.preset === "scoops") return v.sizes.handscooped ?? [];
  return [];
}
