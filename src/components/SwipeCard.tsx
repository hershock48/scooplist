"use client";

import { useRef, useState } from "react";

/**
 * A case card you can swipe left to pull off the board.
 *
 * Built for a thumb at the dipping cabinet, so the rules are strict:
 *
 *  - The gesture NEVER decides for you. A completed swipe opens a confirm
 *    sheet; nothing leaves the board until the owner says so.
 *  - It must not fight the page. `touch-action: pan-y` leaves vertical
 *    scrolling to the browser, and the first few pixels decide the axis —
 *    once a drag is judged vertical it is abandoned, so scrolling past a
 *    row never smears it sideways.
 *  - Tap still works. A press that never crosses the slop threshold falls
 *    through to onTap, which is also the whole keyboard/screen-reader path:
 *    the card is a real button, swipe is an accelerator, never the only way.
 *  - Pointer events, so a trackpad drag behaves the same as a thumb.
 */

const SLOP = 8; // px before the gesture commits to an axis
const TRIGGER = 72; // px of travel that counts as "yes, pull it"

export default function SwipeCard({
  onTap,
  onSwiped,
  label,
  actionLabel = "Take off",
  children,
}: {
  onTap: () => void;
  onSwiped: () => void;
  label: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [sliding, setSliding] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"undecided" | "x" | "y">("undecided");
  /*
   * A pointerup that ended a horizontal drag is STILL followed by a click.
   * Without this latch the swipe fired onSwiped and then the click fired
   * onTap, so a swipe opened the details sheet on top of the confirm sheet
   * and looked like the gesture had done nothing. Any horizontal gesture
   * eats exactly one click — including one that snapped back, because that
   * was a cancelled swipe, not a tap.
   */
  const swallowClick = useRef(false);

  function down(e: React.PointerEvent) {
    // Ignore secondary buttons; let the browser keep right-click etc.
    if (e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY };
    axis.current = "undecided";
    swallowClick.current = false;
    setSliding(false);
  }

  function move(e: React.PointerEvent) {
    if (!start.current) return;
    const mx = e.clientX - start.current.x;
    const my = e.clientY - start.current.y;

    if (axis.current === "undecided") {
      if (Math.abs(my) > SLOP && Math.abs(my) >= Math.abs(mx)) {
        // Vertical: this is a scroll, not a swipe. Hands off.
        axis.current = "y";
        start.current = null;
        setDx(0);
        return;
      }
      if (Math.abs(mx) > SLOP) {
        axis.current = "x";
        e.currentTarget.setPointerCapture(e.pointerId);
      } else {
        return;
      }
    }

    if (axis.current !== "x") return;
    // Left only, with resistance past the trigger so it feels like rubber.
    const raw = Math.min(0, mx);
    setDx(raw < -TRIGGER ? -TRIGGER - (Math.abs(raw) - TRIGGER) * 0.35 : raw);
  }

  function up() {
    if (!start.current && axis.current !== "x") return;
    const pulled = dx <= -TRIGGER;
    start.current = null;
    setSliding(true);
    setDx(0);
    if (axis.current === "x") {
      axis.current = "undecided";
      swallowClick.current = true;
      if (pulled) onSwiped();
    }
  }

  function click() {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    onTap();
  }

  const revealed = Math.min(1, Math.abs(dx) / TRIGGER);

  return (
    <div className="relative overflow-hidden rounded-[--radius-card]">
      {/* What the swipe uncovers. Hidden from AT: the button below says it. */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-end bg-berry px-4 text-sm font-semibold text-cream"
        style={{ opacity: revealed }}
      >
        {actionLabel}
      </div>
      <button
        type="button"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={click}
        aria-label={label}
        className="card relative block w-full touch-pan-y overflow-hidden text-left"
        style={{
          transform: `translateX(${dx}px)`,
          transition: sliding ? "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
        }}
        onTransitionEnd={() => setSliding(false)}
      >
        {children}
      </button>
    </div>
  );
}
