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
      {/* Phone keeps glazedweb's 165px; desktop grows past its 230px, because
          here the mark IS the page rather than sharing a two-column hero. */}
      <ScooplistMark
        animated
        className="h-auto w-[165px] sm:w-[230px] lg:w-[300px]"
      />
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight text-berry sm:text-6xl lg:text-8xl">
        Scooplist
      </h1>
      {/* The tagline answers glazedweb's "Websites, fresh daily." on purpose:
          same cadence, so the two read as one studio. */}
      <p className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-ink sm:text-2xl lg:text-3xl">
        Flavor boards, fresh daily.
      </p>
      <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft lg:max-w-lg lg:text-xl">
        Blow through a tub, tap it out, tap the next flavor in. Your website,
        your TV board, and your counter menu update themselves — nobody calls
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
