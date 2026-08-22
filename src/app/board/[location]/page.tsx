import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import { locationById, locations } from "@/lib/locations";
import { seedIfEmpty } from "@/lib/seed";
import { CATEGORIES } from "@/lib/domain";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The TV board: what a shop points its in-store screen at, replacing the
 * rented signage tools. Dark, huge type, grouped by category.
 *
 * A plain meta refresh keeps it current, a TV stick's browser left running
 * for a week needs the dumbest possible update mechanism, not a websocket.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ location: string }> },
): Promise<Metadata> {
  const { location: slug } = await params;
  const location = locationById(slug);
  return { title: location ? `${location.name} board` : "Board" };
}

function ago(t: number | null): string {
  if (!t) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 1) return "updated just now";
  if (mins < 60) return `updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `updated ${hours}h ago` : `updated ${Math.round(hours / 24)}d ago`;
}

export default async function BoardPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location: slug } = await params;
  const location = locationById(slug);
  if (!location) notFound();

  await seedIfEmpty();
  const store = getStore();
  const [entries, flavors, updatedAt] = await Promise.all([
    store.listCase(location.id),
    store.listFlavors(),
    store.caseUpdatedAt(location.id),
  ]);
  const byId = new Map(flavors.map((f) => [f.id, f]));
  const boards = CATEGORIES.map((c) => ({
    ...c,
    flavors: entries
      .map((e) => byId.get(e.flavorId))
      .filter((f) => f && !f.retired && f.category === c.key)
      .map((f) => f!)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((b) => b.flavors.length > 0);

  const otherShops = locations().filter((l) => l.id !== location.id);

  return (
    <main className="bg-board min-h-screen px-8 py-10 text-cream">
      {/*
        In-place refresh with JS (no white flash, no axe-critical timed
        reload); a plain meta refresh only for the no-JS TV stick, where
        nobody is navigating anyway.
      */}
      <AutoRefresh seconds={60} />
      <noscript>
        <meta httpEquiv="refresh" content="60" />
      </noscript>

      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold">
          {location.name}, in the case
        </h1>
        <p className="text-lg text-cream/60">{ago(updatedAt)}</p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {boards.map((b) => (
          <section key={b.key} aria-labelledby={`b-${b.key}`}>
            <h2
              id={`b-${b.key}`}
              className="border-b-2 border-berry-bright pb-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-berry-bright"
            >
              {b.label}
            </h2>
            <ul className="mt-4 columns-1 gap-8 text-2xl leading-relaxed xl:columns-2">
              {b.flavors.map((f) => (
                <li key={f.id} className="flex items-baseline gap-3 break-inside-avoid">
                  <span className="font-medium">{f.name}</span>
                  {f.allergens.length > 0 ? (
                    <span className="text-base uppercase tracking-wide text-cream/50">
                      {f.allergens.map((a) => a[0].toUpperCase()).join(" ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 text-cream/50">
        <p className="text-lg">
          N nuts · G gluten · E egg · S soy. Ask us about anything.
        </p>
        {otherShops.length > 0 ? (
          <p className="text-sm">
            Also scooping: {otherShops.map((l) => l.name).join(", ")}
          </p>
        ) : null}
      </footer>
    </main>
  );
}
