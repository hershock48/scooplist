import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Sign out. POST only, a GET would let any image tag or link prefetch on
 * the internet sign the owner out mid-rush.
 */
export async function POST(request: Request) {
  await clearAuthCookie();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
