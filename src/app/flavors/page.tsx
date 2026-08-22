import Link from "next/link";
import { redirect } from "next/navigation";
import FlavorLibrary from "@/components/FlavorLibrary";
import AppHeader from "@/components/AppHeader";
import { blobToken } from "@/lib/blob";
import { isAuthed } from "@/lib/auth";
import { locations } from "@/lib/locations";
import { allergens, categories, exampleItem } from "@/lib/vertical";
import { seedIfEmpty } from "@/lib/seed";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Flavor library" };

export default async function FlavorsPage() {
  if (!(await isAuthed())) redirect("/login");

  await seedIfEmpty();
  const store = getStore();
  const flavors = await store.listFlavors();
  /*
    Which shops have each flavor out right now. The library without this is a
    filing cabinet; with it, it is a picture of the business.
  */
  const shops = locations();
  const inCase: Record<string, string[]> = {};
  for (const shop of shops) {
    for (const entry of await store.listCase(shop.id)) {
      (inCase[entry.flavorId] ??= []).push(shop.id);
    }
  }
  const blobConfigured = Boolean(blobToken());

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <AppHeader current="library" boardHref={`/board/${shops[0]?.id ?? ""}`} />

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold">
        Every flavor you&apos;ve ever churned
      </h1>
      <p className="mt-2 text-ink-soft">
        The case pulls from here. Photos, stories, allergens, and prices live
        on the flavor, so they follow it into every shop and every board.
      </p>
      {!blobConfigured ? (
        <p className="card mt-4 border-berry/40 bg-berry/5 px-4 py-3 text-sm font-medium text-berry">
          Demo mode for photos: they&apos;ll work, but ask your web person to
          switch on photo storage before loading in the whole menu.
        </p>
      ) : null}

      <FlavorLibrary
        flavors={flavors}
        shops={shops}
        categories={categories()}
        allergenOptions={allergens()}
        example={exampleItem()}
        inCase={inCase}
      />
    </main>
  );
}
