import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { locations } from "@/lib/locations";

/*
  Signed in, the root IS the case — zero taps between opening the app and
  the thing the owner came to do. Signed out, a one-screen explainer with
  the public boards linked, because the boards are the pitch.
*/
export default async function Home() {
  if (await isAuthed()) redirect("/case");

  const shops = locations();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="font-[family-name:var(--font-display)] text-3xl font-bold text-berry">
        Scooplist
      </p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-semibold leading-tight">
        What&apos;s in the case, always current.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">
        Blow through a tub, tap it out, tap the next flavor in. The website,
        the TV board, and the counter menu update themselves — nobody calls
        the web person.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className="btn">
          Open the case
        </Link>
        {shops.map((l) => (
          <Link key={l.id} href={`/board/${l.id}`} className="btn-ghost">
            {l.name} board
          </Link>
        ))}
      </div>
      <p className="mt-10 text-sm text-ink-soft">
        A{" "}
        <a
          href="https://glazedweb.com"
          className="font-semibold text-berry underline-offset-4 hover:underline"
        >
          Glazed Web
        </a>{" "}
        tool.
      </p>
    </main>
  );
}
