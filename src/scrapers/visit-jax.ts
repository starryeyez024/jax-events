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
import { resolveEventTime } from "@/lib/event-time";

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
  const startTime = resolveEventTime(event.startDate);
  if (!startTime) return null;
  // This feed expresses "no time given" as an explicit midnight Eastern
  // rather than a bare date — multi-day festivals like Fin Fest, WasabiCon
  // and Oktoberfest all arrive as T00:00:00-04:00. Treat that as all-day.
  // (8pm ET shows land on 00:00Z, which is a different thing entirely and
  // must not be caught here.)
  const localHM = new Date(startTime.iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const isMidnightLocal = localHM === "00:00" || localHM === "24:00";

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
    // A bare "2026-09-10" parsed by Date() becomes UTC midnight, which
    // renders as 8pm the previous day in Eastern — wrong day and a fake time.
    starts_at: startTime.iso,
    all_day: startTime.allDay || isMidnightLocal,
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
    categories: classify(ev.name, ev.description ?? "", venueName ?? ""),
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

function classify(title: string, description: string, venue = ""): Category[] {
  // Every pattern is word-bounded. Unanchored substrings were matching inside
  // ordinary words and mislabelling most of this source: /ai/ hit "acclaimed"
  // and "available" so touring concerts came back as tech-ai-design, /class/
  // hit "classic" so any "holiday classic" became a workshop, /alt/ hit
  // "salt" and "health", /park/ hit "parking" and "sparkle" (present in
  // nearly every venue blurb), /sup/ hit "supper", /dive/ hit "diverse",
  // /rap/ hit "therapy".
  const t = title.toLowerCase();
  const blob = `${title} ${description}`.toLowerCase();

  // Activity and format claims come from the title. A description mentioning
  // a workshop, a class or a market is usually context, not what this is.
  const inTitle = (re: RegExp) => re.test(t);
  const anywhere = (re: RegExp) => re.test(blob);

  const out = new Set<Category>();

  if (anywhere(/\bswing dance\b|\blindy hop\b|\bwest coast swing\b|\bsalsa\b|\bbachata\b/)) {
    out.add("dance-other");
    if (anywhere(/\bswing\b|\blindy\b/)) out.add("swing-dance");
  }
  if (anywhere(/\bjazz\b/)) out.add("music-swing-jazz");
  if (anywhere(/\bhip[- ]?hop\b|\brap\b|\brapper\b/)) out.add("music-00s-hiphop");
  if (anywhere(/\brock\b|\bmetal\b|\bpunk\b|\balt[- ]rock\b|\balternative\b/))
    out.add("music-90s-rock");
  if (anywhere(/\bconcert\b|\bband\b|\blive music\b|\bsymphony\b/)) out.add("music-live-other");
  if (anywhere(/\byoga\b|\bwellness\b/)) out.add("yoga");
  if (anywhere(/\bsound bath\b|\bgong\b/)) out.add("sound-bath");
  if (anywhere(/\bkayak\w*\b|\bpaddle\w*\b|\bstand[- ]up paddle\b/)) out.add("kayaking");
  if (anywhere(/\bsnorkel\w*\b|\bscuba\b|\bdiving\b/)) out.add("snorkeling");
  if (anywhere(/\bsail\w*\b|\bboat ride\b|\bharbor cruise\b/)) out.add("boat-ride");
  if (anywhere(/\bcycling\b|\bbike ride\b/)) out.add("cycling");
  if (anywhere(/\bart walk\b|\bgallery\b|\bexhibit\w*\b|\bmuseum\b/)) out.add("art-exhibition");

  if (inTitle(/\bworkshop\b|\bclass\b|\bclasses\b|\bhands[- ]on\b/)) {
    out.add("learning-workshop");
    if (!out.has("yoga")) out.add("experiential");
  }
  if (inTitle(/\bmaker\b|\b3d print\w*\b|\blaser\b|\bpottery\b|\bceramics\b|\bpainting\b|\bpaint\b/)) {
    out.add("maker-space");
    out.add("experiential");
  }
  if (anywhere(/\bphilosophy\b|\bdebate\b|\bstoic\w*\b/)) out.add("philosophy");
  if (inTitle(/\btalk\b|\blecture\b|\bpanel\b|\bforum\b|\bdiscussion\b/)) {
    out.add("intellectual-discussion");
  }
  if (anywhere(/\bai\b|\bartificial intelligence\b|\bmachine learning\b|\btech meetup\b/))
    out.add("tech-ai-design");
  if (inTitle(/\bmarket\b|\bcraft fair\b|\bflea\b/)) out.add("market-shopping");
  if (anywhere(/\bfestival\b|\bstreet party\b|\bfest\b/)) out.add("festival");
  if (inTitle(/\bfamily\b|\bkids\b|\bchildren\b|\ball ages\b/)) out.add("kids-family");
  if (anywhere(/\bsoccer\b|\bfootball\b|\bbaseball\b|\bbasketball\b|\bsporting jax\b|\busl\b/)) {
    out.add("sports");
  }
  if (anywhere(/\bcomedy\b|\bstand[- ]up\b|\bcomedian\b/)) out.add("comedy");
  // "park" alone matched parking and sparkle; require it to name a park or a
  // genuine outdoor activity.
  if (inTitle(/\bnature\b|\bpreserve\b|\btrail\b|\bhike\b|\bhiking\b|\bpark\b|\bgarden\b/))
    out.add("outdoor-nature");

  // Stage formats. Tightening the keyword rules left a third of this source
  // matching nothing at all — touring concerts, film screenings and musicals
  // carry no activity vocabulary, and their old tags came from accidents like
  // "rock" inside "Rocky Horror".
  if (anywhere(/\btheat(er|re)\b|\bmusical\b|\bbroadway\b|\bopera\b|\bballet\b|\bplay\b/))
    out.add("theater");
  if (anywhere(/\bfilm\b|\bscreening\b|\bmovie\b|\bpicture show\b|\bcinema\b/))
    out.add("theater");

  // Venue is a far more reliable signal than prose for the "an evening with
  // <artist>" listings that dominate this feed and describe nothing.
  const v = venue.toLowerCase();
  if (out.size === 0) {
    if (/florida theatre|moran theater|performing arts|ritz theatre|amphitheat|daily's place|decca|myth|jack rabbits|1904 music hall|intuition/.test(v))
      out.add("music-live-other");
    else if (/comedy zone/.test(v)) out.add("comedy");
    else if (/museum|gallery/.test(v)) out.add("art-exhibition");
    else if (/park|preserve|garden/.test(v)) out.add("outdoor-nature");
  }

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
