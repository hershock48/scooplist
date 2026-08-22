"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The tagline's first word, cycling through the verticals the product
 * serves: Flavor boards, Menu boards, Tap boards, Specials boards. Kevin's
 * ask, and the honest version of the pitch now that the app is
 * env-configurable: one engine, several boards.
 *
 * Mechanics, each the survivor of a known trap:
 *
 *  - The CURRENT word sits in normal flow, so the container's baseline is
 *    the word's own baseline and descenders never clip; only the LEAVING
 *    word is absolutely positioned, riding up and out under overflow:
 *    hidden (the keyframes live in globals.css, .sl-flip-*).
 *  - The slot's width is measured per word and transitioned. Two rejected
 *    versions bracket why: free width + natural wrapping re-wrapped the
 *    sentence when the word changed ("Menu" fit one line, "Specials"
 *    broke to two, the layout breathed every 2 seconds); a slot fixed at
 *    the widest word kept the lines stable but parked "Tap" in a
 *    "Specials"-wide hole that read as a typo, rendered and seen. The
 *    resolution lives in the PAGE, not here: the sentence hard-breaks
 *    after "boards" below lg and runs nowrap at lg+, so the line count
 *    is constant at every viewport no matter what the width does, and
 *    the width is free to ease. Until measurement lands the width is
 *    auto, which is also the no-JS render: the static first word, a
 *    complete page (glaze.md rule 1 of motion).
 *  - Reduced motion: the interval never starts, the first word stands.
 *    Checked here rather than only in CSS because stopping the swap beats
 *    snapping it.
 *  - Screen readers get the static first word once (sr-only); the
 *    animation is aria-hidden so the sentence is read exactly once, not
 *    re-announced every few seconds.
 */
export default function FlipWord({ words, className = "" }: { words: string[]; className?: string }) {
  const [idx, setIdx] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [widths, setWidths] = useState<number[] | null>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const spans = Array.from(el.children) as HTMLSpanElement[];
    setWidths(spans.map((s) => s.getBoundingClientRect().width));
  }, [words]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tick = setInterval(() => {
      setIdx((cur) => {
        setLeaving(cur);
        return (cur + 1) % words.length;
      });
    }, 1800);
    return () => clearInterval(tick);
  }, [words.length]);

  useEffect(() => {
    if (leaving === null) return;
    const id = setTimeout(() => setLeaving(null), 360);
    return () => clearTimeout(id);
  }, [leaving]);

  return (
    <>
      <span className="sr-only">{words[0]}</span>
      {/*
        clip-path, NOT overflow: hidden. An inline-block with overflow
        hidden baselines on its bottom margin edge (CSS 2.1 §10.8.1), which
        floated the whole word a descender's height above the rest of the
        sentence, rendered and observed. clip-path clips identically and
        leaves the baseline as the in-flow word's own.
      */}
      <span
        aria-hidden
        className={`relative inline-block align-baseline ${className}`}
        style={{
          clipPath: "inset(0)",
          width: widths ? `${Math.ceil(widths[idx])}px` : undefined,
          transition: "width 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <span key={idx} className="sl-flip-in block whitespace-nowrap">
          {words[idx]}
        </span>
        {leaving !== null ? (
          <span key={`out-${leaving}`} className="sl-flip-out absolute inset-x-0 top-0 block whitespace-nowrap">
            {words[leaving]}
          </span>
        ) : null}
        {/* Invisible measurer: every word rendered once, in this exact
            font context, so the width transition has real numbers. FIXED
            and hung off the LEFT edge: clip-path clips paint, not layout,
            so an absolute measurer wider than the slot still fed
            document.scrollWidth (a 6px page overflow at 320, measured);
            leftward overflow is the side scrollWidth never counts. */}
        <span ref={measureRef} className="pointer-events-none invisible fixed top-0 -left-[9999px] whitespace-nowrap">
          {words.map((w) => (
            <span key={w} className="inline-block">
              {w}
            </span>
          ))}
        </span>
      </span>
    </>
  );
}
