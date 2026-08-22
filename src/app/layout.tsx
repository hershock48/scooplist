import type { Metadata } from "next";
import { Fraunces, Figtree } from "next/font/google";
import "./globals.css";

/*
  Fraunces carries display sizes — an ice cream parlor's warmth without any
  one client's brand. Figtree carries the working UI. Both self-hosted by
  next/font per the house stack rules.
*/
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Scooplist — flavor boards, fresh daily",
    template: "%s | Scooplist",
  },
  description:
    "The flavor board for scoop shops. Blow through a tub at 2:15, and by 2:16 the website, the TV board, and the sign over the counter have all caught up. Nobody called anybody.",
  /*
    The share card, in glazedweb's own composition: cream field, the mark
    large and centered, the name and tagline beneath. Regenerate it with
    scratchpad/make-og.mjs whenever the mark or the tagline changes — it is
    a rendered PNG, and you cannot grep an image.
  */
  openGraph: {
    type: "website",
    siteName: "Scooplist",
    title: "Scooplist — flavor boards, fresh daily",
    description:
      "Blow through a tub at 2:15. By 2:16 the website, the TV board, and the sign over the counter have all caught up.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Scooplist: a pink scoop with sprinkles on a waffle cone, green glaze dripping off it, over the line Flavor boards, fresh daily.",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
