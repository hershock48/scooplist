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
 * Types and constants live in domain.ts (client-safe, no pg import), the
 * browser UI imports THAT, never this file.
 */

import type { CaseEntry, Flavor } from "@/lib/domain";

type Store = {
  backend: "postgres" | "memory";
  listFlavors(): Promise<Flavor[]>;
  /** Cheap emptiness probe, the seed check must not haul every jsonb row. */
  hasAnyFlavors(): Promise<boolean>;
  getFlavor(id: string): Promise<Flavor | null>;
  upsertFlavor(f: Flavor): Promise<void>;
  /** Open entries for one shop, oldest first (the order the case was built). */
  listCase(locationId: string): Promise<CaseEntry[]>;
  /**
   * EVERY entry, open and closed, the history nothing used to read. This is
   * the analytics ("Mint Chip lasted four days") and the export. Newest
   * first, capped generously; the cap is logged if it ever trims.
   */
  listEntries(): Promise<CaseEntry[]>;
  /**
   * IDEMPOTENT: a flavor already open at this shop is not added twice. The
   * guard lives here (unique partial index / in-store check), not in the API
   * route, a check-then-insert in the route is a race two double-tap POSTs
   * will lose.
   */
  addToCase(e: CaseEntry): Promise<void>;
  /** Close the OPEN entry for this flavor at this shop. No-op if none. */
  closeCaseEntry(locationId: string, flavorId: string, removedAt: number): Promise<void>;
  /** Set/clear the open entry's status: "low", "ondeck", or null = scooping. */
  setCaseStatus(locationId: string, flavorId: string, status: "low" | "ondeck" | null): Promise<void>;
  /** Overwrite positions for a shop's open entries, in the order given. */
  reorderCase(locationId: string, flavorIds: string[]): Promise<void>;
  /** When anything about a shop's case last changed, for "updated x ago". */
  caseUpdatedAt(locationId: string): Promise<number | null>;
  /**
   * Run `fn` at most once across concurrent callers, the seed guard. On
   * postgres this takes an advisory lock so two cold serverless instances
   * cannot both seed a fresh database; in memory a memoized promise does it.
   */
  once(fn: () => Promise<void>): Promise<void>;
};

/* ------------------------------ memory ------------------------------ */

type Bag = {
  flavors: Map<string, Flavor>;
  entries: Map<string, CaseEntry>;
};

function bag(): Bag {
  const g = globalThis as typeof globalThis & { __scooplist?: Bag };
  if (!g.__scooplist) {
    g.__scooplist = { flavors: new Map(), entries: new Map() };
  }
  return g.__scooplist;
}

const memoryStore: Store = {
  backend: "memory",
  async listFlavors() {
    return [...bag().flavors.values()].sort((a, b) => a.name.localeCompare(b.name));
  },
  async hasAnyFlavors() {
    return bag().flavors.size > 0;
  },
  async getFlavor(id) {
    return bag().flavors.get(id) ?? null;
  },
  async upsertFlavor(f) {
    bag().flavors.set(f.id, f);
  },
  async listCase(locationId) {
    return [...bag().entries.values()]
      .filter((e) => e.locationId === locationId && e.removedAt === null)
      .sort((a, b) => a.addedAt - b.addedAt);
  },
  async listEntries() {
    return [...bag().entries.values()].sort((a, b) => b.addedAt - a.addedAt);
  },
  async addToCase(e) {
    const open = [...bag().entries.values()].some(
      (x) => x.locationId === e.locationId && x.flavorId === e.flavorId && x.removedAt === null,
    );
    if (!open) bag().entries.set(e.id, e);
  },
  async closeCaseEntry(locationId, flavorId, removedAt) {
    for (const e of bag().entries.values()) {
      if (e.locationId === locationId && e.flavorId === flavorId && e.removedAt === null) {
        e.removedAt = removedAt;
      }
    }
  },
  async setCaseStatus(locationId, flavorId, status) {
    for (const e of bag().entries.values()) {
      if (e.locationId === locationId && e.flavorId === flavorId && e.removedAt === null) {
        e.status = status;
      }
    }
  },
  async reorderCase(locationId, flavorIds) {
    const order = new Map(flavorIds.map((id, i) => [id, i]));
    for (const e of bag().entries.values()) {
      if (e.locationId === locationId && e.removedAt === null && order.has(e.flavorId)) {
        e.position = order.get(e.flavorId);
      }
    }
  },
  async caseUpdatedAt(locationId) {
    let t: number | null = null;
    for (const e of bag().entries.values()) {
      if (e.locationId !== locationId) continue;
      const latest = Math.max(e.addedAt, e.removedAt ?? 0);
      if (t === null || latest > t) t = latest;
    }
    return t;
  },
  async once(fn) {
    const g = globalThis as typeof globalThis & { __scooplistOnce?: Promise<void> };
    if (!g.__scooplistOnce) g.__scooplistOnce = fn();
    await g.__scooplistOnce;
  },
};

/* ----------------------------- postgres ----------------------------- */

function connectionString(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
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
      -- UNIQUE, deliberately: this is the "one open entry per flavor per
      -- shop" invariant. addToCase leans on it via ON CONFLICT.
      CREATE UNIQUE INDEX IF NOT EXISTS scooplist_case_open_uniq
        ON scooplist_case (location_id, flavor_id) WHERE removed_at IS NULL;
    `);
  }
  await g.__scooplistReady;
  return g.__scooplistPool;
}

const postgresStore: Store = {
  backend: "postgres",
  async listFlavors() {
    const pool = await pgPool();
    const r = await pool.query(`SELECT data FROM scooplist_flavors ORDER BY name ASC`);
    return r.rows.map((row) => row.data as Flavor);
  },
  async hasAnyFlavors() {
    const pool = await pgPool();
    const r = await pool.query(`SELECT 1 FROM scooplist_flavors LIMIT 1`);
    return r.rows.length > 0;
  },
  async getFlavor(id) {
    const pool = await pgPool();
    const r = await pool.query(`SELECT data FROM scooplist_flavors WHERE id = $1`, [id]);
    return (r.rows[0]?.data as Flavor) ?? null;
  },
  async upsertFlavor(f) {
    const pool = await pgPool();
    await pool.query(
      `INSERT INTO scooplist_flavors (id, name, data) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = $2, data = $3`,
      [f.id, f.name, JSON.stringify(f)],
    );
  },
  async listCase(locationId) {
    const pool = await pgPool();
    /*
      Fetch one PAST the cap so truncation is detectable. No real case has
      500 open entries (twenty taps, forty tubs), so hitting this means
      something is wrong upstream, and a silent trim would make the board
      quietly lie about it.
    */
    const r = await pool.query(
      `SELECT data FROM scooplist_case
       WHERE location_id = $1 AND removed_at IS NULL
       ORDER BY added_at ASC LIMIT 501`,
      [locationId],
    );
    if (r.rows.length > 500) {
      console.warn(`scooplist: case for ${locationId} exceeds 500 open entries, list truncated`);
      r.rows.length = 500;
    }
    return r.rows.map((row) => row.data as CaseEntry);
  },
  async listEntries() {
    const pool = await pgPool();
    const r = await pool.query(
      `SELECT data FROM scooplist_case ORDER BY added_at DESC LIMIT 20001`,
    );
    if (r.rows.length > 20000) {
      console.warn("scooplist: history exceeds 20000 entries, list truncated");
      r.rows.length = 20000;
    }
    return r.rows.map((row) => row.data as CaseEntry);
  },
  async addToCase(e) {
    const pool = await pgPool();
    await pool.query(
      `INSERT INTO scooplist_case (id, location_id, flavor_id, added_at, removed_at, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (location_id, flavor_id) WHERE removed_at IS NULL DO NOTHING`,
      [e.id, e.locationId, e.flavorId, e.addedAt, e.removedAt, JSON.stringify(e)],
    );
  },
  async closeCaseEntry(locationId, flavorId, removedAt) {
    const pool = await pgPool();
    await pool.query(
      `UPDATE scooplist_case
       SET removed_at = $3, data = data || jsonb_build_object('removedAt', $3::bigint)
       WHERE location_id = $1 AND flavor_id = $2 AND removed_at IS NULL`,
      [locationId, flavorId, removedAt],
    );
  },
  async setCaseStatus(locationId, flavorId, status) {
    const pool = await pgPool();
    // null clears the key entirely so the blob stays as small as it started.
    await pool.query(
      status === null
        ? `UPDATE scooplist_case SET data = data - 'status'
           WHERE location_id = $1 AND flavor_id = $2 AND removed_at IS NULL`
        : `UPDATE scooplist_case SET data = data || jsonb_build_object('status', $3::text)
           WHERE location_id = $1 AND flavor_id = $2 AND removed_at IS NULL`,
      status === null ? [locationId, flavorId] : [locationId, flavorId, status],
    );
  },
  async reorderCase(locationId, flavorIds) {
    const pool = await pgPool();
    // A handful of rows at most; one statement per row is simpler than a
    // jsonb VALUES join and impossible to get subtly wrong.
    for (let i = 0; i < flavorIds.length; i++) {
      await pool.query(
        `UPDATE scooplist_case SET data = data || jsonb_build_object('position', $3::int)
         WHERE location_id = $1 AND flavor_id = $2 AND removed_at IS NULL`,
        [locationId, flavorIds[i], i],
      );
    }
  },
  async caseUpdatedAt(locationId) {
    const pool = await pgPool();
    const r = await pool.query(
      `SELECT GREATEST(MAX(added_at), MAX(removed_at)) AS t FROM scooplist_case WHERE location_id = $1`,
      [locationId],
    );
    const t = r.rows[0]?.t;
    return t == null ? null : Number(t);
  },
  async once(fn) {
    // Advisory lock: two cold serverless instances hitting a fresh database
    // serialize here, and the second one re-checks inside fn (seedIfEmpty
    // re-probes) so it becomes a no-op instead of a double seed.
    const pool = await pgPool();
    await pool.query(`SELECT pg_advisory_lock(823542)`);
    try {
      await fn();
    } finally {
      await pool.query(`SELECT pg_advisory_unlock(823542)`);
    }
  },
};

export function getStore(): Store {
  return connectionString() ? postgresStore : memoryStore;
}
