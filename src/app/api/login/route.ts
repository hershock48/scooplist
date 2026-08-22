import { NextResponse } from "next/server";
import { checkPin, pinLocked, setAuthCookie } from "@/lib/auth";

export const runtime = "nodejs";

function address(request: Request): string {
  // Vercel sets x-forwarded-for; locally there may be nothing, one shared
  // bucket beats no throttle.
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: Request) {
  const addr = address(request);

  let pin = "";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const b = (await request.json().catch(() => ({}))) as { pin?: string };
    pin = typeof b.pin === "string" ? b.pin : "";
  } else {
    const fd = await request.formData().catch(() => null);
    pin = String(fd?.get("pin") ?? "");
  }

  if (pinLocked(addr)) {
    return NextResponse.redirect(new URL("/login?locked=1", request.url), 303);
  }
  if (!checkPin(addr, pin)) {
    const flag = pinLocked(addr) ? "locked" : "bad";
    return NextResponse.redirect(new URL(`/login?${flag}=1`, request.url), 303);
  }

  await setAuthCookie();
  return NextResponse.redirect(new URL("/case", request.url), 303);
}
