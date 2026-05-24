import type Database from "better-sqlite3";
import type { Category } from "./categories";
import { type EventRow, type EventWithExtras } from "./db";
import {
  loadPreferences,
  loadSourceAffinity,
  loadVenueAffinity,
  scoreEvent,
} from "./scoring";
import {
  type DistanceBucket,
  bucketsUpTo,
  bucketFor,
  estimateDrive,
  mapLinkForAddress,
  directionsLink,
} from "./distance";
import { eventTypeFor } from "./event-type";

export type EventFilters = {
  from?: string;
  to?: string;
  categories?: Category[];
  noCategories?: boolean; // explicit "show no events" — distinct from undefined (no filter)
  maxPrice?: number;
  freeOnly?: boolean;
  includeRecurring?: boolean;
  hideUninterested?: boolean;
  maxDistance?: DistanceBucket;
  includeMonthly?: boolean;   // default true; false hides events classified as 'monthly'
  interestedOnly?: boolean;   // only events I've thumbed-up
  registeredOnly?: boolean;   // only events I've registered for
  search?: string;
};

// The date pickers hand us "YYYY-MM-DD" strings meant as local-time dates,
// but stored timestamps are UTC ISO. A naive string compare lets an event
// stored as "2026-05-22T00:00:00Z" (which is May 21 8 PM Eastern) pass a
// from=2026-05-22 filter even though the user sees it as the prior day.
// Normalize both bounds to UTC ISO computed from local midnight on the
// user's machine (this app runs server-side on the user's own box).
function localDateToIso(dateStr: string, which: "start" | "endExclusive"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr; // fall back to whatever was passed; SQL will compare as-is
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]) + (which === "endExclusive" ? 1 : 0);
  return new Date(y, mo, d, 0, 0, 0, 0).toISOString();
}

export function queryEvents(db: Database.Database, filters: EventFilters): EventWithExtras[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  // Three classes of "starts before the window but is still relevant":
  //   (a) Evergreen with no ends_at — always-on item (a park, a venue stub).
  //   (b) Anything with an ends_at that extends to or past 'from' — covers
  //       both evergreen exhibitions (Cummer show running Mar–Aug) AND
  //       multi-day one-offs like the Jacksonville Jazz Festival (May 21–25
  //       should appear in a May 22–25 search).
  //   (c) Anything whose starts_at is on or after 'from' — the normal case.
  // The 'includeRecurring=0' filter is still the kill-switch for (a)/(b)
  // when the event is flagged as recurring.
  if (filters.from) {
    where.push(
      `(
         (e.is_recurring = 1 AND e.ends_at IS NULL)
         OR (e.ends_at IS NOT NULL AND e.ends_at >= @from)
         OR e.starts_at >= @from
       )`
    );
    params.from = localDateToIso(filters.from, "start");
  }
  if (filters.to) {
    where.push("(e.starts_at < @to)");
    // 'to' is inclusive in the UI — convert to the *start of the next day*
    // local so SQL's strict-less-than still includes events on the chosen day.
    params.to = localDateToIso(filters.to, "endExclusive");
  }
  if (filters.freeOnly) {
    where.push("(e.price_min = 0)");
  } else if (typeof filters.maxPrice === "number") {
    where.push("(e.price_min IS NULL OR e.price_min <= @maxPrice)");
    params.maxPrice = filters.maxPrice;
  }
  if (filters.includeRecurring === false) {
    where.push("e.is_recurring = 0");
  }
  if (filters.hideUninterested) {
    // Hide three states: 👎 Not for me (interest = -1, includes 🚗 Too far which
    // also writes interest = -1), and ⏭ Not this time (dismissed = 1).
    where.push("(i.value IS NULL OR i.value >= 0)");
    where.push("(d.dismissed IS NULL OR d.dismissed = 0)");
  }
  if (filters.interestedOnly) {
    where.push("i.value = 1");
  }
  if (filters.registeredOnly) {
    where.push("r.registered = 1");
  }
  if (filters.search) {
    where.push("(e.title LIKE @search OR e.description LIKE @search)");
    params.search = `%${filters.search}%`;
  }
  if (filters.noCategories) {
    // User toggled "Select all" off without picking any chips — explicit
    // request for zero events. Distinct from omitting the category filter,
    // which means "show everything regardless of category".
    where.push("1 = 0");
  } else if (filters.categories && filters.categories.length > 0) {
    const placeholders = filters.categories.map((_, i) => `@cat${i}`).join(",");
    where.push(
      `e.id IN (SELECT event_id FROM event_categories WHERE category IN (${placeholders}))`
    );
    filters.categories.forEach((c, i) => (params[`cat${i}`] = c));
  }

  const sql = `
    SELECT e.*,
           i.value AS interest,
           a.attended AS attended,
           a.stars AS stars,
           r.registered AS registered,
           d.dismissed AS dismissed
    FROM events e
    LEFT JOIN interest i ON i.event_id = e.id
    LEFT JOIN attendance a ON a.event_id = e.id
    LEFT JOIN registration r ON r.event_id = e.id
    LEFT JOIN dismissed d ON d.event_id = e.id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY e.starts_at ASC
  `;

  let rows = db.prepare(sql).all(params) as Array<
    EventRow & {
      interest: number | null;
      attended: number | null;
      stars: number | null;
      registered: number | null;
      dismissed: number | null;
    }
  >;

  // Distance filter is applied here (not in SQL) because the bucket is computed
  // in JS from the city name + lookup table.
  if (filters.maxDistance) {
    const allowed = new Set(bucketsUpTo(filters.maxDistance));
    rows = rows.filter((r) =>
      allowed.has(bucketFor(r.city, `${r.venue_name ?? ""} ${r.title ?? ""}`))
    );
  }

  // 'Monthly' classification is text-based (not stored), so filter in JS.
  if (filters.includeMonthly === false) {
    rows = rows.filter((r) => eventTypeFor(r) !== "monthly");
  }

  const catsStmt = db.prepare(
    "SELECT category FROM event_categories WHERE event_id = ?"
  );
  const prefs = loadPreferences(db);
  const venues = loadVenueAffinity(db);
  const sources = loadSourceAffinity(db);

  return rows.map((row) => {
    const cats = (catsStmt.all(row.id) as Array<{ category: string }>).map(
      (r) => r.category as Category
    );
    const breakdown = scoreEvent(
      db,
      {
        id: row.id,
        source: row.source,
        is_recurring: row.is_recurring,
        price_min: row.price_min,
        venue_name: row.venue_name,
        city: row.city,
        title: row.title,
        categories: cats,
      },
      prefs,
      venues,
      sources
    );
    const haystack = `${row.venue_name ?? ""} ${row.title ?? ""}`;
    const drive = estimateDrive(row.lat, row.lon, row.city, haystack);
    // Only build a map link when we have something more specific than just a
    // city name — pointing Google Maps at "Jacksonville" alone is useless.
    const hasSpecific = !!(row.venue_name || row.venue_address);
    const addressParts = hasSpecific
      ? [row.venue_name, row.venue_address, row.city]
      : [];
    return {
      ...row,
      categories: cats,
      score: breakdown.total,
      distance_bucket: breakdown.bucket,
      distance_penalty: breakdown.distancePenalty,
      drive_miles: drive?.miles ?? null,
      drive_minutes: drive?.minutes ?? null,
      drive_precise: drive?.precise ?? false,
      map_link: mapLinkForAddress(addressParts),
      directions_link: directionsLink(addressParts),
    };
  });
}
