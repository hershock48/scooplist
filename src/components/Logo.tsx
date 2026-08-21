/**
 * The Scooplist mark: a scoop in glazedweb's own raspberry (#E84D8A — sampled
 * from the donut icing in glazedweb/public/favicon.svg), wearing the same
 * white-arc sheen, melting over the cone the way the goo drips off the donut
 * (long rounded drip, wavy scallops). Same visual language, different dessert
 * — the product is the studio's, and the mark says so without a wordmark.
 *
 * Kept flat + arc like the parent mark, no gradients: it has to read at 16px
 * in a browser tab. icon.svg is this exact artwork; keep them in sync.
 */
export default function ScooplistMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden
      className={className}
    >
      <path d="M 18 33 L 46 33 L 32 61 Z" fill="#B98A4A" />
      <path
        d="M 22 40 L 42 40 M 25 46 L 39 46 M 28 52 L 36 52 M 26 36 L 32 48 M 38 36 L 33 46"
        stroke="#8a6536"
        strokeWidth="2"
        fill="none"
      />
      <path
        fill="#E84D8A"
        d="M 15 26
           A 17 17 0 1 1 49 26
           L 49 30
           C 47 34, 44 34, 43 31
           C 42 29, 41 30, 41 33
           L 41 40 C 41 44, 36.5 44, 36.5 40 L 36.5 34
           C 36.5 31, 35 31, 34 33
           C 33 35, 31 35, 30 33
           C 29 31, 27.5 31, 27.5 34
           L 27.5 48 C 27.5 52.5, 22.5 52.5, 22.5 48 L 22.5 33
           C 22.5 30, 21 29, 20 31
           C 19 34, 16 34, 15 30
           Z"
      />
      <path
        d="M 20 18 A 13.5 13.5 0 0 1 30 9.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}
