import type { Size } from "@/lib/domain";

/**
 * THE PRESETS: what kind of business this is, as data.
 *
 * Kevin named the feature walking the Cascarelli's install: "we should have
 * some sort of setup page where we select what sort of business this is and
 * these little things change accordingly." The little things turned out to
 * be five env vars plus a copy flag, discovered one pasted screenshot at a
 * time; this file is all of them in one place per business type, so the
 * setup page (and we, and a future preset) have one thing to point at.
 *
 * CLIENT-SAFE, deliberately: pure data, no env reads, no server imports.
 * The setup page renders these cards in the browser, and vertical.ts layers
 * env and the store on top server-side.
 *
 * Nouns carry a PREPOSITION because the surfaces differ grammatically:
 * things sit IN a case or a cooler but ON a board. "Cooler" itself is
 * Kevin's word for the tavern list, which is why presets carry their own
 * nouns instead of one neutral fallback.
 */

export type Category = { key: string; label: string };

export type VerticalNouns = {
  /** One thing: "flavor", "drink", "item". Lowercase; copy capitalizes. */
  item: string;
  /** The display the customers read: "case", "cooler", "board". */
  surface: string;
  /** "in" the case/cooler, "on" the board. */
  prep: "in" | "on";
  /**
   * The word for "on offer right now" when the trade has one. A bar says a
   * drink is POURING, not "in the cooler" (Kevin, 2 Sep 2026, looking at
   * Copper's cocktails), so copy that has this word says "Pouring at
   * Copper Athletic Club" and "New drink, pouring at ..." instead of
   * composing around the surface noun. Lowercase gerund; copy capitalizes.
   * Not stored per business: resolveVertical reads it from the preset in
   * code, so a better word reaches every existing business on deploy.
   */
  live?: string;
};

/** "Pouring" as a screen title when the vertical has a live word, else "The cooler". */
export function surfaceTitle(n: VerticalNouns): string {
  return n.live ? n.live[0].toUpperCase() + n.live.slice(1) : `The ${n.surface}`;
}

export type PresetKey = "scoops" | "tavern" | "coffee" | "other";

export type VerticalConfig = {
  preset: PresetKey;
  categories: Category[];
  allergens: string[];
  /** Default price lists per category key; a missing key means none. */
  sizes: Record<string, Size[]>;
  /** Placeholder name in "new item" inputs. */
  example: string;
  /** Which verb set the admin speaks (scoop charm vs service neutral). */
  voice: "scoops" | "neutral";
  nouns: VerticalNouns;
};

export type Preset = Omit<VerticalConfig, "preset"> & {
  key: PresetKey;
  label: string;
  /** One line under the card title on the setup screen. */
  blurb: string;
  /** Whether choosing this preset seeds demo data into an empty library. */
  seeds: boolean;
  /**
   * Whether the owner's header offers the History screen. It is the
   * product's differentiator for a scoop shop rotating forty flavors (how
   * long each lasted, how often it came back); for a bar with sixteen
   * handles it is a screen nobody behind the bar opens (Kevin, 2 Sep 2026,
   * on Copper). The data keeps accruing either way; this is only the door.
   */
  history: boolean;
  /**
   * Whether the trade gets the public TV board at /board/{org}/{location}.
   * A scoop shop points an in-store screen at it; a bar whose website
   * already renders the feed has no screen to point (Kevin, 2 Sep 2026,
   * on Copper: "get rid of the tv board too"). Off means the header drops
   * the link AND the address 404s, so nothing lingers as a hidden page.
   */
  board: boolean;
  /**
   * Whether the item editor offers an ABV field. It was always on, which
   * put "ABV %" next to Blue Moon on an ice cream shop's screen (Kevin,
   * 4 Sep 2026, on True North). Only a bar prices alcohol by strength.
   * Read from the preset at resolve time like history and board, so the
   * field disappears for every existing scoop shop on deploy; any value
   * already stored is left alone and still rides the feed, because v1 is
   * additive only and a consumer may be rendering it.
   */
  abv: boolean;
};

export const PRESETS: Preset[] = [
  {
    key: "scoops",
    abv: false,
    history: true,
    board: true,
    label: "Scoop shop",
    blurb: "Ice cream boards: hand-scooped, soft serve, dairy free, adult.",
    categories: [
      { key: "handscooped", label: "Hand-Scooped" },
      { key: "softserve", label: "Soft Serve" },
      { key: "dairyfree", label: "Dairy Free & Sorbet" },
      { key: "adult", label: "Adult Flavors (21+)" },
    ],
    allergens: ["nuts", "gluten", "egg", "soy"],
    sizes: {
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
    },
    example: "Lemon Poppyseed",
    voice: "scoops",
    nouns: { item: "flavor", surface: "case", prep: "in" },
    seeds: true,
  },
  {
    key: "tavern",
    abv: true,
    label: "Bar / tavern",
    blurb: "Tap list and cooler: what's pouring, what's in cans, what's next.",
    categories: [
      { key: "taps", label: "On Tap" },
      { key: "cans", label: "Cans & Bottles" },
      { key: "na", label: "Non-Alcoholic" },
    ],
    // A tap list carries no allergen chips, and no invented pour prices:
    // real ones land per drink, or per category once the owner supplies them.
    allergens: [],
    sizes: {},
    example: "Bell's Two Hearted",
    voice: "neutral",
    nouns: { item: "drink", surface: "cooler", prep: "in", live: "pouring" },
    history: false,
    board: false,
    // No demo data: the only bar seed on file is Cascarelli's real ten-board
    // program, which does not fit the generic three boards here.
    seeds: false,
  },
  {
    key: "coffee",
    abv: false,
    history: true,
    board: true,
    label: "Coffee shop",
    blurb: "The rotating board: espresso drinks, brews, seasonal specials.",
    categories: [
      { key: "espresso", label: "Espresso" },
      { key: "brewed", label: "Brewed & Cold" },
      { key: "seasonal", label: "Seasonal Specials" },
    ],
    allergens: ["dairy", "nuts", "gluten", "soy"],
    // No invented latte prices either; sizes are added per drink.
    sizes: {},
    example: "Honey Lavender Latte",
    voice: "neutral",
    nouns: { item: "drink", surface: "board", prep: "on" },
    seeds: false,
  },
  {
    key: "other",
    abv: false,
    history: true,
    board: true,
    label: "Something else",
    blurb: "Any rotating menu. Name your own board and what you call a thing.",
    categories: [{ key: "menu", label: "On the Menu" }],
    allergens: ["nuts", "gluten", "egg", "soy"],
    sizes: {},
    example: "The Special",
    voice: "neutral",
    nouns: { item: "item", surface: "board", prep: "on" },
    seeds: false,
  },
];

export function presetByKey(key: string): Preset | null {
  return PRESETS.find((p) => p.key === key) ?? null;
}

/**
 * A VerticalConfig from a preset, the one construction the setup route and
 * org creation both need (it lived inline in the setup route until org
 * creation became its second caller; facts in one place).
 *
 * `categories` overrides the preset's board list wholesale: real installs
 * keep needing boards no preset carries (Cascarelli's runs ten, Copper AC
 * runs taps + cocktails), and an override at creation beats inventing a
 * preset per client. Overridden categories get NO default sizes (the
 * preset's size map is keyed to its own boards; carrying it over would
 * price unknown boards with someone else's numbers, the placeholder rule).
 */
export function configFromPreset(
  preset: Preset,
  overrides?: { categories?: Category[]; nouns?: VerticalNouns },
): VerticalConfig {
  const categories =
    overrides?.categories && overrides.categories.length > 0 ? overrides.categories : preset.categories;
  return {
    preset: preset.key,
    categories,
    allergens: preset.allergens,
    sizes: categories === preset.categories ? preset.sizes : {},
    example: preset.example,
    voice: preset.voice,
    nouns: overrides?.nouns ?? preset.nouns,
  };
}

/** The neutral fallback nouns, for env-pinned installs that set none. */
export const NEUTRAL_NOUNS: VerticalNouns = { item: "item", surface: "board", prep: "on" };
export const SCOOP_NOUNS: VerticalNouns = { item: "flavor", surface: "case", prep: "in" };
