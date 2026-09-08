// The standing weekly free-yoga schedule around Jacksonville.
//
// These run every week indefinitely, but no single feed publishes them:
// they're split across JaxParks (registration portal, no feed), Yoga 4 Change,
// and Yoga Den, and mostly surface via social posts. So the schedule lives
// here as rules, expanded into dated instances like the Kava scraper does.
//
// Re-running is safe: stable source_ids mean instances update in place rather
// than duplicating, and the horizon simply rolls forward.
//
// Usage:  npx tsx scripts/add-recurring-yoga.ts

import { getDb, upsertEvent, type EventInput } from "../src/lib/db";
import type { Category } from "../src/lib/categories";

const HORIZON_WEEKS = 8;

type Schedule = {
  id: string;
  title: string;
  /** 0=Sun … 6=Sat */
  weekday: number;
  /** Local 24h start, "HH:MM". */
  time: string;
  durationMin: number;
  venue: string;
  address: string;
  city: string;
  url: string;
  description: string;
  /** Cost to actually attend. 0 = genuinely free. */
  price: number;
  categories: Category[];
  /** Only the first occurrence of that weekday each month. */
  firstOfMonthOnly?: boolean;
};

const SCHEDULES: Schedule[] = [
  {
    id: "sun-hanna-park",
    title: "Sunrise Yoga at Hanna Park (Hot Spot Power Yoga)",
    weekday: 0,
    time: "07:00",
    durationMin: 60,
    venue: "Kathryn Abbey Hanna Park",
    address: "500 Wonderwood Dr, Jacksonville, FL 32233",
    city: "Jacksonville",
    url: "https://hotspotpoweryoga.com/",
    description:
      "Free weekly sunrise beach yoga led by Hot Spot Power Yoga. NOTE: the class is free, but Hanna Park charges a $5 per-vehicle entrance fee at the gate — bring cash or card for the gate.",
    price: 5,
    categories: ["yoga", "health-wellness", "outdoor-nature"],
  },
  {
    id: "mon-blue-cypress",
    title: "Free Yoga at Blue Cypress Park",
    weekday: 1,
    time: "18:00",
    durationMin: 60,
    venue: "Blue Cypress Park",
    address: "4012 University Blvd N, Jacksonville, FL 32277",
    city: "Jacksonville",
    url: "https://jaxparks.coj.net/",
    description: "Free Monday evening community yoga in Arlington.",
    price: 0,
    categories: ["yoga", "health-wellness", "outdoor-nature"],
  },
  {
    id: "tue-riverside-arts-market",
    title: "Free Yoga at Riverside Arts Market (Yoga 4 Change)",
    weekday: 2,
    time: "18:00",
    durationMin: 60,
    venue: "Riverside Arts Market",
    address: "715 Riverside Ave, Jacksonville, FL 32204",
    city: "Jacksonville",
    url: "https://www.y4c.org/classes/for-all/",
    description:
      "Free all-levels community yoga under the Fuller Warren Bridge, led by Yoga 4 Change. Trauma-informed and open to everyone.",
    price: 0,
    categories: ["yoga", "health-wellness"],
  },
  {
    id: "wed-riversedge-lawn",
    title: "Free Yoga at The RiversEdge Lawn (Yoga Den)",
    weekday: 3,
    time: "18:00",
    durationMin: 60,
    venue: "The RiversEdge Lawn",
    address: "RiversEdge, San Marco, Jacksonville, FL 32207",
    city: "Jacksonville",
    url: "https://yoga-den.com/",
    description: "Free Wednesday evening yoga on the RiversEdge lawn, hosted by Yoga Den.",
    price: 0,
    categories: ["yoga", "health-wellness", "outdoor-nature"],
  },
  {
    id: "thu-tommy-hazouri",
    title: "Free Yoga at Tommy Hazouri Sr. Park",
    weekday: 4,
    time: "18:15",
    durationMin: 60,
    venue: "Tommy Hazouri Sr. Park",
    address: "14780 Mandarin Rd, Jacksonville, FL 32223",
    city: "Jacksonville",
    url: "https://jaxparks.coj.net/",
    description:
      "Free Thursday evening yoga in Mandarin. JaxParks rotates this slot between Tommy Hazouri Sr. Park, Lift Ev'ry Voice and Sing Park and other Mandarin locations — check the JaxParks portal for the current week before heading out.",
    price: 0,
    categories: ["yoga", "health-wellness", "outdoor-nature"],
  },
  {
    id: "thu1-friendship-fountain",
    title: "Free Yoga at Friendship Fountain (Hot Spot Power Yoga)",
    weekday: 4,
    time: "19:00",
    durationMin: 60,
    venue: "Friendship Fountain",
    address: "1015 Museum Cir, Jacksonville, FL 32207",
    city: "Jacksonville",
    url: "https://hotspotpoweryoga.com/",
    description:
      "Free monthly yoga on the Southbank, first Thursday of each month, led by Hot Spot Power Yoga (the Atlantic Beach / Neptune Beach studio that also runs the Sunday Hanna Park session).",
    price: 0,
    categories: ["yoga", "health-wellness", "outdoor-nature"],
    firstOfMonthOnly: true,
  },
];

// Single-date rows added earlier from the weekly community digest that these
// recurring series now cover. Removing them prevents a visible duplicate on
// the one day both would land.
const SUPERSEDED_DIGEST_IDS = [
  "community-digest:2026-09-08-yoga-ram",
  "community-digest:2026-09-09-yoga-riversedge",
  "community-digest:2026-09-10-yoga-hazouri",
];

/** Jacksonville is UTC-4 in September (EDT). */
function isoAt(date: Date, time: string, addMinutes = 0): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m + addMinutes, 0, 0);
  return d.toISOString();
}

function expand(s: Schedule): Date[] {
  const out: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + HORIZON_WEEKS * 7);

  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== s.weekday) continue;
    // "First Thursday" = the first occurrence of that weekday in the month,
    // i.e. it falls on the 1st through 7th.
    if (s.firstOfMonthOnly && d.getDate() > 7) continue;
    out.push(new Date(d));
  }
  return out;
}

function main() {
  const db = getDb();
  const events: EventInput[] = [];

  for (const s of SCHEDULES) {
    for (const date of expand(s)) {
      events.push({
        source: "community-yoga",
        source_id: `${date.toISOString().slice(0, 10)}-${s.id}`,
        title: s.title,
        description: s.description,
        url: s.url,
        starts_at: isoAt(date, s.time),
        ends_at: isoAt(date, s.time, s.durationMin),
        venue_name: s.venue,
        venue_address: s.address,
        city: s.city,
        price_min: s.price,
        price_max: s.price,
        categories: s.categories,
      });
    }
  }

  const tx = db.transaction(() => {
    for (const e of events) upsertEvent(db, e);
    for (const id of SUPERSEDED_DIGEST_IDS) {
      db.prepare("DELETE FROM events WHERE id = ?").run(id);
    }
  });
  tx();

  console.log(`upserted ${events.length} recurring yoga instances`);
  for (const s of SCHEDULES) {
    console.log(`  ${s.title} — ${expand(s).length} dates`);
  }
  console.log(`removed ${SUPERSEDED_DIGEST_IDS.length} superseded single-date digest rows`);
}

main();
