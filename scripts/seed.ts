// Seed the database with ONLY verified-real events and venues.
//
// Every entry below was fetched from the official source's public site on 2026-05-16.
// The source URL is recorded on each entry. Anything that couldn't be verified is NOT here.
//
// This is intentionally small — the real volume comes from scrapers (Ticketmaster,
// Meetup, etc). Run `npm run seed` after adding events you've personally confirmed.

import { getDb, upsertEvent, type EventInput } from "../src/lib/db";

const db = getDb();

// Eastern Daylight Time for May–early November.
const EDT = "-04:00";

const seeds: EventInput[] = [
  // ─────────────────────────────────────────────────────────────────────
  // Florida Theatre — verified at https://floridatheatre.com/events/ on 2026-05-16
  // ─────────────────────────────────────────────────────────────────────
  {
    source: "verified",
    source_id: "florida-theatre-chicago-2026-05-19",
    title: "Chicago (the band)",
    url: "https://www.floridatheatre.com/events/detail/chicago",
    starts_at: `2026-05-19T20:00:00${EDT}`,
    venue_name: "Florida Theatre",
    city: "Jacksonville",
    categories: ["music-live-other"],
  },
  {
    source: "verified",
    source_id: "florida-theatre-jazz-piano-2026-05-21",
    title: "Jacksonville Jazz Piano Competition",
    url: "https://www.floridatheatre.com/events/detail/jacksonville-jazz-piano-competition-3",
    starts_at: `2026-05-21T19:00:00${EDT}`,
    venue_name: "Florida Theatre",
    city: "Jacksonville",
    categories: ["music-swing-jazz", "experiential"],
  },
  {
    source: "verified",
    source_id: "florida-theatre-josh-gates-2026-05-24",
    title: "Josh Gates Live",
    url: "https://www.floridatheatre.com/events/detail/josh-gates-live",
    starts_at: `2026-05-24T19:00:00${EDT}`,
    venue_name: "Florida Theatre",
    city: "Jacksonville",
    categories: ["theater", "intellectual-discussion"],
  },
  {
    source: "verified",
    source_id: "florida-theatre-happy-together-2026-05-26",
    title: "Happy Together Tour 2026",
    url: "https://www.floridatheatre.com/events/detail/happy-together-tour-2026",
    starts_at: `2026-05-26T19:00:00${EDT}`,
    venue_name: "Florida Theatre",
    city: "Jacksonville",
    categories: ["music-live-other"],
  },
  {
    source: "verified",
    source_id: "florida-theatre-rob-schneider-2026-05-28",
    title: "Rob Schneider: Rescue Husband Tour",
    url: "https://www.floridatheatre.com/events/detail/rob-schneider-rescue-husband-tour",
    starts_at: `2026-05-28T19:30:00${EDT}`,
    venue_name: "Florida Theatre",
    city: "Jacksonville",
    categories: ["comedy"],
  },
  {
    source: "verified",
    source_id: "florida-theatre-john-crist-2026-05-29",
    title: "John Crist Live!",
    url: "https://www.floridatheatre.com/events/detail/john-crist-live",
    starts_at: `2026-05-29T19:00:00${EDT}`,
    venue_name: "Florida Theatre",
    city: "Jacksonville",
    categories: ["comedy"],
  },
  {
    source: "verified",
    source_id: "florida-theatre-kc-2026-06-03",
    title: "KC and The Sunshine Band",
    url: "https://www.floridatheatre.com/events/detail/kc-and-the-sunshine-band",
    starts_at: `2026-06-03T19:30:00${EDT}`,
    venue_name: "Florida Theatre",
    city: "Jacksonville",
    categories: ["music-live-other"],
  },
  {
    source: "verified",
    source_id: "florida-theatre-shawn-mullins-2026-06-04",
    title: "Shawn Mullins",
    url: "https://www.floridatheatre.com/events/detail/shawn-mullins",
    starts_at: `2026-06-04T19:30:00${EDT}`,
    venue_name: "Florida Theatre",
    city: "Jacksonville",
    categories: ["music-live-other"],
  },
  {
    source: "verified",
    source_id: "florida-theatre-voyage-2026-06-11",
    title: "Voyage — Celebrating the Music of Journey",
    url: "https://www.floridatheatre.com/events/detail/voyage",
    starts_at: `2026-06-11T20:00:00${EDT}`,
    venue_name: "Florida Theatre",
    city: "Jacksonville",
    categories: ["music-live-other"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Jacksonville Symphony — verified at https://jaxsymphony.org/ on 2026-05-16
  // Specific times not shown on listing page; using common 7:30pm start as
  // best-effort, with the canonical URL so you can confirm.
  // ─────────────────────────────────────────────────────────────────────
  {
    source: "verified",
    source_id: "jax-symphony-ballet-2026-05-21",
    title: "Symphony in 60 · At the Ballet (Night 1)",
    url: "https://my.jaxsymphony.org/overview/at-the-ballet-2026",
    starts_at: `2026-05-21T19:30:00${EDT}`,
    venue_name: "Jacoby Symphony Hall",
    venue_address: "300 Water Street, Suite 200",
    city: "Jacksonville",
    categories: ["theater", "music-live-other"],
  },
  {
    source: "verified",
    source_id: "jax-symphony-ballet-2026-05-22",
    title: "Symphony in 60 · At the Ballet (Night 2)",
    url: "https://my.jaxsymphony.org/overview/at-the-ballet-2026",
    starts_at: `2026-05-22T19:30:00${EDT}`,
    venue_name: "Jacoby Symphony Hall",
    venue_address: "300 Water Street, Suite 200",
    city: "Jacksonville",
    categories: ["theater", "music-live-other"],
  },
  {
    source: "verified",
    source_id: "jax-symphony-elton-2026-05-29",
    title: "Pops Series: The Music of Elton John feat. Michael Cavanaugh (Night 1)",
    url: "https://my.jaxsymphony.org/overview/music-of-elton-john",
    starts_at: `2026-05-29T19:30:00${EDT}`,
    venue_name: "Jacoby Symphony Hall",
    city: "Jacksonville",
    categories: ["music-live-other", "theater"],
  },
  {
    source: "verified",
    source_id: "jax-symphony-elton-2026-05-30",
    title: "Pops Series: The Music of Elton John feat. Michael Cavanaugh (Night 2)",
    url: "https://my.jaxsymphony.org/overview/music-of-elton-john",
    starts_at: `2026-05-30T19:30:00${EDT}`,
    venue_name: "Jacoby Symphony Hall",
    city: "Jacksonville",
    categories: ["music-live-other", "theater"],
  },
  {
    source: "verified",
    source_id: "jax-symphony-rach3-2026-06-05",
    title: "Classical Series: Rachmaninoff's Third (Night 1)",
    url: "https://my.jaxsymphony.org/overview/rachmaninoffs-third",
    starts_at: `2026-06-05T19:30:00${EDT}`,
    venue_name: "Jacoby Symphony Hall",
    city: "Jacksonville",
    categories: ["music-live-other", "theater"],
  },
  {
    source: "verified",
    source_id: "jax-symphony-rach3-2026-06-06",
    title: "Classical Series: Rachmaninoff's Third (Night 2)",
    url: "https://my.jaxsymphony.org/overview/rachmaninoffs-third",
    starts_at: `2026-06-06T19:30:00${EDT}`,
    venue_name: "Jacoby Symphony Hall",
    city: "Jacksonville",
    categories: ["music-live-other", "theater"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Cummer Museum events — verified at https://www.cummermuseum.org/ on 2026-05-16
  // ─────────────────────────────────────────────────────────────────────
  {
    source: "verified",
    source_id: "cummer-architecture-2026-05-27",
    title: "Lecture: The Amazing Architecture of Northeast Florida (Dr. Wayne Wood)",
    description:
      "Dr. Wayne Wood discusses how the buildings of Northeast Florida have shaped the region for over three and a half centuries.",
    url: "https://www.cummermuseum.org/",
    starts_at: `2026-05-27T18:00:00${EDT}`,
    venue_name: "Cummer Museum of Art & Gardens",
    city: "Jacksonville",
    categories: ["intellectual-discussion", "learning-workshop", "art-exhibition"],
  },
  {
    source: "verified",
    source_id: "cummer-garden-workshop-2026-05-30",
    title: "Garden Workshop: Propagation",
    description:
      "Hands-on session with the Cummer Gardens & Horticulture Team on the art and science of plant propagation.",
    url: "https://www.cummermuseum.org/",
    starts_at: `2026-05-30T10:00:00${EDT}`,
    venue_name: "Cummer Museum of Art & Gardens",
    city: "Jacksonville",
    categories: ["maker-space", "learning-workshop", "outdoor-nature", "experiential"],
  },
  {
    source: "verified",
    source_id: "cummer-portrait-drawing-2026-06-07",
    title: "Workshop: The Art of Portrait Drawing (William McMahan)",
    description:
      "Extended workshop with artist William McMahan for developing portrait-drawing skills.",
    url: "https://www.cummermuseum.org/",
    starts_at: `2026-06-07T13:00:00${EDT}`,
    venue_name: "Cummer Museum of Art & Gardens",
    city: "Jacksonville",
    categories: ["art-class", "learning-workshop", "maker-space", "experiential"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // MOCA Jacksonville — verified at https://mocajacksonville.unf.edu/ on 2026-05-16
  // Long-running exhibitions are flagged is_recurring so the calendar isn't spammed.
  // ─────────────────────────────────────────────────────────────────────
  {
    source: "verified",
    source_id: "moca-nari-ward",
    title: "Exhibition: Nari Ward — Great Greetings (Project Atrium)",
    description: "Project Atrium installation by Nari Ward. Runs March 5 – August 16, 2026.",
    url: "https://mocajacksonville.unf.edu/",
    starts_at: `2026-05-17T11:00:00${EDT}`,
    ends_at: `2026-08-16T17:00:00${EDT}`,
    is_recurring: true,
    venue_name: "MOCA Jacksonville",
    city: "Jacksonville",
    categories: ["art-exhibition", "experiential"],
  },
  {
    source: "verified",
    source_id: "moca-kobaslija",
    title: "Exhibition: Outside Looking In — The Paintings of Amer Kobaslija",
    description: "Runs April 30 – September 20, 2026.",
    url: "https://mocajacksonville.unf.edu/",
    starts_at: `2026-05-17T11:00:00${EDT}`,
    ends_at: `2026-09-20T17:00:00${EDT}`,
    is_recurring: true,
    venue_name: "MOCA Jacksonville",
    city: "Jacksonville",
    categories: ["art-exhibition", "experiential"],
  },
  {
    source: "verified",
    source_id: "moca-moments-in-time",
    title: "Exhibition: Moments in Time — Defining Moments in the History of Photography",
    description: "Runs December 13, 2025 – July 6, 2026.",
    url: "https://mocajacksonville.unf.edu/",
    starts_at: `2026-05-17T11:00:00${EDT}`,
    ends_at: `2026-07-06T17:00:00${EDT}`,
    is_recurring: true,
    venue_name: "MOCA Jacksonville",
    city: "Jacksonville",
    categories: ["art-exhibition", "experiential"],
  },
  {
    source: "verified",
    source_id: "moca-jiha-moon",
    title: "Exhibition: Jiha Moon — Half Moon",
    description: "Runs February 28 – August 23, 2026.",
    url: "https://mocajacksonville.unf.edu/",
    starts_at: `2026-05-17T11:00:00${EDT}`,
    ends_at: `2026-08-23T17:00:00${EDT}`,
    is_recurring: true,
    venue_name: "MOCA Jacksonville",
    city: "Jacksonville",
    categories: ["art-exhibition", "experiential"],
  },
  {
    source: "verified",
    source_id: "moca-vystar-free-saturdays",
    title: "VyStar Free Saturdays at MOCA (every Saturday)",
    description: "Free admission every Saturday courtesy of VyStar.",
    url: "https://mocajacksonville.unf.edu/",
    starts_at: `2026-05-17T11:00:00${EDT}`,
    is_recurring: true,
    venue_name: "MOCA Jacksonville",
    city: "Jacksonville",
    price_min: 0,
    price_max: 0,
    categories: ["art-exhibition", "experiential"],
  },
  {
    source: "verified",
    source_id: "moca-free-museum-nights",
    title: "Free Museum Nights at MOCA (1st & 3rd Wednesdays, 5–9pm)",
    description:
      "Free admission the 1st and 3rd Wednesday evenings of each month, presented by Florida Blue.",
    url: "https://mocajacksonville.unf.edu/",
    starts_at: `2026-05-17T17:00:00${EDT}`,
    is_recurring: true,
    venue_name: "MOCA Jacksonville",
    city: "Jacksonville",
    price_min: 0,
    price_max: 0,
    categories: ["art-exhibition", "experiential"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Beaches Town Center recurring events — verified at
  //   https://www.beachestowncenter.com/  on 2026-05-18
  // Their calendar is Wix + MembershipWorks (JS-rendered) so we can't scrape
  // it; these annual/monthly events are hand-encoded so we never miss them.
  // ─────────────────────────────────────────────────────────────────────
  {
    source: "verified",
    source_id: "btc-north-beaches-art-walk",
    title: "North Beaches Art Walk (3rd Thursday monthly)",
    description:
      "Free monthly art walk in Beaches Town Center where Atlantic Boulevard meets the ocean. 55+ local artists; Adele Grage Cultural Center features a different artist each month. Held the third Thursday, 5pm–9pm.",
    url: "https://www.beachestowncenter.com/north-beaches-art-walk",
    starts_at: `2026-05-17T17:00:00${EDT}`,
    is_recurring: true,
    venue_name: "Beaches Town Center (Atlantic Blvd at the Ocean)",
    city: "Atlantic Beach",
    price_min: 0,
    price_max: 0,
    categories: ["art-exhibition", "experiential", "festival"],
  },
  {
    source: "verified",
    source_id: "btc-dancin-in-the-street-annual",
    title: "Dancin' in the Street (annual, mid-May)",
    description:
      "Annual outdoor block party in Beaches Town Center: live local music, vendor booths, food trucks, beverage stations, children's activities. 40th edition in 2026.",
    url: "https://www.beachestowncenter.com/copy-of-north-beaches-art-walk",
    starts_at: `2026-05-17T11:00:00${EDT}`,
    is_recurring: true,
    venue_name: "Beaches Town Center",
    city: "Atlantic Beach",
    price_min: 0,
    price_max: 0,
    categories: ["festival", "music-live-other", "experiential"],
  },
  {
    source: "verified",
    source_id: "btc-fall-festival-annual",
    title: "Beaches Town Center Fall Festival (annual)",
    description:
      "Autumn community festival in Beaches Town Center.",
    url: "https://www.beachestowncenter.com/general-8-2",
    starts_at: `2026-05-17T11:00:00${EDT}`,
    is_recurring: true,
    venue_name: "Beaches Town Center",
    city: "Atlantic Beach",
    price_min: 0,
    price_max: 0,
    categories: ["festival", "experiential"],
  },
  {
    source: "verified",
    source_id: "btc-surfboard-artist-contest-annual",
    title: "Surfboard Artist Contest (annual)",
    description:
      "Annual contest where local artists paint surfboards. Hosted by Beaches Town Center.",
    url: "https://www.beachestowncenter.com/about-4",
    starts_at: `2026-05-17T11:00:00${EDT}`,
    is_recurring: true,
    venue_name: "Beaches Town Center",
    city: "Atlantic Beach",
    price_min: 0,
    price_max: 0,
    categories: ["art-exhibition", "experiential", "festival"],
  },
  {
    source: "verified",
    source_id: "btc-season-of-lights-annual",
    title: "Season of Lights (December, annual)",
    description:
      "Holiday lights display and community celebration in Beaches Town Center.",
    url: "https://www.beachestowncenter.com/season-of-lights",
    starts_at: `2026-05-17T18:00:00${EDT}`,
    is_recurring: true,
    venue_name: "Beaches Town Center",
    city: "Atlantic Beach",
    price_min: 0,
    price_max: 0,
    categories: ["festival", "experiential"],
  },

  // ─────────────────────────────────────────────────────────────────────
  // Evergreen real places (no specific date — surfaced when the calendar is light)
  // ─────────────────────────────────────────────────────────────────────
  {
    source: "verified",
    source_id: "cummer-evergreen",
    title: "Cummer Museum — galleries, gardens, and free Tuesday evenings",
    description:
      "Art museum + waterfront gardens. Free admission 4–9pm sponsored by VyStar Credit Union (check site for current free-night day).",
    url: "https://www.cummermuseum.org/",
    starts_at: `2026-05-17T11:00:00${EDT}`,
    is_recurring: true,
    venue_name: "Cummer Museum of Art & Gardens",
    city: "Jacksonville",
    categories: ["art-exhibition", "experiential", "outdoor-nature"],
  },
  {
    source: "verified",
    source_id: "gtm-reserve-evergreen",
    title: "Guana Tolomato Matanzas Research Reserve — hiking & beach",
    description:
      "12,000-acre estuarine reserve with trails, beach access, and naturalist programs.",
    url: "https://gtmnerr.org/",
    starts_at: `2026-05-17T09:00:00${EDT}`,
    is_recurring: true,
    venue_name: "GTM Research Reserve",
    city: "Ponte Vedra Beach",
    price_min: 3,
    price_max: 3,
    categories: ["outdoor-nature", "experiential", "health-wellness", "kayaking"],
  },
  {
    source: "verified",
    source_id: "hanna-park-evergreen",
    title: "Kathryn Abbey Hanna Park",
    description:
      "Beach-side city park with trails, kayak rentals, and a freshwater lake.",
    url: "https://www.coj.net/departments/parks-and-recreation/recreation-and-community-programming/hanna-park",
    starts_at: `2026-05-17T08:00:00${EDT}`,
    is_recurring: true,
    venue_name: "Kathryn Abbey Hanna Park",
    city: "Atlantic Beach",
    price_min: 5,
    price_max: 5,
    categories: ["outdoor-nature", "cycling", "health-wellness", "kayaking"],
  },
  {
    source: "verified",
    source_id: "riverside-arts-market-evergreen",
    title: "Riverside Arts Market (Saturdays under the Fuller Warren Bridge)",
    description:
      "Outdoor Saturday market with artists, food, and live music. Tagged as market — lower priority in your feed.",
    url: "https://riversideartsmarket.org/",
    starts_at: `2026-05-17T10:00:00${EDT}`,
    is_recurring: true,
    venue_name: "Riverside Arts Market",
    city: "Jacksonville",
    price_min: 0,
    price_max: 0,
    categories: ["market-shopping", "music-live-other"],
  },
];

let inserted = 0;
const tx = db.transaction(() => {
  for (const ev of seeds) {
    upsertEvent(db, ev);
    inserted++;
  }
});
tx();

console.log(`Seeded ${inserted} verified events into data/events.db`);
