import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { boardHref, currentOrg, orgMode } from "@/lib/org";
import { resolveVertical } from "@/lib/vertical";
import type { CaseEntry, Flavor } from "@/lib/domain";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "History" };

/**
 * THE DIFFERENTIATOR, finally on a screen. Case entries close instead of
 * deleting, which means the database has held a full timeline from day one
 * that nothing read. This page reads it: how long flavors last, how often
 * they come back, what share of recent days they were on the board. These
 * are answers signage products do not have the data for and a POS does not
 * track, and they are the honest reply to "why not just use Taplist.io".
 *
 * Deliberately plain math over the rows the store already keeps: no new
 * tables, no counters to maintain, nothing to drift.
 */

const WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

type Row = {
  flavor: Flavor;
  runs: number;
  totalDays: number;
  windowShare: number;
  openNow: boolean;
  lastSeen: number;
};

function rowsFor(shopId: string, entries: CaseEntry[], byId: Map<string, Flavor>, now: number): Row[] {
  const windowStart = now - WINDOW_DAYS * DAY_MS;
  const perFlavor = new Map<string, CaseEntry[]>();
  for (const e of entries) {
    if (e.locationId !== shopId) continue;
    const list = perFlavor.get(e.flavorId) ?? [];
    list.push(e);
    perFlavor.set(e.flavorId, list);
  }

  const rows: Row[] = [];
  for (const [flavorId, list] of perFlavor) {
    const flavor = byId.get(flavorId);
    if (!flavor) continue;
    let totalMs = 0;
    let windowMs = 0;
    let openNow = false;
    let lastSeen = 0;
    for (const e of list) {
      const end = e.removedAt ?? now;
      totalMs += end - e.addedAt;
      windowMs += Math.max(0, Math.min(end, now) - Math.max(e.addedAt, windowStart));
      if (e.removedAt === null) openNow = true;
      lastSeen = Math.max(lastSeen, end);
    }
    rows.push({
      flavor,
      runs: list.length,
      totalDays: Math.round(totalMs / DAY_MS),
      windowShare: Math.min(100, Math.round((windowMs / (WINDOW_DAYS * DAY_MS)) * 100)),
      openNow,
      lastSeen,
    });
  }
  return rows.sort((a, b) => b.totalDays - a.totalDays || a.flavor.name.localeCompare(b.flavor.name));
}

function since(t: number, now: number): string {
  const days = Math.round((now - t) / DAY_MS);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}

export default async function HistoryPage() {
  const org = await currentOrg();
  if (!org) redirect("/login");

  const v = await resolveVertical(org.slug);
  if (v.setupPending) redirect("/setup");

  const store = getStore();
  const now = Date.now();
  const shops = org.locations;
  const [flavors, entries] = await Promise.all([
    store.listFlavors(org.slug),
    store.listEntries(org.slug),
  ]);
  const byId = new Map(flavors.map((f) => [f.id, f]));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <AppHeader
        current="history"
        boardHref={boardHref(org, shops[0]?.id ?? "")}
        voice={v.voice}
        nouns={v.nouns}
        orgName={orgMode() ? org.name : undefined}
      />

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold">
        What the {v.nouns.surface} remembers
      </h1>
      {/* Say what each column MEANS, in the sentence, not in a tooltip: the
          owner's first reaction to this page was "no clue what it's
          tracking". */}
      <p className="mt-2 text-ink-soft">
        Everything that has ever been on a board, and how it did.{" "}
        <span className="font-semibold">Times on</span> is how often it went
        on, <span className="font-semibold">days total</span> is how long it
        stayed across all of those runs, and{" "}
        <span className="font-semibold">last {WINDOW_DAYS} days</span> is the
        share of the last {WINDOW_DAYS} days it was available. Nothing is
        ever deleted, so this is the whole record.
      </p>

      {store.backend === "memory" ? (
        <p className="card mt-4 border-berry/40 bg-berry/5 px-4 py-3 text-sm font-medium text-berry">
          Demo mode: history only accumulates once storage is on.
        </p>
      ) : null}

      {shops.map((shop) => {
        const rows = rowsFor(shop.id, entries, byId, now);
        return (
          <section key={shop.id} aria-labelledby={`h-${shop.id}`} className="mt-8">
            <h2 id={`h-${shop.id}`} className="font-[family-name:var(--font-display)] text-xl font-semibold">
              {shop.name}
            </h2>
            {rows.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No history at {shop.name} yet.</p>
            ) : (
              /* Focusable: a keyboard has to be able to scroll the table on
                 a narrow screen, axe scrollable-region-focusable. */
              <div
                className="card mt-3 overflow-x-auto"
                tabIndex={0}
                role="region"
                aria-labelledby={`h-${shop.id}`}
              >
                <table className="w-full min-w-[540px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-soft">
                      <th scope="col" className="px-4 py-3 font-semibold">
                        {v.nouns.item.charAt(0).toUpperCase() + v.nouns.item.slice(1)}
                      </th>
                      <th scope="col" className="px-3 py-3 font-semibold">Times on</th>
                      <th scope="col" className="px-3 py-3 font-semibold">Days total</th>
                      <th scope="col" className="px-3 py-3 font-semibold">Last {WINDOW_DAYS} days</th>
                      <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/5">
                    {rows.map((r) => (
                      <tr key={r.flavor.id}>
                        <th scope="row" className="px-4 py-2.5 text-left font-semibold">
                          {r.flavor.name}
                          {r.flavor.retired ? (
                            <span className="ml-2 text-xs font-normal text-ink-soft">retired</span>
                          ) : null}
                        </th>
                        <td className="px-3 py-2.5">{r.runs}</td>
                        <td className="px-3 py-2.5">{r.totalDays}</td>
                        <td className="px-3 py-2.5">{r.windowShare}%</td>
                        <td className="px-3 py-2.5 text-ink-soft">
                          {r.openNow ? "On the board now" : `Off since ${since(r.lastSeen, now)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {/* The way out, next to the record it exports. */}
      <p className="mt-10 text-sm text-ink-soft">
        This is your data.{" "}
        <a
          href="/api/admin/export"
          className="font-semibold text-berry underline-offset-4 hover:underline"
        >
          Download all of it as one file
        </a>
        , the whole library and every day of history, whenever you like.
      </p>
    </main>
  );
}
