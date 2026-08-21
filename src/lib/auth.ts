import "server-only";

import { cookies } from "next/headers";

/**
 * Scooplist auth: a PIN and a cookie. A gate, not a vault (the pjs/devine
 * words, still true). Nothing behind it moves money: the worst a leaked PIN
 * can do is put Butter Pecan in the case, and the history log keeps even
 * that honest.
 *
 * The people using it are an owner with cold hands at the dipping cabinet
 * and whoever is behind the counter. A PIN they can tell each other over
 * the machine beats a password nobody remembers mid-rush.
 *
 * The fallback is the Marshall shop phone's last four, so a demo works with
 * zero setup and the owner can be told the PIN over the counter. Set
 * SCOOPLIST_PIN in Vercel before this carries a real case.
 *
 * 30-day cookie, not devine's 18 hours: this lives on the owner's own phone,
 * not a shared shop screen, and re-typing a PIN every morning is exactly the
 * friction that makes a board go stale.
 */

const COOKIE = "scooplist_admin";
const PIN_FALLBACK = "7623";

export function adminPin(): string {
  return process.env.SCOOPLIST_PIN || PIN_FALLBACK;
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === adminPin();
}

export async function setAuthCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, adminPin(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}
