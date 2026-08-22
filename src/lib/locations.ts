/**
 * The shops. Env-configured (slug:Name pairs) so a different client is a
 * dashboard edit, not a code change; defaults to True North's two so a demo
 * works with zero setup. Slugs are the public URL and API segment, keep
 * them URL-safe and stable.
 */

export type ShopLocation = { id: string; name: string };

const DEFAULT = "marshall:Marshall,battlecreek:Battle Creek";

export function locations(): ShopLocation[] {
  const raw = process.env.SCOOPLIST_LOCATIONS || DEFAULT;
  return raw
    .split(",")
    .map((pair) => {
      const [id, ...name] = pair.split(":");
      return { id: id.trim(), name: name.join(":").trim() || id.trim() };
    })
    .filter((l) => l.id);
}

export function locationById(id: string): ShopLocation | null {
  return locations().find((l) => l.id === id) ?? null;
}
