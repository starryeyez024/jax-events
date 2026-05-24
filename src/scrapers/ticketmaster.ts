// Ticketmaster Discovery API
// Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
//
// Free tier: 5,000 calls/day, 5/sec. Get a key at:
//   https://developer-acct.ticketmaster.com/user/register
//
// Set TICKETMASTER_API_KEY in .env.local

import type { EventInput } from "@/lib/db";
import type { Category } from "@/lib/categories";

const HOME_LAT = Number(process.env.HOME_LAT ?? 30.2946);
const HOME_LON = Number(process.env.HOME_LON ?? -81.3931);

type TmEvent = {
  id: string;
  name: string;
  url?: string;
  info?: string;
  description?: string;
  dates?: {
    start?: { dateTime?: string; localDate?: string; localTime?: string };
  };
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
    subGenre?: { name?: string };
  }>;
  priceRanges?: Array<{ min?: number; max?: number }>;
  images?: Array<{ url: string; ratio?: string; width?: number }>;
  _embedded?: {
    venues?: Array<{
      name?: string;
      city?: { name?: string };
      address?: { line1?: string };
      location?: { latitude?: string; longitude?: string };
    }>;
  };
};

type TmResponse = {
  _embedded?: { events?: TmEvent[] };
  page?: { totalElements?: number; totalPages?: number };
};

export async function fetchTicketmaster(): Promise<EventInput[]> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) {
    throw new Error("TICKETMASTER_API_KEY not set — copy .env.example to .env.local");
  }

  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", key);
  url.searchParams.set("latlong", `${HOME_LAT},${HOME_LON}`);
  url.searchParams.set("radius", "60");
  url.searchParams.set("unit", "miles");
  url.searchParams.set("size", "100");
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("startDateTime", new Date().toISOString().split(".")[0] + "Z");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Ticketmaster API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as TmResponse;
  const items = data._embedded?.events ?? [];

  return items
    .map((ev) => mapEvent(ev))
    .filter((x): x is EventInput => x !== null);
}

function mapEvent(ev: TmEvent): EventInput | null {
  const startsAt = ev.dates?.start?.dateTime;
  if (!startsAt) return null;

  const venue = ev._embedded?.venues?.[0];
  const cats = inferCategories(ev);
  const priceRange = ev.priceRanges?.[0];
  const image = ev.images?.find((i) => (i.width ?? 0) >= 600) ?? ev.images?.[0];

  return {
    source: "ticketmaster",
    source_id: ev.id,
    title: ev.name,
    description: ev.info || ev.description || null,
    url: ev.url ?? null,
    starts_at: startsAt,
    venue_name: venue?.name ?? null,
    venue_address: venue?.address?.line1 ?? null,
    city: venue?.city?.name ?? null,
    lat: venue?.location?.latitude ? Number(venue.location.latitude) : null,
    lon: venue?.location?.longitude ? Number(venue.location.longitude) : null,
    price_min: priceRange?.min ?? null,
    price_max: priceRange?.max ?? null,
    image_url: image?.url ?? null,
    raw_json: ev,
    categories: cats,
  };
}

function inferCategories(ev: TmEvent): Category[] {
  const out = new Set<Category>();
  const c = ev.classifications?.[0];
  const segment = c?.segment?.name?.toLowerCase() ?? "";
  const genre = c?.genre?.name?.toLowerCase() ?? "";
  const subGenre = c?.subGenre?.name?.toLowerCase() ?? "";
  const title = ev.name.toLowerCase();
  const blob = `${segment} ${genre} ${subGenre} ${title}`;

  if (segment === "music") {
    out.add("music-live-other");
    if (/jazz|big band|swing/.test(blob)) out.add("music-swing-jazz");
    if (/hip[- ]?hop|rap/.test(blob)) {
      // We can't reliably tell decade from TM data — call it generic live music,
      // and let user ratings teach the system.
      out.add("music-live-other");
    }
    if (/rock|alt|grunge|pearl jam|nirvana/.test(blob)) {
      out.add("music-live-other");
    }
  }
  if (segment === "arts & theatre" || /theatre|theater|play|broadway/.test(blob)) {
    out.add("theater");
  }
  if (/comedy/.test(blob)) out.add("comedy");
  if (segment === "sports") out.add("sports");
  if (/family|kids|disney/.test(blob)) out.add("kids-family");
  if (/festival/.test(blob)) out.add("festival");

  if (out.size === 0) out.add("music-live-other");
  return Array.from(out);
}
