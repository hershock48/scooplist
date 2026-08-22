import Link from "next/link";
import { redirect } from "next/navigation";
import ScooplistMark from "@/components/Logo";
import { isAuthed } from "@/lib/auth";
import { locations } from "@/lib/locations";

/*
  Signed in, the root IS the case — zero taps between opening the app and
  the thing the owner came to do. Signed out, the brand moment: the mark
  big and dripping with the name under it, centered, which is glazedweb's
  own mobile hero (its .hero collapses to one centered column at 800px and
  moves .mark to order:-1, above the words). Sizes follow its lead too —
  165px on a phone, 230px up — so the two sites feel like one studio.
*/
export default async function Home() {
  if (await isAuthed()) redirect("/case");

  const shops = locations();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-14 text-center">
      <ScooplistMark
        animated
        className="h-auto w-[165px] sm:w-[230px]"
      />
      <p className="mt-1 font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight text-berry sm:text-6xl">
        Scooplist
      </p>
      <h1 className="mt-5 font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight sm:text-4xl">
        What&apos;s in the case, always current.
      </h1>
      <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
        Blow through a tub, tap it out, tap the next flavor in. The website,
        the TV board, and the counter menu update themselves — nobody calls
        the web person.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
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
