import { redirect } from "next/navigation";
import ScooplistMark from "@/components/Logo";
import { isAuthed } from "@/lib/auth";

export const metadata = { title: "Sign in" };

/*
  A plain form post, no client JS: the API route sets the cookie and
  redirects. ?bad=1 is the whole failure UI a PIN needs.
*/
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ bad?: string; locked?: string }>;
}) {
  if (await isAuthed()) redirect("/case");
  const { bad, locked } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="flex items-center gap-2.5 font-[family-name:var(--font-display)] text-2xl font-bold text-berry">
        <ScooplistMark size={40} animated />
        Scooplist
      </p>
      <h1 className="mt-3 text-xl font-semibold">Shop PIN</h1>
      <form method="post" action="/api/login" className="mt-4">
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          required
          className="field text-center text-2xl tracking-[0.5em]"
          aria-label="Shop PIN"
        />
        {locked ? (
          <p role="alert" className="mt-3 text-sm font-medium text-berry">
            Too many tries. Give it ten minutes, then ask whoever runs the shop
            for the PIN.
          </p>
        ) : bad ? (
          <p role="alert" className="mt-3 text-sm font-medium text-berry">
            That PIN didn&apos;t match. Ask whoever runs the shop.
          </p>
        ) : null}
        <button type="submit" className="btn mt-4 w-full">
          Open the case
        </button>
      </form>
    </main>
  );
}
