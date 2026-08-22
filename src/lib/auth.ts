import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Scooplist auth: a PIN and a cookie. A gate, not a vault (the pjs/devine
 * words, still true) — nothing behind it moves money, and the worst a
 * breached gate can do is put Butter Pecan in the case, visibly, with
 * history. But a gate should still latch:
 *
 *  - The cookie carries an HMAC of the PIN, never the PIN itself. Set
 *    SCOOPLIST_SECRET to make cookie-guessing require the server secret;
 *    without it the key derives from the PIN (the cookie still never
 *    exposes the PIN to shoulder-surfing devtools).
 *  - Failed PINs throttle per address: 5 misses locks that address out for
 *    10 minutes. Per-process on serverless — a determined attacker can
 *    spread across instances, which is exactly why the README's
 *    productization list has real auth on it. This raises the bar from
 *    "script the 10,000" to "not worth it for a menu."
 *
 * The fallback PIN is the Marshall shop phone's last four so a zero-setup
 * demo works and the owner can be told it over the counter. Set
 * SCOOPLIST_PIN before this carries a real case.
 *
 * 30-day cookie, not devine's 18 hours: this lives on the owner's own
 * phone, and re-typing a PIN every morning is how boards go stale.
 */

const COOKIE = "scooplist_admin";
const PIN_FALLBACK = "7623";

export function adminPin(): string {
  return process.env.SCOOPLIST_PIN || PIN_FALLBACK;
}

function cookieValue(): string {
  const pin = adminPin();
  const secret = process.env.SCOOPLIST_SECRET || `scooplist-gate:${pin}`;
  return createHmac("sha256", secret).update(pin).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  const got = jar.get(COOKIE)?.value ?? "";
  return got !== "" && safeEqual(got, cookieValue());
}

export async function setAuthCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, cookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function clearAuthCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/* ------------------------- PIN attempt throttle ------------------------- */

const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;

type Attempts = Map<string, { fails: number; lockedUntil: number }>;

function attempts(): Attempts {
  const g = globalThis as typeof globalThis & { __scooplistPinAttempts?: Attempts };
  if (!g.__scooplistPinAttempts) g.__scooplistPinAttempts = new Map();
  return g.__scooplistPinAttempts;
}

/** True while this address is locked out. */
export function pinLocked(address: string): boolean {
  const a = attempts().get(address);
  return !!a && a.lockedUntil > Date.now();
}

/** Check a submitted PIN, recording the outcome for the throttle. */
export function checkPin(address: string, pin: string): boolean {
  if (pinLocked(address)) return false;
  const ok = safeEqual(pin.trim(), adminPin());
  const map = attempts();
  if (ok) {
    map.delete(address);
    return true;
  }
  const a = map.get(address) ?? { fails: 0, lockedUntil: 0 };
  a.fails += 1;
  if (a.fails >= MAX_FAILS) {
    a.lockedUntil = Date.now() + LOCK_MS;
    a.fails = 0;
  }
  map.set(address, a);
  return false;
}
