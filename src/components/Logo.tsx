/**
 * The Scooplist mark v4, from Kevin's sketch at the glazedweb logo's own
 * proportions: goo creep LOW on the scoop, fat drips (~21% of scoop width,
 * the donut's ratio) owning the whole underside, green goo construction
 * transplanted from the logo (gradients, dark back layer, creep band, cream
 * highlights, droplet, dark accent), narrow brown cone, sprinkles clear of
 * the fat swoosh+dot sheen. RENDERED AND EYEBALLED against the logo before
 * shipping, never trust path arithmetic alone.
 *
 * icon.svg is this exact artwork, keep them in sync (this file was
 * generated from it).
 */
export default function ScooplistMark({
  size = 32,
  className = "",
  idSuffix = "a",
  animated = false,
}: {
  size?: number;
  className?: string;
  /** Unique per instance on a page, so gradient ids never collide. */
  idSuffix?: string;
  /**
   * Melt it. glazedweb's own rule: the small inline Mark is static, the
   * hero AnimatedMark drips - a wobbling 30px logo in a working header is
   * a distraction, the same wobble on a landing page is the brand.
   */
  animated?: boolean;
}) {
  const a = (cls: string) => (animated ? cls : undefined);
  const id = (name: string) => `sp-${name}-${idSuffix}`;
  const url = (name: string) => `url(#${id(name)})`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={className}>
      <defs>
    <radialGradient id={id("pink")} cx="40%" cy="34%" r="75%">
      <stop offset="0%" stopColor="#F887B2"/>
      <stop offset="55%" stopColor="#E84D8A"/>
      <stop offset="100%" stopColor="#CE3672"/>
    </radialGradient>
    <linearGradient id={id("goo")} x1="0" y1="26" x2="0" y2="54" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor="#D9EDA0"/>
      <stop offset="55%" stopColor="#BFE07A"/>
      <stop offset="100%" stopColor="#A3CE55"/>
    </linearGradient>
    <linearGradient id={id("creep")} x1="0" y1="23" x2="0" y2="30" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor="#E3F2B0"/>
      <stop offset="100%" stopColor="#C3E181"/>
    </linearGradient>
    <linearGradient id={id("dark")} x1="0" y1="26" x2="0" y2="42" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor="#5FA850"/>
      <stop offset="100%" stopColor="#43813A"/>
    </linearGradient>
  </defs>

  <path d="M 21 31.5 L 43 31.5 L 32 63 Z" fill="#B98A4A"/>
  <path d="M 24.5 41 L 39.5 41 M 26.6 47 L 37.4 47 M 28.7 53 L 35.3 53 M 30.8 59 L 33.2 59 M 25 35 L 31.4 56 M 39 35 L 32.6 56" stroke="#8a6536" strokeWidth="1.4" fill="none"/>

  {/* The whole melt breathes as one, then each drip sags on its own clock. */}
  <g className={a("sl-goo")}>
  <g fill={url("dark")}>
    <ellipse cx="32" cy="30" rx="13.5" ry="4.5"/>
    <path className={a("sl-wobB")} d="M 24.5 26.5 C 24.5 30, 24.7 33, 24.9 35.5 C 24.9 37.3, 25.9 37.6, 26.3 35.5 C 26.6 33, 26.4 29.5, 26.4 26.5 Z"/>
    <path d="M 35.8 26.5 C 35.8 29.5, 36 32, 36.2 34.2 C 36.2 36, 37.2 36.3, 37.5 34.2 C 37.8 32, 37.6 29, 37.6 26.5 Z"/>
  </g>

  <g fill={url("goo")}>
    <path className={a("sl-wob1")} d="M 17.2 26.5 C 17 31, 17.4 34.5, 17.6 37.2 C 17.5 40.4, 18.6 42.6, 20.8 42.7 C 23 42.6, 24.2 40.5, 24 37.9 C 24.3 34.1, 24.4 30.2, 24.5 26.5 Z"/>
    <path className={a("sl-wob2")} d="M 27.7 27.5 C 27.5 34, 27.9 39.8, 28.2 44.7 C 28 49.1, 29.4 52.2, 31.8 52.4 C 34.3 52.2, 35.6 49.6, 35.3 45.9 C 35.6 39.8, 35.7 33.4, 35.8 27.5 Z"/>
    <path className={a("sl-wob3")} d="M 38.2 26.5 C 38 30.5, 38.4 33.8, 38.6 36.6 C 38.4 39.8, 39.5 41.9, 41.6 42 C 43.7 41.9, 44.8 39.9, 44.6 37.4 C 44.9 33.9, 45 30.1, 45 26.5 Z"/>
  </g>
      </g>

  {/* String + droplet fall from the LEFT drip: clear of the cone all the way
      down, where glazedweb's fall from the donut into open air. */}
  <path className={a("sl-string")} d="M 20.8 42.4 L 20.8 45.7" stroke="#BFE07A" strokeWidth="0.82" strokeLinecap="round" fill="none" opacity={animated ? undefined : 0} />
  <g className={a("sl-droplet")} opacity={animated ? undefined : 0}>
    <circle cx="20.8" cy="48.6" r="2.3" fill="#BFE07A"/>
    <circle cx="20.15" cy="47.95" r="0.65" fill="#F1F8DC" opacity="0.9"/>
  </g>
  <circle className={a("sl-droplet2")} cx="41.6" cy="45.4" r="1.5" fill="#BFE07A" opacity={animated ? undefined : 0} />

  <path d="M 15 22 A 17 17 0 1 1 49 22 Q 47.5 28.5 44 30.5 Q 38 32.5 32 32.5 Q 26 32.5 20 30.5 Q 16.5 28.5 15 22 Z" fill={url("pink")}/>

  <path d="M 16 23.5 Q 17 29.5 20.5 31.5 Q 26 33.8 32 33.8 Q 38 33.8 43.5 31.5 Q 47 29.5 48 23.5 C 47.3 22.1 45.9 21.5 44.5 22.2 C 43.1 23.1 42.7 24.9 41.3 25.6 C 39.2 26.3 38.1 23.5 36 22.8 C 33.9 22.1 33.6 24.9 31.8 26 C 30.1 26.7 29 24.3 26.9 23.2 C 24.8 22.5 24.1 24.3 22.3 24.9 C 20.6 25.3 19.1 24.3 16 23.5 Z" fill={url("creep")}/>
  <path d="M 20.3 28.8 A 13 13 0 0 0 25.6 32" fill="none" stroke="#F1F8DC" strokeWidth="1.4" strokeLinecap="round" opacity="0.85"/>

  <g strokeWidth="1.7" strokeLinecap="round" fill="none">
    <path d="M 24 13 l 2.6 -1.5" stroke="#F5C84C"/>
    <path d="M 31.5 8.5 l 3 0.6" stroke="#6BC1E8"/>
    <path d="M 39 12 l 2.2 2" stroke="#FFF7E6"/>
    <path d="M 21 19 l 2.9 0.8" stroke="#A8E06B"/>
    <path d="M 28.5 16.5 l 2.4 -1.7" stroke="#F5934B"/>
    <path d="M 36.5 18.5 l 2.8 -1" stroke="#C79BE8"/>
    <path d="M 43 17.5 l 1.6 2.3" stroke="#F5C84C"/>
    <path d="M 26 22.5 l 2.8 1" stroke="#6BC1E8"/>
    <path d="M 33.5 22.8 l 2.7 -1.3" stroke="#FFF7E6"/>
    <path d="M 41 22 l 2.3 -1.8" stroke="#F5934B"/>
  </g>

  <path d="M 30 41.3 Q 31.9 43.4 33.8 41.2" fill="none" stroke="#55974A" strokeWidth="1.3" strokeLinecap="round"/>

  <g stroke="#F1F8DC" fill="none" strokeLinecap="round">
    <path d="M 29.8 31.8 C 29.6 38.2, 29.9 44, 30.6 49" strokeWidth="1.5" opacity="0.85"/>
    <path d="M 19.2 29.3 C 19 32.8, 19.4 36.6, 19.7 39.6" strokeWidth="1.1" opacity="0.8"/>
    <path d="M 40 28.8 C 39.8 31.8, 40.2 35.2, 40.5 38.2" strokeWidth="1.1" opacity="0.8"/>
  </g>
  <circle cx="31.9" cy="50.2" r="0.8" fill="#F1F8DC" opacity="0.9"/>

  <path className={a("sl-sheen")} d="M 19.8 12.8 A 14.3 14.3 0 0 1 26.2 7" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" opacity="0.75"/>
  <circle className={a("sl-sheen")} cx="29.5" cy="6.4" r="1.15" fill="#FFFFFF" opacity="0.75"/>

</svg>
  );
}
