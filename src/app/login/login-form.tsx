import ScooplistMark from "@/components/Logo";

/**
 * The PIN screen both login pages share: the brand stack trimmed enough to
 * leave the field and button above the fold on a small phone. This is the
 * screen the owner opens every shift, so it should look like the product,
 * not like a password prompt. Plain form post, no client JS: the API route
 * sets the cookie and redirects, ?bad=1 is the whole failure UI a PIN needs.
 *
 * `org` renders as a hidden field, never as a displayed name: the page
 * must not confirm whether an org exists to whoever typed the URL, and
 * whoever was handed the login link already knows whose it is.
 */
export default function LoginForm({
  org,
  bad,
  locked,
}: {
  org?: string;
  bad?: string;
  locked?: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
      <ScooplistMark animated className="h-auto w-[150px] sm:w-[200px]" />
      <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-berry sm:text-5xl">
        Scooplist
      </p>
      <p className="mt-1.5 font-[family-name:var(--font-display)] text-lg font-semibold text-ink sm:text-xl">
        Flavor boards that taste like the truth.
      </p>
      <h1 className="mt-7 text-xl font-semibold">Shop PIN</h1>
      <form method="post" action="/api/login" className="mt-3 w-full">
        {org ? <input type="hidden" name="org" value={org} /> : null}
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
