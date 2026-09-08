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
import { getDb, getSourceStatuses } from "../src/lib/db";
import { queryEvents } from "../src/lib/events-query";

// How far ahead to snapshot. The page's date filter narrows within this
// window client-side, so it needs to be at least as wide as the UI allows.
const WINDOW_DAYS = 180;

// Local calendar date, matching how the browser computes its default date
// range. toISOString() would give the UTC date, which after ~8pm Eastern has
// already rolled to tomorrow — the snapshot then starts a day late and
// silently drops the rest of today's events. The weekly CI run happens at
// 11:00 UTC where the two agree, so this only ever bit manual runs.
function localIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function main() {
  const db = getDb();

  // Widest non-personalized read: every upcoming event, all categories, all
  // distances, recurring + monthly included. The client narrows from here.
  const events = queryEvents(db, {
    // Start a day early: the client filters the window precisely anyway, so
    // the extra day costs nothing and removes any timezone-edge truncation.
    from: localIso(-1),
    to: localIso(WINDOW_DAYS),
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

  // Companion snapshot for the /sources page. Written unconditionally so the
  // static site never has to fall back to a stale or missing file.
  const sources = getSourceStatuses(db);
  const sourcesFile = path.join(dir, "sources.json");
  fs.writeFileSync(
    sourcesFile,
    JSON.stringify({ generated_at: new Date().toISOString(), sources })
  );
  console.log(
    `wrote ${sources.length} sources → ${path.relative(process.cwd(), sourcesFile)}`
  );
}

main();
