// Human-facing registry of where events come from.
//
// The `source` column on an event is an internal slug ('visit-jax'). This maps
// each slug to something a person can actually click and evaluate: the real
// site, what it covers, and how far ahead that site tends to publish.
//
// Keep this in sync with the SOURCES map in scripts/scrape.ts. A slug missing
// from here still renders on /sources — it just falls back to a prettified
// version of the slug with no link, which is a visible nudge to add it.

export type SourceKind = "scraper" | "manual";

export type SourceMeta = {
  /** Human name, e.g. "Visit Jacksonville". */
  label: string;
  /** The page a person should actually visit. Null = no public page. */
  url: string | null;
  /** One line on what this source covers. */
  covers: string;
  kind: SourceKind;
};

export const SOURCE_META: Record<string, SourceMeta> = {
  "visit-jax": {
    label: "Visit Jacksonville",
    url: "https://www.visitjacksonville.com/events/",
    covers: "The city tourism board's calendar — concerts, festivals, sports, big-ticket everything.",
    kind: "scraper",
  },
  eventbrite: {
    label: "Eventbrite",
    url: "https://www.eventbrite.com/d/fl--jacksonville/all-events/",
    covers: "Ticketed events across Jacksonville and Jax Beach.",
    kind: "scraper",
  },
  "atlantic-beach": {
    label: "City of Atlantic Beach",
    url: "https://www.coab.us/calendar.aspx",
    covers: "Atlantic Beach civic calendar — commission meetings, park yoga, tai chi, markets.",
    kind: "scraper",
  },
  cummer: {
    label: "Cummer Museum of Art & Gardens",
    url: "https://www.cummermuseum.org/events/",
    covers: "Exhibitions, tours, workshops and garden programming.",
    kind: "scraper",
  },
  kickers: {
    label: "Kickers Country Bar",
    url: "https://www.kickersjax.com/upcoming-events",
    covers: "Line dancing lessons, socials and live country music.",
    kind: "scraper",
  },
  "jax-beach-city": {
    label: "City of Jacksonville Beach",
    url: "https://www.jacksonvillebeach.org/",
    covers: "Jax Beach city calendar — green market, surf classics, festivals.",
    kind: "scraper",
  },
  "florida-theatre": {
    label: "Florida Theatre",
    url: "https://floridatheatre.com/events/",
    covers: "Touring music, comedy and film at the downtown Florida Theatre.",
    kind: "scraper",
  },
  "bold-city-swing": {
    label: "Bold City Swing",
    url: "https://boldcityswing.com/",
    covers: "The city's swing-dance scene across several venues, via their public calendar.",
    kind: "scraper",
  },
  "kava-and-company": {
    label: "Kava & Company",
    url: "https://kavaandcompany.com/events/",
    covers:
      "Weekly and monthly programming at all three kava bars — Jax Beach, Mandarin and San Marco. Open mics, trivia, craft nights, pool tournaments, yoga.",
    kind: "scraper",
  },
  ticketmaster: {
    label: "Ticketmaster",
    url: "https://www.ticketmaster.com/discover/concerts/jacksonville",
    covers: "Arena and amphitheatre shows. Needs an API key to run.",
    kind: "scraper",
  },
  meetup: {
    label: "Meetup",
    url: "https://www.meetup.com/",
    covers: "Per-group calendars for the Meetup groups configured in MEETUP_GROUPS.",
    kind: "scraper",
  },
  "community-digest": {
    label: "Community events digest (hand-entered)",
    url: null,
    covers:
      "Small free and civic events — JaxParks fitness classes, run clubs, neighborhood markets, community meetings — typed in by hand from a weekly local newsletter. No automated feed exists for most of these.",
    kind: "manual",
  },
  seed: {
    label: "Starter seed list",
    url: null,
    covers: "Hand-verified events loaded when the database was first created.",
    kind: "manual",
  },
};

/**
 * Meetup sources are dynamic — one per configured group, keyed
 * 'meetup:<group-slug>'. Build their metadata on demand rather than
 * enumerating every group here.
 */
export function metaForSource(source: string): SourceMeta {
  const known = SOURCE_META[source];
  if (known) return known;

  if (source.startsWith("meetup:")) {
    const slug = source.slice("meetup:".length);
    return {
      label: `Meetup · ${slug.replace(/-/g, " ")}`,
      url: `https://www.meetup.com/${slug}/`,
      covers: "A single Meetup group's public calendar.",
      kind: "scraper",
    };
  }

  // Unknown slug: degrade to something readable rather than throwing.
  return {
    label: source.replace(/[-:]/g, " "),
    url: null,
    covers: "Source not yet described in src/lib/sources.ts.",
    kind: "scraper",
  };
}

/** Row shape rendered by the /sources page. */
export type SourceStatus = {
  source: string;
  label: string;
  url: string | null;
  covers: string;
  kind: SourceKind;
  /** Upcoming events currently in the app from this source. */
  upcoming: number;
  /** ISO date of the furthest-out event we have. Null if none upcoming. */
  covers_through: string | null;
  /**
   * When data from this source last landed in the app. Distinct from
   * last_run_at: a scraper can run and fail, in which case this stays put.
   * This is the honest "how fresh is this" figure for the public page.
   */
  last_updated: string | null;
  /** When the scraper last ran, successfully or not. Null if never recorded. */
  last_run_at: string | null;
  /** Outcome of that last run. */
  last_status: "ok" | "error" | null;
  /** Error text when last_status is 'error'. */
  last_error: string | null;
};
