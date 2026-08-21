import "server-only";

import { DEFAULT_SIZES, newId, type Allergen, type CategoryKey, type Flavor } from "@/lib/domain";
import { getStore } from "@/lib/store";
import { locations } from "@/lib/locations";

/**
 * First-run seed: True North's real board (their site, August 2026), so the
 * demo the owner sees is his own case, not lorem ipsum. Runs once, only when
 * the library is empty; a cleared database reseeds, a working one is never
 * touched. Soft serve lands only in Marshall's case — the machine is theirs.
 */

type SeedRow = [name: string, category: CategoryKey, allergens?: Allergen[], description?: string];

const SEED: SeedRow[] = [
  ["Birthday Cake", "handscooped"],
  ["Biscoff Cookie Butter", "handscooped", ["gluten"]],
  ["Blue Moon", "handscooped"],
  ["Butter Pecan", "handscooped", ["nuts"]],
  ["Cascarelli Cashew", "handscooped", ["nuts"], "Made with the famous nuts from Cascarelli's of Homer."],
  ["Chocolate", "handscooped"],
  ["Chocolate Avalanche", "handscooped", ["gluten"]],
  ["Cookie Dough", "handscooped", ["gluten"]],
  ["Coffee Crunch", "handscooped", ["nuts"]],
  ["Dark Cherry Chip", "handscooped"],
  ["Lemon", "handscooped"],
  ["Mint Chip", "handscooped"],
  ["Old Pan Toffee", "handscooped", ["nuts"], "A collaboration with Old Pan Toffee, made down the road."],
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
    hit), a SELECT 1 probe (never the full jsonb library — inline photos make
    that megabytes), and the store's once() guard with a re-check inside, so
    two cold instances racing a fresh database cannot both seed it.
  */
  const g = globalThis as typeof globalThis & { __scooplistSeeded?: boolean };
  if (g.__scooplistSeeded) return;

  const store = getStore();
  if (await store.hasAnyFlavors()) {
    g.__scooplistSeeded = true;
    return;
  }

  await store.once(async () => {
    if (await store.hasAnyFlavors()) return;
    await seed();
  });
  g.__scooplistSeeded = true;
}

async function seed(): Promise<void> {
  const store = getStore();
  const now = Date.now();
  const shops = locations();
  const ids: { id: string; category: CategoryKey }[] = [];

  for (const [name, category, allergens, description] of SEED) {
    const flavor: Flavor = {
      id: newId("flv"),
      name,
      description: description ?? "",
      category,
      allergens: allergens ?? [],
      tags: category === "dairyfree" ? ["dairy free"] : [],
      photoUrl: "",
      sizes: DEFAULT_SIZES[category],
      retired: false,
      createdAt: now,
    };
    await store.upsertFlavor(flavor);
    ids.push({ id: flavor.id, category });
  }

  for (const shop of shops) {
    for (const { id, category } of ids) {
      // The soft serve machine is Marshall's (Choose Marshall article) —
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
