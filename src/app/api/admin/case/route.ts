import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { locationById } from "@/lib/locations";
import { newId } from "@/lib/domain";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * The case, changing: { action: "in" | "out", locationId, flavorId }.
 * "in" is idempotent (a double-tap must not create two entries) and "out"
 * closes rather than deletes, the history is future analytics.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let b: { action?: string; locationId?: string; flavorId?: string };
  try {
    b = (await request.json()) as typeof b;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const location = locationById(String(b.locationId ?? ""));
  if (!location) return NextResponse.json({ error: "Unknown shop." }, { status: 400 });

  const store = getStore();
  const flavor = await store.getFlavor(String(b.flavorId ?? ""));
  if (!flavor) return NextResponse.json({ error: "Unknown flavor." }, { status: 400 });

  if (b.action === "out") {
    await store.closeCaseEntry(location.id, flavor.id, Date.now());
    return NextResponse.json({ ok: true });
  }

  if (b.action === "in") {
    // Idempotency lives in the STORE (unique partial index / in-store
    // check), a check here would be a race two double-tap POSTs can lose.
    await store.addToCase({
      id: newId("case"),
      locationId: location.id,
      flavorId: flavor.id,
      addedAt: Date.now(),
      removedAt: null,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
