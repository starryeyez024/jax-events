import type Database from "better-sqlite3";
import type { Category } from "./categories";
import { distancePenalty, type DistanceBucket } from "./distance";

// Transparent linear scoring. Higher = better match for you.
//
// score = avg(category_weights) * categoryWeightFactor
//       + venueAffinity
//       + sourceAffinity            (per-Meetup-group or per-source learned bump)
//       + freeBonus                 (free events get a small lift)
//       + experientialBonus         (any event tagged 'experiential' gets a lift)
//       - consumerPenalty           (events tagged only 'market-shopping' get a hit)
//       + recurringPenalty          (slight penalty for evergreen items so dated events win)
//       + distancePenalty           (city-based, source-modified; small events penalized harder)
//
// All weights can be tuned in one place.

const TUNING = {
  categoryWeightFactor: 1.0,
  freeBonus: 8,
  experientialBonus: 15,
  consumerPenaltyIfOnlyShopping: -25,
  // Slight nudge — dated one-offs still win all else equal, but ongoing
  // exhibitions stay visible without scrolling past 90+ results.
  recurringPenalty: -3,
};

export type EventForScoring = {
  id: string;
  source: string;
  is_recurring: number;
  price_min: number | null;
  venue_name: string | null;
  city: string | null;
  title: string;
  categories: Category[];
};

export type ScoreBreakdown = {
  total: number;
  bucket: DistanceBucket;
  distancePenalty: number;
};

export function scoreEvent(
  db: Database.Database,
  event: EventForScoring,
  prefs: Map<string, number>,
  venueAffinity: Map<string, number>,
  sourceAffinity: Map<string, number>
): ScoreBreakdown {
  const empty = { total: 0, bucket: "local" as DistanceBucket, distancePenalty: 0 };
  if (event.categories.length === 0) return empty;

  const weights = event.categories.map((c) => prefs.get(c) ?? 0);
  const categoryAvg = weights.reduce((a, b) => a + b, 0) / weights.length;

  let score = categoryAvg * TUNING.categoryWeightFactor;

  if (event.venue_name) score += venueAffinity.get(event.venue_name) ?? 0;
  score += sourceAffinity.get(event.source) ?? 0;

  if (event.price_min === 0) score += TUNING.freeBonus;
  if (event.categories.includes("experiential")) score += TUNING.experientialBonus;

  if (event.categories.length === 1 && event.categories[0] === "market-shopping") {
    score += TUNING.consumerPenaltyIfOnlyShopping;
  }

  if (event.is_recurring) score += TUNING.recurringPenalty;

  // Use venue_name + title as a fallback haystack — many Meetup events have
  // city=null but encode the city in the venue/location string or the title
  // itself (e.g. 'Book Club (Orlando, 7362 Future Drive)').
  const haystack = [event.venue_name, event.title].filter(Boolean).join(" ");
  const { bucket, penalty } = distancePenalty(event.city, event.source, haystack);
  score += penalty;

  return {
    total: Math.round(score * 10) / 10,
    bucket,
    distancePenalty: penalty,
  };
}

export function loadPreferences(db: Database.Database): Map<string, number> {
  const rows = db.prepare("SELECT category, weight FROM preferences").all() as Array<{
    category: string;
    weight: number;
  }>;
  return new Map(rows.map((r) => [r.category, r.weight]));
}

export function loadVenueAffinity(db: Database.Database): Map<string, number> {
  const rows = db.prepare("SELECT venue_name, bonus FROM venue_affinity").all() as Array<{
    venue_name: string;
    bonus: number;
  }>;
  return new Map(rows.map((r) => [r.venue_name, r.bonus]));
}

export function loadSourceAffinity(db: Database.Database): Map<string, number> {
  const rows = db.prepare("SELECT source, bonus FROM source_affinity").all() as Array<{
    source: string;
    bonus: number;
  }>;
  return new Map(rows.map((r) => [r.source, r.bonus]));
}

// ----- Learning -----
//
// Pre-event interest: small nudge (+/- 2 per category).
// Post-event 1-5 stars: bigger nudge — (stars - 3) * 4 per category.
// Venue affinity moves at half that rate.
// 'Too far' is a much stronger negative signal — the event interests you
// in category, but the distance/setting kills it. We:
//   - record interest = -1
//   - penalize the source heavily (so future events from this Meetup group drop)
//   - penalize the venue heavily
// Crucially, we do NOT shift category weights — you still like the topic.

const LEARN = {
  interestStepPerCategory: 2,
  starStepPerCategory: 4,
  venueStepFactor: 0.5,
  tooFarSourcePenalty: -8,
  tooFarVenuePenalty: -8,
  clampMin: -100,
  clampMax: 100,
};

export function applyInterest(
  db: Database.Database,
  eventId: string,
  value: -1 | 0 | 1
): void {
  const cats = db
    .prepare("SELECT category FROM event_categories WHERE event_id = ?")
    .all(eventId) as Array<{ category: string }>;
  const delta = value * LEARN.interestStepPerCategory;
  const update = db.prepare(
    `UPDATE preferences SET weight = MAX(?, MIN(?, weight + ?)) WHERE category = ?`
  );
  const venue = (db
    .prepare("SELECT venue_name FROM events WHERE id = ?")
    .get(eventId) as { venue_name: string | null } | undefined)?.venue_name;
  const tx = db.transaction(() => {
    for (const { category } of cats) update.run(LEARN.clampMin, LEARN.clampMax, delta, category);
    if (venue) bumpVenue(db, venue, delta * LEARN.venueStepFactor);
  });
  tx();
}

export function applyStars(db: Database.Database, eventId: string, stars: 1 | 2 | 3 | 4 | 5): void {
  const cats = db
    .prepare("SELECT category FROM event_categories WHERE event_id = ?")
    .all(eventId) as Array<{ category: string }>;
  const delta = (stars - 3) * LEARN.starStepPerCategory;
  const update = db.prepare(
    `UPDATE preferences SET weight = MAX(?, MIN(?, weight + ?)) WHERE category = ?`
  );
  const venue = (db
    .prepare("SELECT venue_name FROM events WHERE id = ?")
    .get(eventId) as { venue_name: string | null } | undefined)?.venue_name;
  const tx = db.transaction(() => {
    for (const { category } of cats) update.run(LEARN.clampMin, LEARN.clampMax, delta, category);
    if (venue) bumpVenue(db, venue, delta * LEARN.venueStepFactor);
  });
  tx();
}

/**
 * "Interesting but too far / too small for the drive."
 * Penalizes the event's source (Meetup group) and venue without nuking
 * the category itself — you still like philosophy book clubs in general.
 */
export function applyTooFar(db: Database.Database, eventId: string): void {
  const row = db
    .prepare("SELECT source, venue_name FROM events WHERE id = ?")
    .get(eventId) as { source: string; venue_name: string | null } | undefined;
  if (!row) return;
  const tx = db.transaction(() => {
    bumpSource(db, row.source, LEARN.tooFarSourcePenalty);
    if (row.venue_name) bumpVenue(db, row.venue_name, LEARN.tooFarVenuePenalty);
  });
  tx();
}

/**
 * Reverse the source/venue penalties applied by applyTooFar. Used by the
 * Undo toast when the user changes their mind within ~5 seconds of clicking
 * 🚗 Too far. Symmetric — adds back the same magnitudes that applyTooFar
 * subtracted, clamped to [-100, 100] in the bumpVenue/bumpSource helpers.
 */
export function revertTooFar(db: Database.Database, eventId: string): void {
  const row = db
    .prepare("SELECT source, venue_name FROM events WHERE id = ?")
    .get(eventId) as { source: string; venue_name: string | null } | undefined;
  if (!row) return;
  const tx = db.transaction(() => {
    bumpSource(db, row.source, -LEARN.tooFarSourcePenalty);
    if (row.venue_name) bumpVenue(db, row.venue_name, -LEARN.tooFarVenuePenalty);
  });
  tx();
}

function bumpVenue(db: Database.Database, venue: string, delta: number) {
  db.prepare(
    `INSERT INTO venue_affinity (venue_name, bonus) VALUES (?, ?)
     ON CONFLICT(venue_name) DO UPDATE SET bonus = MAX(-100, MIN(100, bonus + ?))`
  ).run(venue, delta, delta);
}

function bumpSource(db: Database.Database, source: string, delta: number) {
  db.prepare(
    `INSERT INTO source_affinity (source, bonus) VALUES (?, ?)
     ON CONFLICT(source) DO UPDATE SET bonus = MAX(-100, MIN(100, bonus + ?))`
  ).run(source, delta, delta);
}
