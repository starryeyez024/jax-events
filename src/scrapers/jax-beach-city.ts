// City of Jacksonville Beach — RSS calendar feed (CivicPlus / MunicodeNEXT).
// Source: https://www.jacksonvillebeach.org/RSSFeed.aspx?ModID=58&CID=All-calendar.xml
//
// The CivicPlus iCal export is empty for this site (a Ruby-iCalendar plug that
// the city doesn't populate), so we parse the RSS instead. Each <item> has
// title, link, description (with embedded date/time/location), and three
// custom <calendarEvent:*> tags we use as the primary source of truth.

import * as cheerio from "cheerio";
import type { EventInput } from "@/lib/db";
import type { Category } from "@/lib/categories";

const FEED_URL =
  "https://www.jacksonvillebeach.org/RSSFeed.aspx?ModID=58&CID=All-calendar.xml";

export async function fetchJaxBeachCity(): Promise<EventInput[]> {
  const res = await fetch(FEED_URL, {
    headers: { "user-agent": "Mozilla/5.0 (jax-events local scraper)" },
  });
  if (!res.ok) throw new Error(`Jax Beach RSS HTTP ${res.status}`);
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  const out: EventInput[] = [];

  $("item").each((_, el) => {
    const $el = $(el);
    const title = $el.find("title").first().text().trim();
    const link = $el.find("link").first().text().trim();
    const eventDates = $el.find("calendarEvent\\:EventDates").text().trim();
    const eventTimes = $el.find("calendarEvent\\:EventTimes").text().trim();
    const location = $el.find("calendarEvent\\:Location").text().trim();
    const guid = $el.find("guid").first().text().trim();

    if (!title || !eventDates) return;

    const starts = parseDateTime(eventDates, eventTimes, "start");
    const ends = parseDateTime(eventDates, eventTimes, "end");
    if (!starts) return;

    out.push({
      source: "jax-beach-city",
      source_id: guid || link || `${title}-${eventDates}`,
      title,
      url: link || null,
      starts_at: starts.toISOString(),
      ends_at: ends ? ends.toISOString() : null,
      venue_name: cleanLocation(location) || null,
      city: "Jacksonville Beach",
      categories: classify(title),
    });
  });

  return out;
}

function parseDateTime(
  dateStr: string,
  timeStr: string,
  which: "start" | "end"
): Date | null {
  // dateStr looks like " May 26, 2026 " — sometimes a single date, sometimes a range.
  // timeStr looks like "04:00 PM - 07:00 PM" or empty for all-day items.
  const d = dateStr.trim();
  const m = d.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[1].slice(0, 3)];
  if (month === undefined) return null;
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);

  const times = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM).*?(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let hour = 0;
  let minute = 0;
  if (times) {
    const [h, mn, ap] = which === "start" ? [times[1], times[2], times[3]] : [times[4], times[5], times[6]];
    hour = parseInt(h, 10);
    minute = parseInt(mn, 10);
    if (/pm/i.test(ap) && hour < 12) hour += 12;
    if (/am/i.test(ap) && hour === 12) hour = 0;
  } else if (which === "end") {
    return null; // no end time → leave open
  }

  return new Date(year, month, day, hour, minute, 0);
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function cleanLocation(loc: string): string {
  // The RSS smushes the address lines together with no separator. Just take
  // everything before "Jacksonville Beach" or strip the city/state/zip tail.
  return loc
    .replace(/Jacksonville Beach,? FL\s*\d*$/i, "")
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/,$/, "")
    .trim();
}

function classify(title: string): Category[] {
  const t = title.toLowerCase();
  const out = new Set<Category>();

  if (/concert|music|jazz|band|symphony/.test(t)) {
    out.add("music-live-other");
    if (/jazz|swing/.test(t)) out.add("music-swing-jazz");
  }
  if (/yoga|wellness|mindful/.test(t)) out.add("yoga");
  if (/sound bath|gong/.test(t)) out.add("sound-bath");
  if (/cycl|bike|ride/.test(t)) out.add("cycling");
  if (/kayak|paddle/.test(t)) out.add("kayaking");
  if (/dance|swing/.test(t)) out.add("dance-other");
  if (/art|exhib|gallery|paint/.test(t)) out.add("art-exhibition");
  if (/maker|workshop|class/.test(t)) {
    out.add("maker-space");
    out.add("learning-workshop");
  }
  if (/talk|lecture|forum|discussion/.test(t)) out.add("intellectual-discussion");
  if (/market|farmer|craft/.test(t)) out.add("market-shopping");
  if (/festival|street|block party|dancin/.test(t)) out.add("festival");
  if (/family|kids/.test(t)) out.add("kids-family");
  if (/hearing|council|special magistrate|board meeting|budget/.test(t)) {
    // Civic meetings — won't be of interest to most users; tag minimally
    // so they score low.
    out.add("intellectual-discussion");
  }

  // No-info fallback: tag 'uncategorized' (neutral 0 weight) so the event
  // scores on its venue/source alone rather than getting a free +15 from
  // 'experiential' just because we couldn't classify it.
  if (out.size === 0) out.add("uncategorized");
  return Array.from(out);
}
