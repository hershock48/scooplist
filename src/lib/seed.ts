import "server-only";

import { newId, type Allergen, type CategoryKey, type Flavor } from "@/lib/domain";
import { categories, defaultSizesFor } from "@/lib/vertical";
import { getStore } from "@/lib/store";
import { locations } from "@/lib/locations";
import { BAR_SEED, BAR_SEED_KEYS } from "@/lib/seed-bar";

/**
 * First-run seed: True North's real board (their site, August 2026), so the
 * demo the owner sees is his own case, not lorem ipsum. Runs once, only when
 * the library is empty; a cleared database reseeds, a working one is never
 * touched. Soft serve lands only in Marshall's case, the machine is theirs.
 */

type SeedRow = [
  name: string,
  category: CategoryKey,
  allergens?: Allergen[],
  description?: string,
  producer?: string,
];

const SEED: SeedRow[] = [
  ["Birthday Cake", "handscooped"],
  ["Biscoff Cookie Butter", "handscooped", ["gluten"]],
  ["Blue Moon", "handscooped"],
  ["Butter Pecan", "handscooped", ["nuts"]],
  // Collaborators are STRUCTURED (producer), not buried in the prose where
  // nothing can style, filter, link, or count them. The description still
  // reads well on its own; the field is what the boards and feeds use.
  ["Cascarelli Cashew", "handscooped", ["nuts"], "Made with the famous nuts from Cascarelli's of Homer.", "Cascarelli's of Homer"],
  ["Chocolate", "handscooped"],
  ["Chocolate Avalanche", "handscooped", ["gluten"]],
  ["Cookie Dough", "handscooped", ["gluten"]],
  ["Coffee Crunch", "handscooped", ["nuts"]],
  ["Dark Cherry Chip", "handscooped"],
  ["Lemon", "handscooped"],
  ["Mint Chip", "handscooped"],
  ["Old Pan Toffee", "handscooped", ["nuts"], "A collaboration with Old Pan Toffee, made down the road.", "Old Pan Toffee"],
  ["Oreo", "handscooped", ["gluten"]],
  ["Peanut Butter Cup", "handscooped", ["nuts"]],
  ["Raspberry Chip", "handscooped"],
  ["Snickers", "handscooped", ["nuts"]],
  ["Strawberry", "handscooped"],
  ["Totally Coconut", "handscooped", ["nuts"]],
  ["Vanilla Bean", "handscooped"],
  ["Black Cherry", "softserve"],
  ["Blue Goo", "softserve"],
  ["Bubble Gum", "softserve"],
  ["Butter Pecan Soft Serve", "softserve", ["nuts"]],
  ["Chocolate Soft Serve", "softserve"],
  ["Cool Lemon", "softserve"],
  ["Green Apple", "softserve"],
  ["Raspberry", "softserve"],
  ["Strawberry Soft Serve", "softserve"],
  ["Twist", "softserve"],
  ["Vanilla", "softserve"],
  ["Bailey Mountain", "adult"],
  ["Cherry Amaretto", "adult"],
  ["Honey Bourbon", "adult"],
  ["Rum Chatta", "adult"],
  ["True North Slide", "adult"],
  ["Dark Cherry Sorbet", "dairyfree"],
  ["Vegan Chocolate", "dairyfree", undefined, "Vegan."],
  ["Pumpkin Pie", "dairyfree"],
  ["Dairy Free Strawberry", "dairyfree"],
  ["Strawberry Lemonade Sorbet", "dairyfree"],
];

export async function seedIfEmpty(): Promise<void> {
  /*
    Three layers, cheapest first: a per-process flag (free after the first
    hit), a SELECT 1 probe (never the full jsonb library, inline photos make
    that megabytes), and the store's once() guard with a re-check inside, so
    two cold instances racing a fresh database cannot both seed it.
  */
  const g = globalThis as typeof globalThis & { __scooplistSeeded?: boolean };
  if (g.__scooplistSeeded) return;

  /*
    Which vertical's demo data fits this deployment:
    - Default (no custom categories): True North's ICE CREAM board.
    - Categories covering the full tavern contract: Cascarelli's BAR
      program (seed-bar.ts) - same precedent, the first client of the
      vertical is its demo data.
    - Any other custom categories: start empty. Rows whose categories
      match none of the boards would be invisible on every screen and
      still pollute the library and the picker.
  */
  let seedFn: (() => Promise<void>) | null = seed;
  if (process.env.SCOOPLIST_CATEGORIES) {
    const keys = new Set(categories().map((c) => c.key));
    seedFn = BAR_SEED_KEYS.every((k) => keys.has(k)) ? seedBar : null;
  }
  if (!seedFn) {
    g.__scooplistSeeded = true;
    return;
  }
  const run = seedFn;

  const store = getStore();
  if (await store.hasAnyFlavors()) {
    g.__scooplistSeeded = true;
    return;
  }

  await store.once(async () => {
    if (await store.hasAnyFlavors()) return;
    await run();
  });
  g.__scooplistSeeded = true;
}

/** The tavern seed: every row into the library and every shop's case, in
    menu order (positions set, so the boards match the printed lists rather
    than going alphabetical). */
async function seedBar(): Promise<void> {
  const store = getStore();
  const now = Date.now();
  const shops = locations();

  const ids: string[] = [];
  for (const row of BAR_SEED) {
    const flavor: Flavor = {
      id: newId("flv"),
      name: row.name,
      description: row.description,
      category: row.category,
      allergens: [],
      tags: row.tags,
      producer: row.producer,
      abv: row.abv,
      photoUrl: "",
      sizes: row.sizes,
      retired: false,
      createdAt: now,
    };
    await store.upsertFlavor(flavor);
    ids.push(flavor.id);
  }

  for (const shop of shops) {
    for (let i = 0; i < ids.length; i += 1) {
      await store.addToCase({
        id: newId("case"),
        locationId: shop.id,
        flavorId: ids[i],
        addedAt: now,
        removedAt: null,
        position: i,
      });
    }
  }
}

async function seed(): Promise<void> {
  const store = getStore();
  const now = Date.now();
  const shops = locations();
  const ids: { id: string; category: CategoryKey }[] = [];

  for (const [name, category, allergens, description, producer] of SEED) {
    const flavor: Flavor = {
      id: newId("flv"),
      name,
      description: description ?? "",
      category,
      allergens: allergens ?? [],
      tags: category === "dairyfree" ? ["dairy free"] : [],
      producer: producer ?? "",
      photoUrl: "",
      sizes: defaultSizesFor(category),
      retired: false,
      createdAt: now,
    };
    await store.upsertFlavor(flavor);
    ids.push({ id: flavor.id, category });
  }

  for (const shop of shops) {
    for (const { id, category } of ids) {
      // The soft serve machine is Marshall's (Choose Marshall article),
      // the one seeded per-shop difference, and the demo's proof the app
      // understands that shops differ.
      if (category === "softserve" && shop.id !== "marshall") continue;
      await store.addToCase({
        id: newId("case"),
        locationId: shop.id,
        flavorId: id,
        addedAt: now,
        removedAt: null,
      });
    }
  }
}
