# Scooplist

Taplist.io for scoop shops, the product that turned out not to exist. Built by
[Glazed Web](https://glazedweb.com), August 2026, after a real search: nothing
does structured, per-shop "what's in the case" data with a public feed. What
exists is TV-signage software with no data behind it, and keg tools with kegs
baked into every screen.

The model, in one paragraph: a **library** holds every flavor a shop has ever
churned (name, story, allergens, tags, photo, price by size). Each shop
location has a **case**, the flavors scooping right now. Blowing through a
tub is two taps (tap the flavor, "Tub's empty"), and the replacement picker
opens itself. Everything downstream, the shop's website, the in-store TV
board, the counter QR menu, reads the same feed and is never edited directly.

First client: True North Ice Cream (two shops, different cases, the soft
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

- `/setup`, PIN-gated: "what kind of business is this?" A fresh,
  unconfigured install lands here first (the admin pages redirect while
  the choice is pending); the presets (`src/lib/presets.ts`) set the
  boards, default prices, allergen chips, demo data, and the app's own
  words (flavor/case, drink/cooler…), stored in `scooplist_settings`.
  Editable later from the menu ("Business type"). Env vars stay the
  operator override: `SCOOPLIST_CATEGORIES` pins a deployment entirely
  (the setup screen turns read-only), which is how the live installs
  stay exactly as deployed. "Something else" takes free-text nouns and a
  first board name.
- `/case`, the owner's screen, PIN-gated, phone-first. Shop tabs, the case
  grouped by board, two-tap out, picker-with-inline-new for in, per-board
  reorder (arrows, not drag: drag fights the swipe gesture and arrows work
  from a keyboard), and two in-between states: "running low" (last call on
  every screen) and "on deck" (queued, visible as coming, not on the boards).
- `/flavors`, the library. Story, maker/collaborator, ABV, allergens, prices
  by size, photo upload (browser resizes to ≤900px JPEG before sending),
  retire/bring back.
- `/history`, PIN-gated. What the closed case entries have been recording
  all along: runs, days on the board, share of the last 90 days, per shop.
  Also the export link.
- `/board/{location}`, public TV board. Dark, huge type, meta-refresh every
  60s: the dumbest reliable update for a TV stick left running all week.
  A store error degrades to a calm "back in a moment" with the refresh
  still armed, never an error page on a screen customers watch; and once
  every six hours the refresh is a hard reload, so a wedged TV stick
  recovers by itself.
- `GET /api/v1/case/{location}`, **the feed.** Public JSON, open CORS,
  `s-maxage=30, stale-while-revalidate`. This is what client sites consume.
  v1 additions (existing consumers unaffected): `producer`, `abv`, `low`,
  `position` on each flavor, and a top-level `onDeck` list.
- `GET /api/admin/export`, PIN-gated. The whole library and every case
  entry ever, one JSON file: the backup path and the ownership promise.

## Decisions, with reasoning

- **Storage is the devine/pjs two-backend store** (Neon Postgres via
  `DATABASE_URL`, else in-memory with a visible warning; jsonb blobs,
  self-creating tables). Extracted per glaze/catalog, do not invent a new
  store shape here.
- **Prices are per flavor, with per-shop overrides.** `Flavor.sizes` is the
  default list; `sizesByShop` overrides it for a counter that charges
  differently, and `sizesFor(flavor, shop)` resolves it. The override replaces
  the whole list rather than individual sizes, a per-size merge leaves a
  half-priced flavor the day someone renames a size. The feed resolves per
  location, so each shop's site, board, and any future checkout quote that
  shop's own numbers. The library keeps it collapsed until a flavor needs it.
- **Case entries close, never delete.** `removedAt` is the history, "Mint
  Chip lasted four days" is the future analytics feature, and a bar logs a
  blown keg rather than erasing it.
- **PIN auth, 30-day cookie** (devine's gate-not-a-vault, lengthened: this
  lives on the owner's phone, not a shared screen, and daily re-auth is how
  boards go stale). The cookie carries an HMAC of the PIN, never the PIN
  (set `SCOOPLIST_SECRET` so cookie-guessing needs the server secret), and
  failed PINs lock the address out for ten minutes after five misses, 
  per-instance on serverless, which is a documented limit, not an oversight.
  Nothing behind the gate moves money. If billing ever lands, that goes
  behind a real login.
- **Photos: Vercel Blob when configured, inline data-URL otherwise.** Blob is
  one click in the dashboard and part of the hosting (same ruling as Neon, 
  nothing rented). The browser downscales before upload so a 4MB camera shot
  never crosses the wire.
- **Locations are env config on single-tenant installs**
  (`SCOOPLIST_LOCATIONS=slug:Name,…`), so those deployments stay a
  dashboard edit. Multi-tenant was deliberately NOT built "until a second
  client proves the shape" (the DeVine gating rule); Cascarelli's proved
  the second vertical and Copper AC was the third install, so the gate is
  passed and org mode exists. See "One deployment, many shops" below. The
  retired ruling stays here as a retraction on the record: the gate was
  right, and so was walking through it when it tripped.
- **The vertical is env config too** (`SCOOPLIST_CATEGORIES`,
  `SCOOPLIST_ALLERGENS`, `SCOOPLIST_SIZES`, see `.env.example` and
  `src/lib/vertical.ts`): categories, allergen chips, and default price
  lists follow the locations pattern, defaulting to exactly the ice cream
  values that used to be hardcoded. A tavern's tap list (Cascarelli's, the
  prompt for this) is a dashboard edit, not a fork. Client components get
  these as props, never by import: a client bundle cannot read server env.
- **Only admin surfaces seed.** The public feed and TV board used to call
  `seedIfEmpty()`, which meant a stranger's GET performed the first write
  on a fresh database. Now an empty library returns an empty board there,
  and the seed runs where a new operator actually lands (`/case`,
  `/flavors`). On the no-database demo, that also means: open `/case`
  once before showing the feed or board, memory is per-instance.
- **The feed is versioned (`/api/v1/`)** because client sites will depend on
  it; breaking it breaks live menus. Additive changes only; a break means v2.

## One deployment, many shops (org mode)

The central deployment serves many organizations from one database. The
mode rule lives in `src/lib/org.ts` and is opt-in: `SCOOPLIST_MASTER` set,
`SCOOPLIST_LOCATIONS` and `SCOOPLIST_CATEGORIES` both unset. Legacy is the
default, so deploying this code to a single-tenant install changes nothing
there (its database self-migrates additively: an org_id column defaulting
to 'default', a widened unique index, an orgs table nothing reads).

The central deployment IS the `scooplist` Vercel project at
scooplist.glazedweb.com, which was True North's single-tenant install:
Kevin's call, August 2026, that the product's domain should belong to the
product and True North should be its first org rather than a special case
squatting on it. The flip mechanism is below; Cascarelli's stays
single-tenant on its own project until there is a reason to move it.

The URL map, per org:

- `/login/{org}` is the sign-in link Kevin hands the owner (plus their PIN)
- `/board/{org}/{location}` is the TV board
- `/api/v1/orgs/{org}/case/{location}` is the public feed, same JSON shape
  and additive-only contract as the legacy `/api/v1/case/{location}`

What an owner on the shared deployment does NOT get (Kevin's rulings, 2 Sep
2026, looking at Copper's account):

- **Business type is ours, not theirs.** It is set at creation through the
  master route and an owner cannot change it: the header does not link to
  `/setup`, the page shows a "set up by Glazed Web" note instead of the form,
  and `POST /api/admin/setup` answers 409 in org mode. Single-tenant installs
  keep the editable screen (his earlier ruling stands there). To change a
  business's type, re-run `create-org` with the same slug.
- **History is per trade.** `history: false` on a preset (tavern today) drops
  the link and redirects `/history` to `/case`. A scoop shop rotating forty
  flavors wants the screen; a bar with sixteen handles does not. The data
  keeps accruing either way.
- **A trade can have a live word.** `nouns.live` on a preset ("pouring" for
  tavern) turns "In the Copper Athletic Club cooler" into "Pouring at Copper
  Athletic Club", the case screen's title into "Pouring", and the TV board's
  heading into "Copper Athletic Club, pouring now". It is read from the
  preset in code at resolve time, never from the stored row, so a better word
  reaches every existing business on deploy without touching the database.

Creating an org (upsert, so a re-run rotates a PIN or edits locations):

    $env:SCOOPLIST_MASTER = "<the master secret>"
    node tools/create-org.mjs --url https://scooplist.glazedweb.com `
      --slug copperac --name "Copper Athletic Club" --pin <pin> `
      --preset tavern --categories "taps:On Tap,cocktails:Cocktails" `
      --locations "marshall:Copper Athletic Club"

### Flipping a single-tenant install into the org deployment

The data never leaves the database; it is re-labeled in place, history
included. In order, and quickly, because between steps 1 and 2 the old
public URLs serve fallbacks:

1. Vercel dashboard, on the install's project: set `SCOOPLIST_MASTER`
   (long and random) and `SCOOPLIST_LEGACY_ALIAS=<slug>` (the org the old
   URLs should keep serving). `SCOOPLIST_SECRET` should already be set.
   Redeploy.
2. `node tools/create-org.mjs --url <the deployment> --slug <slug> --name
   "<Name>" --pin <new pin> --preset <preset> --locations "..."
   --adopt-legacy` with the master secret in the terminal. Adoption
   replaces seeding: the org inherits the whole library, case, and
   history.
3. Verify: the OLD feed URL (`/api/v1/case/{location}`) and the old
   `/board/{location}` answer identically to before; the org URLs answer
   the same data; `/api/status` shows `mode: "orgs"`.
4. Tell the owner their PIN changed and their sign-in link is now
   `/login/{slug}` (the legacy cookie died with the flip; the TV boards
   and the site never noticed anything).

Consumer sites on the legacy feed path keep working through the alias
indefinitely; moving them to `/api/v1/orgs/{slug}/case/{location}` is a
one-line cleanup whenever their repo is next open.

`--categories` overrides the preset's boards; without it the preset's own
list applies and seeding presets (scoops, or the full Cascarelli's-shaped
bar contract) fill an empty library. Org config lives in the database
(vertical in the settings table, locations on the org row); the env vars
are legacy-install config and are ignored per-org on purpose, so one
dashboard edit can never restyle every tenant at once.

Verify with the same discipline as everything else: `npm run build` then
`npm start` (never the dev server), and walk one org end to end: create,
sign in, add a drink, see it on `/board/{org}/{location}` and in the feed.

## Wiring a client site

Fetch the feed server-side with a short revalidate and treat it as
unavailable-tolerant, keep rendering the last good copy (or a static
fallback) if the feed errors. The truenorth repo is the reference
integration for legacy feeds; copperac (org feed, section-map template
from glaze/assets/scooplist-feed/) is the reference for org feeds.

## Before this is a product

- [x] Set `SCOOPLIST_PIN`, `SCOOPLIST_SECRET`, `DATABASE_URL` (Neon), and
      `BLOB_READ_WRITE_TOKEN` in Vercel, verified via `/api/status`
      (all true, `vercelEnv: production`), August 2026
- [ ] Remove the noindex in `next.config.ts` when it gets a real domain
- [x] Wire truenorth's flavor board to the feed, done end to end:
      `truenorth/src/data/liveCase.ts` + `SCOOPLIST_FEED_URL` set on the
      truenorth Vercel project, verified via truenorth's `/api/status`
      ("Live: the boards render from Scooplist"), August 2026
- [x] Case history view, `/history`, August 2026
- [x] Export, `/api/admin/export`, August 2026
- [x] Second tenant → extract multi-tenancy, not before. Gate passed:
      Cascarelli's proved the second vertical, Copper AC was the third
      install. Org mode shipped August 2026 (`SCOOPLIST_MASTER`, orgs as
      data, per-org login links and feeds); the two single-tenant installs
      stay on their own deployments, zero migration. Still deliberately
      NOT built: signup, billing, real accounts.
- [ ] QR counter menu page (the feed + a template; an evening)
- [ ] "Tell me when it's back", customer flavor alerts; the Untappd hook
