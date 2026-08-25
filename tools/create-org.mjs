#!/usr/bin/env node
/**
 * Create (or update) an org on a multi-org Scooplist deployment.
 *
 *   $env:SCOOPLIST_MASTER = "<the master secret>"
 *   node tools/create-org.mjs --url https://scooplist.glazedweb.com \
 *     --slug copperac --name "Copper Athletic Club" --pin 1234 \
 *     --preset tavern --categories "taps:On Tap,cocktails:Cocktails" \
 *     --locations "marshall:Copper Athletic Club"
 *
 * The master secret comes from the environment ONLY, set for the one
 * terminal session (dashboard-held everywhere else, per glaze.md): never a
 * flag someone's shell history keeps, never a file. Re-running with the
 * same slug updates the org in place, which is how a PIN gets rotated or
 * a location list gets edited; the library and case are never touched by
 * a re-run (creation only seeds an EMPTY library, and only for presets
 * that seed at all).
 *
 * --categories is optional and overrides the preset's boards (the tavern
 * preset's generic taps/cans/na rarely matches a real bar's program).
 * --locations and --categories both use the env-var pair format,
 * "slug:Label,slug2:Label2", so there is one syntax to remember.
 */

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function pairs(raw) {
  return raw
    .split(",")
    .map((pair) => {
      const [key, ...label] = pair.split(":");
      return { key: key.trim(), label: label.join(":").trim() || key.trim() };
    })
    .filter((p) => p.key);
}

const master = process.env.SCOOPLIST_MASTER;
if (!master) {
  console.error(
    "SCOOPLIST_MASTER is not set. Set it for this terminal session only\n" +
      '(PowerShell: $env:SCOOPLIST_MASTER = "...") and run again. Do not\n' +
      "write it into any file.",
  );
  process.exit(1);
}

const url = arg("url");
const slug = arg("slug");
const name = arg("name");
const pin = arg("pin");
const preset = arg("preset");
const locationsRaw = arg("locations");
const categoriesRaw = arg("categories");

if (!url || !slug || !name || !pin || !preset || !locationsRaw) {
  console.error(
    "Usage: node tools/create-org.mjs --url <deployment> --slug <org> " +
      '--name "<Org Name>" --pin <pin> --preset scoops|tavern|coffee|other ' +
      '--locations "slug:Name,..." [--categories "key:Label,..."]',
  );
  process.exit(1);
}

const base = url.replace(/\/$/, "");
const body = {
  slug,
  name,
  pin,
  preset,
  locations: pairs(locationsRaw).map((p) => ({ id: p.key, name: p.label })),
  ...(categoriesRaw ? { categories: pairs(categoriesRaw).map((p) => ({ key: p.key, label: p.label })) } : {}),
};

const res = await fetch(`${base}/api/master/org`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-scooplist-master": master,
  },
  body: JSON.stringify(body),
});

const out = await res.json().catch(() => ({}));
if (!res.ok || !out.ok) {
  console.error(`Failed (${res.status}): ${out.error ?? "no detail"}`);
  process.exit(1);
}

console.log(`Org "${out.slug}" is ready on ${base}.`);
console.log(`  Sign-in link (hand this to the owner): ${base}${out.urls.login}`);
for (const b of out.urls.boards) console.log(`  TV board: ${base}${b}`);
for (const f of out.urls.feeds) console.log(`  Feed: ${base}${f}`);
