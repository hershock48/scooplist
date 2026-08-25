import { redirect } from "next/navigation";
import ScooplistMark from "@/components/Logo";
import { currentOrg, orgMode, validOrgSlug } from "@/lib/org";
import LoginForm from "./login-form";

export const metadata = { title: "Sign in" };

/*
  Legacy installs: the PIN form, unchanged. The org-mode deployment cannot
  ask for a PIN without knowing whose, so it asks for the shop's short name
  first and forwards to /login/{org}. That forward is a plain GET form back
  to this page (?org=...) redirected server-side, so it works with
  JavaScript off; the login links Kevin hands out skip this screen anyway.
*/
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ bad?: string; locked?: string; org?: string }>;
}) {
  if (await currentOrg()) redirect("/case");
  const { bad, locked, org } = await searchParams;

  if (!orgMode()) return <LoginForm bad={bad} locked={locked} />;

  if (org && validOrgSlug(org.trim().toLowerCase())) {
    redirect(`/login/${org.trim().toLowerCase()}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
      <ScooplistMark animated className="h-auto w-[150px] sm:w-[200px]" />
      <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-berry sm:text-5xl">
        Scooplist
      </p>
      <p className="mt-1.5 font-[family-name:var(--font-display)] text-lg font-semibold text-ink sm:text-xl">
        Flavor boards that taste like the truth.
      </p>
      <h1 className="mt-7 text-xl font-semibold">Your shop&apos;s short name</h1>
      <form method="get" action="/login" className="mt-3 w-full">
        <input
          name="org"
          type="text"
          autoComplete="organization"
          autoFocus
          required
          pattern="[A-Za-z0-9-]+"
          className="field text-center text-2xl"
          aria-label="Shop short name"
        />
        {bad ? (
          <p role="alert" className="mt-3 text-sm font-medium text-berry">
            That didn&apos;t match a shop. Use the sign-in link you were given,
            or ask your web person.
          </p>
        ) : null}
        <button type="submit" className="btn mt-4 w-full">
          Continue
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        Most shops sign in from the link they were given, which ends in
        /login/yourshop.
      </p>
    </main>
  );
}
