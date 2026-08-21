"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type CategoryKey, type Flavor } from "@/lib/domain";
import type { ShopLocation } from "@/lib/locations";

/**
 * The owner's screen. One rule shaped every choice here: the user is standing
 * at the dipping cabinet with cold hands and a line. Blowing a tub is two
 * taps — tap the flavor, tap "It's out" — and the replacement picker opens
 * itself, because the empty slot in the cabinet is about to be filled and
 * the board should follow the hands.
 *
 * Every mutation runs through post(), which owns three behaviors the rush
 * demands: `busy` covers the WHOLE round-trip (a double-tap on shop Wi-Fi
 * must not file the same new flavor twice), a 401 walks the owner to /login
 * instead of stranding them on a dead board, and errors render INSIDE the
 * open sheet — behind the backdrop is where failures go to be missed.
 */

type Props = {
  shops: ShopLocation[];
  flavors: Flavor[];
  caseByShop: Record<string, { flavorId: string; addedAt: number }[]>;
};

type Sheet =
  | { kind: "flavor"; flavor: Flavor }
  | { kind: "picker" }
  | { kind: "new" }
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
  /*
   * The real double-tap latch. `busy` is React state — async, so two taps in
   * the same tick both read it false. The ref flips synchronously; the state
   * only drives the visuals.
   */
  const inFlightRef = useRef(false);

  const working = busy || pending;

  const byId = useMemo(() => new Map(flavors.map((f) => [f.id, f])), [flavors]);
  const inCaseIds = useMemo(
    () => new Set((caseByShop[shopId] ?? []).map((e) => e.flavorId)),
    [caseByShop, shopId],
  );

  const boards = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        flavors: (caseByShop[shopId] ?? [])
          .map((e) => byId.get(e.flavorId))
          .filter((f): f is Flavor => !!f && !f.retired && f.category === c.key)
          .sort((a, b) => a.name.localeCompare(b.name)),
      })).filter((b) => b.flavors.length > 0),
    [caseByShop, shopId, byId],
  );

  const pickable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flavors
      .filter((f) => !f.retired && !inCaseIds.has(f.id))
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [flavors, inCaseIds, search]);

  /* Focus follows the sheet: into the panel on open, back to the trigger on close. */
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
        // The cookie aged out mid-shift; the board is dead until they sign
        // back in, so take them there instead of showing a failing button.
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
      // The tub just left the cabinet; the next tap is "what's going in?"
      setSheet({ kind: "picker" });
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

  async function createAndAdd() {
    const name = newName.trim();
    if (!name || working) return;
    const created = await post("/api/admin/flavors", { name, category: newCategory });
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
      {/* Shop tabs — the first decision, always visible. */}
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

      {/* Page-level errors, for when no sheet is up. */}
      {!sheet ? errorBanner : null}

      {boards.map((b) => (
        <section key={b.key} aria-labelledby={`case-${b.key}`} className="mt-7">
          <h2 id={`case-${b.key}`} className="font-[family-name:var(--font-display)] text-xl font-semibold">
            {b.label}
            <span className="ml-2 text-sm font-normal text-ink-soft">{b.flavors.length} in the case</span>
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {b.flavors.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => openSheet({ kind: "flavor", flavor: f })}
                  className="card block w-full overflow-hidden text-left transition-transform hover:-translate-y-0.5"
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
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* An empty case must say so, or a first-run owner reads it as broken. */}
      {boards.length === 0 ? (
        <div className="card mt-7 px-5 py-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Nothing in the {shopName} case yet.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Tap the button below to put the first flavor on the board.
          </p>
        </div>
      ) : null}

      {/* The always-there door for restocking without blowing anything.
          pb includes the iPhone home-bar inset so the button clears it. */}
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

      {/* Sheets. One at a time, full-width on phones, Escape closes. */}
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
              sheet.kind === "flavor" ? sheet.flavor.name : sheet.kind === "picker" ? "Add a flavor" : "New flavor"
            }
            tabIndex={-1}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[--radius-panel] bg-cream p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[--radius-panel]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Failures surface HERE, on top of the tap that caused them. */}
            {errorBanner}

            {sheet.kind === "flavor" ? (
              <>
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                  {sheet.flavor.name}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  In the {shopName} case.{" "}
                  {sheet.flavor.sizes.map((s) => `${s.label} ${s.price}`).join(" · ")}
                </p>
                <div className="mt-5 grid gap-3">
                  <button onClick={() => markOut(sheet.flavor)} className="btn w-full disabled:opacity-60" disabled={working}>
                    {working ? "Taking it off…" : "Tub's empty — take it off the board"}
                  </button>
                  <button onClick={() => setSheet(null)} className="btn-ghost w-full">
                    Never mind
                  </button>
                </div>
              </>
            ) : sheet.kind === "picker" ? (
              <>
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                  What&apos;s going in at {shopName}?
                </h3>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search the library…"
                  className="field mt-4"
                  aria-label="Search flavors"
                  autoFocus
                />
                <ul className="mt-3 divide-y divide-ink/5">
                  {pickable.map((f) => (
                    <li key={f.id}>
                      <button
                        onClick={() => addIn(f)}
                        disabled={working}
                        className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left disabled:opacity-60"
                      >
                        <span>
                          <span className="font-semibold">{f.name}</span>
                          <span className="ml-2 text-xs text-ink-soft">
                            {CATEGORIES.find((c) => c.key === f.category)?.label}
                          </span>
                        </span>
                        <span aria-hidden className="font-semibold text-berry">
                          {working ? "…" : "+ In"}
                        </span>
                      </button>
                    </li>
                  ))}
                  {pickable.length === 0 ? (
                    <li className="py-3 text-sm text-ink-soft">
                      Nothing in the library matches — make it a new flavor below.
                    </li>
                  ) : null}
                </ul>
                <button onClick={() => setSheet({ kind: "new" })} className="btn-ghost mt-4 w-full">
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
                    onClick={createAndAdd}
                    className="btn w-full disabled:opacity-60"
                    disabled={working || !newName.trim()}
                  >
                    {working ? "Adding it…" : "Add it to the case"}
                  </button>
                  <button onClick={() => setSheet({ kind: "picker" })} className="btn-ghost w-full">
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
