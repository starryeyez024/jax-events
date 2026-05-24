// Shared helpers for iCal-based scrapers (Cummer, Meetup, any other Tribe-Events
// or Google-Calendar style feed). node-ical does the heavy lifting; we just
// normalize into our EventInput shape.

import nodeIcal from "node-ical";
import type { EventInput } from "@/lib/db";
import type { Category } from "@/lib/categories";

type IcalVEvent = {
  type: "VEVENT";
  uid: string;
  summary?: string;
  description?: string;
  location?: string;
  url?: string;
  start: Date;
  end?: Date;
  datetype?: string;
};

export type IcalFetchOpts = {
  url: string;
  source: string;                       // db column 'source'
  defaultCategories: Category[];        // fallback if classifier returns nothing
  classify?: (e: IcalVEvent) => Category[]; // optional per-feed classifier
  venueName?: string;                   // fallback venue
  city?: string;                        // fallback city
  recurringIfLongerThanDays?: number;   // tag multi-day items as 'is_recurring'
};

const DEFAULT_RECURRING_THRESHOLD = 7;

export async function fetchIcal(opts: IcalFetchOpts): Promise<EventInput[]> {
  const data = await nodeIcal.async.fromURL(opts.url);
  const events: EventInput[] = [];

  // Skip events older than yesterday. Most feeds (Meetup, Cummer) only ship
  // upcoming events anyway, but Google Calendar's iCal export includes the
  // full history — without this filter, a long-running calendar dumps years
  // of dead events into the DB.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);

  for (const value of Object.values(data)) {
    const v = value as unknown as IcalVEvent;
    if (v.type !== "VEVENT" || !v.start) continue;
    // Use ends_at when present (multi-day events still relevant during their
    // span), otherwise fall back to starts_at.
    const tail = v.end ?? v.start;
    if (tail < cutoff) continue;

    const classified = opts.classify ? opts.classify(v) : [];
    const categories = classified.length ? classified : opts.defaultCategories;

    const durationDays = v.end
      ? (v.end.getTime() - v.start.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const recurringThreshold =
      opts.recurringIfLongerThanDays ?? DEFAULT_RECURRING_THRESHOLD;
    const isRecurring = durationDays > recurringThreshold;

    events.push({
      source: opts.source,
      source_id: asString(v.uid),
      title: clean(asString(v.summary) ?? "Untitled"),
      description: asString(v.description),
      url: asString(v.url) ?? null,
      starts_at: v.start.toISOString(),
      ends_at: v.end ? v.end.toISOString() : null,
      is_recurring: isRecurring,
      venue_name: asString(v.location) ?? opts.venueName ?? null,
      city: opts.city ?? null,
      categories,
    });
  }

  return events;
}

function clean(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

// node-ical returns either a string or an object like { val, params } for fields
// that have iCal parameters (ALTREP, TZID, etc). Normalize to a plain string.
export function stringy(v: unknown): string {
  return asString(v) ?? "";
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "object" && "val" in (v as object)) {
    const val = (v as { val: unknown }).val;
    return typeof val === "string" ? val.trim() || null : null;
  }
  return null;
}
