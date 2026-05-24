import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jax Beach Fun Times",
  description: "Personal event discovery for Jacksonville Beach",
  // Inline SVG favicon — calendar emoji rendered into a tiny SVG so we don't
  // ship a binary asset. Works in all modern browsers.
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🥳</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-sand-50 text-slate-900 min-h-screen">{children}</body>
    </html>
  );
}
