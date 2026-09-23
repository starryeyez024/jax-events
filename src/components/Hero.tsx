"use client";

import type { ReactNode } from "react";

/**
 * Cinematic masthead built on the St. Johns River skyline photo.
 *
 * The file is stored downscaled and re-encoded rather than as the original.
 * next/image will otherwise generate a retina derivative at 3840 — far too
 * much for a decorative band that is also `priority`, so it competes with
 * the real content for LCP. Capping the stored width caps what any
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
    <header
      className="relative isolate overflow-hidden"
      role="img"
      aria-label="The Jacksonville skyline at night, seen across the St. Johns River with the Acosta Bridge lit up"
    >
      {/* Fixed aspect on small screens, capped height on large, so the skyline
          never gets so tall it pushes the results below the fold. */}
      <div className="relative h-[210px] sm:h-[250px] lg:h-[290px]">
        {/* The photo is a CSS background (see .hero-photo in globals.css),
            not an <img>, so its framing is one value — --hero-pos — rather
            than an object-position buried in this file. */}
        <div
          aria-hidden
          className="absolute inset-0 hero-photo motion-safe:animate-[heroDrift_28s_ease-out_forwards]"
        />

        {/* Graded scrim, kept as light as the type allows. It exists only to
            hold the wordmark and the controls, not to mood-light the photo —
            the earlier values (55/30/82) were tuned for a flatter original
            and buried most of the water in this one. The wordmark leans on
            its own drop shadow instead, which darkens the type rather than
            the picture behind it. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.34)_0%,rgba(2,6,23,0.08)_45%,rgba(2,6,23,0.58)_100%)]"
        />
        {/* Chromatic wash pulled from the photo's own lights. */}
        <div
          aria-hidden
          className="absolute inset-0 mix-blend-soft-light bg-[radial-gradient(ellipse_60%_80%_at_15%_100%,rgba(13,148,136,0.28),transparent_60%),radial-gradient(ellipse_55%_75%_at_88%_95%,rgba(245,166,35,0.22),transparent_62%)]"
        />
        {/* Grain. */}
        <div aria-hidden className="absolute inset-0 opacity-[0.055] mix-blend-overlay hero-grain" />

        <div className="relative h-full max-w-7xl mx-auto px-4 md:px-8 flex flex-col">
          <div className="flex justify-end pt-3 md:pt-4">{actions}</div>

          <div className="mt-auto pb-5 md:pb-6">
            {/* A serif at this weight needs more size and looser tracking than
                the chunky face it replaced to hold the same presence. */}
            <h1 className="font-title text-white leading-[0.85] tracking-[-0.015em] text-[3.25rem] sm:text-7xl lg:text-8xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)]">
              <span aria-hidden className="mr-2 md:mr-3">🏄</span>
              Wavelength
            </h1>
            <p className="mt-2 text-white/90 font-medium text-sm sm:text-base max-w-xl drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
              Events on your wavelength · Jacksonville, FL
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
