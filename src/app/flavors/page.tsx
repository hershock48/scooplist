import Link from "next/link";
import { redirect } from "next/navigation";
import FlavorLibrary from "@/components/FlavorLibrary";
import ScooplistMark from "@/components/Logo";
import { blobToken } from "@/lib/blob";
import { isAuthed } from "@/lib/auth";
import { locations } from "@/lib/locations";
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
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/case"
          className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-bold text-berry"
        >
          <ScooplistMark size={30} />
          Scooplist
        </Link>
        <nav className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/case" className="text-ink-soft underline-offset-4 hover:text-berry hover:underline">
            The case
          </Link>
          <span aria-current="page" className="text-ink">
            Library
          </span>
          <form method="post" action="/api/logout">
            <button type="submit" className="text-ink-soft underline-offset-4 hover:text-berry hover:underline">
              Sign out
            </button>
          </form>
        </nav>
      </header>

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

      <FlavorLibrary flavors={flavors} shops={shops} inCase={inCase} />
    </main>
  );
}
