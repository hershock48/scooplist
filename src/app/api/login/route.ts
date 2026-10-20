import { seeOther } from "@/lib/redirect";
import { checkPin, pinLocked, recordPinResult, setAuthCookie, verifyPin } from "@/lib/auth";
import { orgBySlug, orgMode, validOrgSlug } from "@/lib/org";

export const runtime = "nodejs";

function address(request: Request): string {
  // Vercel sets x-forwarded-for; locally there may be nothing, one shared
  // bucket beats no throttle.
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/**
 * PIN sign-in, both deployment modes. Legacy: the env PIN, the flow
 * unchanged since day one. Org mode: the body carries an org slug (the
 * hidden field on /login/{org}), the throttle keys per org+address, and
 * the PIN checks against the org's stored hash.
 *
 * A PIN for an org that does not exist burns a throttled attempt and gets
 * the same generic failure as a wrong PIN: login must not be an org
 * enumeration oracle, and the throttle must not be free to probe with.
 */
export async function POST(request: Request) {
  const addr = address(request);

  let pin = "";
  let orgSlug = "";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const b = (await request.json().catch(() => ({}))) as { pin?: string; org?: string };
    pin = typeof b.pin === "string" ? b.pin : "";
    orgSlug = typeof b.org === "string" ? b.org : "";
  } else {
    const fd = await request.formData().catch(() => null);
    pin = String(fd?.get("pin") ?? "");
    orgSlug = String(fd?.get("org") ?? "");
  }

  if (!orgMode()) {
    if (pinLocked(addr)) {
      return seeOther("/login?locked=1");
    }
    if (!checkPin(addr, pin)) {
      const flag = pinLocked(addr) ? "locked" : "bad";
      return seeOther(`/login?${flag}=1`);
    }
    await setAuthCookie();
    return seeOther("/case");
  }

  // The slug is re-validated BEFORE it goes anywhere near a redirect URL;
  // an invalid one lands on the plain login page, never reflected.
  if (!validOrgSlug(orgSlug)) {
    return seeOther("/login?bad=1");
  }
  const key = `${orgSlug}|${addr}`;
  if (pinLocked(key)) {
    return seeOther(`/login/${orgSlug}?locked=1`);
  }
  const org = await orgBySlug(orgSlug);
  const ok = Boolean(org && org.pinHash && verifyPin(pin.trim(), org.pinHash));
  recordPinResult(key, ok);
  if (!ok || !org) {
    const flag = pinLocked(key) ? "locked" : "bad";
    return seeOther(`/login/${orgSlug}?${flag}=1`);
  }
  await setAuthCookie({ slug: org.slug, pinHash: org.pinHash });
  return seeOther("/case");
}
