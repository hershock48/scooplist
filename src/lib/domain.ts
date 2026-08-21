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
  /** Price by size. Seeded from the category default, editable per flavor. */
  sizes: Size[];
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

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
