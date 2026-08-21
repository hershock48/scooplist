import "server-only";

/**
 * Scooplist storage: the flavor library and each shop's case.
 *
 * Ported from devine/src/lib/workroom/store.ts, the account's newest copy of
 * the two-backend shape per glaze/catalog/apps.md. The jsonb-blob decision and
 * the self-creating tables are its; the domain here is a scoop shop: flavors
 * (the library — everything the shop has ever churned) and case entries
 * (which flavors are in which shop's dipping cabinet right now).
 *
 * Two backends behind one interface:
 *
 *   postgres   when DATABASE_URL (or POSTGRES_URL) is set. One click in
 *              Vercel: project > Storage > Create Database > Neon, free tier —
 *              part of the hosting the shop already has, so it does not break
 *              the "nothing rented" rule. Tables create themselves on first use.
 *
 *   memory     fallback so local dev and the build need nothing. On deployed
 *              serverless this only holds within one warm lambda, so the
 *              admin shows a plain warning when it is on memory: a demo that
 *              half-works silently is worse than one that says what is wrong.
 *
 * A case entry is never deleted, only closed (removedAt) — the history IS the
 * product's future analytics ("mint chip lasted four days"), and closing beats
 * deleting for the same reason a bar logs a blown keg instead of erasing it.
 *
 * Types and constants live in domain.ts (client-safe, no pg import) — the
 * browser UI imports THAT, never this file.
 */

import type { CaseEntry, Flavor } from "@/lib/domain";

type Store = {
  backend: "postgres" | "memory";
  listFlavors(): Promise<Flavor[]>;
  getFlavor(id: string): Promise<Flavor | null>;
  upsertFlavor(f: Flavor): Promise<void>;
  /** Open entries for one shop, oldest first (the order the case was built). */
  listCase(locationId: string): Promise<CaseEntry[]>;
  /** All entries for one shop, for history views later. */
  addToCase(e: CaseEntry): Promise<void>;
  /** Close the OPEN entry for this flavor at this shop. No-op if none. */
  closeCaseEntry(locationId: string, flavorId: string, removedAt: number): Promise<void>;
  /** When anything about a shop's case last changed, for "updated x ago". */
  caseUpdatedAt(locationId: string): Promise<number | null>;
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
  async addToCase(e) {
    bag().entries.set(e.id, e);
  },
  async closeCaseEntry(locationId, flavorId, removedAt) {
    for (const e of bag().entries.values()) {
      if (e.locationId === locationId && e.flavorId === flavorId && e.removedAt === null) {
        e.removedAt = removedAt;
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
    g.__scooplistPool = new Pool({
      connectionString: cs,
      ssl: cs?.includes("localhost") ? undefined : { rejectUnauthorized: false },
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
      CREATE INDEX IF NOT EXISTS scooplist_case_open
        ON scooplist_case (location_id) WHERE removed_at IS NULL;
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
    const r = await pool.query(
      `SELECT data FROM scooplist_case
       WHERE location_id = $1 AND removed_at IS NULL
       ORDER BY added_at ASC LIMIT 500`,
      [locationId],
    );
    return r.rows.map((row) => row.data as CaseEntry);
  },
  async addToCase(e) {
    const pool = await pgPool();
    await pool.query(
      `INSERT INTO scooplist_case (id, location_id, flavor_id, added_at, removed_at, data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
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
  async caseUpdatedAt(locationId) {
    const pool = await pgPool();
    const r = await pool.query(
      `SELECT GREATEST(MAX(added_at), MAX(removed_at)) AS t FROM scooplist_case WHERE location_id = $1`,
      [locationId],
    );
    const t = r.rows[0]?.t;
    return t == null ? null : Number(t);
  },
};

export function getStore(): Store {
  return connectionString() ? postgresStore : memoryStore;
}
