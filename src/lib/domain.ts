/**
 * The domain, client-safe: types and helpers both the browser UI and the
 * server store speak. No imports beyond types, no server-only, store.ts
 * layers the database on top of this, never the other way around.
 *
 * The category and allergen LISTS used to live here as frozen ice cream
 * constants. They moved to vertical.ts (server-side, env-configured, ice
 * cream by default) the day a second vertical appeared, and the client
 * components now receive them as props. Keys are plain strings for the
 * same reason locations are: the set is deployment config, not code.
 */

export type CategoryKey = string;
export type Allergen = string;

export type Size = { label: string; price: string };

/** The shops, as the domain knows them. locations.ts owns the real list. */
export type LocationKey = string;

export type Flavor = {
  id: string;
  name: string;
  description: string;
  category: CategoryKey;
  allergens: Allergen[];
  /** Free labels the shop cares about: vegan, seasonal, new, collaboration… */
  tags: string[];
  /**
   * Who made it, when that is not the shop itself. Ice cream wanted this
   * before beer did: the seed's own "Cascarelli Cashew" buried its
   * collaborator in prose where nothing could style, filter, or count it.
   * For a tap list it stops being optional, a board without the brewery
   * is not a tap list.
   */
  producer?: string;
  /**
   * ABV as entered ("5.2"), only meaningful for the drinks verticals and
   * blank everywhere else. A single named field, deliberately not a
   * generic attribute bag: a bag makes every screen mushier, and a third
   * vertical can pay for the generalization when it actually asks.
   */
  abv?: string;
  /** Blob URL in production; a data: URL on the no-Blob demo path. */
  photoUrl: string;
  /**
   * Price by size, the flavor's default list, seeded from its category.
   */
  sizes: Size[];
  /**
   * PER-SHOP PRICES, when a counter charges differently.
   *
   * Most flavors cost the same everywhere, so the common case stays one
   * list and the library UI keeps it that way. A shop that appears here
   * overrides the default entirely (not per size, which would leave a
   * half-priced flavor if someone renamed a size). Deleting the entry
   * puts the shop back on the default.
   *
   * The public feed resolves this per location, so each shop's website,
   * board, and future checkout all quote that shop's own numbers.
   */
  sizesByShop?: Record<LocationKey, Size[]>;
  /** Retired flavors stay in the library (history, "bring it back") but out of pickers. */
  retired: boolean;
  /**
   * When it was retired, so a mistake is recoverable at a glance.
   *
   * Nothing is ever deleted, retiring only hides a flavor from the boards
   * and the pickers. This timestamp exists so the library can put the last
   * day's retirements on a shelf of their own, where an accidental tap is
   * one tap back. Older ones are still there behind "Show retired"; they
   * just stop shouting.
   */
  retiredAt?: number | null;
  createdAt: number;
};

/**
 * The two in-between states a live case actually has, besides "scooping"
 * and "gone": LOW is the last-call flag (the interesting moment between
 * full and blown), ONDECK is queued to go on next, in the system but not
 * yet on the customer boards. Absent = scooping normally.
 */
export type CaseStatus = "low" | "ondeck";

export type CaseEntry = {
  id: string;
  locationId: string;
  flavorId: string;
  addedAt: number;
  /** null = in the case right now. Set when the tub blows. */
  removedAt: number | null;
  /**
   * Physical order, the thing localeCompare threw away: real cases and tap
   * walls have positions ("tap seven blew", "third tub from the left") and
   * the TV board should match the wall. Entries without one sort after
   * positioned ones, in the old alphabetical order, so nothing moves until
   * an owner actually reorders.
   */
  position?: number;
  status?: CaseStatus | null;
};

/** What this flavor costs at this shop: its override, else the default. */
export function sizesFor(flavor: Flavor, shop: LocationKey): Size[] {
  const override = flavor.sizesByShop?.[shop];
  return override && override.length > 0 ? override : flavor.sizes;
}

/** True when any shop is priced differently from the default. */
export function hasShopPricing(flavor: Flavor): boolean {
  return Object.values(flavor.sizesByShop ?? {}).some((s) => s && s.length > 0);
}

/** Retired within the recovery window, the shelf you can still undo from. */
export const RETIRE_GRACE_MS = 24 * 60 * 60 * 1000;

export function recentlyRetired(flavor: Flavor, now = Date.now()): boolean {
  return Boolean(flavor.retired && flavor.retiredAt && now - flavor.retiredAt < RETIRE_GRACE_MS);
}

/**
 * Case order: position first (the wall), then the pre-position alphabetical
 * fallback. One comparator shared by the feed, the TV board, and the admin
 * so "the board matches the wall" is true everywhere at once.
 */
export function byCaseOrder<T extends { position?: number | null; name: string }>(a: T, b: T): number {
  const pa = a.position ?? Number.MAX_SAFE_INTEGER;
  const pb = b.position ?? Number.MAX_SAFE_INTEGER;
  return pa - pb || a.name.localeCompare(b.name);
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
