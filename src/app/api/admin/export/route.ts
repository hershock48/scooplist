import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { locations } from "@/lib/locations";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * THE WAY OUT. The client's entire library and case history, one JSON file,
 * admin-gated.
 *
 * It exists for two reasons. Operationally, everything lives in one Neon
 * free-tier database with no other backup path, and this turns "we lost the
 * board" into "restore yesterday's file". And it is the ownership promise
 * made concrete: "you own everything" rings hollow while the client's menu
 * history is only reachable through screens we built. The format is the
 * store's own shapes, verbatim, so an import (or a competitor) can consume
 * it without archaeology.
 */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const store = getStore();
  const [flavors, entries] = await Promise.all([store.listFlavors(), store.listEntries()]);

  const stamp = new Date().toISOString().slice(0, 10);
  return NextResponse.json(
    {
      exportedAt: Date.now(),
      backend: store.backend,
      locations: locations(),
      flavors,
      // Open AND closed: the closed entries are the history, which is most
      // of the point of backing this up.
      caseEntries: entries,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="scooplist-export-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    },
  );
}
