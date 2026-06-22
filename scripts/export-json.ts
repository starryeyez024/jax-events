// Snapshot the upcoming events from SQLite to a static public/events.json.
//
// This is the bridge between the SQLite world (your Mac, and the GitHub
// Actions runner) and the read-only static site on Vercel. The site never
// touches the database — it fetches this JSON and filters it client-side
// (see src/lib/filter-events.ts).
//
// Usage:   npm run export        (after npm run scrape)
// CI:      runs in .github/workflows/scrape.yml right after the scrape step.

import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { queryEvents } from "../src/lib/events-query";

// How far ahead to snapshot. The page's date filter narrows within this
// window client-side, so it needs to be at least as wide as the UI allows.
const WINDOW_DAYS = 180;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function main() {
  const db = getDb();

  // Widest non-personalized read: every upcoming event, all categories, all
  // distances, recurring + monthly included. The client narrows from here.
  const events = queryEvents(db, {
    from: todayIso(),
    to: plusDaysIso(WINDOW_DAYS),
    includeRecurring: true,
    includeMonthly: true,
    hideUninterested: false,
  });

  const payload = {
    generated_at: new Date().toISOString(),
    window_days: WINDOW_DAYS,
    count: events.length,
    events,
  };

  const dir = path.join(process.cwd(), "public");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "events.json");
  fs.writeFileSync(file, JSON.stringify(payload));
  console.log(`wrote ${events.length} events → ${path.relative(process.cwd(), file)}`);
}

main();
