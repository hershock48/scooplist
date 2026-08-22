import type { Size } from "@/lib/domain";

/**
 * THE VERTICAL: what kind of things this deployment lists.
 *
 * Scooplist shipped with ice cream frozen into domain.ts, and the first
 * question a second vertical asked (Cascarelli's tavern, twenty taps) was
 * "why is Soft Serve in my beer app?" locations.ts had already solved this
 * exact problem for shops, read the env, default to True North, so this
 * file does the same thing one concept over: categories, allergens, and
 * the default size/price lists are a dashboard edit, not a fork.
 *
 * Nothing set = exactly the ice cream values that used to be hardcoded, so
 * every existing deployment behaves identically until someone chooses
 * otherwise.
 *
 *   SCOOPLIST_CATEGORIES   key:Label pairs, comma-separated.
 *                          taps:On Tap,cans:Cans & Bottles,na:Non-Alcoholic
 *   SCOOPLIST_ALLERGENS    plain comma list. For a bar, likely empty: set
 *                          it to "-" to mean "none" (an empty var means
 *                          "use the default", the locations.ts convention).
 *   SCOOPLIST_SIZES        default price lists per category key:
 *                          taps=Half:$4|Pint:$7|Flight:$12;cans=Can:$5
 *
 * SERVER-SIDE ONLY: pages and routes read these and hand them to the
 * client components as props. A client bundle only inlines NEXT_PUBLIC_
 * vars, so importing this from a "use client" file would silently give
 * every visitor the defaults.
 */

export type Category = { key: string; label: string };

const DEFAULT_CATEGORIES: Category[] = [
  { key: "handscooped", label: "Hand-Scooped" },
  { key: "softserve", label: "Soft Serve" },
  { key: "dairyfree", label: "Dairy Free & Sorbet" },
  { key: "adult", label: "Adult Flavors (21+)" },
];

const DEFAULT_ALLERGENS = ["nuts", "gluten", "egg", "soy"];

const DEFAULT_SIZES: Record<string, Size[]> = {
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

export function categories(): Category[] {
  const raw = process.env.SCOOPLIST_CATEGORIES;
  if (!raw) return DEFAULT_CATEGORIES;
  const parsed = raw
    .split(",")
    .map((pair) => {
      const [key, ...label] = pair.split(":");
      return { key: key.trim(), label: label.join(":").trim() || key.trim() };
    })
    .filter((c) => c.key);
  return parsed.length > 0 ? parsed : DEFAULT_CATEGORIES;
}

export function categoryByKey(key: string): Category | null {
  return categories().find((c) => c.key === key) ?? null;
}

export function allergens(): string[] {
  const raw = process.env.SCOOPLIST_ALLERGENS;
  if (!raw) return DEFAULT_ALLERGENS;
  // "-" = deliberately none; a bar has no allergen chips to offer.
  if (raw.trim() === "-") return [];
  return raw
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

/** The starting price list for a category: env override, else ice cream. */
export function defaultSizesFor(categoryKey: string): Size[] {
  const raw = process.env.SCOOPLIST_SIZES;
  if (raw) {
    for (const block of raw.split(";")) {
      const [key, list] = block.split("=");
      if (key?.trim() !== categoryKey || !list) continue;
      const sizes = list
        .split("|")
        .map((pair) => {
          const [label, ...price] = pair.split(":");
          return { label: label.trim(), price: price.join(":").trim() };
        })
        .filter((s) => s.label && s.price);
      if (sizes.length > 0) return sizes;
    }
  }
  return DEFAULT_SIZES[categoryKey] ?? DEFAULT_SIZES.handscooped;
}
