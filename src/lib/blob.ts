import "server-only";

/**
 * Find the Vercel Blob token whatever Vercel decided to call it.
 *
 * Connecting a Blob store injects `BLOB_READ_WRITE_TOKEN`, UNLESS the store
 * carries a custom name/prefix, in which case the variable arrives as
 * e.g. `SCOOPLIST_BLOB_READ_WRITE_TOKEN`. The first deploy hit exactly that:
 * the store was connected, the app reported "no photo storage", and the
 * owner went looking for a second storage vendor he did not need. So: take
 * the standard name if present, otherwise any variable that ends in
 * `BLOB_READ_WRITE_TOKEN`.
 */
export function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find(
    (k) => k.endsWith("BLOB_READ_WRITE_TOKEN") && process.env[k],
  );
  return key ? process.env[key] : undefined;
}
