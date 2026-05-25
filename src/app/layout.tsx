import "./globals.css";
import type { Metadata } from "next";
import { Noto_Sans, Montserrat, Sigmar } from "next/font/google";

// Noto Sans for body text — humanist, neutral, very legible across weights.
// Exposed as a CSS variable so the Tailwind `font-sans` token picks it up.
const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// Montserrat for section headings (event titles, sidebar headings, etc.) —
// geometric, modern. Mapped to the Tailwind `font-display` token.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Sigmar — chunky, playful display face reserved for the main page title
// ("Jax Beach Fun Times"). Single weight available. Used only via the
// `font-title` Tailwind alias.
const sigmar = Sigmar({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-title",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wavelength",
  description: "Events on your wavelength — Jacksonville Beach",
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
    <html lang="en" className={`${notoSans.variable} ${montserrat.variable} ${sigmar.variable}`}>
      <body className="text-slate-900 min-h-screen antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
