// How far ahead the app can honestly claim to know what's on.
//
// The furthest event is a bad answer: one source (visit-jax) lists concerts
// nine months out, so "through June 2027" would imply a completeness that
// does not exist. Nor is event count the right test — that same source can
// carry twenty events in a week on its own and look healthy while every
// community calendar has gone quiet.
//
// Source diversity is the honest test. Past this date the listings are
// mainly large venues, not because nothing else is happening but because
// nobody has published it yet.

/** Distinct sources a day needs before it counts as covered. */
export const MIN_SOURCES = 3;

type Dated = { starts_at: string; source: string };

/**
 * Last day, as YYYY-MM-DD, on which at least MIN_SOURCES sources have an
 * event. Null when nothing qualifies. Mirrors coverageThrough() in db.ts,
 * which answers the same question in SQL for the local path — keep the two
 * in step.
 */
export function coverageThrough(events: Dated[], minSources = MIN_SOURCES): string | null {
  const byDay = new Map<string, Set<string>>();
  const now = Date.now();

  for (const e of events) {
    const t = new Date(e.starts_at).getTime();
    if (Number.isNaN(t) || t < now) continue;
    // Local day, so the boundary matches the dates shown on cards.
    const d = new Date(t);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    if (!byDay.has(day)) byDay.set(day, new Set());
    byDay.get(day)!.add(e.source);
  }

  let last: string | null = null;
  for (const [day, sources] of byDay) {
    if (sources.size >= minSources && (last === null || day > last)) last = day;
  }
  return last;
}

/** "Nov 17" — short enough to sit beside the result count. */
export function formatCoverage(day: string | null): string | null {
  if (!day) return null;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
