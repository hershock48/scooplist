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
    default: "Scooplist — what's in the case, always current",
    template: "%s | Scooplist",
  },
  description:
    "The flavor board for scoop shops. Blow a tub, tap it out, tap the next one in — and the website, the TV board, and the counter menu all update themselves.",
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
