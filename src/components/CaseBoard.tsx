"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SwipeCard from "@/components/SwipeCard";
import { CATEGORIES, type CategoryKey, type Flavor } from "@/lib/domain";
import type { ShopLocation } from "@/lib/locations";

/**
 * The owner's screen. One rule shaped every choice: the user is standing at
 * the dipping cabinet with cold hands and a line.
 *
 *  - Pulling a tub is a swipe (or a tap, or a keypress) and then a confirm.
 *    Never a bare gesture — a mis-swipe must not silently change the menu a
 *    customer is reading.
 *  - Every board carries its own "+" pill, so restocking hand-scooped shows
 *    hand-scooped and nothing else. Boards with nothing in them still show
 *    their pill, because that is exactly when you need it.
 *  - Every mutation runs through post(), which owns the double-tap latch
 *    (a ref, synchronous — state is too slow for two taps in one tick), the
 *    401 walk back to /login, and errors rendered INSIDE the open sheet,
 *    because behind the backdrop is where failures go to be missed.
 */

type Props = {
  shops: ShopLocation[];
  flavors: Flavor[];
  caseByShop: Record<string, { flavorId: string; addedAt: number }[]>;
};

type Sheet =
  | { kind: "flavor"; flavor: Flavor }
  | { kind: "confirm"; flavor: Flavor }
  | { kind: "picker"; category?: CategoryKey }
  | { kind: "new"; category?: CategoryKey }
  | null;

export default function CaseBoard({ shops, flavors, caseByShop }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [shopId, setShopId] = useState(shops[0]?.id ?? "");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<CategoryKey>("handscooped");
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const inFlightRef = useRef(false);

  const working = busy || pending;

  const byId = useMemo(() => new Map(flavors.map((f) => [f.id, f])), [flavors]);
  const inCaseIds = useMemo(
    () => new Set((caseByShop[shopId] ?? []).map((e) => e.flavorId)),
    [caseByShop, shopId],
  );

  /* Every board, always — an empty one still needs its "+" pill. */
  const boards = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        flavors: (caseByShop[shopId] ?? [])
          .map((e) => byId.get(e.flavorId))
          .filter((f): f is Flavor => !!f && !f.retired && f.category === c.key)
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
    [caseByShop, shopId, byId],
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
      CATEGORIES.map((c) => ({ ...c, items: pickable.filter((f) => f.category === c.key) })).filter(
        (g) => g.items.length > 0,
      ),
    [pickable],
  );

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
        setError(typeof json.error === "string" ? json.error : "That didn't stick — try again.");
        return null;
      }
      return json;
    } catch {
      setError("That didn't stick — check the connection and try again.");
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
      // The tub just left the cabinet; the next tap is "what's going in?" —
      // and it opens on the board that just lost something.
      setSheet({ kind: "picker", category: flavor.category });
      setSearch("");
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

  return (
    <div aria-busy={working}>
      <div role="tablist" aria-label="Shop" className="mt-5 flex gap-2">
        {shops.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={shopId === s.id}
            onClick={() => setShopId(s.id)}
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
          Swipe a flavor left to pull it off the board, or tap it for details.
        </p>
      ) : (
        <div className="card mt-5 px-5 py-6 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Nothing in the {shopName} case yet.
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
                {b.flavors.length ? `${b.flavors.length} in the case` : "empty"}
              </span>
            </h2>
            {/* The board's own door: opens the picker already filtered to it. */}
            <button
              onClick={() => { openSheet({ kind: "picker", category: b.key }); setSearch(""); }}
              aria-label={`Add a ${b.label} flavor to ${shopName}`}
              className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-berry px-4 font-semibold text-cream transition-colors hover:bg-berry-bright"
            >
              <span aria-hidden className="text-lg leading-none">+</span>
              Add
            </button>
          </div>

          {b.flavors.length > 0 ? (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {b.flavors.map((f) => (
                <li key={f.id}>
                  <SwipeCard
                    label={`${f.name} — tap for details, swipe left to take off the board`}
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

      <div className="fixed inset-x-0 bottom-0 border-t border-ink/10 bg-cream/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => { openSheet({ kind: "picker" }); setSearch(""); }}
            className="btn w-full"
          >
            Add a flavor to {shopName}
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
                  ? "Add a flavor"
                  : "New flavor"
            }
            tabIndex={-1}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[--radius-panel] bg-cream p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[--radius-panel]"
            onClick={(e) => e.stopPropagation()}
          >
            {errorBanner}

            {sheet.kind === "confirm" ? (
              <>
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                  Take {sheet.flavor.name} off the {shopName} board?
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  It stays in your library — this only clears it from what
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
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                  {sheet.flavor.name}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  In the {shopName} case.{" "}
                  {sheet.flavor.sizes.map((s) => `${s.label} ${s.price}`).join(" · ")}
                </p>
                <div className="mt-5 grid gap-3">
                  <button
                    onClick={() => openSheet({ kind: "confirm", flavor: sheet.flavor })}
                    className="btn w-full"
                  >
                    Tub&apos;s empty — take it off the board
                  </button>
                  <button onClick={() => setSheet(null)} className="btn-ghost w-full">
                    Never mind
                  </button>
                </div>
              </>
            ) : sheet.kind === "picker" ? (
              <>
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                  {sheet.category
                    ? `Add ${CATEGORIES.find((c) => c.key === sheet.category)?.label} at ${shopName}`
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
                    Nothing left in the library for this board — make a new one below.
                  </p>
                ) : null}

                <button
                  onClick={() => {
                    setNewCategory(sheet.category ?? "handscooped");
                    setSheet({ kind: "new", category: sheet.category });
                  }}
                  className="btn-ghost mt-4 w-full"
                >
                  New flavor…
                </button>
              </>
            ) : (
              <>
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                  New flavor, into the {shopName} case
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  Name and board now, mid-rush; photo, story, and prices later
                  in the library.
                </p>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Lemon Poppyseed"
                  className="field mt-4"
                  aria-label="Flavor name"
                  autoFocus
                />
                <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Board">
                  {CATEGORIES.map((c) => (
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
                    {working ? "Adding it…" : "Add it to the case"}
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
