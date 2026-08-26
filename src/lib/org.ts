import "server-only";

import { cookies } from "next/headers";
import { DEFAULT_ORG } from "@/lib/domain";
import { isLegacyCookieValid, orgCookieValue, safeEqual } from "@/lib/auth";
import { locations, type ShopLocation } from "@/lib/locations";
import { getStore } from "@/lib/store";

export { DEFAULT_ORG };

/**
 * Tenancy facts, all of them, in one file.
 *
 * Scooplist ran single-tenant per deployment until August 2026 (True North,
 * then Cascarelli's, each their own Vercel project and database). Copper AC
 * is the third install and the point where per-client infrastructure stopped
 * being the cheap option, so this deployment mode exists: one central app,
 * orgs as data, per-org login links and feeds. The two live installs never
 * migrate; they keep running in legacy mode on their own databases.
 */

/**
 * Org mode is OPT-IN, and the trigger is deliberately inverted from the
 * obvious "no env pins means orgs": True North sets NO env vars at all (it
 * predates every SCOOPLIST_* var and runs on the code defaults), so "env
 * absent" describes the oldest live install, not a fresh central
 * deployment. Instead org mode requires SCOOPLIST_MASTER, which the
 * central deployment needs anyway to create orgs, AND the absence of the
 * two pinning vars. If someone sets pins and MASTER together the pins win:
 * fail toward the mode that cannot lose data.
 */
export function orgMode(): boolean {
  return (
    Boolean(process.env.SCOOPLIST_MASTER) &&
    !process.env.SCOOPLIST_LOCATIONS &&
    !process.env.SCOOPLIST_CATEGORIES
  );
}

/**
 * "default" is reserved so no real org can collide with the legacy
 * sentinel's rows or settings. The rest protect current and future
 * top-level URL space (/login/{org} and /board/{org}/... must never be
 * shadowed by an app route, or the other way around).
 */
export const RESERVED_SLUGS = new Set([
  DEFAULT_ORG,
  "api",
  "login",
  "logout",
  "board",
  "case",
  "flavors",
  "history",
  "setup",
  "admin",
  "master",
  "status",
  "org",
  "orgs",
  "v1",
  "new",
]);

/**
 * No "/" (it would break the org-prefixed settings keys), no ":" or ","
 * (they are the separators in every SCOOPLIST_* pair format), no "." (the
 * org cookie is dot-delimited). Lowercase URL-safe slugs only, 2 to 31
 * characters, starting alphanumeric.
 */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;

export function validOrgSlug(s: string): boolean {
  return SLUG_RE.test(s) && !RESERVED_SLUGS.has(s);
}

/**
 * SCOOPLIST_LEGACY_ALIAS keeps a flipped install's OLD public URLs alive:
 * when a single-tenant deployment becomes the org deployment (True North's
 * install became the central one, August 2026), its bookmarked TV boards
 * (/board/marshall) and its site's feed URL (/api/v1/case/marshall) must
 * not break mid-flip. Set to an org slug, the legacy public routes serve
 * that org; the admin surfaces are NOT aliased, owners sign in at
 * /login/{org} like everyone else. Public-only on purpose: the alias
 * exists for URLs already printed on someone's hardware, not as a second
 * front door.
 */
export function legacyAliasSlug(): string | null {
  const raw = process.env.SCOOPLIST_LEGACY_ALIAS?.trim().toLowerCase();
  return raw && validOrgSlug(raw) ? raw : null;
}

/** The public TV board URL for one of an org's shops, both modes' shapes
    in one place so the four admin pages cannot disagree about it. */
export function boardHref(org: Org, shopId: string): string {
  return orgMode() ? `/board/${org.slug}/${shopId}` : `/board/${shopId}`;
}

export type Org = {
  slug: string;
  name: string;
  locations: ShopLocation[];
  /** Stored PIN hash; only the auth paths look inside it. */
  pinHash: string;
};

/**
 * Resolve an org by slug. In legacy mode the only org that exists is the
 * implicit one: the deployment itself, shops from env, named after the
 * first shop so headers read naturally. Everything else is null, which is
 * what makes the org routes 404 on the pinned installs.
 */
export async function orgBySlug(slug: string): Promise<Org | null> {
  if (!orgMode()) {
    if (slug !== DEFAULT_ORG) return null;
    const shops = locations();
    return {
      slug: DEFAULT_ORG,
      name: shops[0]?.name ?? "Scooplist",
      locations: shops,
      pinHash: "",
    };
  }
  if (!validOrgSlug(slug)) return null;
  const row = await getStore().getOrg(slug);
  if (!row) return null;
  const shops = Array.isArray(row.data.locations)
    ? row.data.locations.filter((l) => l && l.id).map((l) => ({ id: String(l.id), name: String(l.name ?? l.id) }))
    : [];
  return { slug: row.slug, name: row.name, locations: shops, pinHash: row.pinHash };
}

/**
 * The signed-in org, resolved from the one auth cookie. This replaces
 * isAuthed() everywhere: every admin surface asks "signed in to WHICH org"
 * now, even though in legacy mode the answer is always the implicit one.
 *
 * Cookie formats never mix: legacy mode accepts only the legacy value
 * (HMAC of the PIN, unchanged since day one, so nobody is signed out by a
 * deploy), org mode accepts only "2.{slug}.{hmac}". An org cookie is bound
 * to the STORED hash, so rotating a PIN invalidates every session at once.
 */
export async function currentOrg(): Promise<Org | null> {
  const jar = await cookies();
  const got = jar.get("scooplist_admin")?.value ?? "";
  if (!got) return null;

  if (!orgMode()) {
    return isLegacyCookieValid(got) ? orgBySlug(DEFAULT_ORG) : null;
  }

  const parts = got.split(".");
  if (parts.length !== 3 || parts[0] !== "2") return null;
  const slug = parts[1];
  if (!validOrgSlug(slug)) return null;
  const org = await orgBySlug(slug);
  if (!org || !org.pinHash) return null;
  return safeEqual(got, orgCookieValue(org.slug, org.pinHash)) ? org : null;
}
