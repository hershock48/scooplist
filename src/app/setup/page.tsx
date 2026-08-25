import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SetupForm from "@/components/SetupForm";
import { boardHref, currentOrg, orgMode } from "@/lib/org";
import { resolveVertical } from "@/lib/vertical";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business type" };

/**
 * THE FRONT DOOR Kevin asked for: "we should have some sort of setup page
 * where we select what sort of business this is and these little things
 * change accordingly." A fresh install lands here before anything else
 * (the admin pages redirect while setupPending); after that it stays
 * reachable from the menu, because the choice is editable (his ruling).
 * Orgs land here already configured (creation writes their vertical), so
 * for them it is only ever the editing surface.
 *
 * An env-pinned deployment (the live installs) gets a plain explanation
 * instead of a form that would silently lose to the env on every save.
 */
export default async function SetupPage() {
  const org = await currentOrg();
  if (!org) redirect("/login");

  const v = await resolveVertical(org.slug);
  const store = getStore();
  const hasData = await store.hasAnyFlavors(org.slug).catch(() => true);
  const shops = org.locations;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <AppHeader
        current="setup"
        boardHref={boardHref(org, shops[0]?.id ?? "")}
        voice={v.voice}
        nouns={v.nouns}
        orgName={orgMode() ? org.name : undefined}
      />

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold">
        What kind of business is this?
      </h1>
      <p className="mt-2 text-ink-soft">
        The boards, the starting prices, the allergen chips, and the words
        the app uses all follow from this. You can change it here any time.
      </p>

      {v.source === "env" ? (
        <div className="card mt-6 px-5 py-5">
          <p className="font-semibold">
            This deployment is configured by your web person.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            The business type here is set at the hosting level, so this
            screen is read-only. If something reads wrong, tell Glazed Web
            and it&apos;s a one-line change on their side.
          </p>
        </div>
      ) : (
        <SetupForm
          current={v.source === "store" ? v.preset : null}
          currentNouns={v.nouns}
          hasData={hasData}
        />
      )}
    </main>
  );
}
