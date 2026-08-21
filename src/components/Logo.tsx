/**
 * The Scooplist mark v4 — from Kevin's sketch at the glazedweb logo's own
 * proportions: goo creep LOW on the scoop, fat drips (~21% of scoop width,
 * the donut's ratio) owning the whole underside, green goo construction
 * transplanted from the logo (gradients, dark back layer, creep band, cream
 * highlights, droplet, dark accent), narrow brown cone, sprinkles clear of
 * the fat swoosh+dot sheen. RENDERED AND EYEBALLED against the logo before
 * shipping — never trust path arithmetic alone.
 *
 * icon.svg is this exact artwork — keep them in sync (this file was
 * generated from it).
 */
export default function ScooplistMark({
  size = 32,
  className = "",
  idSuffix = "a",
}: {
  size?: number;
  className?: string;
  /** Unique per instance on a page, so gradient ids never collide. */
  idSuffix?: string;
}) {
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

  <path d="M 23.5 33 L 40.5 33 L 32 61 Z" fill="#B98A4A"/>
  <path d="M 26.2 40 L 37.8 40 M 27.8 45 L 36.2 45 M 29.4 50 L 34.6 50 M 26.8 36 L 31.6 52 M 37.2 36 L 32.4 52" stroke="#8a6536" strokeWidth="1.4" fill="none"/>

  <g fill={url("dark")}>
    <ellipse cx="32" cy="30" rx="14.6" ry="6"/>
    <path d="M 24.5 27.5 C 24.5 31, 24.7 34, 24.9 36.5 C 24.9 38.3, 25.9 38.6, 26.3 36.5 C 26.6 34, 26.4 30.5, 26.4 27.5 Z"/>
    <path d="M 35.8 27.5 C 35.8 30.5, 36 33, 36.2 35.2 C 36.2 37, 37.2 37.3, 37.5 35.2 C 37.8 33, 37.6 30, 37.6 27.5 Z"/>
  </g>

  <g fill={url("goo")}>
    <path d="M 17.2 27.5 C 17 32, 17.4 35.5, 17.6 38.5 C 17.5 41.8, 18.6 44, 20.8 44.1 C 23 44, 24.2 41.9, 24 39.2 C 24.3 35.4, 24.4 31.3, 24.5 27.5 Z"/>
    <path d="M 27.7 28.5 C 27.5 35, 27.9 41, 28.2 46 C 28 50.5, 29.4 53.6, 31.8 53.8 C 34.3 53.6, 35.6 51, 35.3 47.2 C 35.6 41, 35.7 34.5, 35.8 28.5 Z"/>
    <path d="M 38.2 27.5 C 38 31.5, 38.4 35, 38.6 38 C 38.4 41.3, 39.5 43.4, 41.6 43.5 C 43.7 43.4, 44.8 41.4, 44.6 38.8 C 44.9 35.2, 45 31.2, 45 27.5 Z"/>
  </g>

  <circle cx="32" cy="20" r="17" fill={url("pink")}/>

  <path d="M 16.1 26 A 17 17 0 0 0 47.9 26 C 47.2 24.6 45.8 24 44.4 24.7 C 43 25.6 42.6 27.4 41.2 28.1 C 39.1 28.8 38 26 35.9 25.3 C 33.8 24.6 33.5 27.4 31.7 28.5 C 30 29.2 28.9 26.8 26.8 25.7 C 24.7 25 24 26.8 22.2 27.4 C 20.5 27.8 19 26.8 16.1 26 Z" fill={url("creep")}/>
  <path d="M 20.5 30.2 A 13.5 13.5 0 0 0 25.8 33.5" fill="none" stroke="#F1F8DC" strokeWidth="1.4" strokeLinecap="round" opacity="0.85"/>

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

  <path d="M 30 42.5 Q 31.9 44.6 33.8 42.4" fill="none" stroke="#55974A" strokeWidth="1.3" strokeLinecap="round"/>

  <g stroke="#F1F8DC" fill="none" strokeLinecap="round">
    <path d="M 29.8 33 C 29.6 39.5, 29.9 45.5, 30.6 50.5" strokeWidth="1.5" opacity="0.85"/>
    <path d="M 19.2 30.5 C 19 34, 19.4 38, 19.7 41" strokeWidth="1.1" opacity="0.8"/>
    <path d="M 40 30 C 39.8 33, 40.2 36.5, 40.5 39.5" strokeWidth="1.1" opacity="0.8"/>
  </g>
  <circle cx="31.9" cy="51.6" r="0.8" fill="#F1F8DC" opacity="0.9"/>

  <path d="M 19.8 12.8 A 14.3 14.3 0 0 1 26.2 7" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" opacity="0.75"/>
  <circle cx="29.5" cy="6.4" r="1.15" fill="#FFFFFF" opacity="0.75"/>

</svg>
  );
}
