// Resolving a source's date string into a stored timestamp.
//
// Feeds emit two very different things through the same field:
//
//   "2026-09-10T19:00:00-04:00"  a real moment
//   "2026-09-10"                 a date, with no time at all
//
// The second used to be papered over with an invented time — Eventbrite's
// parser substituted local noon, and a bare `new Date("2026-09-10")` parses
// as UTC midnight, which renders as 8pm the PREVIOUS day in Eastern. Both
// state something the source never said, and a wrong time reads as fact
// while a missing one reads as missing. So date-only values are flagged
// all_day and anchored to local midnight, which keeps them on the correct
// calendar day without claiming an hour.

/** Eastern offset for a given date. US DST: 2nd Sun Mar - 1st Sun Nov. */
function easternOffset(y: number, m: number, d: number): string {
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (n - 1) * 7;
  };
  const dstStart = { m: 2, d: nthSunday(2, 2) }; // March
  const dstEnd = { m: 10, d: nthSunday(10, 1) }; // November
  const after = (a: { m: number; d: number }) => m > a.m || (m === a.m && d >= a.d);
  const before = (a: { m: number; d: number }) => m < a.m || (m === a.m && d < a.d);
  return after(dstStart) && before(dstEnd) ? "-04:00" : "-05:00";
}

export type ResolvedTime = { iso: string; allDay: boolean };

export function resolveEventTime(raw: string | null | undefined): ResolvedTime | null {
  if (!raw) return null;
  const s = raw.trim();

  // Already a real moment — trust it.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : { iso: d.toISOString(), allDay: false };
  }

  // Date only: anchor to local midnight so it lands on the right day, and
  // record that the time is unknown rather than inventing one.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const d = new Date(`${s}T00:00:00${easternOffset(y, mo - 1, da)}`);
    return Number.isNaN(d.getTime()) ? null : { iso: d.toISOString(), allDay: true };
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime())
    ? null
    : { iso: fallback.toISOString(), allDay: false };
}
