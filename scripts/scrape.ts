// Standalone scrape runner — no dev server needed.
//
// Mirrors src/app/api/refresh/route.ts but runs from the command line so it
// can be scheduled by launchd / cron without the Next.js process being up.
// Each source runs independently — one failing scraper won't sink the others.
//
// Usage:   npx tsx scripts/scrape.ts
// Cron:    triggered weekly by scripts/refresh.sh + the launchd plist.

import { getDb, upsertEvent, type EventInput } from "../src/lib/db";
import { fetchTicketmaster } from "../src/scrapers/ticketmaster";
import { fetchCummer } from "../src/scrapers/cummer";
import { fetchFloridaTheatre } from "../src/scrapers/florida-theatre";
import { fetchMeetup } from "../src/scrapers/meetup";
import { fetchJaxBeachCity } from "../src/scrapers/jax-beach-city";
import { fetchVisitJax } from "../src/scrapers/visit-jax";
import { fetchKickers } from "../src/scrapers/kickers";
import { fetchAtlanticBeach } from "../src/scrapers/atlantic-beach";
import { fetchEventbrite } from "../src/scrapers/eventbrite";

type SourceFn = () => Promise<EventInput[]>;

const SOURCES: Record<string, SourceFn> = {
  "florida-theatre": fetchFloridaTheatre,
  cummer: fetchCummer,
  meetup: fetchMeetup,
  "jax-beach-city": fetchJaxBeachCity,
  "visit-jax": fetchVisitJax,
  ticketmaster: fetchTicketmaster,
  kickers: fetchKickers,
  "atlantic-beach": fetchAtlanticBeach,
  eventbrite: fetchEventbrite,
};

async function main() {
  const start = Date.now();
  const db = getDb();
  const results: Array<{ source: string; fetched: number; error?: string; ms: number }> = [];

  await Promise.all(
    Object.entries(SOURCES).map(async ([name, fn]) => {
      const t0 = Date.now();
      try {
        const events = await fn();
        const tx = db.transaction(() => {
          for (const e of events) upsertEvent(db, e);
        });
        tx();
        results.push({ source: name, fetched: events.length, ms: Date.now() - t0 });
      } catch (err) {
        results.push({
          source: name,
          fetched: 0,
          error: (err as Error).message,
          ms: Date.now() - t0,
        });
      }
    })
  );

  // Sorted by name for stable log output.
  results.sort((a, b) => a.source.localeCompare(b.source));
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] scrape complete in ${Date.now() - start}ms`);
  for (const r of results) {
    const tag = r.error ? `error: ${r.error}` : `+${r.fetched}`;
    console.log(`  ${r.source.padEnd(18)} ${String(r.ms).padStart(6)}ms  ${tag}`);
  }

  const totalFetched = results.reduce((s, r) => s + r.fetched, 0);
  const errored = results.filter((r) => r.error).length;
  console.log(`total: ${totalFetched} events, ${errored} source(s) errored`);

  // Exit non-zero if every source failed — useful for monitoring.
  if (errored === results.length) process.exit(1);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
