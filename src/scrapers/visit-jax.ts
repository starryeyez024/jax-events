// VisitJacksonville.com — pulls the events sitemap, then fetches each event
// page and parses the schema.org JSON-LD Event blob. Cleanest scrape in the
// codebase because every page has structured data.
//
// Sources:
//   sitemap: https://www.visitjacksonville.com/sitemaps-1-event-default-1-sitemap.xml
//   detail:  https://www.visitjacksonville.com/events/<slug>/  → <script type="application/ld+json">
//
// 318 events as of 2026-05-18; concurrency is capped to be polite.

import * as cheerio from "cheerio";
import type { EventInput } from "@/lib/db";
import type { Category } from "@/lib/categories";

const SITEMAP =
  "https://www.visitjacksonville.com/sitemaps-1-event-default-1-sitemap.xml";

const CONCURRENCY = 6;
const UA = "Mozilla/5.0 (jax-events local scraper)";

export async function fetchVisitJax(): Promise<EventInput[]> {
  const urls = await fetchSitemap();
  // Past events get filtered after parse — sitemap doesn't carry dates.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);

  const out: EventInput[] = [];
  await runWithConcurrency(urls, CONCURRENCY, async (url) => {
    try {
      const parsed = await fetchAndParse(url);
      if (!parsed) return;
      if (new Date(parsed.starts_at) < cutoff) return;
      out.push(parsed);
    } catch {
      // one bad event shouldn't sink the whole batch; swallow.
    }
  });

  return out;
}

async function fetchSitemap(): Promise<string[]> {
  const res = await fetch(SITEMAP, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`VisitJax sitemap HTTP ${res.status}`);
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("loc").map((_, el) => $(el).text().trim()).get().filter(Boolean);
}

type JsonLdEvent = {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  mainEntityOfPage?: string;
  image?: { url?: string } | string;
  location?: {
    "@type"?: string;
    name?: string;
    address?:
      | string
      | {
          streetAddress?: string;
          addressLocality?: string;
          addressRegion?: string;
          postalCode?: string;
        };
  } | string;
  offers?: { price?: string | number; lowPrice?: number; highPrice?: number };
};

async function fetchAndParse(url: string): Promise<EventInput | null> {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);
  const blob = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).text())
    .get()
    .join("\n");
  if (!blob) return null;

  let event: JsonLdEvent | null = null;
  // Each page may have multiple JSON-LD scripts. Walk each, find the Event.
  $('script[type="application/ld+json"]').each((_, el) => {
    if (event) return;
    const text = $(el).text();
    if (!text) return;
    try {
      const data = JSON.parse(text);
      const candidates: unknown[] = [];
      if (Array.isArray(data)) candidates.push(...data);
      else if (data && typeof data === "object") {
        if ("@graph" in data && Array.isArray((data as { "@graph": unknown[] })["@graph"])) {
          candidates.push(...(data as { "@graph": unknown[] })["@graph"]);
        } else candidates.push(data);
      }
      for (const c of candidates) {
        if (c && typeof c === "object") {
          const t = (c as JsonLdEvent)["@type"];
          if (t === "Event" || (Array.isArray(t) && t.includes("Event"))) {
            event = c as JsonLdEvent;
            return false;
          }
        }
      }
    } catch {
      // ignore malformed
    }
  });

  if (!event) return null;
  if (!event.name || !event.startDate) return null;

  const ev = event as JsonLdEvent; // narrow for downstream access
  const venueName =
    typeof ev.location === "object" && ev.location && "name" in ev.location
      ? ev.location.name ?? null
      : null;
  const city =
    typeof ev.location === "object" &&
    ev.location &&
    typeof ev.location.address === "object" &&
    ev.location.address
      ? ev.location.address.addressLocality ?? null
      : null;
  const street =
    typeof ev.location === "object" &&
    ev.location &&
    typeof ev.location.address === "object" &&
    ev.location.address
      ? ev.location.address.streetAddress ?? null
      : null;
  const image =
    typeof ev.image === "object" && ev.image && "url" in ev.image
      ? ev.image.url ?? null
      : typeof ev.image === "string"
      ? ev.image
      : null;

  return {
    source: "visit-jax",
    source_id: ev.mainEntityOfPage ?? ev.url ?? url,
    title: ev.name,
    description: ev.description ?? null,
    url: ev.url ?? ev.mainEntityOfPage ?? url,
    starts_at: ev.startDate,
    ends_at: ev.endDate ?? null,
    venue_name: venueName,
    venue_address: street,
    // VisitJacksonville's JSON-LD usually omits addressLocality. Since this
    // is the *Jacksonville* tourism site, default to Jacksonville rather than
    // letting the bucket classifier fall through to 'far' — anything actually
    // outside Jax tends to surface a recognizable city name in the title
    // (e.g. "Daytona", "Orlando") which the haystack scan still catches.
    city: city ?? inferCityFromTitle(ev.name) ?? "Jacksonville",
    image_url: image,
    categories: classify(ev.name, ev.description ?? ""),
  };
}

// Detect non-Jax cities that VisitJax sometimes covers (it occasionally
// promotes Daytona/Orlando trips). Returns null if nothing matches — caller
// then falls back to "Jacksonville".
function inferCityFromTitle(title: string): string | null {
  const t = title.toLowerCase();
  if (/\bst\.? augustine\b/.test(t)) return "St Augustine";
  if (/\bfernandina\b/.test(t)) return "Fernandina Beach";
  if (/\bamelia island\b/.test(t)) return "Amelia Island";
  if (/\bponte vedra\b/.test(t)) return "Ponte Vedra";
  if (/\batlantic beach\b/.test(t)) return "Atlantic Beach";
  if (/\bneptune beach\b/.test(t)) return "Neptune Beach";
  if (/\bjacksonville beach\b/.test(t)) return "Jacksonville Beach";
  if (/\bdaytona\b/.test(t)) return "Daytona Beach";
  if (/\bgainesville\b/.test(t)) return "Gainesville";
  if (/\bbrunswick\b/.test(t)) return "Brunswick";
  if (/\bst\.? simons\b/.test(t)) return "St Simons";
  if (/\borlando\b/.test(t)) return "Orlando";
  if (/\btampa\b/.test(t)) return "Tampa";
  if (/\bmiami\b/.test(t)) return "Miami";
  return null;
}

function classify(title: string, description: string): Category[] {
  const blob = `${title} ${description}`.toLowerCase();
  const out = new Set<Category>();

  if (/swing dance|lindy hop|west coast swing|salsa|bachata/.test(blob)) {
    out.add("dance-other");
    if (/swing|lindy/.test(blob)) out.add("swing-dance");
  }
  if (/jazz/.test(blob)) out.add("music-swing-jazz");
  if (/hip[- ]?hop|rap/.test(blob)) out.add("music-00s-hiphop");
  if (/rock|alt|metal|punk/.test(blob)) out.add("music-90s-rock");
  if (/concert|band|live music|symphony/.test(blob)) out.add("music-live-other");
  if (/yoga|wellness/.test(blob)) out.add("yoga");
  if (/sound bath|gong/.test(blob)) out.add("sound-bath");
  if (/kayak|paddle|sup/.test(blob)) out.add("kayaking");
  if (/snorkel|dive/.test(blob)) out.add("snorkeling");
  if (/sail|boat ride|harbor cruise/.test(blob)) out.add("boat-ride");
  if (/cycling|bike ride/.test(blob)) out.add("cycling");
  if (/art walk|gallery|exhibit|museum/.test(blob)) out.add("art-exhibition");
  if (/workshop|class|hands[- ]on/.test(blob)) {
    out.add("learning-workshop");
    // "Yoga class" matches /class/ — avoid double-counting experiential on
    // structured classes where yoga is the real signal.
    if (!out.has("yoga")) out.add("experiential");
  }
  if (/maker|3d print|laser|pottery|ceramics|painting/.test(blob)) {
    out.add("maker-space");
    out.add("experiential");
  }
  if (/philosophy|debate|stoic/.test(blob)) out.add("philosophy");
  if (/talk|lecture|panel|forum|discussion/.test(blob)) {
    out.add("intellectual-discussion");
  }
  if (/ai|machine learning|tech meetup/.test(blob)) out.add("tech-ai-design");
  if (/market|maker.?market|craft fair/.test(blob)) out.add("market-shopping");
  if (/festival|street party|fest\b/.test(blob)) out.add("festival");
  if (/family|kids/.test(blob)) out.add("kids-family");
  if (/soccer|football|baseball|basketball|sporting jax|usl/.test(blob)) {
    out.add("sports");
  }
  if (/comedy|stand[- ]up/.test(blob)) out.add("comedy");
  if (/nature|preserve|trail|hike|park/.test(blob)) out.add("outdoor-nature");

  if (out.size === 0) out.add("uncategorized");
  return Array.from(out);
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let i = 0;
  async function next(): Promise<void> {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => next()));
}
