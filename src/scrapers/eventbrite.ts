// Eventbrite — city-wide search pages render full schema.org JSON-LD
// ItemList blobs server-side, even though the rest of the page is React.
// We fetch a small set of geographically relevant search URLs, parse each
// ItemList, dedupe by event URL, and skip past events.
//
// The JSON-LD blob carries date-only (no time-of-day) for each event. To get
// time-of-day we'd need to hit every event-detail page (20+ per search per
// page = a lot). For now we default unknown times to local noon — keeps the
// event on the right calendar day without misleading users that it's at
// midnight or 8 PM.
//
// Sources:
//   https://www.eventbrite.com/d/fl--jacksonville-beach/all-events/
//   https://www.eventbrite.com/d/fl--jacksonville/all-events/

import * as cheerio from "cheerio";
import type { EventInput } from "@/lib/db";
import type { Category } from "@/lib/categories";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 jax-events";

const SEARCHES = [
  "https://www.eventbrite.com/d/fl--jacksonville-beach/all-events/",
  "https://www.eventbrite.com/d/fl--jacksonville/all-events/",
];

// Each search URL paginates with ?page=N. Pull 2 pages (≈ 40 events) per area
// — plenty for a week or two of coverage, polite on Eventbrite.
const PAGES_PER_SEARCH = 2;

type JsonLdEvent = {
  "@type"?: string | string[];
  name?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  url?: string;
  image?: string;
  location?: {
    "@type"?: string;
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
    };
    geo?: { latitude?: string; longitude?: string };
  };
};

export async function fetchEventbrite(): Promise<EventInput[]> {
  const seen = new Set<string>();
  const out: EventInput[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);

  for (const base of SEARCHES) {
    for (let page = 1; page <= PAGES_PER_SEARCH; page++) {
      const url = page === 1 ? base : `${base}?page=${page}`;
      const events = await fetchPage(url);
      for (const e of events) {
        // Dedupe by event URL — the same event often appears in both the
        // "jacksonville-beach" and "jacksonville" searches.
        if (!e.url || seen.has(e.url)) continue;
        if (new Date(e.starts_at) < cutoff) continue;
        seen.add(e.url);
        out.push(e);
      }
    }
  }

  return out;
}

async function fetchPage(url: string): Promise<EventInput[]> {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) {
    // One search failing shouldn't sink the others; the caller handles it
    // by treating an empty list as no-op.
    return [];
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const out: EventInput[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).text();
    if (!text) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    const items = extractItems(parsed);
    for (const ev of items) {
      const built = buildEvent(ev);
      if (built) out.push(built);
    }
  });
  return out;
}

function extractItems(blob: unknown): JsonLdEvent[] {
  // Eventbrite's search renders an ItemList with .itemListElement[].item.
  // Each search page may have several ld+json scripts — only one is the list.
  if (
    blob &&
    typeof blob === "object" &&
    (blob as { "@type"?: string })["@type"] === "ItemList"
  ) {
    const list = (blob as { itemListElement?: Array<{ item?: unknown }> })
      .itemListElement;
    if (Array.isArray(list)) {
      return list
        .map((wrap) => (wrap.item ?? wrap) as JsonLdEvent)
        .filter((e) => {
          const t = e?.["@type"];
          return t === "Event" || (Array.isArray(t) && t.includes("Event"));
        });
    }
  }
  return [];
}

function buildEvent(ev: JsonLdEvent): EventInput | null {
  if (!ev.name || !ev.startDate || !ev.url) return null;

  const starts = parseStart(ev.startDate);
  if (!starts) return null;

  const loc = ev.location;
  const venueName = loc?.name ?? null;
  const street = loc?.address?.streetAddress ?? null;
  const city = loc?.address?.addressLocality ?? null;
  const lat = loc?.geo?.latitude ? Number(loc.geo.latitude) : null;
  const lon = loc?.geo?.longitude ? Number(loc.geo.longitude) : null;

  return {
    source: "eventbrite",
    source_id: ev.url, // Eventbrite event URLs are stable per-event.
    title: ev.name,
    description: ev.description ?? null,
    url: ev.url,
    starts_at: starts.toISOString(),
    ends_at: ev.endDate ? parseEnd(ev.endDate)?.toISOString() ?? null : null,
    venue_name: venueName,
    venue_address: street,
    city,
    lat: Number.isFinite(lat ?? NaN) ? lat : null,
    lon: Number.isFinite(lon ?? NaN) ? lon : null,
    image_url: ev.image ?? null,
    categories: classify(ev.name, ev.description ?? ""),
  };
}

function parseStart(s: string): Date | null {
  // Two shapes Eventbrite emits:
  //   "2026-06-03"                  — date only
  //   "2026-06-03T19:00:00-04:00"   — full ISO with tz
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    // Default to local noon Eastern so the event lands on the right day even
    // after UTC-conversion.
    const [y, m, d] = s.split("-").map(Number);
    const month = m;
    const offset = month >= 3 && month <= 10 ? "-04:00" : "-05:00";
    const date = new Date(
      `${s}T12:00:00${offset}`
    );
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function parseEnd(s: string): Date | null {
  // Mirror start handling but anchor end-of-day events to local 5 PM.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const month = Number(s.slice(5, 7));
    const offset = month >= 3 && month <= 10 ? "-04:00" : "-05:00";
    const d = new Date(`${s}T17:00:00${offset}`);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function classify(title: string, description: string): Category[] {
  const blob = `${title} ${description}`.toLowerCase();
  const cats = new Set<Category>();

  if (/swing dance|lindy hop|west coast swing/.test(blob)) {
    cats.add("swing-dance");
    cats.add("dance-other");
  }
  if (/salsa|bachata|tango|kizomba/.test(blob)) cats.add("dance-other");
  if (/jazz/.test(blob)) cats.add("music-swing-jazz");
  if (/hip[- ]?hop|rap/.test(blob)) cats.add("music-00s-hiphop");
  if (/rock|metal|punk|alt\b/.test(blob)) cats.add("music-90s-rock");
  if (/concert|band|live music|symphony|festival/.test(blob)) {
    cats.add("music-live-other");
  }
  if (/yoga|wellness|mindful/.test(blob)) cats.add("yoga");
  if (/sound bath|gong/.test(blob)) cats.add("sound-bath");
  if (/kayak|paddle|sup/.test(blob)) cats.add("kayaking");
  if (/snorkel|dive\b/.test(blob)) cats.add("snorkeling");
  if (/sail|boat|cruise|harbor/.test(blob)) cats.add("boat-ride");
  if (/cycling|bike ride|group ride/.test(blob)) cats.add("cycling");
  if (/art walk|gallery|exhibit|museum/.test(blob)) cats.add("art-exhibition");
  if (/maker|3d print|laser|pottery|ceramics/.test(blob)) {
    cats.add("maker-space");
    cats.add("experiential");
  }
  if (/workshop|class|hands[- ]on/.test(blob)) {
    cats.add("learning-workshop");
    // "Yoga class" matches /class/ — avoid double-counting experiential on
    // structured classes where yoga is the real signal.
    if (!cats.has("yoga")) cats.add("experiential");
  }
  if (/philosophy|stoic|debate/.test(blob)) cats.add("philosophy");
  if (/talk|lecture|panel|forum|discussion/.test(blob)) {
    cats.add("intellectual-discussion");
  }
  if (/ai\b|machine learning|tech meetup|hackathon/.test(blob)) {
    cats.add("tech-ai-design");
  }
  if (/market|farmer|craft fair/.test(blob)) cats.add("market-shopping");
  if (/festival|street party|fest\b/.test(blob)) cats.add("festival");
  if (/family|kids/.test(blob)) cats.add("kids-family");
  if (/comedy|stand[- ]up/.test(blob)) cats.add("comedy");
  if (/nature|preserve|trail|hike|park/.test(blob)) cats.add("outdoor-nature");
  if (/sport|football|baseball|basketball|usl|soccer/.test(blob)) {
    cats.add("sports");
  }
  if (/food|wine|beer|tasting|brewery|dinner/.test(blob)) cats.add("food-drink");

  if (cats.size === 0) cats.add("uncategorized");
  return Array.from(cats);
}
