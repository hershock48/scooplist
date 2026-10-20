import { seeOther } from "@/lib/redirect";
import { clearAuthCookie } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Sign out. POST only, a GET would let any image tag or link prefetch on
 * the internet sign the owner out mid-rush.
 */
export async function POST() {
  await clearAuthCookie();
  return seeOther("/login");
}
