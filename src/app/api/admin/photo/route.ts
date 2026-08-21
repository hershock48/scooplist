import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Flavor photo upload: { filename, contentType, data (base64, no prefix) }.
 * The client resizes to ~900px JPEG before sending, so files arrive small.
 *
 * With BLOB_READ_WRITE_TOKEN set (Vercel Blob, one click, part of the
 * hosting) the photo lands in Blob storage and a real URL comes back.
 * Without it, the photo is returned as a data: URL and stored inline in the
 * flavor row — fine for a demo, capped hard, and the admin says which mode
 * it is in rather than pretending.
 */
const MAX_BASE64 = 1_500_000; // ~1.1MB decoded; client-side resize keeps real uploads far below.

export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let b: { filename?: string; contentType?: string; data?: string };
  try {
    b = (await request.json()) as typeof b;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const filename = typeof b.filename === "string" ? b.filename.slice(0, 120) : "";
  const contentType = typeof b.contentType === "string" ? b.contentType : "";
  const data = typeof b.data === "string" ? b.data : "";

  if (!filename || !data || !/^image\/(jpeg|png|webp)$/.test(contentType)) {
    return NextResponse.json({ error: "Send a JPEG, PNG, or WebP." }, { status: 400 });
  }
  if (data.length > MAX_BASE64) {
    return NextResponse.json({ error: "Photo too large — try again, it will re-compress." }, { status: 413 });
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await put(`flavors/${Date.now()}-${safe}`, Buffer.from(data, "base64"), {
      access: "public",
      contentType,
    });
    return NextResponse.json({ ok: true, url: blob.url, storage: "blob" });
  }

  return NextResponse.json({
    ok: true,
    url: `data:${contentType};base64,${data}`,
    storage: "inline",
  });
}
