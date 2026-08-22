/**
 * The domain, client-safe: types and constants both the browser UI and the
 * server store speak. No imports, no server-only — store.ts layers the
 * database on top of this, never the other way around.
 */

export const CATEGORIES = [
  { key: "handscooped", label: "Hand-Scooped" },
  { key: "softserve", label: "Soft Serve" },
  { key: "dairyfree", label: "Dairy Free & Sorbet" },
  { key: "adult", label: "Adult Flavors (21+)" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export const ALLERGENS = ["nuts", "gluten", "egg", "soy"] as const;
export type Allergen = (typeof ALLERGENS)[number];

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
  /** Blob URL in production; a data: URL on the no-Blob demo path. */
  photoUrl: string;
  /**
   * Price by size — the flavor's default list, seeded from its category.
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
  createdAt: number;
};

export type CaseEntry = {
  id: string;
  locationId: string;
  flavorId: string;
  addedAt: number;
  /** null = in the case right now. Set when the tub blows. */
  removedAt: number | null;
};

/** Sensible starting prices per category — True North's published menu. */
export const DEFAULT_SIZES: Record<CategoryKey, Size[]> = {
  handscooped: [
    { label: "Mini", price: "$4.75" },
    { label: "Small", price: "$5.75" },
    { label: "Large", price: "$6.75" },
  ],
  softserve: [
    { label: "Mini", price: "$3.75" },
    { label: "Small", price: "$4.75" },
    { label: "Large", price: "$5.75" },
  ],
  dairyfree: [
    { label: "Mini", price: "$4.75" },
    { label: "Small", price: "$5.75" },
    { label: "Large", price: "$6.75" },
  ],
  adult: [
    { label: "Mini", price: "$5.75" },
    { label: "Small", price: "$6.75" },
    { label: "Large", price: "$7.75" },
  ],
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

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
