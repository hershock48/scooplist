import "server-only";

/**
 * Scooplist storage: the flavor library and each shop's case.
 *
 * Ported from devine/src/lib/workroom/store.ts, the account's newest copy of
 * the two-backend shape per glaze/catalog/apps.md. The jsonb-blob decision and
 * the self-creating tables are its; the domain here is a scoop shop: flavors
 * (the library, everything the shop has ever churned) and case entries
 * (which flavors are in which shop's dipping cabinet right now).
 *
 * Two backends behind one interface:
 *
 *   postgres   when DATABASE_URL (or POSTGRES_URL) is set. One click in
 *              Vercel: project > Storage > Create Database > Neon, free tier,
 *              part of the hosting the shop already has, so it does not break
 *              the "nothing rented" rule. Tables create themselves on first use.
 *
 *   memory     fallback so local dev and the build need nothing. On deployed
 *              serverless this only holds within one warm lambda, so the
 *              admin shows a plain warning when it is on memory: a demo that
 *              half-works silently is worse than one that says what is wrong.
 *
 * A case entry is never deleted, only closed (removedAt), the history IS the
 * product's future analytics ("mint chip lasted four days"), and closing beats
 * deleting for the same reason a bar logs a blown keg instead of erasing it.
 *
 * EVERY method is org-scoped since the multi-tenant deployment mode arrived
 * (org.ts). Single-tenant installs pass DEFAULT_ORG everywhere, and the DDL
 * backfills org_id = 'default' onto their existing rows, so a legacy
 * database keeps answering exactly as it always did with zero migration.
 *
 * Types and constants live in domain.ts (client-safe, no pg import), the
 * browser UI imports THAT, never this file.
 */

import { DEFAULT_ORG, type CaseEntry, type Flavor } from "@/lib/domain";

export type OrgRow = {
  slug: string;
  name: string;
  /** Salted scrypt via auth.ts hashPin, never plaintext. */
  pinHash: string;
  data: {
    locations: { id: string; name: string }[];
    createdAt: number;
    /**
     * The org's handoff key: a random secret the org's own website holds,
     * so its workroom can sign the owner into Scooplist without the PIN
     * (app/api/handoff). Minted at creation, kept across re-runs, rotated
     * only on request. Absent on orgs created before the feature.
     */
    handoffKey?: string;
  };
};

type Store = {
  backend: "postgres" | "memory";
  listFlavors(orgId: string): Promise<Flavor[]>;
  /** Cheap emptiness probe, the seed check must not haul every jsonb row. */
  hasAnyFlavors(orgId: string): Promise<boolean>;
  getFlavor(orgId: string, id: string): Promise<Flavor | null>;
  upsertFlavor(orgId: string, f: Flavor): Promise<void>;
  /** Open entries for one shop, oldest first (the order the case was built). */
  listCase(orgId: string, locationId: string): Promise<CaseEntry[]>;
  /**
   * EVERY entry, open and closed, the history nothing used to read. This is
   * the analytics ("Mint Chip lasted four days") and the export. Newest
   * first, capped generously; the cap is logged if it ever trims.
   */
  listEntries(orgId: string): Promise<CaseEntry[]>;
  /**
   * IDEMPOTENT: a flavor already open at this shop is not added twice. The
   * guard lives here (unique partial index / in-store check), not in the API
   * route, a check-then-insert in the route is a race two double-tap POSTs
   * will lose.
   */
  addToCase(orgId: string, e: CaseEntry): Promise<void>;
  /** Close the OPEN entry for this flavor at this shop. No-op if none. */
  closeCaseEntry(orgId: string, locationId: string, flavorId: string, removedAt: number): Promise<void>;
  /** Set/clear the open entry's status: "low", "ondeck", or null = scooping. */
  setCaseStatus(orgId: string, locationId: string, flavorId: string, status: "low" | "ondeck" | null): Promise<void>;
  /** Overwrite positions for a shop's open entries, in the order given. */
  reorderCase(orgId: string, locationId: string, flavorIds: string[]): Promise<void>;
  /** When anything about a shop's case last changed, for "updated x ago". */
  caseUpdatedAt(orgId: string, locationId: string): Promise<number | null>;
  /**
   * Settings the APP owns (the setup page's vertical choice), one jsonb
   * value per key per org. Env vars stay the operator override on top;
   * vertical.ts is the only reader and owns the precedence.
   */
  getSetting<T>(orgId: string, key: string): Promise<T | null>;
  setSetting(orgId: string, key: string, value: unknown): Promise<void>;
  /**
   * Run `fn` at most once across concurrent callers, the seed guard, scoped
   * per org so one tenant's long seed never serializes another's. On
   * postgres this takes an advisory lock; in memory a per-org promise chain.
   */
  once(orgId: string, fn: () => Promise<void>): Promise<void>;
  /** The org registry, org-mode deployments only (see org.ts). */
  getOrg(slug: string): Promise<OrgRow | null>;
  upsertOrg(row: OrgRow): Promise<void>;
  /**
   * Re-label every pre-org row (org_id 'default') as `orgId`: the flip
   * that turns a single-tenant install's data into that org, in place,
   * history included, nothing copied between databases. Idempotent: a
   * re-run finds nothing left to move. Sequential statements rather than
   * a transaction (the pool API hides connections, and a partial run
   * completes on re-run, which the master route's caller documents).
   */
  adoptDefaultOrg(orgId: string): Promise<void>;
};

/**
 * Settings scoping by KEY PREFIX rather than a new primary key: changing a
 * live table's PK is not an additive migration, and the legacy "vertical"
 * row has to keep working untouched. The slug regex (org.ts) bans "/", so
 * "org/{slug}/{key}" can never collide with a legacy key or another org's.
 */
function settingKey(orgId: string, key: string): string {
  return orgId === DEFAULT_ORG ? key : `org/${orgId}/${key}`;
}

/* ------------------------------ memory ------------------------------ */

type Bag = {
  flavors: Map<string, Flavor>;
  entries: Map<string, CaseEntry>;
  settings: Map<string, unknown>;
};

type Bags = {
  orgs: Map<string, OrgRow>;
  bags: Map<string, Bag>;
};

function allBags(): Bags {
  const g = globalThis as typeof globalThis & { __scooplist?: Bags | Bag };
  if (!g.__scooplist) {
    g.__scooplist = { orgs: new Map(), bags: new Map() };
  }
  // A bag created before orgs existed (hot reload across versions) is the
  // legacy deployment's data: wrap it as the default org's bag.
  const maybeOld = g.__scooplist as Bag & Partial<Bags>;
  if (!maybeOld.bags && maybeOld.flavors) {
    const old: Bag = {
      flavors: maybeOld.flavors,
      entries: maybeOld.entries,
      settings: maybeOld.settings ?? new Map(),
    };
    g.__scooplist = { orgs: new Map(), bags: new Map([[DEFAULT_ORG, old]]) };
  }
  return g.__scooplist as Bags;
}

function bag(orgId: string): Bag {
  const all = allBags();
  let b = all.bags.get(orgId);
  if (!b) {
    b = { flavors: new Map(), entries: new Map(), settings: new Map() };
    all.bags.set(orgId, b);
  }
  return b;
}

const memoryStore: Store = {
  backend: "memory",
  async listFlavors(orgId) {
    return [...bag(orgId).flavors.values()].sort((a, b) => a.name.localeCompare(b.name));
  },
  async hasAnyFlavors(orgId) {
    return bag(orgId).flavors.size > 0;
  },
  async getFlavor(orgId, id) {
    return bag(orgId).flavors.get(id) ?? null;
  },
  async upsertFlavor(orgId, f) {
    bag(orgId).flavors.set(f.id, f);
  },
  async listCase(orgId, locationId) {
    return [...bag(orgId).entries.values()]
      .filter((e) => e.locationId === locationId && e.removedAt === null)
      .sort((a, b) => a.addedAt - b.addedAt);
  },
  async listEntries(orgId) {
    return [...bag(orgId).entries.values()].sort((a, b) => b.addedAt - a.addedAt);
  },
  async addToCase(orgId, e) {
    const open = [...bag(orgId).entries.values()].some(
      (x) => x.locationId === e.locationId && x.flavorId === e.flavorId && x.removedAt === null,
    );
    if (!open) bag(orgId).entries.set(e.id, e);
  },
  async closeCaseEntry(orgId, locationId, flavorId, removedAt) {
    for (const e of bag(orgId).entries.values()) {
      if (e.locationId === locationId && e.flavorId === flavorId && e.removedAt === null) {
        e.removedAt = removedAt;
      }
    }
  },
  async setCaseStatus(orgId, locationId, flavorId, status) {
    for (const e of bag(orgId).entries.values()) {
      if (e.locationId === locationId && e.flavorId === flavorId && e.removedAt === null) {
        e.status = status;
      }
    }
  },
  async reorderCase(orgId, locationId, flavorIds) {
    const order = new Map(flavorIds.map((id, i) => [id, i]));
    for (const e of bag(orgId).entries.values()) {
      if (e.locationId === locationId && e.removedAt === null && order.has(e.flavorId)) {
        e.position = order.get(e.flavorId);
      }
    }
  },
  async caseUpdatedAt(orgId, locationId) {
    let t: number | null = null;
    for (const e of bag(orgId).entries.values()) {
      if (e.locationId !== locationId) continue;
      const latest = Math.max(e.addedAt, e.removedAt ?? 0);
      if (t === null || latest > t) t = latest;
    }
    return t;
  },
  async getSetting(orgId, key) {
    return (bag(orgId).settings.get(key) as never) ?? null;
  },
  async setSetting(orgId, key, value) {
    bag(orgId).settings.set(key, value);
  },
  async once(orgId, fn) {
    /*
      SERIALIZE, don't memoize-forever: this used to cache the first
      promise and skip every later fn, which was fine when seeding was a
      one-shot, and wrong the day /setup let the config change mid-process
      (choose tavern, then scoops: the scoops seed silently never ran,
      observed). The postgres twin is an advisory lock, i.e. mutual
      exclusion with re-entry; the "at most once" outcome comes from fn's
      own re-check inside, on both backends. One chain PER ORG, so one
      tenant's seed never queues behind another's.
    */
    const g = globalThis as typeof globalThis & { __scooplistOnce?: Map<string, Promise<void>> };
    if (!g.__scooplistOnce || !(g.__scooplistOnce instanceof Map)) g.__scooplistOnce = new Map();
    const run = (g.__scooplistOnce.get(orgId) ?? Promise.resolve()).then(fn);
    // Keep the chain alive even if fn rejects, or every later once() would
    // re-reject with a stale error.
    g.__scooplistOnce.set(orgId, run.catch(() => {}));
    await run;
  },
  async getOrg(slug) {
    return allBags().orgs.get(slug) ?? null;
  },
  async upsertOrg(row) {
    allBags().orgs.set(row.slug, row);
  },
  async adoptDefaultOrg(orgId) {
    const from = bag(DEFAULT_ORG);
    const to = bag(orgId);
    for (const [k, v] of from.flavors) to.flavors.set(k, v);
    for (const [k, v] of from.entries) to.entries.set(k, v);
    // The org's own settings win: creation just wrote them on purpose.
    for (const [k, v] of from.settings) if (!to.settings.has(k)) to.settings.set(k, v);
    from.flavors.clear();
    from.entries.clear();
    from.settings.clear();
  },
};

/* ----------------------------- postgres ----------------------------- */

/**
 * The env var actually holding the database URL, by name.
 *
 * Plain DATABASE_URL / POSTGRES_URL first. But the Vercel/Neon integration
 * injects PREFIXED names in real situations (observed on the Cascarelli's
 * install: DATABASE_CASCARELLIS_DATABASE_URL, with the connection's prefix
 * box empty and no dashboard path to rename it), and asking an operator to
 * hand-copy a secret between rows of the env screen cost a full evening.
 * So: accept any *_DATABASE_URL, then any *_POSTGRES_URL. The exact-suffix
 * match keeps the sibling variants out (…_URL_UNPOOLED, …_NON_POOLING,
 * …_PRISMA_URL, …_URL_NO_SSL, …_AUTH_URL all end differently); keys are
 * sorted so two candidates resolve the same way on every boot.
 */
export function connectionVar(): string | null {
  const env = process.env;
  if (env.DATABASE_URL) return "DATABASE_URL";
  if (env.POSTGRES_URL) return "POSTGRES_URL";
  const keys = Object.keys(env).sort();
  return (
    keys.find((k) => k.endsWith("_DATABASE_URL") && env[k]) ??
    keys.find((k) => k.endsWith("_POSTGRES_URL") && env[k]) ??
    null
  );
}

function connectionString(): string | undefined {
  const name = connectionVar();
  return name ? process.env[name] : undefined;
}

type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

async function pgPool(): Promise<PgPool> {
  const g = globalThis as typeof globalThis & { __scooplistPool?: PgPool; __scooplistReady?: Promise<unknown> };
  if (!g.__scooplistPool) {
    // Dynamic import so the dependency never loads unless a database is
    // actually configured (devine/pjs pattern, unchanged).
    const { Pool } = await import("pg");
    const cs = connectionString();
    // Local hosts (any spelling) get no forced TLS; cloud Postgres requires it.
    const local = /localhost|127\.0\.0\.1|\[::1\]/.test(cs ?? "") || cs?.includes("sslmode=disable");
    g.__scooplistPool = new Pool({
      connectionString: cs,
      ssl: local ? undefined : { rejectUnauthorized: false },
      max: 3,
    }) as unknown as PgPool;
    g.__scooplistReady = g.__scooplistPool.query(`
      CREATE TABLE IF NOT EXISTS scooplist_flavors (
        id text PRIMARY KEY,
        name text NOT NULL,
        data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scooplist_case (
        id text PRIMARY KEY,
        location_id text NOT NULL,
        flavor_id text NOT NULL,
        added_at bigint NOT NULL,
        removed_at bigint,
        data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scooplist_settings (
        key text PRIMARY KEY,
        data jsonb NOT NULL
      );
      -- The org column, added in place on live single-tenant databases:
      -- ADD COLUMN with a DEFAULT is additive and instant (Postgres 11+
      -- fast default, Neon qualifies), and 'default' is the sentinel every
      -- pre-org row belongs to (DEFAULT_ORG in domain.ts). Zero migration
      -- is the contract: the two pinned installs never run anything else.
      ALTER TABLE scooplist_flavors ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
      ALTER TABLE scooplist_case ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
      -- UNIQUE, deliberately: this is the "one open entry per flavor per
      -- shop" invariant, now per org. addToCase leans on it via ON
      -- CONFLICT. The new index is created BEFORE the old one is dropped
      -- so the invariant never has a gap; on a legacy database (org_id
      -- constant 'default') the two enforce the identical rule.
      CREATE UNIQUE INDEX IF NOT EXISTS scooplist_case_open_uniq2
        ON scooplist_case (org_id, location_id, flavor_id) WHERE removed_at IS NULL;
      DROP INDEX IF EXISTS scooplist_case_open_uniq;
      CREATE TABLE IF NOT EXISTS scooplist_orgs (
        slug text PRIMARY KEY,
        name text NOT NULL,
        pin_hash text NOT NULL,
        data jsonb NOT NULL
      );
    `);
  }
  await g.__scooplistReady;
  return g.__scooplistPool;
}

const postgresStore: Store = {
  backend: "postgres",
  async listFlavors(orgId) {
    const pool = await pgPool();
    const r = await pool.query(`SELECT data FROM scooplist_flavors WHERE org_id = $1 ORDER BY name ASC`, [orgId]);
    return r.rows.map((row) => row.data as Flavor);
  },
  async hasAnyFlavors(orgId) {
    const pool = await pgPool();
    const r = await pool.query(`SELECT 1 FROM scooplist_flavors WHERE org_id = $1 LIMIT 1`, [orgId]);
    return r.rows.length > 0;
  },
  async getFlavor(orgId, id) {
    const pool = await pgPool();
    // AND org_id: a guessed or pasted id from another org must miss, or the
    // admin case route becomes a cross-tenant reference hole.
    const r = await pool.query(`SELECT data FROM scooplist_flavors WHERE id = $1 AND org_id = $2`, [id, orgId]);
    return (r.rows[0]?.data as Flavor) ?? null;
  },
  async upsertFlavor(orgId, f) {
    const pool = await pgPool();
    await pool.query(
      `INSERT INTO scooplist_flavors (id, name, data, org_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = $2, data = $3 WHERE scooplist_flavors.org_id = $4`,
      [f.id, f.name, JSON.stringify(f), orgId],
    );
  },
  async listCase(orgId, locationId) {
    const pool = await pgPool();
    /*
      Fetch one PAST the cap so truncation is detectable. No real case has
      500 open entries (twenty taps, forty tubs), so hitting this means
      something is wrong upstream, and a silent trim would make the board
      quietly lie about it.
    */
    const r = await pool.query(
      `SELECT data FROM scooplist_case
       WHERE org_id = $1 AND location_id = $2 AND removed_at IS NULL
       ORDER BY added_at ASC LIMIT 501`,
      [orgId, locationId],
    );
    if (r.rows.length > 500) {
      console.warn(`scooplist: case for ${locationId} exceeds 500 open entries, list truncated`);
      r.rows.length = 500;
    }
    return r.rows.map((row) => row.data as CaseEntry);
  },
  async listEntries(orgId) {
    const pool = await pgPool();
    const r = await pool.query(
      `SELECT data FROM scooplist_case WHERE org_id = $1 ORDER BY added_at DESC LIMIT 20001`,
      [orgId],
    );
    if (r.rows.length > 20000) {
      console.warn("scooplist: history exceeds 20000 entries, list truncated");
      r.rows.length = 20000;
    }
    return r.rows.map((row) => row.data as CaseEntry);
  },
  async addToCase(orgId, e) {
    const pool = await pgPool();
    await pool.query(
      `INSERT INTO scooplist_case (id, location_id, flavor_id, added_at, removed_at, data, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (org_id, location_id, flavor_id) WHERE removed_at IS NULL DO NOTHING`,
      [e.id, e.locationId, e.flavorId, e.addedAt, e.removedAt, JSON.stringify(e), orgId],
    );
  },
  async closeCaseEntry(orgId, locationId, flavorId, removedAt) {
    const pool = await pgPool();
    await pool.query(
      `UPDATE scooplist_case
       SET removed_at = $3, data = data || jsonb_build_object('removedAt', $3::bigint)
       WHERE org_id = $4 AND location_id = $1 AND flavor_id = $2 AND removed_at IS NULL`,
      [locationId, flavorId, removedAt, orgId],
    );
  },
  async setCaseStatus(orgId, locationId, flavorId, status) {
    const pool = await pgPool();
    // null clears the key entirely so the blob stays as small as it started.
    await pool.query(
      status === null
        ? `UPDATE scooplist_case SET data = data - 'status'
           WHERE org_id = $3 AND location_id = $1 AND flavor_id = $2 AND removed_at IS NULL`
        : `UPDATE scooplist_case SET data = data || jsonb_build_object('status', $3::text)
           WHERE org_id = $4 AND location_id = $1 AND flavor_id = $2 AND removed_at IS NULL`,
      status === null ? [locationId, flavorId, orgId] : [locationId, flavorId, status, orgId],
    );
  },
  async reorderCase(orgId, locationId, flavorIds) {
    const pool = await pgPool();
    // A handful of rows at most; one statement per row is simpler than a
    // jsonb VALUES join and impossible to get subtly wrong.
    for (let i = 0; i < flavorIds.length; i++) {
      await pool.query(
        `UPDATE scooplist_case SET data = data || jsonb_build_object('position', $3::int)
         WHERE org_id = $4 AND location_id = $1 AND flavor_id = $2 AND removed_at IS NULL`,
        [locationId, flavorIds[i], i, orgId],
      );
    }
  },
  async caseUpdatedAt(orgId, locationId) {
    const pool = await pgPool();
    const r = await pool.query(
      `SELECT GREATEST(MAX(added_at), MAX(removed_at)) AS t FROM scooplist_case
       WHERE org_id = $1 AND location_id = $2`,
      [orgId, locationId],
    );
    const t = r.rows[0]?.t;
    return t == null ? null : Number(t);
  },
  async getSetting(orgId, key) {
    const pool = await pgPool();
    const r = await pool.query(`SELECT data FROM scooplist_settings WHERE key = $1`, [settingKey(orgId, key)]);
    return (r.rows[0]?.data as never) ?? null;
  },
  async setSetting(orgId, key, value) {
    const pool = await pgPool();
    await pool.query(
      `INSERT INTO scooplist_settings (key, data) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET data = $2`,
      [settingKey(orgId, key), JSON.stringify(value)],
    );
  },
  async once(orgId, fn) {
    // Advisory lock: two cold serverless instances hitting a fresh database
    // serialize here, and the second one re-checks inside fn (seedIfEmpty
    // re-probes) so it becomes a no-op instead of a double seed. Two-int
    // form: 823542 stays the app's namespace (so no collision with other
    // apps' locks on a shared database), hashtext discriminates per org so
    // tenants never serialize behind each other.
    const pool = await pgPool();
    await pool.query(`SELECT pg_advisory_lock(823542, hashtext($1))`, [orgId]);
    try {
      await fn();
    } finally {
      await pool.query(`SELECT pg_advisory_unlock(823542, hashtext($1))`, [orgId]);
    }
  },
  async getOrg(slug) {
    const pool = await pgPool();
    const r = await pool.query(`SELECT slug, name, pin_hash, data FROM scooplist_orgs WHERE slug = $1`, [slug]);
    const row = r.rows[0];
    if (!row) return null;
    return {
      slug: String(row.slug),
      name: String(row.name),
      pinHash: String(row.pin_hash),
      data: row.data as OrgRow["data"],
    };
  },
  async upsertOrg(row) {
    const pool = await pgPool();
    // Upsert on purpose: re-running creation is how a PIN gets rotated or a
    // location list gets edited, with no separate update surface to build.
    await pool.query(
      `INSERT INTO scooplist_orgs (slug, name, pin_hash, data) VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET name = $2, pin_hash = $3, data = $4`,
      [row.slug, row.name, row.pinHash, JSON.stringify(row.data)],
    );
  },
  async adoptDefaultOrg(orgId) {
    const pool = await pgPool();
    await pool.query(`UPDATE scooplist_flavors SET org_id = $1 WHERE org_id = 'default'`, [orgId]);
    await pool.query(`UPDATE scooplist_case SET org_id = $1 WHERE org_id = 'default'`, [orgId]);
    // Legacy settings take the org prefix; a key the org already owns
    // stays put (creation just wrote it on purpose, it wins).
    await pool.query(
      `UPDATE scooplist_settings SET key = 'org/' || $1 || '/' || key
       WHERE key NOT LIKE 'org/%'
         AND NOT EXISTS (
           SELECT 1 FROM scooplist_settings s2
           WHERE s2.key = 'org/' || $1 || '/' || scooplist_settings.key
         )`,
      [orgId],
    );
  },
};

export function getStore(): Store {
  return connectionString() ? postgresStore : memoryStore;
}
