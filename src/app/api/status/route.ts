import { NextResponse } from "next/server";
import { locations } from "@/lib/locations";
import { blobToken, blobTokenVar } from "@/lib/blob";
import { connectionVar, getStore } from "@/lib/store";
import { resolveVertical } from "@/lib/vertical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Is this thing really wired up?", answerable in one click, without
 * signing in.
 *
 * It exists because the honest answer to "is photo storage on?" used to be
 * "log in and try it", which is a terrible thing to discover during a demo
 * in front of a client. Everything here is a boolean or a count: which
 * backends are live, and whether the library has anything in it. No
 * secrets, no tokens, no customer data, deliberately safe to leave public,
 * and no-store so it never answers from a cache.
 */
export async function GET() {
  const store = getStore();
  const blob = Boolean(blobToken());

  let flavors = 0;
  let reachable = true;
  try {
    flavors = (await store.listFlavors()).length;
  } catch {
    reachable = false;
  }

  const ok = store.backend === "postgres" && blob && reachable;

  return NextResponse.json(
    {
      ok,
      storage: {
        // "postgres" = the case survives restarts. "memory" = demo only.
        data: store.backend,
        reachable,
        // "blob" = uploaded photos live in real storage. "inline" = demo.
        photos: blob ? "blob" : "inline",
      },
      library: { flavors },
      shops: locations().map((l) => l.id),
      /*
        What kind of business this deployment thinks it is, and WHO decided:
        "env" = pinned by us in the dashboard, "store" = the owner's /setup
        choice, "default" = nothing configured (scoops). setupPending means
        a fresh install is still waiting on its first-run question.
      */
      vertical: await resolveVertical().then((v) => ({
        preset: v.preset,
        source: v.source,
        setupPending: v.setupPending,
        boards: v.categories.map((c) => c.key),
      })),
      /*
        Which variables this RUNNING deployment can actually see. Names only,
        never values, enough to tell "not connected" from "connected to the
        wrong environment" from "connected but never redeployed", which is
        otherwise an afternoon of guessing.
      */
      env: {
        BLOB_READ_WRITE_TOKEN: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        /* Same contract as resolvedDatabaseVar: the NAME the blob resolver
           picked, never the value. */
        resolvedBlobVar: blobTokenVar(),
        BLOB_STORE_ID: Boolean(process.env.BLOB_STORE_ID),
        DATABASE_URL: Boolean(process.env.DATABASE_URL),
        POSTGRES_URL: Boolean(process.env.POSTGRES_URL),
        /* The var the store actually resolved, prefixed names included —
           name only, never the value. null = genuinely no database. */
        resolvedDatabaseVar: connectionVar(),
        SCOOPLIST_PIN: Boolean(process.env.SCOOPLIST_PIN),
        SCOOPLIST_SECRET: Boolean(process.env.SCOOPLIST_SECRET),
        otherBlobKeys: Object.keys(process.env).filter(
          (k) => k.includes("BLOB") && k !== "BLOB_READ_WRITE_TOKEN" && k !== "BLOB_STORE_ID",
        ).length,
        vercelEnv: process.env.VERCEL_ENV ?? null,
      },
      /** Plain English for whoever is looking at this in a hurry. */
      summary: ok
        ? "Fully configured: the case persists and photos upload to real storage."
        : [
            store.backend === "postgres" ? null : "no database (demo storage, changes reset)",
            blob ? null : "no photo storage (photos stored inline)",
            reachable ? null : "database unreachable",
          ]
            .filter(Boolean)
            .join("; "),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
