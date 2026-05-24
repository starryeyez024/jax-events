// Florida Theatre — scrapes the HTML events listing.
// Their site renders events server-side, so cheerio is enough.
// Source: https://floridatheatre.com/events/

import * as cheerio from "cheerio";
import type { EventInput } from "@/lib/db";
import type { Category } from "@/lib/categories";

const URL = "https://floridatheatre.com/events/";

export async function fetchFloridaTheatre(): Promise<EventInput[]> {
  const res = await fetch(URL, {
    headers: { "user-agent": "Mozilla/5.0 (jax-events local scraper)" },
  });
  if (!res.ok) {
    throw new Error(`Florida Theatre HTTP ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const out: EventInput[] = [];

  // Each event is .eventItem.entry (skip the .small Vue.js template stub).
  $(".eventItem.entry").each((_, el) => {
    const $el = $(el);
    if ($el.hasClass("small")) return; // template fragment, not real data

    const title = $el.find(".title a").first().text().trim();
    const url = $el.find(".title a").first().attr("href") ?? null;
    const month = $el.find(".m-date__month").first().text().trim();
    const day = $el.find(".m-date__day").first().text().trim();
    const year = $el.find(".m-date__year").first().text().trim();
    const timeStr = $el.find(".time .start").first().text().trim(); // e.g. "8:00 PM"

    if (!title || !month || !day || !year) return;

    const starts = parseEventTime(month, day, year, timeStr);
    if (!starts) return;

    out.push({
      source: "florida-theatre",
      source_id: slugFromUrl(url) ?? `${year}-${month}-${day}-${slugify(title)}`,
      title,
      url,
      starts_at: starts.toISOString(),
      venue_name: "Florida Theatre",
      city: "Jacksonville",
      categories: classifyFloridaTheatre(title),
    });
  });

  return out;
}

function parseEventTime(
  month: string,
  day: string,
  year: string,
  timeStr: string
): Date | null {
  // Build "May 19 2026 8:00 PM EDT" — let JS parse it.
  const t = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let hour = 19;
  let minute = 0;
  if (t) {
    hour = parseInt(t[1], 10);
    minute = parseInt(t[2], 10);
    if (/pm/i.test(t[3]) && hour < 12) hour += 12;
    if (/am/i.test(t[3]) && hour === 12) hour = 0;
  }
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const m = months[month.slice(0, 3)];
  if (m === undefined) return null;
  const d = parseInt(day, 10);
  const y = parseInt(year, 10);
  if (!d || !y) return null;
  // Construct as local time at the venue (EDT/EST) — Date() uses local TZ,
  // but stored times are normalized to UTC at write time in upsertEvent.
  return new Date(y, m, d, hour, minute, 0);
}

function classifyFloridaTheatre(title: string): Category[] {
  const t = title.toLowerCase();
  const cats = new Set<Category>();
  if (/jazz|piano competition|swing/.test(t)) cats.add("music-swing-jazz");
  if (/rock|metal|punk|alt/.test(t)) cats.add("music-live-other");
  if (/hip[- ]?hop|rap/.test(t)) cats.add("music-live-other");
  if (/comedy|comedian|stand[- ]up/.test(t)) cats.add("comedy");
  if (/ballet|dance/.test(t)) cats.add("theater");
  if (/symphony|orchestra|classical/.test(t)) cats.add("music-live-other");
  if (/tour|live!?$|featuring|tribute/.test(t)) cats.add("music-live-other");
  // Florida Theatre IS a music venue, so live-music fallback is appropriate
  // here (not 'uncategorized'). Most events that don't match other keywords
  // genuinely are concerts.
  if (cats.size === 0) cats.add("music-live-other");
  return Array.from(cats);
}

function slugFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/events\/detail\/([^/?#]+)/);
  return m ? m[1] : null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
