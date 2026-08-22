"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RETIRE_GRACE_MS,
  hasShopPricing,
  recentlyRetired,
  type Allergen,
  type CategoryKey,
  type Flavor,
  type Size,
} from "@/lib/domain";
import type { Category } from "@/lib/vertical";
import type { ShopLocation } from "@/lib/locations";

/**
 * The library: everything the shop has ever churned, edited in place, and
 * created here too, because prepping next week's menu from the couch must
 * not require boarding a flavor at a live shop. Photos are resized in the
 * browser before upload (a phone camera shot is 4MB the server never
 * needs), every failure says so out loud, and retiring beats deleting, a
 * retired flavor keeps its history and can come back next summer.
 */

/**
 * Categories and allergens arrive as PROPS (env-configured per deployment,
 * vertical.ts), never imported: a client bundle cannot read the server's
 * env, so importing the lists here would show every deployment ice cream.
 */
type Props = {
  flavors: Flavor[];
  shops: ShopLocation[];
  categories: Category[];
  allergenOptions: string[];
  /** Vertical-appropriate placeholder name (vertical.ts exampleItem). */
  example: string;
  /** Copy voice (vertical.ts voice()): "churned" is scoop vocabulary. */
  voice: "scoops" | "neutral";
  inCase: Record<string, string[]>;
};

/** Downscale to <=900px JPEG so uploads are ~100KB, not a camera original. */
async function resizeToJpeg(file: File): Promise<{ data: string; contentType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, 900 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    return { data: dataUrl.split(",")[1], contentType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function FlavorLibrary({ flavors, shops, categories, allergenOptions, example, voice, inCase }: Props) {
  const noun = voice === "neutral" ? "item" : "flavor";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [error, setError] = useState("");
  /** Positive confirmation. A save that only flashes is a save you distrust. */
  const [saved, setSaved] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<CategoryKey>(categories[0]?.key ?? "");
  /** The open editor sets this; collapsing a dirty editor asks first. */
  const dirtyRef = useRef(false);
  /** Synchronous double-tap latch, `busy` state is async and misses same-tick taps. */
  const inFlightRef = useRef(false);

  const working = busy || pending;

  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(""), 4000);
    return () => clearTimeout(id);
  }, [saved]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return flavors
      .filter((f) => (showRetired ? true : !f.retired))
      .filter((f) => !q || f.name.toLowerCase().includes(q));
  }, [flavors, filter, showRetired]);

  /*
    GROUPED BY BOARD, not one long A-Z run. Alphabetical across every
    category put Bailey Mountain (adult) next to Birthday Cake (hand-scooped)
    next to Black Cherry (soft serve), which is alphabetical and useless:
    nobody thinks about their flavors that way. Boards are the unit
    everywhere else in the app, so they are the unit here too, and within a
    board the flavors that are OUT right now sort to the top.
  */
  /*
    THE RETIREMENT HOME: everything retired in the last day, on its own shelf
    at the bottom with a one-tap way back. Retiring is not destruction,
    nothing is ever deleted, but a mis-tap should not send you hunting
    through a checkbox filter to undo it.
  */
  const retirementHome = useMemo(
    () =>
      flavors
        .filter((f) => recentlyRetired(f))
        .sort((a, b) => (b.retiredAt ?? 0) - (a.retiredAt ?? 0)),
    [flavors],
  );
  const homeIds = useMemo(() => new Set(retirementHome.map((f) => f.id)), [retirementHome]);

  const groups = useMemo(
    () =>
      categories.map((c) => ({
        ...c,
        items: visible
          .filter((f) => f.category === c.key && !homeIds.has(f.id))
          .sort((a, b) => {
            const outA = (inCase[a.id]?.length ?? 0) > 0 ? 0 : 1;
            const outB = (inCase[b.id]?.length ?? 0) > 0 ? 0 : 1;
            return outA - outB || a.name.localeCompare(b.name);
          }),
      })).filter((g) => g.items.length > 0),
    [categories, visible, inCase, homeIds],
  );

  async function save(patch: Record<string, unknown>, note = "Saved"): Promise<Flavor | null> {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    setError("");
    setSaved("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/flavors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return null;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string; flavor?: Flavor };
      if (!res.ok) {
        setError(json.error ?? "That didn't save, try again.");
        return null;
      }
      dirtyRef.current = false;
      setSaved(note);
      startTransition(() => router.refresh());
      return json.flavor ?? null;
    } catch {
      setError("That didn't save, check the connection and try again.");
      return null;
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  function toggleOpen(id: string) {
    if (openId === id) {
      // A stray thumb must not eat ten minutes of typing.
      if (dirtyRef.current && !window.confirm("Close without saving your changes?")) return;
      dirtyRef.current = false;
      setOpenId(null);
    } else {
      if (openId && dirtyRef.current && !window.confirm("Close without saving your changes?")) return;
      dirtyRef.current = false;
      setOpenId(id);
    }
  }

  async function createFlavor() {
    const name = newName.trim();
    if (!name || working) return;
    const created = await save({ name, category: newCategory }, `${name} added to the library`);
    if (created) {
      setNewName("");
      setOpenId(created.id);
    }
  }

  return (
    <div aria-busy={working}>
      {/* Create here, not just from the case, no shop's board required. */}
      <div className="card mt-5 p-4">
        <label htmlFor="lib-new" className="block text-sm font-semibold">
          New {noun}
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id="lib-new"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={example}
            className="field max-w-xs"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as CategoryKey)}
            aria-label="Board"
            className="field max-w-52"
          >
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <button onClick={createFlavor} className="btn disabled:opacity-60" disabled={working || !newName.trim()}>
            {working ? "Adding…" : "Add to the library"}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          {voice === "neutral"
            ? "It lands in the library only. Put it on the board from The Board screen when it goes on."
            : "It lands in the library only, put it in a case from The Case screen when it’s churned."}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search…"
          aria-label={`Search ${noun}s`}
          className="field max-w-xs"
        />
        <label className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-medium text-ink-soft">
          <input
            type="checkbox"
            checked={showRetired}
            onChange={(e) => setShowRetired(e.target.checked)}
            className="h-4 w-4 accent-[--color-berry]"
          />
          Show retired
        </label>
      </div>

      {error ? (
        <p role="alert" className="card mt-4 border-berry/40 bg-berry/5 px-4 py-3 text-sm font-medium text-berry">
          {error}
        </p>
      ) : null}

      {/* Says so, out loud, where the eye already is. */}
      {saved ? (
        <div role="status" className="fixed inset-x-0 bottom-4 z-40 px-3">
          <p className="mx-auto w-fit rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-lg">
            {saved}
          </p>
        </div>
      ) : null}

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`lib-${g.key}`} className="mt-7">
          <h2
            id={`lib-${g.key}`}
            className="font-[family-name:var(--font-display)] text-xl font-semibold"
          >
            {g.label}
            <span className="ml-2 text-sm font-normal text-ink-soft">{g.items.length}</span>
          </h2>
          <ul className="mt-3 grid gap-3">
            {g.items.map((f) => {
              const out = inCase[f.id] ?? [];
              return (
                <li key={f.id} className="card overflow-hidden">
                  <button
                    onClick={() => toggleOpen(f.id)}
                    aria-expanded={openId === f.id}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
                  >
                    {f.photoUrl ? (
                      <Image src={f.photoUrl} alt="" width={48} height={48} unoptimized className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <span aria-hidden className="h-12 w-12 rounded-lg bg-gradient-to-br from-berry-bright/60 to-mint/60" />
                    )}
                    <span className="flex-1">
                      <span className={`block font-semibold ${f.retired ? "text-ink-soft line-through" : ""}`}>
                        {f.name}
                      </span>
                      {/* Where it is RIGHT NOW, the thing the old flat list never said. */}
                      <span className="block text-xs text-ink-soft">
                        {out.length > 0
                          ? `${voice === "neutral" ? "On the board" : "In the case"}: ${out
                              .map((id) => shops.find((s) => s.id === id)?.name ?? id)
                              .join(", ")}`
                          : f.retired
                            ? "Retired"
                            : "In the library"}
                        {f.allergens.length ? ` · ${f.allergens.join(", ")}` : ""}
                      </span>
                    </span>
                    <span aria-hidden className="text-ink-soft">{openId === f.id ? "▴" : "▾"}</span>
                  </button>
                  {openId === f.id ? (
                    <FlavorEditor
                      flavor={f}
                      save={save}
                      setError={setError}
                      shops={shops}
                      categories={categories}
                      allergenOptions={allergenOptions}
                      markDirty={() => (dirtyRef.current = true)}
                      working={working}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {visible.length === 0 && retirementHome.length === 0 ? (
        <p className="card mt-4 px-4 py-6 text-center text-sm text-ink-soft">
          No {noun} matches that
          {!showRetired ? ", it might be retired; flip on “Show retired” above" : ""}.
        </p>
      ) : null}

      {retirementHome.length > 0 ? (
        <section aria-labelledby="lib-retired" className="mt-10 rounded-[--radius-panel] bg-cream-dim p-5">
          <h2 id="lib-retired" className="font-[family-name:var(--font-display)] text-xl font-semibold">
            The Retirement Home
            <span className="ml-2 text-sm font-normal text-ink-soft">{retirementHome.length}</span>
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Retired in the last day. Bring one back and it returns to the
            library exactly as it was, after that it stays retired, and
            “Show retired” above still finds it.
          </p>
          <ul className="mt-4 grid gap-2">
            {retirementHome.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[--radius-card] bg-white px-4 py-3"
              >
                <span>
                  <span className="block font-semibold text-ink-soft line-through">{f.name}</span>
                  <span className="block text-xs text-ink-soft">
                    {categories.find((c) => c.key === f.category)?.label ?? f.category} ·{" "}
                    {hoursLeft(f.retiredAt)}
                  </span>
                </span>
                <button
                  onClick={() => save({ id: f.id, retired: false }, `${f.name} is back`)}
                  disabled={working}
                  className="btn !min-h-11 !px-5 !py-2 text-sm disabled:opacity-60"
                >
                  Bring it back
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** "23 hours left to undo", plain, and never negative. */
function hoursLeft(retiredAt?: number | null): string {
  if (!retiredAt) return "recoverable";
  const left = retiredAt + RETIRE_GRACE_MS - Date.now();
  if (left <= 0) return "recovery window closed";
  const hours = Math.floor(left / 3_600_000);
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} left to undo`;
  const mins = Math.max(1, Math.floor(left / 60_000));
  return `${mins} minute${mins === 1 ? "" : "s"} left to undo`;
}

function FlavorEditor({
  flavor,
  save,
  setError,
  shops,
  categories,
  allergenOptions,
  markDirty,
  working,
}: {
  flavor: Flavor;
  shops: ShopLocation[];
  categories: Category[];
  allergenOptions: string[];
  save: (patch: Record<string, unknown>, note?: string) => Promise<Flavor | null>;
  setError: (e: string) => void;
  markDirty: () => void;
  working: boolean;
}) {
  const [name, setName] = useState(flavor.name);
  const [description, setDescription] = useState(flavor.description);
  const [category, setCategory] = useState<CategoryKey>(flavor.category);
  const [allergens, setAllergens] = useState<Allergen[]>(flavor.allergens);
  const [producer, setProducer] = useState(flavor.producer ?? "");
  const [abv, setAbv] = useState(flavor.abv ?? "");
  const [sizes, setSizes] = useState<Size[]>(flavor.sizes);
  /*
    Per-shop prices stay collapsed unless this flavor already has them: most
    flavors cost the same at both counters, and a pricing grid on every row
    would bury the fields people actually edit.
  */
  const [perShop, setPerShop] = useState(hasShopPricing(flavor));
  const [shopSizes, setShopSizes] = useState<Record<string, Size[]>>(() =>
    Object.fromEntries(
      shops.map((s) => [
        s.id,
        flavor.sizesByShop?.[s.id]?.length ? flavor.sizesByShop[s.id] : flavor.sizes,
      ]),
    ),
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function touch() {
    markDirty();
  }

  function toggleAllergen(a: Allergen) {
    touch();
    setAllergens((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  }

  function setSize(i: number, key: keyof Size, value: string) {
    touch();
    setSizes((cur) => cur.map((s, j) => (j === i ? { ...s, [key]: value } : s)));
  }

  function setShopSize(shop: string, i: number, key: keyof Size, value: string) {
    touch();
    setShopSizes((cur) => ({
      ...cur,
      [shop]: (cur[shop] ?? []).map((s, j) => (j === i ? { ...s, [key]: value } : s)),
    }));
  }

  async function onSave() {
    // A half-filled size row must not vanish silently on save.
    const halfFilled = sizes.some((s) => (s.label.trim() === "") !== (s.price.trim() === ""));
    if (halfFilled) {
      setError("One of the size rows is missing its name or price, fill it in or clear both boxes.");
      return;
    }
    await save(
      {
        id: flavor.id,
        name,
        description,
        category,
        allergens,
        producer,
        abv,
        sizes: sizes.filter((s) => s.label.trim() && s.price.trim()),
        // Off means "every shop uses the default", an empty object clears it.
        sizesByShop: perShop
          ? Object.fromEntries(
              shops.map((s) => [
                s.id,
                (shopSizes[s.id] ?? []).filter((x) => x.label.trim() && x.price.trim()),
              ]),
            )
          : {},
      },
      `${name} saved`,
    );
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { data, contentType } = await resizeToJpeg(file);
      const res = await fetch("/api/admin/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType, data }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "The photo didn't upload, try again.");
        return;
      }
      const ok = await save({ id: flavor.id, photoUrl: json.url }, "Photo added");
      if (!ok) return; // save() already surfaced its error
    } catch {
      // A file the browser can't decode (HEIC on some browsers, a corrupt
      // shot) rejects in resizeToJpeg, that must not fail silently.
      setError("Couldn't read that photo, try a different one, or a screenshot of it.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="border-t border-ink/10 px-4 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Name
          <input
            value={name}
            onChange={(e) => { touch(); setName(e.target.value); }}
            className="field mt-1 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          Board
          <select
            value={category}
            onChange={(e) => { touch(); setCategory(e.target.value as CategoryKey); }}
            className="field mt-1 font-normal"
          >
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/*
        The collaborator gets a FIELD, not a sentence. The seed proved the
        need twice before beer did: Cascarelli Cashew's maker was buried in
        prose where nothing could style, filter, or link it. ABV rides along
        for the drinks verticals; blank means it never renders anywhere.
      */}
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_8rem]">
        <label className="block text-sm font-semibold">
          Made by / with <span className="font-normal text-ink-soft">(if not the shop)</span>
          <input
            value={producer}
            onChange={(e) => { touch(); setProducer(e.target.value); }}
            className="field mt-1 font-normal"
            placeholder="Cascarelli's of Homer"
          />
        </label>
        <label className="block text-sm font-semibold">
          ABV %
          <input
            value={abv}
            onChange={(e) => { touch(); setAbv(e.target.value); }}
            className="field mt-1 font-normal"
            placeholder="5.2"
            inputMode="decimal"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm font-semibold">
        The story <span className="font-normal text-ink-soft">(shows on the website)</span>
        <textarea
          value={description}
          onChange={(e) => { touch(); setDescription(e.target.value); }}
          rows={2}
          className="field mt-1 font-normal"
          placeholder="Made with the famous nuts from Cascarelli's of Homer."
        />
      </label>

      {allergenOptions.length > 0 ? (
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Allergens</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {allergenOptions.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={allergens.includes(a)}
              onClick={() => toggleAllergen(a)}
              className={`chip min-h-10 px-3 capitalize ${
                allergens.includes(a) ? "bg-berry text-cream" : "bg-cream-dim text-ink"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </fieldset>
      ) : null}

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Prices by size</legend>
        <div className="mt-2 grid gap-2">
          {sizes.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={s.label}
                onChange={(e) => setSize(i, "label", e.target.value)}
                aria-label={`Size ${i + 1} name`}
                className="field"
              />
              <input
                value={s.price}
                onChange={(e) => setSize(i, "price", e.target.value)}
                aria-label={`Size ${i + 1} price`}
                className="field max-w-28"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => { touch(); setSizes((cur) => [...cur, { label: "", price: "" }]); }}
            className="btn-ghost"
          >
            Another size
          </button>
        </div>
      </fieldset>

      <div className="mt-4">
        <label className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={perShop}
            onChange={(e) => { touch(); setPerShop(e.target.checked); }}
            className="h-4 w-4 accent-[--color-berry]"
          />
          This one costs different at each shop
        </label>
        {perShop ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {shops.map((s) => (
              <fieldset key={s.id} className="rounded-[--radius-card] border border-ink/10 p-3">
                <legend className="px-1 text-sm font-semibold">{s.name}</legend>
                <div className="grid gap-2">
                  {(shopSizes[s.id] ?? []).map((size, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={size.label}
                        onChange={(e) => setShopSize(s.id, i, "label", e.target.value)}
                        aria-label={`${s.name} size ${i + 1} name`}
                        className="field"
                      />
                      <input
                        value={size.price}
                        onChange={(e) => setShopSize(s.id, i, "price", e.target.value)}
                        aria-label={`${s.name} size ${i + 1} price`}
                        className="field max-w-28"
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-ink-soft">
            Off means every shop charges the prices above.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="btn-ghost cursor-pointer">
          {uploading ? "Uploading…" : flavor.photoUrl ? "Replace photo" : "Add a photo"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPhoto(e.target.files?.[0])}
            disabled={uploading || working}
          />
        </label>
        <button onClick={onSave} className="btn disabled:opacity-60" disabled={working}>
          {working ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => {
            if (
              !flavor.retired &&
              !window.confirm(
                `Retire ${flavor.name}?\n\nIt comes off every board and moves to the Retirement Home at the bottom of the library. You have 24 hours to bring it back with one tap.`,
              )
            ) {
              return;
            }
            save(
              { id: flavor.id, retired: !flavor.retired },
              flavor.retired ? `${flavor.name} is back` : `${flavor.name} retired, recoverable for 24 hours`,
            );
          }}
          className="min-h-12 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-berry hover:underline"
          disabled={working}
        >
          {flavor.retired ? "Bring it back" : "Retire it"}
        </button>
      </div>
    </div>
  );
}
