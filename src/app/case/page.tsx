import Link from "next/link";
import { redirect } from "next/navigation";
import CaseBoard from "@/components/CaseBoard";
import AppHeader from "@/components/AppHeader";
import { isAuthed } from "@/lib/auth";
import { locations } from "@/lib/locations";
import { categories } from "@/lib/vertical";
import { seedIfEmpty } from "@/lib/seed";
import { getStore } from "@/lib/store";
import type { CaseStatus } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const metadata = { title: "The case" };

export default async function CasePage() {
  if (!(await isAuthed())) redirect("/login");

  await seedIfEmpty();
  const store = getStore();
  const shops = locations();
  const flavors = await store.listFlavors();
  const caseByShop: Record<
    string,
    { flavorId: string; addedAt: number; position?: number; status?: CaseStatus | null }[]
  > = {};
  for (const shop of shops) {
    caseByShop[shop.id] = (await store.listCase(shop.id)).map((e) => ({
      flavorId: e.flavorId,
      addedAt: e.addedAt,
      position: e.position,
      status: e.status,
    }));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <AppHeader current="case" boardHref={`/board/${shops[0]?.id ?? ""}`} />

      {/* Shop voice out front; the Vercel specifics live in the README for
          the person who can actually act on them. */}
      {store.backend === "memory" ? (
        <p className="card mt-4 border-berry/40 bg-berry/5 px-4 py-3 text-sm font-medium text-berry">
          Demo mode: changes here aren&apos;t saved permanently yet. Ask your
          web person to switch on storage, it&apos;s one click for them.
        </p>
      ) : null}

      <CaseBoard shops={shops} categories={categories()} flavors={flavors} caseByShop={caseByShop} />
    </main>
  );
}
