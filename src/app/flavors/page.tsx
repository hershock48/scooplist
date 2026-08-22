import type { Metadata } from "next";
import { redirect } from "next/navigation";
import FlavorLibrary from "@/components/FlavorLibrary";
import AppHeader from "@/components/AppHeader";
import { blobToken } from "@/lib/blob";
import { isAuthed } from "@/lib/auth";
import { locations } from "@/lib/locations";
import { resolveVertical } from "@/lib/vertical";
import { seedIfEmpty } from "@/lib/seed";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const v = await resolveVertical();
  return { title: v.voice === "neutral" ? "The library" : "Flavor library" };
}

export default async function FlavorsPage() {
  if (!(await isAuthed())) redirect("/login");

  const v = await resolveVertical();
  if (v.setupPending) redirect("/setup");

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
      <AppHeader
        current="library"
        boardHref={`/board/${shops[0]?.id ?? ""}`}
        voice={v.voice}
        nouns={v.nouns}
      />

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold">
        {v.voice === "neutral"
          ? "Everything you have ever served"
          : "Every flavor you’ve ever churned"}
      </h1>
      <p className="mt-2 text-ink-soft">
        {v.voice === "neutral"
          ? `The ${v.nouns.surface} pulls from here. Photos, descriptions, and prices live on the ${v.nouns.item}, so they follow it everywhere it goes.`
          : "The case pulls from here. Photos, stories, allergens, and prices live on the flavor, so they follow it into every shop and every board."}
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
        categories={v.categories}
        allergenOptions={v.allergens}
        example={v.example}
        voice={v.voice}
        nouns={v.nouns}
        inCase={inCase}
      />
    </main>
  );
}
