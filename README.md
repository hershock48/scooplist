# Scooplist

Taplist.io for scoop shops — the product that turned out not to exist. Built by
[Glazed Web](https://glazedweb.com), August 2026, after a real search: nothing
does structured, per-shop "what's in the case" data with a public feed. What
exists is TV-signage software with no data behind it, and keg tools with kegs
baked into every screen.

The model, in one paragraph: a **library** holds every flavor a shop has ever
churned (name, story, allergens, tags, photo, price by size). Each shop
location has a **case** — the flavors scooping right now. Blowing through a
tub is two taps (tap the flavor, "Tub's empty"), and the replacement picker
opens itself. Everything downstream — the shop's website, the in-store TV
board, the counter QR menu — reads the same feed and is never edited directly.

First client: True North Ice Cream (two shops, different cases — the soft
serve machine is Marshall's). The seed data is their real August 2026 board.

## Run it

```
npm install
npm run build && npm start     # verify against THIS, never the dev server
npm run dev                    # development only
```

Zero-setup demo: no env vars needed. The store runs in memory (the admin says
so), the PIN falls back to 7623, photos store inline. `.env.example` is the
authority on the real configuration.

## Surfaces

- `/case` — the owner's screen, PIN-gated, phone-first. Shop tabs, the case
  grouped by board, two-tap out, picker-with-inline-new for in.
- `/flavors` — the library. Story, allergens, prices by size, photo upload
  (browser resizes to ≤900px JPEG before sending), retire/bring back.
- `/board/{location}` — public TV board. Dark, huge type, meta-refresh every
  60s: the dumbest reliable update for a TV stick left running all week.
- `GET /api/v1/case/{location}` — **the feed.** Public JSON, open CORS,
  `s-maxage=30, stale-while-revalidate`. This is what client sites consume.

## Decisions, with reasoning

- **Storage is the devine/pjs two-backend store** (Neon Postgres via
  `DATABASE_URL`, else in-memory with a visible warning; jsonb blobs,
  self-creating tables). Extracted per glaze/catalog — do not invent a new
  store shape here.
- **Case entries close, never delete.** `removedAt` is the history — "Mint
  Chip lasted four days" is the future analytics feature, and a bar logs a
  blown keg rather than erasing it.
- **PIN auth, 30-day cookie** (devine's gate-not-a-vault, lengthened: this
  lives on the owner's phone, not a shared screen, and daily re-auth is how
  boards go stale). The cookie carries an HMAC of the PIN, never the PIN
  (set `SCOOPLIST_SECRET` so cookie-guessing needs the server secret), and
  failed PINs lock the address out for ten minutes after five misses —
  per-instance on serverless, which is a documented limit, not an oversight.
  Nothing behind the gate moves money. If billing ever lands, that goes
  behind a real login.
- **Photos: Vercel Blob when configured, inline data-URL otherwise.** Blob is
  one click in the dashboard and part of the hosting (same ruling as Neon —
  nothing rented). The browser downscales before upload so a 4MB camera shot
  never crosses the wire.
- **Locations are env config** (`SCOOPLIST_LOCATIONS=slug:Name,…`), so the
  next client is a dashboard edit. Multi-tenant (accounts table, per-shop
  PINs, a signup) is deliberately NOT built — single-tenant per deployment
  until a second client proves the shape, the DeVine gating rule.
- **The feed is versioned (`/api/v1/`)** because client sites will depend on
  it; breaking it breaks live menus. Additive changes only; a break means v2.

## Wiring a client site

Fetch the feed server-side with a short revalidate and treat it as
unavailable-tolerant — keep rendering the last good copy (or a static
fallback) if the feed errors. The truenorth repo is the reference
integration.

## Before this is a product

- [ ] Set `SCOOPLIST_PIN`, `SCOOPLIST_SECRET`, `DATABASE_URL` (Neon), and
      `BLOB_READ_WRITE_TOKEN` in Vercel
- [ ] Remove the noindex in `next.config.ts` when it gets a real domain
- [x] Wire truenorth's flavor board to the feed — done, `truenorth/src/data/
      liveCase.ts` (env-flagged via SCOOPLIST_FEED_URL, static fallback);
      set the env on the truenorth Vercel project once this app is public
- [ ] Case history view ("what left the case, when") — the data is already kept
- [ ] Second tenant → extract multi-tenancy, not before
- [ ] QR counter menu page (the feed + a template; an evening)
- [ ] "Tell me when it's back" — customer flavor alerts; the Untappd hook
