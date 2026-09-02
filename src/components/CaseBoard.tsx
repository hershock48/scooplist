"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SwipeCard from "@/components/SwipeCard";
import { byCaseOrder, type CaseStatus, type CategoryKey, type Flavor } from "@/lib/domain";
import type { Category, VerticalNouns } from "@/lib/presets";
import type { ShopLocation } from "@/lib/locations";

/**
 * The owner's screen. One rule shaped every choice: the user is standing at
 * the dipping cabinet with cold hands and a line.
 *
 *  - Pulling a tub is a swipe (or a tap, or a keypress) and then a confirm.
 *    Never a bare gesture, a mis-swipe must not silently change the menu a
 *    customer is reading.
 *  - Every board carries its own "+" pill, so restocking hand-scooped shows
 *    hand-scooped and nothing else. Boards with nothing in them still show
 *    their pill, because that is exactly when you need it.
 *  - Every mutation runs through post(), which owns the double-tap latch
 *    (a ref, synchronous, state is too slow for two taps in one tick), the
 *    401 walk back to /login, and errors rendered INSIDE the open sheet,
 *    because behind the backdrop is where failures go to be missed.
 *  - Categories arrive as a PROP (env-configured per deployment, vertical.ts),
 *    never imported: a client bundle cannot read the server's env, so an
 *    import here would silently show every deployment the ice cream boards.
 *  - Reordering is arrows in a dedicated mode, not drag. Drag would fight
 *    the swipe-to-remove gesture for the same touches, and arrows work from
 *    a keyboard and a screen reader for free. The order is the WALL's order:
 *    tap seven, third tub from the left.
 */

type CaseEntryLite = {
  flavorId: string;
  addedAt: number;
  position?: number;
  status?: CaseStatus | null;
};

type Props = {
  shops: ShopLocation[];
  categories: Category[];
  flavors: Flavor[];
  /** Vertical-appropriate placeholder name (vertical.ts). */
  example: string;
  /** Copy voice (vertical.ts): scoop-shop charm or neutral verbs. */
  voice: "scoops" | "neutral";
  /** The vertical's own words (presets.ts): flavor/case, drink/cooler… */
  nouns: VerticalNouns;
  caseByShop: Record<string, CaseEntryLite[]>;
};

type Copy = {
  noun: string;
  out: string;
  start: string;
  ondeck: string;
  addIt: string;
  inCase: (shop: string) => string;
  low: (shop: string) => string;
  newInto: (shop: string) => string;
  empty: (shop: string) => string;
  count: (n: number) => string;
  offBoard: (shop: string) => string;
  confirmTitle: (name: string, shop: string) => string;
};

/**
 * The verbs that turned out to be vertical: "Tub's empty" over a bottle of
 * Pinot Grigio was the tavern owner's first question. The scoop voice is
 * LITERAL strings, unchanged character for character since the True North
 * build; the neutral voice composes around the preset's nouns, minding the
 * grammar the nouns bring with them (things come OUT OF a cooler but OFF
 * a board, so the preposition travels with the noun).
 */
const SCOOP_COPY: Copy = {
  noun: "flavor",
  out: "Tub's empty, take it off the board",
  start: "Start scooping it",
  ondeck: "Move to on deck",
  addIt: "Add it to the case",
  inCase: (shop) => `In the ${shop} case.`,
  low: (shop) => `Running low in the ${shop} case.`,
  newInto: (shop) => `New flavor, into the ${shop} case`,
  empty: (shop) => `Nothing in the ${shop} case yet.`,
  count: (n) => `${n} in the case`,
  offBoard: (shop) => `is off the ${shop} board.`,
  confirmTitle: (name, shop) => `Take ${name} off the ${shop} board?`,
};

function neutralCopy(n: VerticalNouns): Copy {
  // A trade with a live word ("pouring") talks about the state, not the
  // furniture: "Pouring at Copper Athletic Club", "86 it, it's done
  // pouring". The surface noun stays for trades without one.
  if (n.live) {
    const live = n.live;
    const Live = live[0].toUpperCase() + live.slice(1);
    return {
      noun: n.item,
      out: `86 it, it's done ${live}`,
      start: `Back on, ${live} again`,
      ondeck: "On deck, it goes on next",
      addIt: `Add it, it's ${live}`,
      inCase: (shop) => `${Live} at ${shop}.`,
      low: (shop) => `Running low at ${shop}, last call.`,
      newInto: (shop) => `New ${n.item}, ${live} at ${shop}`,
      empty: (shop) => `Nothing ${live} at ${shop} yet.`,
      count: (count) => `${count} ${live}`,
      offBoard: (shop) => `is done ${live} at ${shop}.`,
      confirmTitle: (name, shop) => `86 ${name} at ${shop}?`,
    };
  }
  const outOf = n.prep === "in" ? "out of" : "off";
  const into = n.prep === "in" ? "into" : "onto";
  const prepCap = n.prep === "in" ? "In" : "On";
  return {
    noun: n.item,
    out: `86 it, take it ${outOf} the ${n.surface}`,
    start: `Put it back ${n.prep} the ${n.surface}`,
    ondeck: "On deck, it goes on next",
    addIt: `Add it to the ${n.surface}`,
    inCase: (shop) => `${prepCap} the ${shop} ${n.surface}.`,
    low: (shop) => `Running low at ${shop}, last call.`,
    newInto: (shop) => `New ${n.item}, ${into} the ${shop} ${n.surface}`,
    empty: (shop) => `Nothing ${n.prep} the ${shop} ${n.surface} yet.`,
    count: (count) => `${count} ${n.prep} the ${n.surface}`,
    offBoard: (shop) => `is ${outOf} the ${shop} ${n.surface}.`,
    confirmTitle: (name, shop) => `Take ${name} ${outOf} the ${shop} ${n.surface}?`,
  };
}

type Sheet =
  | { kind: "flavor"; flavor: Flavor }
  | { kind: "confirm"; flavor: Flavor }
  | { kind: "picker"; category?: CategoryKey }
  | { kind: "new"; category?: CategoryKey }
  | null;

export default function CaseBoard({ shops, categories, flavors, example, voice, nouns, caseByShop }: Props) {
  const copy = voice === "scoops" ? SCOOP_COPY : neutralCopy(nouns);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [shopId, setShopId] = useState(shops[0]?.id ?? "");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<CategoryKey>(categories[0]?.key ?? "");
  /** Which board is in reorder mode, if any. */
  const [reordering, setReordering] = useState<string | null>(null);
  /** What just left the board, so the owner can undo the decision to stop there. */
  const [pulled, setPulled] = useState<Flavor | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const inFlightRef = useRef(false);

  const working = busy || pending;

  const byId = useMemo(() => new Map(flavors.map((f) => [f.id, f])), [flavors]);
  const entries = useMemo(() => caseByShop[shopId] ?? [], [caseByShop, shopId]);
  const inCaseIds = useMemo(() => new Set(entries.map((e) => e.flavorId)), [entries]);
  const entryFor = (flavorId: string) => entries.find((e) => e.flavorId === flavorId);

  /* Every board, always, an empty one still needs its "+" pill. On-deck
     entries live in their own section, not on the customer boards. */
  const boards = useMemo(
    () =>
      categories.map((c) => ({
        ...c,
        flavors: entries
          .filter((e) => e.status !== "ondeck")
          .map((e) => {
            const f = byId.get(e.flavorId);
            return f && !f.retired && f.category === c.key
              ? { flavor: f, position: e.position, low: e.status === "low", name: f.name }
              : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
          .sort(byCaseOrder),
      })),
    [categories, entries, byId],
  );

  const onDeck = useMemo(
    () =>
      entries
        .filter((e) => e.status === "ondeck")
        .map((e) => {
          const f = byId.get(e.flavorId);
          return f && !f.retired ? { flavor: f, position: e.position, name: f.name } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort(byCaseOrder),
    [entries, byId],
  );

  const inCaseCount = boards.reduce((n, b) => n + b.flavors.length, 0);

  const pickerCategory = sheet?.kind === "picker" ? sheet.category : undefined;

  /** What the picker can offer: not retired, not already on this shop's board. */
  const pickable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flavors
      .filter((f) => !f.retired && !inCaseIds.has(f.id))
      .filter((f) => !pickerCategory || f.category === pickerCategory)
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [flavors, inCaseIds, search, pickerCategory]);

  /** Unfiltered, the picker groups by board instead of one long A-Z list. */
  const pickableGroups = useMemo(
    () =>
      categories
        .map((c) => ({ ...c, items: pickable.filter((f) => f.category === c.key) }))
        .filter((g) => g.items.length > 0),
    [categories, pickable],
  );

  /* The pulled-flavor note fades on its own; it must never become litter. */
  useEffect(() => {
    if (!pulled) return;
    const id = setTimeout(() => setPulled(null), 8000);
    return () => clearTimeout(id);
  }, [pulled]);

  useEffect(() => {
    if (sheet) {
      panelRef.current?.focus();
    } else {
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    }
  }, [sheet]);

  function openSheet(next: Sheet) {
    if (document.activeElement instanceof HTMLElement) {
      restoreFocusRef.current = document.activeElement;
    }
    setError("");
    setSheet(next);
  }

  async function post(url: string, body: unknown): Promise<Record<string, unknown> | null> {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return null;
      }
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "That didn't stick, try again.");
        return null;
      }
      return json;
    } catch {
      setError("That didn't stick, check the connection and try again.");
      return null;
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function markOut(flavor: Flavor) {
    const ok = await post("/api/admin/case", { action: "out", locationId: shopId, flavorId: flavor.id });
    if (ok) {
      // Taking a tub out is a complete act. The old build force-opened the
      // picker, which on a phone is a full-height sheet covering the board
      // you were just looking at - presumptuous when most pulls are not
      // replacements. Say what happened, offer the next step, get out of
      // the way.
      setSheet(null);
      setPulled(flavor);
      refresh();
    }
  }

  async function addIn(flavor: Flavor) {
    const ok = await post("/api/admin/case", { action: "in", locationId: shopId, flavorId: flavor.id });
    if (ok) {
      setSheet(null);
      refresh();
    }
  }

  async function setStatus(flavor: Flavor, status: CaseStatus | null) {
    const ok = await post("/api/admin/case", {
      action: "status",
      locationId: shopId,
      flavorId: flavor.id,
      status,
    });
    if (ok) {
      setSheet(null);
      refresh();
    }
  }

  /**
   * Move one flavor up or down within its board, then write the WHOLE
   * shop's order (all boards in category order, then on deck): positions
   * are shop-wide, so writing only one board's slice would let two boards'
   * numbers interleave unpredictably.
   */
  async function move(boardKey: string, index: number, dir: -1 | 1) {
    const board = boards.find((b) => b.key === boardKey);
    if (!board) return;
    const ids = board.flavors.map((x) => x.flavor.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    const full = boards
      .flatMap((b) => (b.key === boardKey ? ids : b.flavors.map((x) => x.flavor.id)))
      .concat(onDeck.map((x) => x.flavor.id));
    const ok = await post("/api/admin/case", { action: "reorder", locationId: shopId, flavorIds: full });
    if (ok) refresh();
  }

  async function createAndAdd(category: CategoryKey) {
    const name = newName.trim();
    if (!name || working) return;
    const created = await post("/api/admin/flavors", { name, category });
    const flavor = created?.flavor as Flavor | undefined;
    if (flavor) {
      await addIn(flavor);
      setNewName("");
    }
  }

  const shopName = shops.find((s) => s.id === shopId)?.name ?? "";

  const errorBanner = error ? (
    <p role="alert" className="card mt-4 border-berry/40 bg-berry/5 px-4 py-3 text-sm font-medium text-berry">
      {error}
    </p>
  ) : null;

  const sheetEntry = sheet?.kind === "flavor" ? entryFor(sheet.flavor.id) : undefined;

  return (
    <div aria-busy={working}>
      <div role="tablist" aria-label="Shop" className="mt-5 flex gap-2">
        {shops.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={shopId === s.id}
            onClick={() => { setShopId(s.id); setReordering(null); }}
            className={`min-h-12 flex-1 rounded-full px-4 font-semibold transition-colors ${
              shopId === s.id ? "bg-berry text-cream" : "bg-cream-dim text-ink hover:bg-berry/15"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {!sheet ? errorBanner : null}

      {inCaseCount > 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          Swipe a {copy.noun} left to pull it off the board, or tap it for details.
        </p>
      ) : (
        <div className="card mt-5 px-5 py-6 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold">
            {copy.empty(shopName)}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Use a <b>+</b> below to fill a board.
          </p>
        </div>
      )}

      {boards.map((b) => (
        <section key={b.key} aria-labelledby={`case-${b.key}`} className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <h2 id={`case-${b.key}`} className="font-[family-name:var(--font-display)] text-xl font-semibold">
              {b.label}
              <span className="ml-2 text-sm font-normal text-ink-soft">
                {b.flavors.length ? copy.count(b.flavors.length) : "empty"}
              </span>
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              {b.flavors.length > 1 ? (
                <button
                  onClick={() => setReordering((cur) => (cur === b.key ? null : b.key))}
                  aria-pressed={reordering === b.key}
                  className="min-h-10 rounded-full px-3 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-berry hover:underline"
                >
                  {reordering === b.key ? "Done" : "Reorder"}
                </button>
              ) : null}
              {/* The board's own door: opens the picker already filtered to it. */}
              <button
                onClick={() => { openSheet({ kind: "picker", category: b.key }); setSearch(""); }}
                aria-label={`Add a ${b.label} ${copy.noun} to ${shopName}`}
                className="inline-flex min-h-10 items-center gap-1 rounded-full bg-berry px-4 font-semibold text-cream transition-colors hover:bg-berry-bright"
              >
                <span aria-hidden className="text-lg leading-none">+</span>
                Add
              </button>
            </div>
          </div>

          {reordering === b.key ? (
            /* Match the wall: the list IS the case, top to bottom. */
            <ul className="mt-3 grid gap-2">
              {b.flavors.map((x, i) => (
                <li
                  key={x.flavor.id}
                  className="card flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="font-semibold">
                    <span className="mr-2 text-sm font-normal text-ink-soft">{i + 1}.</span>
                    {x.flavor.name}
                  </span>
                  <span className="flex gap-1">
                    <button
                      onClick={() => move(b.key, i, -1)}
                      disabled={working || i === 0}
                      aria-label={`Move ${x.flavor.name} up`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-cream-dim text-lg font-semibold disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(b.key, i, 1)}
                      disabled={working || i === b.flavors.length - 1}
                      aria-label={`Move ${x.flavor.name} down`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-cream-dim text-lg font-semibold disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : b.flavors.length > 0 ? (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {b.flavors.map(({ flavor: f, low }) => (
                <li key={f.id}>
                  <SwipeCard
                    label={`${f.name}, tap for details, swipe left to take off the board`}
                    onTap={() => openSheet({ kind: "flavor", flavor: f })}
                    onSwiped={() => openSheet({ kind: "confirm", flavor: f })}
                  >
                    {f.photoUrl ? (
                      <Image
                        src={f.photoUrl}
                        alt=""
                        width={300}
                        height={200}
                        unoptimized
                        className="h-20 w-full object-cover"
                      />
                    ) : (
                      <div aria-hidden className="h-3 w-full bg-gradient-to-r from-berry-bright/70 to-mint/70" />
                    )}
                    <span className="block px-3 py-2.5">
                      <span className="block font-semibold leading-snug">{f.name}</span>
                      {low ? (
                        <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-berry">
                          running low
                        </span>
                      ) : null}
                      {f.allergens.length > 0 ? (
                        <span className="mt-1 block text-xs uppercase tracking-wide text-ink-soft">
                          {f.allergens.join(" · ")}
                        </span>
                      ) : null}
                    </span>
                  </SwipeCard>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              Nothing on this board at {shopName} right now.
            </p>
          )}
        </section>
      ))}

      {onDeck.length > 0 ? (
        <section aria-labelledby="case-ondeck" className="mt-8 rounded-[--radius-panel] bg-cream-dim p-4">
          <h2 id="case-ondeck" className="font-[family-name:var(--font-display)] text-xl font-semibold">
            On deck
            <span className="ml-2 text-sm font-normal text-ink-soft">{onDeck.length}</span>
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Queued to go on next. Customers can see these are coming; they are
            not on the boards yet.
          </p>
          <ul className="mt-3 grid gap-2">
            {onDeck.map(({ flavor: f }) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[--radius-card] bg-white px-4 py-3"
              >
                <span className="font-semibold">{f.name}</span>
                <span className="flex gap-2">
                  <button
                    onClick={() => setStatus(f, null)}
                    disabled={working}
                    className="btn !min-h-11 !px-4 !py-2 text-sm disabled:opacity-60"
                  >
                    {copy.start}
                  </button>
                  <button
                    onClick={() => markOut(f)}
                    disabled={working}
                    className="min-h-11 px-2 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-berry hover:underline"
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* What just happened, with the optional next step - not a sheet. */}
      {pulled ? (
        <div
          role="status"
          className="fixed inset-x-0 bottom-[4.75rem] z-40 px-3 pb-[env(safe-area-inset-bottom)]"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-full bg-ink px-4 py-2.5 text-cream shadow-lg">
            <span className="flex-1 text-sm font-medium">
              <b>{pulled.name}</b> {copy.offBoard(shopName)}
            </span>
            <button
              onClick={() => {
                const c = pulled.category;
                setPulled(null);
                openSheet({ kind: "picker", category: c });
                setSearch("");
              }}
              className="shrink-0 rounded-full bg-cream px-3 py-1.5 text-sm font-semibold text-ink"
            >
              Add another
            </button>
            <button
              onClick={() => setPulled(null)}
              aria-label="Dismiss"
              className="shrink-0 px-1 text-lg leading-none text-cream/70 hover:text-cream"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t border-ink/10 bg-cream/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => { openSheet({ kind: "picker" }); setSearch(""); }}
            className="btn w-full"
          >
            Add a {copy.noun} to {shopName}
          </button>
        </div>
      </div>

      {sheet ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
          onClick={() => setSheet(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSheet(null);
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={
              sheet.kind === "flavor" || sheet.kind === "confirm"
                ? sheet.flavor.name
                : sheet.kind === "picker"
                  ? `Add a ${copy.noun}`
                  : `New ${copy.noun}`
            }
            tabIndex={-1}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[--radius-panel] bg-cream px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[--radius-panel]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky: on a phone the flavor list can run past the screen, and
                the only exit used to be a lucky tap on the backdrop. */}
            <div className="sticky top-0 -mx-5 flex justify-end bg-cream/95 px-5 pb-2 pt-4 backdrop-blur">
              <button
                onClick={() => setSheet(null)}
                aria-label="Close"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-cream-dim text-xl font-semibold text-ink hover:bg-berry/15"
              >
                ×
              </button>
            </div>
            {errorBanner}

            {sheet.kind === "confirm" ? (
              <>
                <h3 className="-mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                  {copy.confirmTitle(sheet.flavor.name, shopName)}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  It stays in your library. This only clears it from what
                  customers see right now.
                </p>
                <div className="mt-5 grid gap-3">
                  <button onClick={() => markOut(sheet.flavor)} className="btn w-full disabled:opacity-60" disabled={working}>
                    {working ? "Taking it off…" : "Yes, it's out"}
                  </button>
                  <button onClick={() => setSheet(null)} className="btn-ghost w-full">
                    Keep it on
                  </button>
                </div>
              </>
            ) : sheet.kind === "flavor" ? (
              <>
                <h3 className="-mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                  {sheet.flavor.name}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {sheetEntry?.status === "low" ? copy.low(shopName) : copy.inCase(shopName)}{" "}
                  {sheet.flavor.sizes.map((s) => `${s.label} ${s.price}`).join(" · ")}
                </p>
                <div className="mt-5 grid gap-3">
                  <button
                    onClick={() => openSheet({ kind: "confirm", flavor: sheet.flavor })}
                    className="btn w-full"
                  >
                    {copy.out}
                  </button>
                  {/* Last call: the state between full and blown. The board
                      and the website both say so the moment it flips. */}
                  <button
                    onClick={() => setStatus(sheet.flavor, sheetEntry?.status === "low" ? null : "low")}
                    className="btn-ghost w-full disabled:opacity-60"
                    disabled={working}
                  >
                    {sheetEntry?.status === "low" ? "Back to full, all good" : "Running low, last call"}
                  </button>
                  <button
                    onClick={() => setStatus(sheet.flavor, "ondeck")}
                    className="btn-ghost w-full disabled:opacity-60"
                    disabled={working}
                  >
                    {copy.ondeck}
                  </button>
                  <button onClick={() => setSheet(null)} className="min-h-12 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-berry hover:underline">
                    Never mind
                  </button>
                </div>
              </>
            ) : sheet.kind === "picker" ? (
              <>
                <h3 className="-mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                  {sheet.category
                    ? `Add ${categories.find((c) => c.key === sheet.category)?.label} at ${shopName}`
                    : `What's going in at ${shopName}?`}
                </h3>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="field mt-4"
                  aria-label="Search flavors"
                  autoFocus
                />

                {sheet.category ? (
                  <ul className="mt-3 divide-y divide-ink/5">
                    {pickable.map((f) => (
                      <PickRow key={f.id} flavor={f} onPick={() => addIn(f)} working={working} />
                    ))}
                  </ul>
                ) : (
                  pickableGroups.map((g) => (
                    <div key={g.key} className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {g.label}
                      </p>
                      <ul className="mt-1 divide-y divide-ink/5">
                        {g.items.map((f) => (
                          <PickRow key={f.id} flavor={f} onPick={() => addIn(f)} working={working} />
                        ))}
                      </ul>
                    </div>
                  ))
                )}

                {pickable.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-soft">
                    Nothing left in the library for this board, make a new one below.
                  </p>
                ) : null}

                <div className="mt-4 grid gap-2">
                  <button
                    onClick={() => {
                      setNewCategory(sheet.category ?? categories[0]?.key ?? "");
                      setSheet({ kind: "new", category: sheet.category });
                    }}
                    className="btn-ghost w-full"
                  >
                    New {copy.noun}…
                  </button>
                  {/* Nothing more to add is a normal outcome, not a dead end. */}
                  <button onClick={() => setSheet(null)} className="min-h-12 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-berry hover:underline">
                    Done for now
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="-mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                  {copy.newInto(shopName)}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  Name and board now, mid-rush; photo, story, and prices later
                  in the library.
                </p>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={example}
                  className="field mt-4"
                  aria-label={`${copy.noun} name`}
                  autoFocus
                />
                <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Board">
                  {categories.map((c) => (
                    <button
                      key={c.key}
                      role="radio"
                      aria-checked={newCategory === c.key}
                      onClick={() => setNewCategory(c.key)}
                      className={`chip min-h-10 px-3 ${
                        newCategory === c.key ? "bg-berry text-cream" : "bg-cream-dim text-ink"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="mt-5 grid gap-3">
                  <button
                    onClick={() => createAndAdd(newCategory)}
                    className="btn w-full disabled:opacity-60"
                    disabled={working || !newName.trim()}
                  >
                    {working ? "Adding it…" : copy.addIt}
                  </button>
                  <button
                    onClick={() => setSheet({ kind: "picker", category: sheet.category })}
                    className="btn-ghost w-full"
                  >
                    Back to the library
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PickRow({
  flavor,
  onPick,
  working,
}: {
  flavor: Flavor;
  onPick: () => void;
  working: boolean;
}) {
  return (
    <li>
      <button
        onClick={onPick}
        disabled={working}
        className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left disabled:opacity-60"
      >
        <span className="font-semibold">{flavor.name}</span>
        <span aria-hidden className="font-semibold text-berry">
          {working ? "…" : "+ In"}
        </span>
      </button>
    </li>
  );
}
