// Client-side event filtering for READ_ONLY (static) mode.
//
// In the full app, /api/events runs queryEvents() against SQLite. On the
// public static deploy there's no database — the page loads the whole
// upcoming snapshot from /events.json once and narrows it here, in the
// browser. This mirrors the filter semantics of queryEvents() in
// events-query.ts; keep the two in sync if you change one.
//
// Personalization-only filters (hideUninterested, interestedOnly,
// registeredOnly) are intentionally no-ops here: the public snapshot carries
// no per-user interest/dismiss/registration data.

import type { EventWithExtras } from "./db";
import type { FilterState } from "@/components/Filters";
import { bucketsUpTo } from "./distance";
import { eventTypeFor } from "./event-type";

// Same local-date → UTC-ISO conversion queryEvents uses, so the date window
// lines up exactly with the server path. "endExclusive" rolls to the next
// day's midnight so the chosen end date is inclusive under a strict <.
function localDateToIso(dateStr: string, which: "start" | "endExclusive"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]) + (which === "endExclusive" ? 1 : 0);
  return new Date(y, mo, d, 0, 0, 0, 0).toISOString();
}

export function filterEvents(
  events: EventWithExtras[],
  f: FilterState
): EventWithExtras[] {
  const fromIso = f.from ? localDateToIso(f.from, "start") : null;
  const toIso = f.to ? localDateToIso(f.to, "endExclusive") : null;
  const allowedBuckets = f.maxDistance ? new Set(bucketsUpTo(f.maxDistance)) : null;
  const search = f.search ? f.search.toLowerCase() : null;
  // !allCategories with an empty selection means "show nothing"; with a
  // non-empty selection it's a subset filter. allCategories => no filter.
  const catSet = !f.allCategories ? new Set<string>(f.selectedCategories) : null;

  return events.filter((e) => {
    // Date window — same three "still relevant before the window" classes as
    // queryEvents: (a) open-ended evergreen, (b) anything still running at
    // 'from', (c) the normal start-on-or-after case.
    if (fromIso) {
      const passFrom =
        (e.is_recurring === 1 && !e.ends_at) ||
        (e.ends_at != null && e.ends_at >= fromIso) ||
        e.starts_at >= fromIso;
      if (!passFrom) return false;
    }
    if (toIso && !(e.starts_at < toIso)) return false;

    if (f.freeOnly) {
      if (e.price_min !== 0) return false;
    } else if (typeof f.maxPrice === "number") {
      if (!(e.price_min == null || e.price_min <= f.maxPrice)) return false;
    }

    if (f.includeRecurring === false && e.is_recurring !== 0) return false;

    if (search) {
      const hay = `${e.title ?? ""} ${e.description ?? ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }

    if (catSet) {
      if (catSet.size === 0) return false; // explicit "show no events"
      if (!e.categories.some((c) => catSet.has(c))) return false;
    }

    if (allowedBuckets && !allowedBuckets.has(e.distance_bucket)) return false;

    if (f.includeMonthly === false && eventTypeFor(e) === "monthly") return false;

    return true;
  });
}
