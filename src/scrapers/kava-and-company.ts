// Kava & Company — three-location kava bar (Jax Beach, Mandarin, San Marco).
// Source: https://kavaandcompany.com/events/
//
// Unlike every other scraper here, this page publishes a RECURRENCE SCHEDULE
// rather than dated events: a hand-authored WordPress page whose rows say
// "2ND+4TH WED · San Marco · 7:00 PM" with no calendar plugin, JSON-LD, or
// iCal feed behind it. So we parse the rule and expand it into concrete dated
// instances over HORIZON_WEEKS.
//
// Markup is a custom theme (kavaco), stable and semantic:
//   .event-row
//     .event-day   "MON" | "2ND+4TH WED" | "LAST THU" | "W·F SAT"
//     .event-info  h3 title, p description, optional a.btn (signup/ticket link)
//     .event-loc   "Jax Beach" | "Mandarin" | "San Marco"
//     .event-time  "8:00 PM" | "10AM–3PM" | "7:00 PM - 11:00 PM"

import * as cheerio from "cheerio";
import type { EventInput } from "@/lib/db";
import type { Category } from "@/lib/categories";

const PAGE_URL = "https://kavaandcompany.com/events/";

// How far ahead to expand the recurrence rules. The page has no end dates, so
// this is our own choice — 8 weeks matches how far the other small-venue
// sources publish, and keeps the /sources "published through" figure honest
// rather than implying we know their schedule a year out.
const HORIZON_WEEKS = 8;

const VENUES: Record<string, { name: string; address: string; city: string }> = {
  "jax beach": {
    name: "Kava & Company — Jax Beach",
    address: "223 9th Ave S, Jacksonville Beach, FL 32250",
    city: "Jacksonville Beach",
  },
  mandarin: {
    name: "Kava & Company — Mandarin",
    address: "11018 Old St Augustine Rd, Ste 123, Jacksonville, FL 32257",
    city: "Jacksonville",
  },
  "san marco": {
    name: "Kava & Company — San Marco",
    address: "1224 Kings Ave, Jacksonville, FL 32207",
    city: "Jacksonville",
  },
};

const DOW: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

// The page mixes three-letter codes with single-letter ones inside a single
// cell: "W·F<br>SAT" means Wednesday, Friday and Saturday. Only M/W/F are
// listed here — T and S are ambiguous (Tue/Thu, Sat/Sun), so those must be
// written out in full or we'd be guessing.
const DOW_ABBREV: Record<string, number> = { M: 1, W: 3, F: 5 };

export async function fetchKavaAndCompany(): Promise<EventInput[]> {
  const res = await fetch(PAGE_URL, {
    headers: { "user-agent": "Mozilla/5.0 (jax-events local scraper)" },
  });
  if (!res.ok) throw new Error(`Kava & Company HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());

  const out: EventInput[] = [];

  $(".event-row").each((_, el) => {
    const $el = $(el);
    // .event-day can contain a <br> ("2ND+4TH<br>WED") — flatten to spaces.
    const dayRaw = ($el.find(".event-day").html() ?? "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    const title = $el.find("h3").first().text().trim();
    const description = $el.find(".event-info p").first().text().trim() || null;
    const locText = $el.find(".event-loc").first().text().trim();
    const timeText = $el.find(".event-time").first().text().trim();
    // Signup/ticket links are relative ("/product/craft-with-cass/").
    const href = $el.find(".event-info a").first().attr("href");
    const link = href ? new URL(href, PAGE_URL).toString() : PAGE_URL;

    if (!title || !dayRaw) return;

    const venue = VENUES[locText.toLowerCase()];
    const { startMin, endMin } = parseTimeRange(timeText);
    if (startMin == null) return;

    const rule = parseRecurrence(dayRaw);

    // Unanchored biweekly ("EVERY OTHER MON") can't be resolved to real dates
    // from this page — there's no reference week anywhere in the markup.
    // Rather than inventing dates or dropping the event, emit it once as an
    // evergreen entry so it can still surface as a standing suggestion.
    if (rule.kind === "unresolved") {
      const next = nextWeekday(new Date(), rule.weekdays[0] ?? 1);
      out.push(
        build({
          title,
          description: prefixCaveat(description, dayRaw),
          link,
          venue,
          date: next,
          startMin,
          endMin,
          isRecurring: true,
        })
      );
      return;
    }

    for (const date of expand(rule, HORIZON_WEEKS)) {
      out.push(
        build({ title, description, link, venue, date, startMin, endMin, isRecurring: false })
      );
    }
  });

  return out;
}

function prefixCaveat(description: string | null, dayRaw: string): string {
  const caveat = `Recurs "${dayRaw.toLowerCase()}" — the venue doesn't publish which weeks, so confirm before going.`;
  return description ? `${caveat} ${description}` : caveat;
}

function build(a: {
  title: string;
  description: string | null;
  link: string;
  venue: { name: string; address: string; city: string } | undefined;
  date: Date;
  startMin: number;
  endMin: number | null;
  isRecurring: boolean;
}): EventInput {
  const starts = withMinutes(a.date, a.startMin);
  const ends = a.endMin != null ? withMinutes(a.date, a.endMin) : null;
  return {
    source: "kava-and-company",
    source_id: `${starts.toISOString().slice(0, 10)}-${slugify(a.title)}-${slugify(
      a.venue?.city ?? "jax"
    )}`,
    title: a.title,
    description: a.description,
    url: a.link,
    starts_at: starts.toISOString(),
    ends_at: ends ? ends.toISOString() : null,
    is_recurring: a.isRecurring,
    venue_name: a.venue?.name ?? "Kava & Company",
    venue_address: a.venue?.address ?? null,
    city: a.venue?.city ?? "Jacksonville",
    // Kava bar programming is free to attend; you pay for drinks. The few
    // paid workshops carry a "Sign Up & Pay" link, so don't claim free there.
    price_min: /sign up & pay|\/product\//i.test(a.link) ? null : 0,
    categories: classify(a.title, a.description ?? ""),
  };
}

// ----- Recurrence parsing -----

type Rule =
  | { kind: "weekly"; weekdays: number[] }
  | { kind: "nth"; weekday: number; ordinals: number[] } // 1-4
  | { kind: "last"; weekday: number }
  | { kind: "unresolved"; weekdays: number[] };

function parseRecurrence(raw: string): Rule {
  const weekdays = parseWeekdays(raw);

  // "EVERY OTHER MON" — biweekly with no anchor date published.
  if (/EVERY OTHER/.test(raw)) return { kind: "unresolved", weekdays };

  // "LAST WED"
  if (/\bLAST\b/.test(raw) && weekdays.length === 1) {
    return { kind: "last", weekday: weekdays[0] };
  }

  // "2ND+4TH WED", "1ST+3RD THU", "1ST SAT", "4TH SUN"
  const ordinals = [...raw.matchAll(/(\d)(?:ST|ND|RD|TH)\b/g)].map((m) => Number(m[1]));
  if (ordinals.length && weekdays.length === 1) {
    return { kind: "nth", weekday: weekdays[0], ordinals };
  }

  // Plain weekday list: "MON", "W·F SAT" (Wed, Fri, Sat).
  return { kind: "weekly", weekdays };
}

/**
 * Pull every weekday out of a cell like "W·F SAT" or "2ND+4TH WED".
 * Tokenizes on the separators the page uses (·, +, -, whitespace) so a
 * three-letter code and a single-letter one can coexist in one cell.
 */
function parseWeekdays(raw: string): number[] {
  const days = new Set<number>();
  for (const token of raw.split(/[^A-Z0-9]+/i).filter(Boolean)) {
    const t = token.toUpperCase();
    if (t in DOW) days.add(DOW[t]);
    else if (t in DOW_ABBREV) days.add(DOW_ABBREV[t]);
  }
  return [...days].sort((a, b) => a - b);
}

/** All dates matching `rule` from today through `weeks` ahead. */
function expand(rule: Rule, weeks: number): Date[] {
  const out: Date[] = [];
  const start = startOfDay(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + weeks * 7);

  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    if (matches(rule, day)) out.push(new Date(day));
  }
  return out;
}

function matches(rule: Rule, d: Date): boolean {
  switch (rule.kind) {
    case "weekly":
      return rule.weekdays.includes(d.getDay());
    case "nth":
      return d.getDay() === rule.weekday && rule.ordinals.includes(weekOfMonth(d));
    case "last":
      return d.getDay() === rule.weekday && isLastWeekdayOfMonth(d);
    case "unresolved":
      return false;
  }
}

/** 1-based index of this weekday within its month (the 3rd Tuesday → 3). */
function weekOfMonth(d: Date): number {
  return Math.floor((d.getDate() - 1) / 7) + 1;
}

function isLastWeekdayOfMonth(d: Date): boolean {
  const next = new Date(d);
  next.setDate(next.getDate() + 7);
  return next.getMonth() !== d.getMonth();
}

function nextWeekday(from: Date, weekday: number): Date {
  const d = startOfDay(from);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return d;
}

// ----- Time parsing -----

/**
 * Handles the three shapes on the page:
 *   "8:00 PM"              → start only
 *   "10AM–3PM"             → range, en-dash, no minutes
 *   "7:00 PM - 11:00 PM"   → range, hyphen
 * Returns minutes-from-midnight.
 */
function parseTimeRange(s: string): { startMin: number | null; endMin: number | null } {
  const parts = s.split(/\s*[–—-]\s*/).filter(Boolean);
  const startMin = parseClock(parts[0] ?? "");
  const endMin = parts[1] ? parseClock(parts[1]) : null;
  return { startMin, endMin };
}

function parseClock(s: string): number | null {
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const pm = /pm/i.test(m[3]);
  if (pm && hour < 12) hour += 12;
  if (!pm && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function withMinutes(day: Date, minutes: number): Date {
  const d = startOfDay(day);
  d.setMinutes(minutes);
  return d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ----- Classification -----

function classify(title: string, description: string): Category[] {
  const t = `${title} ${description}`.toLowerCase();
  const cats = new Set<Category>();

  if (/yoga|salt & flow|salt and flow/.test(t)) cats.add("yoga");
  if (/yoga|run club|flow/.test(t)) cats.add("health-wellness");
  if (/run club/.test(t)) cats.add("sports");
  if (/open mic|karaoke|dj set|name that tune|acoustic|musicians/.test(t))
    cats.add("music-live-other");
  if (/comedy/.test(t)) cats.add("comedy");
  if (/craft|crochet|paint|by numbers/.test(t)) {
    cats.add("art-class");
    cats.add("learning-workshop");
  }
  if (/trivia|bingo|pool tournament|8-ball|marvelous|comic/.test(t))
    cats.add("experiential");
  if (/food truck|vendor market|coffee/.test(t)) cats.add("food-drink");
  if (/vendor market/.test(t)) cats.add("market-shopping");
  if (/cars & coffee|cars and coffee/.test(t)) cats.add("experiential");

  if (cats.size === 0) cats.add("experiential");
  return Array.from(cats);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
