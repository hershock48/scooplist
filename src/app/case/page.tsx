import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CaseBoard from "@/components/CaseBoard";
import AppHeader from "@/components/AppHeader";
import { boardHref, currentOrg, orgMode } from "@/lib/org";
import { resolveVertical } from "@/lib/vertical";
import { surfaceTitle } from "@/lib/presets";
import { seedIfEmpty } from "@/lib/seed";
import { getStore } from "@/lib/store";
import type { CaseStatus } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const org = await currentOrg();
  if (!org) return { title: "The case" };
  const v = await resolveVertical(org.slug);
  return { title: surfaceTitle(v.nouns) };
}

export default async function CasePage() {
  const org = await currentOrg();
  if (!org) redirect("/login");

  /*
    First run on a fresh, unconfigured install: before anything else, ask
    what kind of business this is. resolveVertical only flags this when
    nothing configured the vertical AND the library is empty, so existing
    installs (env-pinned, or full of flavors) never see it. Orgs never see
    it either: creation writes their vertical.
  */
  const v = await resolveVertical(org.slug);
  if (v.setupPending) redirect("/setup");

  await seedIfEmpty(org.slug);
  const store = getStore();
  const shops = org.locations;
  const flavors = await store.listFlavors(org.slug);
  const caseByShop: Record<
    string,
    { flavorId: string; addedAt: number; position?: number; status?: CaseStatus | null }[]
  > = {};
  for (const shop of shops) {
    caseByShop[shop.id] = (await store.listCase(org.slug, shop.id)).map((e) => ({
      flavorId: e.flavorId,
      addedAt: e.addedAt,
      position: e.position,
      status: e.status,
    }));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <AppHeader
        current="case"
        boardHref={boardHref(org, shops[0]?.id ?? "")}
        voice={v.voice}
        nouns={v.nouns}
        preset={v.preset}
        managed={orgMode()}
        orgName={orgMode() ? org.name : undefined}
      />

      {/* Shop voice out front; the Vercel specifics live in the README for
          the person who can actually act on them. */}
      {store.backend === "memory" ? (
        <p className="card mt-4 border-berry/40 bg-berry/5 px-4 py-3 text-sm font-medium text-berry">
          Demo mode: changes here aren&apos;t saved permanently yet. Ask your
          web person to switch on storage, it&apos;s one click for them.
        </p>
      ) : null}

      <CaseBoard
        shops={shops}
        categories={v.categories}
        flavors={flavors}
        example={v.example}
        voice={v.voice}
        nouns={v.nouns}
        caseByShop={caseByShop}
      />
    </main>
  );
}
