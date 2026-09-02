import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SetupForm from "@/components/SetupForm";
import { boardHref, currentOrg, orgMode } from "@/lib/org";
import { resolveVertical } from "@/lib/vertical";
import { presetByKey } from "@/lib/presets";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business type" };

/**
 * THE FRONT DOOR Kevin asked for: "we should have some sort of setup page
 * where we select what sort of business this is and these little things
 * change accordingly." A fresh install lands here before anything else
 * (the admin pages redirect while setupPending); after that it stays
 * reachable from the menu on a single-tenant install, because there the
 * choice is the owner's (his ruling).
 *
 * On the shared deployment it is NOT the owner's: the type is set by us at
 * creation (create-org, with the master secret) and an owner cannot change
 * it (Kevin's ruling, 2 Sep 2026). The header no longer links here for
 * them, the page shows a note instead of the form, and the API behind the
 * form refuses in org mode, so the lock is real and not just a hidden link.
 *
 * An env-pinned deployment (the live installs) gets the same plain
 * explanation instead of a form that would silently lose to the env.
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
        preset={v.preset}
        managed={orgMode()}
        orgName={orgMode() ? org.name : undefined}
      />

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold">
        What kind of business is this?
      </h1>
      <p className="mt-2 text-ink-soft">
        The boards, the starting prices, the allergen chips, and the words
        the app uses all follow from this.
        {v.source === "env" || orgMode() ? "" : " You can change it here any time."}
      </p>

      {v.source === "env" || orgMode() ? (
        <div className="card mt-6 px-5 py-5">
          <p className="font-semibold">
            Set up by Glazed Web: {presetByKey(v.preset)?.label ?? v.preset}.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            The business type is part of how your account was created, so
            this screen is read-only. If something reads wrong, tell Glazed
            Web and it&apos;s a one-line change on their side.
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
