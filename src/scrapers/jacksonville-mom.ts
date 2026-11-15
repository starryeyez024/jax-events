// Jacksonville Mom — used ONLY to carry the First Wednesday Art Walk.
// Source: https://jacksonvillemom.com/wp-json/tribe/events/v1/events
//
// The Art Walk is Downtown Vision's flagship monthly event, but none of the
// calendars we already read carry it: Visit Jacksonville's sitemap is capped at
// 500 URLs and does not include it, and dtjax.com (Downtown Vision's own site)
// has a Tribe REST API that ignores every query parameter — paging, search and
// date filters all return the same first 9 events — and no JSON-LD on the
// event pages. Jacksonville Mom runs a stock Tribe Events install whose REST
// API honours `search`, `start_date` and `page`, and lists the whole series
// months ahead.
//
// It is a parenting/family blog calendar, so we take nothing from it except
// the Art Walk: everything is filtered by title. If dtjax ever fixes its
// API, point this scraper there and drop this file.

import * as cheerio from "cheerio";
import type { EventInput } from "@/lib/db";

const API = "https://jacksonvillemom.com/wp-json/tribe/events/v1/events";
const UA = "Mozilla/5.0 (jax-events local scraper)";
const TITLE_RE = /first wednesday art walk/i;
const MAX_PAGES = 5;

type TribeVenue = { venue?: string; address?: string; city?: string };

type TribeEvent = {
  id: number;
  title: string;
  description?: string;
  url: string;
  utc_start_date: string; // "2026-12-02 22:00:00" — UTC, no zone suffix
  utc_end_date?: string;
  all_day?: boolean;
  cost?: string;
  image?: { url?: string } | false;
  venue?: TribeVenue | unknown[];
};

type TribePage = { events: TribeEvent[]; total_pages?: number };

export async function fetchJacksonvilleMom(): Promise<EventInput[]> {
  const today = new Date().toISOString().slice(0, 10);
  const out: EventInput[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const qs = new URLSearchParams({
      search: "first wednesday art walk",
      start_date: today,
      per_page: "50",
      page: String(page),
    });
    const res = await fetch(`${API}?${qs}`, { headers: { "user-agent": UA } });
    // Tribe answers 404 once `page` runs past the last page.
    if (res.status === 404) break;
    if (!res.ok) throw new Error(`Jacksonville Mom HTTP ${res.status}`);
    const data = (await res.json()) as TribePage;

    for (const e of data.events ?? []) {
      // The feed titles it "First Wednesday Art Walk | Downtown Jacksonville";
      // the venue already says where, so keep the name clean.
      const title = decode(e.title).replace(/\s*\|\s*Downtown Jacksonville$/i, "");
      if (!TITLE_RE.test(title)) continue;
      out.push(toEvent(e, title));
    }
    if (page >= (data.total_pages ?? 1)) break;
  }

  return out;
}

function toEvent(e: TribeEvent, title: string): EventInput {
  const venue =
    e.venue && !Array.isArray(e.venue) ? (e.venue as TribeVenue) : undefined;

  return {
    source: "jacksonville-mom",
    source_id: String(e.id),
    title,
    description: e.description ? decode(e.description).slice(0, 600) : null,
    url: e.url,
    starts_at: utcIso(e.utc_start_date),
    ends_at: e.utc_end_date ? utcIso(e.utc_end_date) : null,
    all_day: !!e.all_day,
    // Occurs every month, but each instance is its own dated row — not the
    // "evergreen" flag, which is for things that are simply always there.
    is_recurring: false,
    venue_name: venue?.venue ? decode(venue.venue) : "Downtown Jacksonville",
    venue_address: venue?.address ? decode(venue.address) : null,
    city: venue?.city ?? "Jacksonville",
    // The feed's cost field is empty, but the Art Walk is free to attend
    // (Downtown Vision, Visit Jacksonville and the listing's own text agree).
    price_min: 0,
    price_max: 0,
    image_url: e.image && typeof e.image === "object" ? e.image.url ?? null : null,
    categories: ["art-exhibition", "experiential"],
  };
}

// Tribe's utc_* fields are "YYYY-MM-DD HH:MM:SS" with no zone marker.
function utcIso(s: string): string {
  return new Date(s.replace(" ", "T") + "Z").toISOString();
}

// Titles and descriptions arrive HTML-escaped ("December&#8217;s").
function decode(s: string): string {
  return cheerio.load(`<p>${s}</p>`)("p").text().trim();
}
