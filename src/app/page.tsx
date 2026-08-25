import Link from "next/link";
import { redirect } from "next/navigation";
import FlipWord from "@/components/FlipWord";
import ScooplistMark from "@/components/Logo";
import { currentOrg, orgMode } from "@/lib/org";
import { locations } from "@/lib/locations";

/*
  Signed in, the root IS the case, zero taps between opening the app and
  the thing the owner came to do. Signed out, the brand moment: the mark
  big and dripping with the name under it, centered, which is glazedweb's
  own mobile hero (its .hero collapses to one centered column at 800px and
  moves .mark to order:-1, above the words). Sizes follow its lead too,
  165px on a phone, 230px up, so the two sites feel like one studio.

  The org-mode deployment has no shop boards to offer here (every board
  belongs to some org, and this page has no idea whose), so the buttons
  reduce to the sign-in.
*/
export default async function Home() {
  if (await currentOrg()) redirect("/case");

  const shops = orgMode() ? [] : locations();

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
      {/*
        Kevin's line, and it beats the one it replaced: "fresh daily" was
        borrowed from glazedweb's cadence, while this names what the product
        actually sells, a board that is RIGHT. The first word rolls through
        the verticals (his ask, once the app grew a second one): Flavor,
        Menu, Tap, Specials boards, one engine. No JS or reduced motion =
        the static "Flavor" line, complete.
      */}
      {/*
        THE WRAP IS HARD-CODED, never natural. The rolling word changes the
        line's width every 1.8s, and any natural wrap point turns that into
        a line-count change at SOME viewport (free width re-wrapped at
        desktop; even per-word width found a viewport around 430px where
        "Tap" fit on one line and "Specials" did not). So: below lg the
        sentence is always two lines, broken after "boards"; at lg+ it is
        always one, nowrap, allowed to run past the max-w-xl column (~615px
        against a 1024+ viewport, so it never overflows the page, and the
        flex column keeps it centered). The width is then free to ease.
      */}
      <p className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-ink sm:text-2xl lg:text-3xl lg:whitespace-nowrap">
        <span className="whitespace-nowrap">
          <FlipWord words={["Flavor", "Menu", "Tap", "Specials"]} /> boards
        </span>{" "}
        <br aria-hidden className="lg:hidden" />
        <span className="whitespace-nowrap">that taste like the truth.</span>
      </p>
      {/*
        The explainer paragraph that used to sit here is gone at Kevin's call.
        The tagline is the whole pitch: anyone who lands here is either the
        owner going to /login or a customer going to a board, and both were
        stepping over three sentences to reach the buttons.
      */}
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
