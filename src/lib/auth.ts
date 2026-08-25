import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Scooplist auth: a PIN and a cookie. A gate, not a vault (the pjs/devine
 * words, still true), nothing behind it moves money, and the worst a
 * breached gate can do is put Butter Pecan in the case, visibly, with
 * history. But a gate should still latch:
 *
 *  - The cookie carries an HMAC of the PIN, never the PIN itself. Set
 *    SCOOPLIST_SECRET to make cookie-guessing require the server secret;
 *    without it the key derives from the PIN (the cookie still never
 *    exposes the PIN to shoulder-surfing devtools).
 *  - Failed PINs throttle per address: 5 misses locks that address out for
 *    10 minutes. Per-process on serverless, a determined attacker can
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
 *
 * TWO COOKIE FORMATS since the org deployment mode arrived (org.ts):
 *
 *  legacy   HMAC-SHA256(secret, pin), hex. Unchanged byte for byte since
 *           day one, so deploying the org-capable build never signs the
 *           live installs out.
 *  org      "2.{slug}.{hmac}" where the hmac covers slug + the STORED pin
 *           hash. Binding to the hash rather than the plaintext means
 *           rotating an org's PIN invalidates its sessions, and the
 *           plaintext PIN never enters the cookie math at all. The "2."
 *           prefix is the format discriminator; a legacy value can never
 *           start with it (hex has no dots).
 *
 * Org PINs are stored as salted scrypt ("s1$salt$hash"), never plaintext.
 * The legacy single PIN stays an env var; it predates orgs and belongs to
 * the deployment, not a database row.
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

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** The legacy cookie check, extracted so org.ts can route on cookie format. */
export function isLegacyCookieValid(got: string): boolean {
  return got !== "" && safeEqual(got, cookieValue());
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  return isLegacyCookieValid(jar.get(COOKIE)?.value ?? "");
}

/* ------------------------------ org PINs ------------------------------ */

/**
 * scrypt over bcrypt/argon because it ships in node:crypto: no dependency,
 * and a 4 to 12 digit PIN behind a 10-minute lockout does not need a
 * tunable-cost arms race. The "s1$" prefix leaves room to change the
 * scheme without guessing what an old hash is.
 */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `s1$${salt}$${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "s1") return false;
  const hash = scryptSync(pin, parts[1], 32).toString("hex");
  return safeEqual(hash, parts[2]);
}

/**
 * Org mode always has SCOOPLIST_MASTER set (it IS the mode trigger, see
 * org.ts), so there is always a real secret here; the legacy
 * derive-from-pin fallback never applies to org cookies.
 */
function orgSecret(): string {
  return process.env.SCOOPLIST_SECRET || process.env.SCOOPLIST_MASTER || "";
}

export function orgCookieValue(slug: string, pinHash: string): string {
  const mac = createHmac("sha256", orgSecret()).update(`${slug}\n${pinHash}`).digest("hex");
  return `2.${slug}.${mac}`;
}

/* ------------------------------ cookies ------------------------------- */

/** No argument = the legacy value, today's behavior exactly. */
export async function setAuthCookie(org?: { slug: string; pinHash: string }): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, org ? orgCookieValue(org.slug, org.pinHash) : cookieValue(), {
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

/**
 * True while this key is locked out. Legacy keys are the bare address;
 * org keys are "{slug}|{addr}", so an address gets five tries PER ORG.
 * That multiplies an attacker's budget by the number of orgs they can
 * name, which is acceptable at this product's threat level (same gate-
 * not-a-vault doctrine as the header) and keeps one bar's fat-fingered
 * PIN from locking a neighbor out of theirs.
 */
export function pinLocked(key: string): boolean {
  const a = attempts().get(key);
  return !!a && a.lockedUntil > Date.now();
}

/** Record one attempt's outcome for the throttle. */
export function recordPinResult(key: string, ok: boolean): void {
  const map = attempts();
  if (ok) {
    map.delete(key);
    return;
  }
  const a = map.get(key) ?? { fails: 0, lockedUntil: 0 };
  a.fails += 1;
  if (a.fails >= MAX_FAILS) {
    a.lockedUntil = Date.now() + LOCK_MS;
    a.fails = 0;
  }
  map.set(key, a);
}

/** Check a submitted PIN against the legacy env PIN, throttle included. */
export function checkPin(key: string, pin: string): boolean {
  if (pinLocked(key)) return false;
  const ok = safeEqual(pin.trim(), adminPin());
  recordPinResult(key, ok);
  return ok;
}
