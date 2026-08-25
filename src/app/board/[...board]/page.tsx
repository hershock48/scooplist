import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import { byCaseOrder, type CaseEntry, type Flavor } from "@/lib/domain";
import { DEFAULT_ORG, orgBySlug, orgMode, type Org } from "@/lib/org";
import { resolveVertical } from "@/lib/vertical";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The TV board: what a shop points its in-store screen at, replacing the
 * rented signage tools. Dark, huge type, grouped by category.
 *
 * A plain meta refresh keeps it current, a TV stick's browser left running
 * for a week needs the dumbest possible update mechanism, not a websocket.
 *
 * ONE CATCH-ALL ROUTE for both deployment modes, because Next.js refuses
 * sibling dynamic segments with different names (/board/[location] beside
 * /board/[org]/[location] is a build error, not an ambiguity):
 *
 *   /board/{location}        legacy single-tenant installs, the URL every
 *                            live TV stick already has bookmarked
 *   /board/{org}/{location}  the org-mode deployment
 *
 * Each mode 404s the other's depth, so a legacy install never answers for
 * an org and the central deployment never guesses one.
 *
 * NO SEED CALL and NO unhandled store errors, both deliberate: this route
 * is public (so a stranger's GET must not perform the first database
 * write), and it renders on a screen customers are looking at during
 * service. A database blip therefore degrades to a calm "back in a moment"
 * with the refresh still armed, never Next's error page. That is this
 * product's worst failure mode and the consumer sites already behave this
 * way (truenorth's liveCase.ts falls back rather than failing).
 */

type Params = { board: string[] };

async function resolveBoard(segs: string[]): Promise<{ org: Org; locationSlug: string } | null> {
  if (segs.length === 1) {
    if (orgMode()) return null;
    const org = await orgBySlug(DEFAULT_ORG);
    return org ? { org, locationSlug: segs[0] } : null;
  }
  if (segs.length === 2) {
    const org = await orgBySlug(segs[0]);
    return org ? { org, locationSlug: segs[1] } : null;
  }
  return null;
}

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { board: segs } = await params;
  const resolved = await resolveBoard(segs);
  const location = resolved?.org.locations.find((l) => l.id === resolved.locationSlug);
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

function BoardShell({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <main className="bg-board min-h-screen px-8 py-10 text-cream">
      {/* The refresh stays armed even on the failure path: recovery is the
          next 60s tick, with no one touching the TV. */}
      <AutoRefresh seconds={60} />
      <noscript>
        <meta httpEquiv="refresh" content="60" />
      </noscript>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold">
          {heading}
        </h1>
      </header>
      {children}
    </main>
  );
}

export default async function BoardPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { board: segs } = await params;
  const resolved = await resolveBoard(segs);
  if (!resolved) notFound();
  const { org, locationSlug } = resolved;
  const location = org.locations.find((l) => l.id === locationSlug);
  if (!location) notFound();

  /*
    The heading speaks the vertical: "Marshall, in the case" but
    "Cascarelli's, in the cooler" (his word for it). resolveVertical never
    throws, its own store failure degrades to the scoops defaults, so it
    is safe to call before the try below.
  */
  const vHead = await resolveVertical(org.slug);
  const heading = `${location.name}, ${vHead.nouns.prep} the ${vHead.nouns.surface}`;

  const store = getStore();
  let entries: CaseEntry[];
  let flavors: Flavor[];
  let updatedAt: number | null;
  try {
    [entries, flavors, updatedAt] = await Promise.all([
      store.listCase(org.slug, location.id),
      store.listFlavors(org.slug),
      store.caseUpdatedAt(org.slug, location.id),
    ]);
  } catch {
    // The next tick (60s) retries; the screen never shows a stack trace.
    return (
      <BoardShell heading={heading}>
        <p className="mt-10 text-2xl text-cream/60">
          The board is catching its breath, back in a moment.
        </p>
      </BoardShell>
    );
  }

  const byId = new Map(flavors.map((f) => [f.id, f]));
  const live = entries
    .map((e) => ({ entry: e, flavor: byId.get(e.flavorId) }))
    .filter((x): x is { entry: CaseEntry; flavor: Flavor } => Boolean(x.flavor && !x.flavor.retired));

  const v = vHead;
  const boards = v.categories
    .map((c) => ({
      ...c,
      items: live
        .filter((x) => x.entry.status !== "ondeck" && x.flavor.category === c.key)
        .map((x) => ({ ...x.flavor, position: x.entry.position, low: x.entry.status === "low" }))
        .sort(byCaseOrder),
    }))
    .filter((b) => b.items.length > 0);

  const onDeck = live
    .filter((x) => x.entry.status === "ondeck")
    .map((x) => ({ ...x.flavor, position: x.entry.position }))
    .sort(byCaseOrder);

  const otherShops = org.locations.filter((l) => l.id !== location.id);

  /*
    The legend is built from the CONFIGURED allergens, not a hardcoded ice
    cream sentence, so a deployment with different allergens (or none, a
    tap list) reads correctly on its own screen.
  */
  const legend = v.allergens;

  return (
    <main className="bg-board min-h-screen px-8 py-10 text-cream">
      <AutoRefresh seconds={60} />
      <noscript>
        <meta httpEquiv="refresh" content="60" />
      </noscript>

      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold">
          {heading}
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
              {b.items.map((f) => (
                <li key={f.id} className="break-inside-avoid">
                  <span className="flex items-baseline gap-3">
                    <span className="font-medium">{f.name}</span>
                    {f.abv ? (
                      <span className="text-base text-cream/50">{f.abv}%</span>
                    ) : null}
                    {f.allergens.length > 0 ? (
                      <span className="text-base uppercase tracking-wide text-cream/50">
                        {f.allergens.map((a) => a[0].toUpperCase()).join(" ")}
                      </span>
                    ) : null}
                    {f.low ? (
                      <span className="text-base font-semibold uppercase tracking-wide text-berry-bright">
                        last call
                      </span>
                    ) : null}
                  </span>
                  {/* Skip the credit when it just repeats the flavor's own
                      name (Old Pan Toffee, by Old Pan Toffee). */}
                  {f.producer && f.producer.toLowerCase() !== f.name.toLowerCase() ? (
                    <span className="block text-base text-cream/50">{f.producer}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {onDeck.length > 0 ? (
        <section aria-labelledby="b-ondeck" className="mt-10">
          <h2
            id="b-ondeck"
            className="border-b-2 border-cream/30 pb-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-cream/70"
          >
            On deck
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-2xl leading-relaxed text-cream/70">
            {onDeck.map((f) => (
              <li key={f.id}>
                {f.name}
                {f.producer ? <span className="text-base text-cream/40"> · {f.producer}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 text-cream/50">
        {legend.length > 0 ? (
          <p className="text-lg">
            {legend.map((a) => `${a[0].toUpperCase()} ${a}`).join(" · ")}. Ask us about anything.
          </p>
        ) : (
          <p className="text-lg">Ask us about anything.</p>
        )}
        {otherShops.length > 0 ? (
          <p className="text-sm">
            {/* "Also scooping" is scoop vocabulary; everyone else "also pours"
                nothing, they just have other locations. */}
            {v.voice === "scoops" ? "Also scooping: " : "Also at: "}
            {otherShops.map((l) => l.name).join(", ")}
          </p>
        ) : null}
      </footer>
    </main>
  );
}
