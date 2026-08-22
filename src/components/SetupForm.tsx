"use client";

import { useState } from "react";
import { PRESETS, type PresetKey, type VerticalNouns } from "@/lib/presets";

/**
 * The business-type picker. Cards, not a dropdown: the choice is the whole
 * page's job and there are four of them. "Something else" opens the short
 * noun form (Kevin's ruling): what one thing is called, what the display
 * is called, and the first board's name, all optional with honest
 * defaults, so a bakery can be "bake / the counter" without waiting for a
 * bakery preset.
 */

type Props = {
  /** The stored preset, when re-entering; null on first run. */
  current: PresetKey | null;
  currentNouns: VerticalNouns;
  /** Library non-empty: switching boards deserves a warning, and no demo
      data will be seeded over real data. */
  hasData: boolean;
};

export default function SetupForm({ current, currentNouns, hasData }: Props) {
  const [picked, setPicked] = useState<PresetKey | null>(current);
  const [item, setItem] = useState(current === "other" ? currentNouns.item : "");
  const [surface, setSurface] = useState(current === "other" ? currentNouns.surface : "");
  const [prep, setPrep] = useState<"in" | "on">(current === "other" ? currentNouns.prep : "on");
  const [firstBoard, setFirstBoard] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const changingBoards = hasData && current !== null && picked !== null && picked !== current;

  async function submit() {
    if (!picked || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset: picked,
          other:
            picked === "other"
              ? { item: item.trim(), surface: surface.trim(), prep, firstBoard: firstBoard.trim() }
              : undefined,
        }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "That didn't save, try again.");
        return;
      }
      window.location.href = "/case";
    } catch {
      setError("That didn't save, check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div role="radiogroup" aria-label="Business type" className="grid gap-3 sm:grid-cols-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            role="radio"
            aria-checked={picked === p.key}
            onClick={() => setPicked(p.key)}
            className={`card px-5 py-4 text-left transition-colors ${
              picked === p.key ? "border-berry ring-2 ring-berry" : "hover:border-berry/40"
            }`}
          >
            <span className="block font-[family-name:var(--font-display)] text-xl font-semibold">
              {p.label}
              {current === p.key ? (
                <span className="ml-2 text-xs font-normal text-ink-soft">current</span>
              ) : null}
            </span>
            <span className="mt-1 block text-sm text-ink-soft">{p.blurb}</span>
            <span className="mt-3 flex flex-wrap gap-1.5">
              {p.categories.map((c) => (
                <span key={c.key} className="chip bg-cream-dim px-2.5 py-1 text-xs text-ink">
                  {c.label}
                </span>
              ))}
            </span>
            {p.seeds && !hasData ? (
              <span className="mt-2 block text-xs text-ink-soft">
                Starts with a sample {p.key === "tavern" ? "tap list" : "board"} you can clear.
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {picked === "other" ? (
        <div className="card mt-4 px-5 py-4">
          <p className="text-sm font-semibold">Your words, if ours don&apos;t fit</p>
          <p className="mt-1 text-xs text-ink-soft">
            All optional. The app says things like &ldquo;New {item.trim() || "item"}&rdquo; and
            &ldquo;Nothing {prep} the {surface.trim() || "board"} yet&rdquo;.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-semibold">
              One thing is a…
              <input
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="item"
                className="field mt-1 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              The display is the…
              <input
                value={surface}
                onChange={(e) => setSurface(e.target.value)}
                placeholder="board"
                className="field mt-1 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              First board&apos;s name
              <input
                value={firstBoard}
                onChange={(e) => setFirstBoard(e.target.value)}
                placeholder="On the Menu"
                className="field mt-1 font-normal"
              />
            </label>
          </div>
          <fieldset className="mt-3">
            <legend className="text-sm font-semibold">Things go…</legend>
            <div className="mt-1 flex gap-2">
              {(["on", "in"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={prep === p}
                  onClick={() => setPrep(p)}
                  className={`chip min-h-10 px-4 ${prep === p ? "bg-berry text-cream" : "bg-cream-dim text-ink"}`}
                >
                  {p} the {surface.trim() || "board"}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {changingBoards ? (
        <p className="card mt-4 border-berry/40 bg-berry/5 px-4 py-3 text-sm font-medium text-berry">
          Heads up: your library keeps everything, but items stay on the
          boards they were made for. Boards that aren&apos;t part of the new
          type stop showing until you switch back. Nothing is deleted.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="card mt-4 border-berry/40 bg-berry/5 px-4 py-3 text-sm font-medium text-berry">
          {error}
        </p>
      ) : null}

      <button
        onClick={submit}
        disabled={!picked || busy}
        className="btn mt-6 w-full disabled:opacity-60 sm:w-auto sm:px-10"
      >
        {busy ? "Setting up…" : current ? "Save the change" : "That's us, let's go"}
      </button>
    </div>
  );
}
