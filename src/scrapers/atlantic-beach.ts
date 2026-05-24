// Atlantic Beach, FL (coab.us) — city calendar.
// CivicPlus calendar with embedded schema.org microdata. Every event item has
// a hidden <div itemscope itemtype="http://schema.org/Event"> child carrying
// title, ISO startDate, location, and street address. We scrape the list view
// rather than the iCal feed because the iCal endpoint returns empty.
//
// Source: https://www.coab.us/calendar.aspx?view=list&CID=0
//
// CID=0 means "all calendars", which includes both civic meetings and the
// Recreation & Special Events category — the city schedules Memorial Day
// ceremonies, farmers markets, concerts, etc. through the same calendar.

import * as cheerio from "cheerio";
import type { EventInput } from "@/lib/db";
import type { Category } from "@/lib/categories";

const LIST_URL = "https://www.coab.us/calendar.aspx?view=list&CID=0";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 jax-events";

export async function fetchAtlanticBeach(): Promise<EventInput[]> {
  const res = await fetch(LIST_URL, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`Atlantic Beach HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const out: EventInput[] = [];
  const now = new Date();
  now.setDate(now.getDate() - 1); // include today even if it's late in the day

  $('[itemscope][itemtype="http://schema.org/Event"]').each((_, el) => {
    const $el = $(el);
    const title = $el.find('[itemprop="name"]').first().text().trim();
    const startDate = $el.find('[itemprop="startDate"]').first().text().trim();
    if (!title || !startDate) return;

    // The page renders startDate as floating local time (no tz). Treat as
    // America/New_York wall clock — append the EDT offset for the months we
    // care about. Florida observes DST from mid-March to early November,
    // which covers essentially all in-window events; for an out-of-DST date
    // we accept the 1hr drift rather than ship a tz library for one scraper.
    const starts = parseLocalAsEastern(startDate);
    if (!starts || starts < now) return;

    const description = $el.find('[itemprop="description"]').first().text().trim();
    const location = $el.find('[itemprop="location"][itemtype="http://schema.org/Place"]').first();
    const venueName = location.find('[itemprop="name"]').first().text().trim() || null;
    const street = location.find('[itemprop="streetAddress"]').first().text().trim() || null;
    const city = location.find('[itemprop="addressLocality"]').first().text().trim() || "Atlantic Beach";

    // The 'More Details' link points to the event-specific page. Use that as
    // both URL and dedup key.
    const detailHref =
      $el
        .closest("li")
        .find('a[id^="calendarEvent"]')
        .first()
        .attr("href") ?? null;
    const eid = detailHref?.match(/EID=(\d+)/)?.[1] ?? null;

    out.push({
      source: "atlantic-beach",
      source_id: eid ?? `${startDate}-${slugify(title)}`,
      title,
      description: description || null,
      url: detailHref ? new URL(detailHref, "https://www.coab.us").toString() : LIST_URL,
      starts_at: starts.toISOString(),
      venue_name: venueName,
      venue_address: street,
      city,
      // City events are typically free unless explicitly otherwise. Civic
      // meetings and park events are zero-cost; ticketed events would be
      // flagged in the title (we leave price null and let the estimator
      // handle it from category/venue).
      categories: classify(title, description),
    });
  });

  return out;
}

function parseLocalAsEastern(s: string): Date | null {
  // "2026-05-25T09:00:00" — no timezone. Treat as Eastern local.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return null;
  // EDT offset is -04:00; EST is -05:00. Use a simple heuristic: any month
  // between March and early November is EDT.
  const [, monthStr] = s.match(/^(\d{4})-(\d{2})/) ?? [];
  const month = Number(monthStr);
  const offset = month >= 3 && month <= 10 ? "-04:00" : "-05:00";
  const iso = s.length === 16 ? `${s}:00${offset}` : `${s}${offset}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function classify(title: string, description: string): Category[] {
  const blob = `${title} ${description}`.toLowerCase();
  const cats = new Set<Category>();

  if (/yoga/.test(blob)) cats.add("yoga");
  if (/farmers? market/.test(blob)) cats.add("market-shopping");
  if (/concert|acoustic|jazz|band|music night/.test(blob)) cats.add("music-live-other");
  if (/jazz|swing/.test(blob)) cats.add("music-swing-jazz");
  if (/memorial day|veterans/.test(blob)) cats.add("festival");
  if (/art walk|gallery|exhibit/.test(blob)) cats.add("art-exhibition");
  if (/workshop|class/.test(blob)) cats.add("learning-workshop");
  if (/festival|street party|fest\b/.test(blob)) cats.add("festival");
  if (/family|kids/.test(blob)) cats.add("kids-family");
  if (/clean[- ]?up|preserve|trail|hike|park/.test(blob)) cats.add("outdoor-nature");
  if (/commission|board|magistrate|hearing|trustees|budget/.test(blob)) {
    cats.add("intellectual-discussion");
  }
  if (/dance|salsa|bachata/.test(blob)) cats.add("dance-other");
  if (/comedy|stand[- ]up/.test(blob)) cats.add("comedy");

  if (cats.size === 0) cats.add("uncategorized");
  return Array.from(cats);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
