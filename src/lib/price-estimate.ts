// Per-event price estimator. Most scrapers don't carry pricing data — only
// Ticketmaster and tip-parsed events have real numbers. Rather than show a
// blank where price would go, fall back to a venue/category guess and clearly
// label it with a "~" so the user can tell guesses from real data.
//
// Rules are deliberately conservative — if we don't have a sensible heuristic,
// return "unknown" and the card just shows blank. Better than fabricating.

import type { EventWithExtras } from "@/lib/db";

export type PriceEstimate =
  | { kind: "free" }
  | { kind: "range"; min: number; max?: number }
  | { kind: "unknown" };

export function estimatePrice(event: EventWithExtras): PriceEstimate {
  const source = event.source;
  const venue = (event.venue_name ?? "").toLowerCase();
  const cats = event.categories;
  const title = event.title.toLowerCase();
  const hasCat = (c: string) => cats.includes(c as never);

  // Civic / government meetings — always free.
  if (/hearing|council|magistrate|board meeting|budget|town hall/.test(title)) {
    return { kind: "free" };
  }

  // City parks/library/beach events — overwhelmingly free.
  if (
    source === "jax-beach-city" &&
    (/park|library|community center|seawalk|latham plaza|pier|beach/.test(venue) ||
      /free/.test(title))
  ) {
    return { kind: "free" };
  }

  // Venue-specific overrides — strongest signal we have.
  if (source === "florida-theatre") return { kind: "range", min: 35, max: 80 };
  if (/cummer/.test(venue)) return { kind: "range", min: 10, max: 15 };
  if (/moca|museum of contemporary/.test(venue)) return { kind: "range", min: 10, max: 15 };
  if (/symphony|jacoby/.test(venue)) return { kind: "range", min: 25, max: 70 };
  if (/daily['']s place|vystar veterans|baseball grounds/.test(venue)) {
    return { kind: "range", min: 35, max: 120 };
  }

  // Category-driven estimates, ordered from most specific to most generic.
  if (hasCat("swing-dance")) return { kind: "range", min: 10, max: 20 };
  if (hasCat("sound-bath")) return { kind: "range", min: 20, max: 35 };
  if (hasCat("yoga")) return { kind: "range", min: 15, max: 25 };
  if (hasCat("kayaking") || hasCat("snorkeling")) return { kind: "range", min: 25, max: 75 };
  if (hasCat("boat-ride")) return { kind: "range", min: 30, max: 60 };
  if (hasCat("maker-space") || hasCat("art-class") || hasCat("learning-workshop")) {
    return { kind: "range", min: 20, max: 50 };
  }
  if (hasCat("comedy")) return { kind: "range", min: 20, max: 40 };
  if (hasCat("theater")) return { kind: "range", min: 25, max: 60 };
  if (hasCat("music-swing-jazz")) return { kind: "range", min: 15, max: 40 };
  if (hasCat("music-live-other")) return { kind: "range", min: 15, max: 40 };
  if (hasCat("sports")) return { kind: "range", min: 15, max: 60 };
  if (hasCat("market-shopping")) return { kind: "free" };
  if (hasCat("art-exhibition")) return { kind: "range", min: 0, max: 15 };
  if (hasCat("intellectual-discussion") || hasCat("philosophy")) {
    return { kind: "range", min: 0, max: 10 };
  }
  if (hasCat("festival")) return { kind: "range", min: 0, max: 20 };
  if (hasCat("outdoor-nature")) return { kind: "range", min: 0, max: 15 };
  if (hasCat("kids-family")) return { kind: "range", min: 0, max: 15 };

  return { kind: "unknown" };
}

export type PriceDisplay = {
  text: string;
  isEstimate: boolean;
};

export function priceDisplayFor(event: EventWithExtras): PriceDisplay {
  // Real data takes precedence over any estimate.
  if (event.price_min === 0 && (event.price_max === 0 || event.price_max == null)) {
    return { text: "Free", isEstimate: false };
  }
  if (event.price_min != null) {
    if (event.price_max == null || event.price_min === event.price_max) {
      return { text: `$${event.price_min}`, isEstimate: false };
    }
    return { text: `$${event.price_min}–${event.price_max}`, isEstimate: false };
  }

  const est = estimatePrice(event);
  if (est.kind === "free") return { text: "~Free", isEstimate: true };
  if (est.kind === "range") {
    if (est.min === 0 && est.max != null) return { text: `~$0–${est.max}`, isEstimate: true };
    if (est.max == null || est.min === est.max) return { text: `~$${est.min}`, isEstimate: true };
    return { text: `~$${est.min}–${est.max}`, isEstimate: true };
  }
  return { text: "", isEstimate: false };
}
