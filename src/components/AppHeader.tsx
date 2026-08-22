"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ScooplistMark from "@/components/Logo";

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
}: {
  current: "case" | "library" | "history";
  boardHref: string;
  /** Copy voice (vertical.ts voice()): "The case" is scoop vocabulary. */
  voice?: "scoops" | "neutral";
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

  const items: Item[] = [
    { href: "/case", label: voice === "neutral" ? "The board" : "The case" },
    { href: "/flavors", label: "Library" },
    { href: "/history", label: "History" },
    { href: boardHref, label: "TV board ↗", external: true },
  ];

  const isCurrent = (href: string) =>
    (current === "case" && href === "/case") ||
    (current === "library" && href === "/flavors") ||
    (current === "history" && href === "/history");

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
      <Link
        href="/case"
        className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-bold text-berry"
      >
        <ScooplistMark size={30} />
        Scooplist
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
      <div ref={wrap} className="relative sm:hidden">
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
