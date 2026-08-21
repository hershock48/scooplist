import Link from "next/link";
import { redirect } from "next/navigation";
import CaseBoard from "@/components/CaseBoard";
import ScooplistMark from "@/components/Logo";
import { isAuthed } from "@/lib/auth";
import { locations } from "@/lib/locations";
import { seedIfEmpty } from "@/lib/seed";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "The case" };

export default async function CasePage() {
  if (!(await isAuthed())) redirect("/login");

  await seedIfEmpty();
  const store = getStore();
  const shops = locations();
  const flavors = await store.listFlavors();
  const caseByShop: Record<string, { flavorId: string; addedAt: number }[]> = {};
  for (const shop of shops) {
    caseByShop[shop.id] = (await store.listCase(shop.id)).map((e) => ({
      flavorId: e.flavorId,
      addedAt: e.addedAt,
    }));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/case"
          className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-bold text-berry"
        >
          <ScooplistMark size={30} />
          Scooplist
        </Link>
        <nav className="flex items-center gap-4 text-sm font-semibold">
          <span aria-current="page" className="text-ink">
            The case
          </span>
          <Link href="/flavors" className="text-ink-soft underline-offset-4 hover:text-berry hover:underline">
            Library
          </Link>
          <Link
            href={`/board/${shops[0]?.id ?? ""}`}
            target="_blank"
            rel="noopener"
            className="text-ink-soft underline-offset-4 hover:text-berry hover:underline"
          >
            TV board ↗
          </Link>
        </nav>
      </header>

      {/* Shop voice out front; the Vercel specifics live in the README for
          the person who can actually act on them. */}
      {store.backend === "memory" ? (
        <p className="card mt-4 border-berry/40 bg-berry/5 px-4 py-3 text-sm font-medium text-berry">
          Demo mode: changes here aren&apos;t saved permanently yet. Ask your
          web person to switch on storage — it&apos;s one click for them.
        </p>
      ) : null}

      <CaseBoard shops={shops} flavors={flavors} caseByShop={caseByShop} />
    </main>
  );
}
