import "./globals.css";
import type { Metadata } from "next";
import { Noto_Sans, Bricolage_Grotesque, Instrument_Serif } from "next/font/google";

// Noto Sans for body text — humanist, neutral, very legible across weights.
// Exposed as a CSS variable so the Tailwind `font-sans` token picks it up.
const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// Bricolage Grotesque for headings — event titles, the result count, panel
// headings. Montserrat is a clean geometric but a very familiar one, and next
// to an editorial serif wordmark it read as default rather than chosen.
// Bricolage has drawn character in its letterforms (the humanised, slightly
// irregular direction) while staying a grotesque, so a dense list of event
// titles is still scannable at a glance — which a display serif at 20px
// would not be.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

// Instrument Serif for the wordmark. Sigmar's chunky novelty read as a
// sticker sitting on top of the skyline photo rather than part of it; a
// high-contrast editorial serif holds its own against a photograph and gives
// the masthead the cinematic register the rest of the hero is going for.
// Single weight, which is all a wordmark needs.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-title",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://jax-events.vercel.app";

const TITLE = "Wavelength — Jacksonville events";
const DESCRIPTION =
  "Free yoga, live music, markets, festivals and community events across Jacksonville, FL — pulled together from a dozen local calendars into one list.";

export const metadata: Metadata = {
  // Required for the relative opengraph-image URL to resolve. Without it Next
  // emits a relative og:image, which crawlers cannot fetch, and the card
  // silently falls back to a bare title — which is what social previews were
  // doing before.
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Wavelength",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    // Wide card. The default "summary" crops to a small square and wastes the
    // 1200x630 image entirely.
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  // Inline SVG favicon — calendar emoji rendered into a tiny SVG so we don't
  // ship a binary asset. Works in all modern browsers.
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏄</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${notoSans.variable} ${bricolage.variable} ${instrumentSerif.variable}`}>
      <body className="text-slate-900 min-h-screen antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
