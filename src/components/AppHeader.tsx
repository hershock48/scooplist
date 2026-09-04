"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ScooplistMark from "@/components/Logo";
import { presetByKey, surfaceTitle, type PresetKey, type VerticalNouns } from "@/lib/presets";

/**
 * The signed-in header.
 *
 * On a phone four inline links (case / library / TV board / sign out) wrapped
 * into a jumble beside the wordmark, so everything past the first tap target
 * looked like debris. Above `sm` they stay inline, there is room, and one
 * tap beats two. Below it, one Menu button opens a real dropdown.
 *
 * The dropdown closes on Escape, on an outside click, and on any navigation
 * inside it, a menu that stays open over the page you just asked for is the
 * classic mobile-nav bug.
 */

type Item = { href: string; label: string; external?: boolean };

export default function AppHeader({
  current,
  boardHref,
  voice = "scoops",
  nouns,
  preset,
  managed = false,
  orgName,
}: {
  current: "case" | "library" | "history" | "setup";
  boardHref: string;
  /** Copy voice (vertical.ts): "The case" is scoop vocabulary. */
  voice?: "scoops" | "neutral";
  /** The vertical's own words (presets.ts): case, cooler, board. */
  nouns?: VerticalNouns;
  /** Which preset the business is on; decides whether History is offered. */
  preset?: PresetKey;
  /**
   * True on the shared deployment, where the business type is set by us at
   * creation and the owner cannot change it (Kevin's ruling, 2 Sep 2026),
   * so the header does not offer the screen.
   */
  managed?: boolean;
  /**
   * The signed-in org's name, org-mode deployments only. One browser holds
   * one session, so whoever manages two shops switches by signing in
   * again; this label is what keeps "which case am I editing" on screen
   * the whole time instead of in their memory.
   */
  orgName?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const caseLabel = nouns
    ? surfaceTitle(nouns)
    : voice === "neutral"
      ? "The board"
      : "The case";
  const p = preset ? presetByKey(preset) : null;
  const showHistory = p ? p.history !== false : true;
  const showBoard = p ? p.board !== false : true;
  const items: Item[] = [
    { href: "/case", label: caseLabel },
    { href: "/flavors", label: "Library" },
    ...(showHistory ? [{ href: "/history", label: "History" }] : []),
    ...(managed ? [] : [{ href: "/setup", label: "Business type" }]),
    ...(showBoard ? [{ href: boardHref, label: "TV board ↗", external: true }] : []),
  ];

  const isCurrent = (href: string) =>
    (current === "case" && href === "/case") ||
    (current === "library" && href === "/flavors") ||
    (current === "history" && href === "/history") ||
    (current === "setup" && href === "/setup");

  const signOut = (
    <form method="post" action="/api/logout">
      <button
        type="submit"
        className="w-full text-left font-semibold text-ink-soft underline-offset-4 hover:text-berry hover:underline"
      >
        Sign out
      </button>
    </form>
  );

  return (
    <header className="flex items-center justify-between gap-3">
      {/*
        min-w-0 is load-bearing. A flex item defaults to min-width:auto, so
        without it this link refuses to shrink below its content and pushes
        the Menu button off the right edge of a phone (found on the True
        North account, whose org name is long). Everything that must keep
        its size is shrink-0; the org name is the one part allowed to
        truncate, which is what truncate needs a shrinkable parent for.

        On a phone the org name wins the space over the wordmark: the mark
        still says whose product this is, and the question the header has
        to answer while someone edits a case is WHOSE case. With no org
        name (the single-tenant installs) the wordmark stays.
      */}
      <Link
        href="/case"
        className="flex min-w-0 items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-bold text-berry"
      >
        <ScooplistMark size={30} className="shrink-0" />
        <span className={orgName ? "hidden shrink-0 sm:inline" : "shrink-0"}>Scooplist</span>
        {orgName ? (
          <span className="min-w-0 truncate text-base font-semibold text-ink-soft sm:max-w-56">
            {orgName}
          </span>
        ) : null}
      </Link>

      {/* Roomy screens keep every destination one tap away. */}
      <nav aria-label="Main" className="hidden items-center gap-4 text-sm font-semibold sm:flex">
        {items.map((i) =>
          isCurrent(i.href) ? (
            <span key={i.href} aria-current="page" className="text-ink">
              {i.label}
            </span>
          ) : (
            <Link
              key={i.href}
              href={i.href}
              {...(i.external ? { target: "_blank", rel: "noopener" } : {})}
              className="text-ink-soft underline-offset-4 hover:text-berry hover:underline"
            >
              {i.label}
            </Link>
          ),
        )}
        <div className="text-sm">{signOut}</div>
      </nav>

      {/* Phones get one button and a panel. */}
      <div ref={wrap} className="relative shrink-0 sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="app-menu"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 px-4 text-sm font-semibold text-ink"
        >
          Menu
          <span aria-hidden className="text-xs">
            {open ? "▲" : "▼"}
          </span>
        </button>
        {open ? (
          <nav
            id="app-menu"
            aria-label="Main"
            className="absolute right-0 top-full z-50 mt-2 w-52 rounded-[--radius-card] border border-ink/10 bg-cream p-2 shadow-lg"
          >
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                {...(i.external ? { target: "_blank", rel: "noopener" } : {})}
                aria-current={isCurrent(i.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`block min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold ${
                  isCurrent(i.href) ? "bg-cream-dim text-ink" : "text-ink-soft hover:bg-cream-dim"
                }`}
              >
                {i.label}
              </Link>
            ))}
            <div className="mt-1 border-t border-ink/10 px-3 py-2.5 text-sm">{signOut}</div>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
