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

/**
 * The example name shown in "new item" placeholders. "Lemon Poppyseed" on a
 * BAR deployment was the first thing the owner noticed, so the example
 * follows the vertical like everything else here. Ice cream by default.
 *
 *   SCOOPLIST_EXAMPLE=Bell's Two Hearted
 */
export function exampleItem(): string {
  return process.env.SCOOPLIST_EXAMPLE?.trim() || "Lemon Poppyseed";
}

/**
 * Which copy voice the admin speaks. The action sheet said "Tub's empty"
 * over a bottle of Pinot Grigio on the tavern install, which is how this
 * earned its place next to exampleItem(): verbs are vertical too. A
 * deployment with its own categories gets neutral service-industry wording;
 * the default vertical keeps the scoop-shop charm. Client components get
 * this as a prop (a string flag, since functions cannot cross the
 * server-to-client boundary).
 */
export function voice(): "scoops" | "neutral" {
  return process.env.SCOOPLIST_CATEGORIES ? "neutral" : "scoops";
}

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

/**
 * The starting price list for a category: env override, else ice cream.
 *
 * "-" means DELIBERATELY NONE, the allergens() convention: a bare
 * SCOOPLIST_SIZES=- gives every category no default prices, and a block
 * whose list is "-" (taps=-) does the same for that one category. Both
 * are checked BEFORE the pipe-parse on purpose, "-" parses to zero valid
 * sizes and would otherwise fall through to the ice cream list, which is
 * exactly the bug this mode exists to prevent (a 7% IPA priced
 * Mini/Small/Large, observed on the Cascarelli's test instance). A bar
 * with no size pricing sets "-" instead of inventing prices, and a
 * flavor that still needs one (a rare bottle) gets it per flavor in the
 * library.
 */
export function defaultSizesFor(categoryKey: string): Size[] {
  const raw = process.env.SCOOPLIST_SIZES?.trim();
  if (raw === "-") return [];
  if (raw) {
    for (const block of raw.split(";")) {
      const [key, list] = block.split("=");
      if (key?.trim() !== categoryKey || list === undefined) continue;
      if (list.trim() === "-") return [];
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
  /*
    The ice cream lists are only a sensible default for the ice cream
    vertical. A deployment that configured its own categories gets NO
    guessed prices for a category it did not price, a placeholder-rule
    call: silence beats an invented number that reads as real. (This is
    also the belt to "-"'s suspenders: the observed bug happened on a bar
    instance with SCOOPLIST_SIZES entirely unset.)
  */
  if (process.env.SCOOPLIST_CATEGORIES) return DEFAULT_SIZES[categoryKey] ?? [];
  return DEFAULT_SIZES[categoryKey] ?? DEFAULT_SIZES.handscooped;
}
