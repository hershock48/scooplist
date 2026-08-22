import "server-only";

/**
 * Find the Vercel Blob token whatever Vercel decided to call it.
 *
 * Connecting a Blob store injects `BLOB_READ_WRITE_TOKEN` - unless the
 * store carries a name/prefix. Observed in the wild, two different shapes:
 * a prefix PREPENDED (`SCOOPLIST_BLOB_READ_WRITE_TOKEN`, the True North
 * install) and the prefix REPLACING the `BLOB` namespace entirely
 * (`cas_READ_WRITE_TOKEN`, the Cascarelli's install - the store prefix
 * substitutes for the default `BLOB`). Both times the app reported "no
 * photo storage" with a working store attached. So: the standard name
 * first, then anything ending `BLOB_READ_WRITE_TOKEN`, then anything
 * ending `_READ_WRITE_TOKEN` - a suffix no other Vercel product uses.
 */
export function blobTokenVar(): string | null {
  const env = process.env;
  if (env.BLOB_READ_WRITE_TOKEN) return "BLOB_READ_WRITE_TOKEN";
  const keys = Object.keys(env).sort();
  return (
    keys.find((k) => k.endsWith("BLOB_READ_WRITE_TOKEN") && env[k]) ??
    keys.find((k) => k.endsWith("_READ_WRITE_TOKEN") && env[k]) ??
    null
  );
}

export function blobToken(): string | undefined {
  const name = blobTokenVar();
  return name ? process.env[name] : undefined;
}
