/**
 * A 303 with a RELATIVE Location. Every sign-in, sign-out and handoff
 * redirect goes through here instead of NextResponse.redirect(new URL(path,
 * request.url)): under `next start`, request.url carries the server's listen
 * address rather than the visitor's Host (measured on 20 Oct 2026: a PIN
 * posted to 127.0.0.1:4491 was redirected to localhost:4491/login), so an
 * absolute URL built from it can send the owner to the wrong origin behind
 * a proxy. Browsers resolve a relative Location against the page they
 * posted from, which is always the right one. Same fix as truenorth's
 * /api/inquiry and /api/order.
 */
export function seeOther(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } });
}
