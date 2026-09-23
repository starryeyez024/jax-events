// JAX Business Calendar — community-submitted Jacksonville business events
// (meetups, workshops, networking, pitch nights).
// Source: https://jaxbusinesscalendar.com/events
//
// The listing pages carry title, time, area and address, but no YEAR and no
// timezone — "Tue, Sep 8, 7:00 AM" alone is ambiguous. Every detail page
// carries a proper schema.org Event block with an ISO startDate including the
// offset, so the listing is used only to enumerate slugs in date order and
// the dates come from JSON-LD.
//
// Listing is ordered ascending from today, so paging can stop as soon as a
// page yields nothing new, rather than walking all ~50 pages.

import * as cheerio from "cheerio";
import type { EventInput } from "@/lib/db";
import type { Category } from "@/lib/categories";

const BASE = "https://jaxbusinesscalendar.com";
const LIST = `${BASE}/events`;

// This calendar is dense — often a dozen events a day — so a fixed page count
// covers only a few days. Page until the events run past the horizon instead,
// with a page cap purely as a backstop against a pagination bug walking
// forever.
// Each event costs a detail fetch (the listing has no year and no timezone,
// only the JSON-LD does), so the horizon is the request budget. 14 days is
// roughly 20 listing pages plus their events on a calendar this dense, and
// comfortably covers the app's default 7-day view.
const HORIZON_DAYS = 14;
const MAX_PAGES = 20;

const UA = { "user-agent": "Mozilla/5.0 (jax-events local scraper)" };

export async function fetchJaxBusinessCalendar(): Promise<EventInput[]> {
  const cutoff = Date.now() + HORIZON_DAYS * 86_400_000;
  const out: EventInput[] = [];
  const seenSlug = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? LIST : `${LIST}?page=${page}`;
    const res = await fetch(url, { headers: UA });
    if (!res.ok) {
      // A failure on page 1 is fatal; a failure later just ends the walk, so
      // one flaky request cannot discard everything already collected.
      if (page === 1) throw new Error(`JAX Business Calendar HTTP ${res.status}`);
      break;
    }
    const html = await res.text();
    // Each event is linked more than once per page (card title, "More", and
    // the card wrapper), so dedupe WITHIN the page as well as across pages —
    // otherwise every event gets fetched several times over.
    const slugs = [
      ...new Set(
        [...html.matchAll(/\/events\/([a-z0-9][a-z0-9-]{3,})/g)]
          .map((m) => m[1])
          .filter((s) => s !== "create" && !seenSlug.has(s))
      ),
    ];

    if (slugs.length === 0) break; // ran off the end of the listing

    let newest = 0;
    for (const slug of slugs) {
      seenSlug.add(slug);
      const ev = await fetchDetail(slug);
      if (!ev) continue;
      out.push(ev);
      newest = Math.max(newest, new Date(ev.starts_at).getTime());
    }
    // The listing is ordered ascending, so once a page's events sit past the
    // horizon every later page does too.
    if (newest > cutoff) break;
  }

  return out;
}

async function fetchDetail(slug: string): Promise<EventInput | null> {
  const url = `${BASE}/events/${slug}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return null;
  const $ = cheerio.load(await res.text());

  for (const el of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(el).contents().text().trim();
    if (!raw) continue;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      continue; // a malformed block should not sink the whole event
    }
    // Some pages nest the Event inside @graph.
    const candidates = Array.isArray(data)
      ? data
      : isRecord(data) && Array.isArray(data["@graph"])
        ? (data["@graph"] as unknown[])
        : [data];

    for (const c of candidates) {
      if (!isRecord(c) || c["@type"] !== "Event") continue;
      const ev = toEvent(c, slug, url);
      if (ev) return ev;
    }
  }
  return null;
}

function toEvent(
  d: Record<string, unknown>,
  slug: string,
  url: string
): EventInput | null {
  const title = str(d.name);
  const start = str(d.startDate);
  if (!title || !start) return null;
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return null;

  const place = isRecord(d.location) ? d.location : null;
  const addr = place && isRecord(place.address) ? place.address : null;
  const streetAddress = addr ? str(addr.streetAddress) : null;
  const city = addr ? str(addr.addressLocality) : null;

  const description = str(d.description);
  const offer = isRecord(d.offers) ? d.offers : null;
  const price = offer ? num(offer.price) : null;
  const isFree = offer ? /free/i.test(str(offer.price) ?? "") || price === 0 : false;

  return {
    source: "jax-business-calendar",
    source_id: slug,
    title,
    description: description ? description.slice(0, 1200) : null,
    url,
    starts_at: startDate.toISOString(),
    ends_at: toIso(str(d.endDate)),
    // "Downtown / Urban Core" is a district label, not a venue — prefer a real
    // venue name and fall back to the district only when nothing better exists.
    venue_name: (place ? str(place.name) : null) ?? null,
    venue_address: streetAddress,
    // The address string always ends "..., Jacksonville, FL 32202, USA"; the
    // structured locality is missing often enough to need the fallback.
    city: city ?? cityFromAddress(streetAddress),
    price_min: isFree ? 0 : price,
    categories: classify(title),
  };
}

function cityFromAddress(a: string | null): string | null {
  if (!a) return null;
  const m = a.match(/,\s*([A-Za-z .'-]+),\s*[A-Z]{2}\s*\d{5}/);
  return m ? m[1].trim() : null;
}

function classify(title: string): Category[] {
  // Exactly one category, chosen by what the event IS.
  //
  // Two earlier attempts were both wrong. Piling on secondary tags made
  // "Coffee & Connect" a food-drink event and broke the filter, because the
  // category filter shows an event if ANY of its categories is selected — so
  // unchecking "Business & Networking" left most business events on screen.
  // Collapsing everything to business-networking fixed that but buried real
  // tech talks: "Testing AI Generated Code" stopped appearing under Tech/AI
  // at all.
  //
  // Both failures came from classifying by SOURCE rather than by content. A
  // tech talk listed on a business calendar is a tech event; a chamber mixer
  // is not. One category, most specific wins, so the filter stays predictable
  // in both directions: uncheck Business and the mixers go, select Tech and
  // the AI talks appear.
  const t = title.toLowerCase();

  // Title only. "data" and "digital" are dropped deliberately: in business
  // copy they attach to anything ("data-driven growth", a speaker's Chief
  // Digital Officer title) and were pulling a health luncheon and a marketing
  // roadmap into Tech/AI.
  if (
    /\b(ai|a\.i\.|artificial intelligence|machine learning|llm|chatgpt|cyber\w*|software|developer|saas|technolog\w*|technical|tech|website|no[- ]code|api)\b/.test(t)
  ) {
    return ["tech-ai-design"];
  }

  // Hands-on sessions that are about making something rather than meeting
  // people — the candle workshop, not the "mastermind" networking group.
  if (/\b(workshop|bootcamp|class|training|masterclass|hands[- ]on|lab)\b/.test(t)) {
    return ["learning-workshop"];
  }

  // No description fallback. Scanning the body for "AI" filed a marketing
  // roadmap and a medical innovation series under Tech/AI because each
  // mentioned it once in passing — the same description-matching mistake
  // already fixed in the Cummer and visit-jax classifiers. An event whose
  // subject is AI says so in its title.
  return ["business-networking"];
}

// ----- small helpers -----

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function toIso(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
