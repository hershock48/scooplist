import { NextResponse } from "next/server";
import { currentOrg } from "@/lib/org";
import { newId, type CaseStatus } from "@/lib/domain";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * The case, changing:
 *
 *   { action: "in",      locationId, flavorId }
 *   { action: "out",     locationId, flavorId }
 *   { action: "status",  locationId, flavorId, status: "low"|"ondeck"|null }
 *   { action: "reorder", locationId, flavorIds: [...] }
 *
 * "in" is idempotent (a double-tap must not create two entries) and "out"
 * closes rather than deletes, the history is future analytics. "status"
 * flips the two in-between states (running low, on deck). "reorder" writes
 * positions in the order given, the wall's order.
 */
export async function POST(request: Request) {
  const org = await currentOrg();
  if (!org) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let b: {
    action?: string;
    locationId?: string;
    flavorId?: string;
    status?: unknown;
    flavorIds?: unknown;
  };
  try {
    b = (await request.json()) as typeof b;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const location = org.locations.find((l) => l.id === String(b.locationId ?? "")) ?? null;
  if (!location) return NextResponse.json({ error: "Unknown shop." }, { status: 400 });

  const store = getStore();

  if (b.action === "reorder") {
    const ids = Array.isArray(b.flavorIds)
      ? b.flavorIds.map((x) => String(x)).filter(Boolean).slice(0, 500)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Nothing to reorder." }, { status: 400 });
    }
    await store.reorderCase(org.slug, location.id, ids);
    return NextResponse.json({ ok: true });
  }

  // getFlavor is org-scoped, so a pasted id from another org misses here
  // rather than putting a stranger's drink on this org's board.
  const flavor = await store.getFlavor(org.slug, String(b.flavorId ?? ""));
  if (!flavor) return NextResponse.json({ error: "Unknown flavor." }, { status: 400 });

  if (b.action === "out") {
    await store.closeCaseEntry(org.slug, location.id, flavor.id, Date.now());
    return NextResponse.json({ ok: true });
  }

  if (b.action === "status") {
    const status: CaseStatus | null =
      b.status === "low" || b.status === "ondeck" ? b.status : null;
    await store.setCaseStatus(org.slug, location.id, flavor.id, status);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "in") {
    // Idempotency lives in the STORE (unique partial index / in-store
    // check), a check here would be a race two double-tap POSTs can lose.
    // The new entry lands at the END of the wall: one past the largest
    // existing position. Two racing adds can tie, which byCaseOrder breaks
    // alphabetically, harmless.
    const open = await store.listCase(org.slug, location.id);
    const positions = open.map((e) => e.position).filter((p): p is number => typeof p === "number");
    await store.addToCase(org.slug, {
      id: newId("case"),
      locationId: location.id,
      flavorId: flavor.id,
      addedAt: Date.now(),
      removedAt: null,
      position: positions.length > 0 ? Math.max(...positions) + 1 : open.length,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
