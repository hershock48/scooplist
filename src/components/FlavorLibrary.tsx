"use client";

import Image from "next/image";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ALLERGENS, CATEGORIES, type Allergen, type CategoryKey, type Flavor, type Size } from "@/lib/domain";

/**
 * The library: everything the shop has ever churned, edited in place — and
 * created here too, because prepping next week's menu from the couch must
 * not require boarding a flavor at a live shop. Photos are resized in the
 * browser before upload (a phone camera shot is 4MB the server never
 * needs), every failure says so out loud, and retiring beats deleting — a
 * retired flavor keeps its history and can come back next summer.
 */

type Props = { flavors: Flavor[] };

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

export default function FlavorLibrary({ flavors }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<CategoryKey>("handscooped");
  /** The open editor sets this; collapsing a dirty editor asks first. */
  const dirtyRef = useRef(false);
  /** Synchronous double-tap latch — `busy` state is async and misses same-tick taps. */
  const inFlightRef = useRef(false);

  const working = busy || pending;

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return flavors
      .filter((f) => (showRetired ? true : !f.retired))
      .filter((f) => !q || f.name.toLowerCase().includes(q));
  }, [flavors, filter, showRetired]);

  async function save(patch: Record<string, unknown>): Promise<Flavor | null> {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    setError("");
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
        setError(json.error ?? "That didn't save — try again.");
        return null;
      }
      dirtyRef.current = false;
      startTransition(() => router.refresh());
      return json.flavor ?? null;
    } catch {
      setError("That didn't save — check the connection and try again.");
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
    const created = await save({ name, category: newCategory });
    if (created) {
      setNewName("");
      setOpenId(created.id);
    }
  }

  return (
    <div aria-busy={working}>
      {/* Create here, not just from the case — no shop's board required. */}
      <div className="card mt-5 p-4">
        <label htmlFor="lib-new" className="block text-sm font-semibold">
          New flavor
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id="lib-new"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Lemon Poppyseed"
            className="field max-w-xs"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as CategoryKey)}
            aria-label="Board"
            className="field max-w-52"
          >
            {CATEGORIES.map((c) => (
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
          It lands in the library only — put it in a case from The Case screen
          when it&apos;s churned.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search…"
          aria-label="Search flavors"
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

      <ul className="mt-4 grid gap-3">
        {visible.map((f) => (
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
                <span className="block text-xs text-ink-soft">
                  {CATEGORIES.find((c) => c.key === f.category)?.label}
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
                markDirty={() => (dirtyRef.current = true)}
                working={working}
              />
            ) : null}
          </li>
        ))}
        {visible.length === 0 ? (
          <li className="card px-4 py-6 text-center text-sm text-ink-soft">
            No flavor matches that
            {!showRetired ? " — it might be retired; flip on “Show retired” above" : ""}.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function FlavorEditor({
  flavor,
  save,
  setError,
  markDirty,
  working,
}: {
  flavor: Flavor;
  save: (patch: Record<string, unknown>) => Promise<Flavor | null>;
  setError: (e: string) => void;
  markDirty: () => void;
  working: boolean;
}) {
  const [name, setName] = useState(flavor.name);
  const [description, setDescription] = useState(flavor.description);
  const [category, setCategory] = useState<CategoryKey>(flavor.category);
  const [allergens, setAllergens] = useState<Allergen[]>(flavor.allergens);
  const [sizes, setSizes] = useState<Size[]>(flavor.sizes);
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

  async function onSave() {
    // A half-filled size row must not vanish silently on save.
    const halfFilled = sizes.some((s) => (s.label.trim() === "") !== (s.price.trim() === ""));
    if (halfFilled) {
      setError("One of the size rows is missing its name or price — fill it in or clear both boxes.");
      return;
    }
    await save({
      id: flavor.id,
      name,
      description,
      category,
      allergens,
      sizes: sizes.filter((s) => s.label.trim() && s.price.trim()),
    });
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
        setError(json.error ?? "The photo didn't upload — try again.");
        return;
      }
      const saved = await save({ id: flavor.id, photoUrl: json.url });
      if (!saved) return; // save() already surfaced its error
    } catch {
      // A file the browser can't decode (HEIC on some browsers, a corrupt
      // shot) rejects in resizeToJpeg — that must not fail silently.
      setError("Couldn't read that photo — try a different one, or a screenshot of it.");
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
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
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

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Allergens</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
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
          onClick={() => save({ id: flavor.id, retired: !flavor.retired })}
          className="min-h-12 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-berry hover:underline"
          disabled={working}
        >
          {flavor.retired ? "Bring it back" : "Retire it"}
        </button>
      </div>
    </div>
  );
}
