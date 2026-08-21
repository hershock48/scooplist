import { NextResponse } from "next/server";
import { adminPin, setAuthCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let pin = "";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const b = (await request.json().catch(() => ({}))) as { pin?: string };
    pin = typeof b.pin === "string" ? b.pin : "";
  } else {
    const fd = await request.formData().catch(() => null);
    pin = String(fd?.get("pin") ?? "");
  }

  if (pin.trim() !== adminPin()) {
    return NextResponse.redirect(new URL("/login?bad=1", request.url), 303);
  }

  await setAuthCookie();
  return NextResponse.redirect(new URL("/case", request.url), 303);
}
