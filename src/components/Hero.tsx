"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Cinematic masthead built on the St. Johns River skyline photo.
 *
 * The source was a 4032px, 1.1MB phone original. next/image was serving a
 * 517KB derivative at 3840 for retina — far too much for a 340px-tall
 * decorative band that is also `priority`, so it blocked LCP on the real
 * content. The file is stored at 2400px instead, which caps what any
 * derivative can cost; the scrim and grain hide the difference entirely.
 *
 * Four 2026 trends, chosen because they suit this app rather than to collect
 * them all:
 *
 *  - Neo-minimalism + micro-maximalism: ONE loud element. The hero carries all
 *    the weight so the results below can stay quiet and legible.
 *  - Emotion-led, candid photography: a real phone photo of this actual city,
 *    which is the whole premise of the app. Stock would undercut it.
 *  - Chromatic expression: the scrim is graded toward the amber and cyan
 *    already in the water, so the overlay reads as the photograph rather than
 *    a grey wash dropped on top.
 *  - Anti-polish: a faint grain layer, because a phone photo scaled to 1200px
 *    of flat gradient looks synthetic without it.
 *
 * "Cloud Dancer" white space is the counterweight — everything below stays on
 * the warm off-white, so this band is the only dense thing on the page.
 */
export function Hero({ actions }: { actions: ReactNode }) {
  return (
    <header className="relative isolate overflow-hidden">
      {/* Fixed aspect on small screens, capped height on large, so the skyline
          never gets so tall it pushes the results below the fold. */}
      <div className="relative h-[260px] sm:h-[300px] lg:h-[340px]">
        <Image
          src="/assets/jax-night.jpg"
          alt="The Jacksonville skyline at night, seen across the St. Johns River with the bridge lit up"
          fill
          priority
          quality={70}
          sizes="100vw"
          // The skyline sits about two-thirds down the frame; anchoring there
          // keeps the city on screen when the band is cropped short.
          className="object-cover object-[50%_62%] motion-safe:animate-[heroDrift_28s_ease-out_forwards]"
        />

        {/* Graded scrim. Darkest at the bottom so the wordmark sits on the
            water rather than fighting the lit buildings. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.55)_0%,rgba(2,6,23,0.30)_42%,rgba(2,6,23,0.82)_100%)]"
        />
        {/* Chromatic wash pulled from the photo's own lights. */}
        <div
          aria-hidden
          className="absolute inset-0 mix-blend-soft-light bg-[radial-gradient(ellipse_60%_80%_at_15%_100%,rgba(13,148,136,0.55),transparent_60%),radial-gradient(ellipse_55%_75%_at_88%_95%,rgba(245,166,35,0.45),transparent_62%)]"
        />
        {/* Grain. */}
        <div aria-hidden className="absolute inset-0 opacity-[0.10] mix-blend-overlay hero-grain" />

        <div className="relative h-full max-w-7xl mx-auto px-4 md:px-8 flex flex-col">
          <div className="flex justify-end pt-4 md:pt-6">{actions}</div>

          <div className="mt-auto pb-6 md:pb-8">
            <h1 className="font-title text-white leading-[0.9] tracking-tight text-[2.75rem] sm:text-6xl lg:text-7xl drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
              <span aria-hidden className="mr-2 md:mr-3">🏄</span>
              Wavelength
            </h1>
            <p className="mt-3 text-white/85 font-medium text-sm sm:text-base max-w-xl">
              Events on your wavelength · Jacksonville, FL
            </p>
            <Link
              href="/sources"
              className="inline-block mt-2 text-[12.8px] text-white/60 hover:text-white underline decoration-white/30 hover:decoration-white/70 underline-offset-4 transition"
            >
              Where this comes from
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
