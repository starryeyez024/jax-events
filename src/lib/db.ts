import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { CATEGORIES, DEFAULT_WEIGHTS, type Category } from "./categories";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "events.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seedPreferencesIfEmpty(db);
  _db = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id              TEXT PRIMARY KEY,
      source          TEXT NOT NULL,          -- 'seed' | 'ticketmaster' | 'meetup' | ...
      source_id       TEXT,                   -- id from upstream
      title           TEXT NOT NULL,
      description     TEXT,
      url             TEXT,
      starts_at       TEXT NOT NULL,          -- ISO 8601, e.g. 2026-05-23T19:00:00-04:00
      ends_at         TEXT,
      all_day         INTEGER NOT NULL DEFAULT 0,
      is_recurring    INTEGER NOT NULL DEFAULT 0, -- 1 for evergreen things (parks, preserves, ongoing exhibitions)
      venue_name      TEXT,
      venue_address   TEXT,
      city            TEXT,
      lat             REAL,
      lon             REAL,
      price_min       REAL,                   -- null = unknown; 0 = free
      price_max       REAL,
      image_url       TEXT,
      raw_json        TEXT,                   -- original payload for debugging
      first_seen_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_starts ON events(starts_at);
    CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);

    -- Many-to-many: events <-> categories
    CREATE TABLE IF NOT EXISTS event_categories (
      event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      category   TEXT NOT NULL,
      PRIMARY KEY (event_id, category)
    );

    CREATE INDEX IF NOT EXISTS idx_event_categories_cat ON event_categories(category);

    -- Pre-event interest: 1 (interested) / -1 (not interested) / 0 (meh)
    CREATE TABLE IF NOT EXISTS interest (
      event_id   TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
      value      INTEGER NOT NULL,
      note       TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Post-event rating: 1-5 stars + optional tags
    CREATE TABLE IF NOT EXISTS attendance (
      event_id    TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
      attended    INTEGER NOT NULL,           -- 1 = went, 0 = skipped
      stars       INTEGER,                    -- 1-5, null if attended=0
      note        TEXT,
      tags        TEXT,                       -- JSON array of free-form tags
      visited_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Category preference weights (learned over time)
    CREATE TABLE IF NOT EXISTS preferences (
      category TEXT PRIMARY KEY,
      weight   REAL NOT NULL
    );

    -- Venue / organizer affinity (learned)
    CREATE TABLE IF NOT EXISTS venue_affinity (
      venue_name TEXT PRIMARY KEY,
      bonus      REAL NOT NULL DEFAULT 0   -- can go positive or negative
    );

    -- Source-level affinity (learned). Keyed by the event's 'source' column,
    -- e.g. 'meetup:philosophy-for-living'. Used to penalize entire meetup
    -- groups when the user flags their events as 'too far'.
    CREATE TABLE IF NOT EXISTS source_affinity (
      source TEXT PRIMARY KEY,
      bonus  REAL NOT NULL DEFAULT 0
    );

    -- 'I signed up / bought a ticket' — separate from Interested, which is
    -- aspirational. Surfaces in the UI as a distinct badge and feeds the
    -- iCal export so registered events show up in Google Calendar.
    CREATE TABLE IF NOT EXISTS registration (
      event_id      TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
      registered    INTEGER NOT NULL,        -- 1 = yes
      note          TEXT,
      registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 'Not this time' — hide this specific event without any learning signal.
    -- Distinct from 👎 (which moves category weights) and 🚗 (which penalizes
    -- source/venue). Stored separately so we can include it in the 'Hide 👎'
    -- filter without polluting the interest table or any affinity scores.
    CREATE TABLE IF NOT EXISTS dismissed (
      event_id     TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
      dismissed    INTEGER NOT NULL,         -- 1 = hidden, 0 = restored
      dismissed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function seedPreferencesIfEmpty(db: Database.Database) {
  // Insert any categories that don't exist yet at their default weight.
  // Existing rows are left alone so the user's learned weights aren't wiped.
  const insert = db.prepare(
    "INSERT OR IGNORE INTO preferences (category, weight) VALUES (?, ?)"
  );
  const tx = db.transaction(() => {
    for (const cat of CATEGORIES) insert.run(cat, DEFAULT_WEIGHTS[cat]);
  });
  tx();
}

// ----- Types -----

export type EventRow = {
  id: string;
  source: string;
  source_id: string | null;
  title: string;
  description: string | null;
  url: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: number;
  is_recurring: number;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
  price_min: number | null;
  price_max: number | null;
  image_url: string | null;
  raw_json: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

export type EventWithExtras = EventRow & {
  categories: Category[];
  interest: number | null;
  attended: number | null;
  stars: number | null;
  score: number;
  distance_bucket: "local" | "nearby" | "drive" | "far";
  distance_penalty: number;
  drive_miles: number | null;
  drive_minutes: number | null;
  drive_precise: boolean;
  map_link: string | null;
  directions_link: string | null;
  registered: number | null;
  dismissed: number | null;
};

// ----- Upsert helpers (used by seeders + scrapers) -----

export type EventInput = {
  source: string;
  source_id?: string | null;
  title: string;
  description?: string | null;
  url?: string | null;
  starts_at: string;
  ends_at?: string | null;
  all_day?: boolean;
  is_recurring?: boolean;
  venue_name?: string | null;
  venue_address?: string | null;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  image_url?: string | null;
  raw_json?: unknown;
  categories: Category[];
};

export function upsertEvent(db: Database.Database, e: EventInput): string {
  // Normalize timestamps to UTC ISO (Z). All filtering and sorting is lexical
  // string compare, which only works correctly when every stored timestamp is
  // in the same timezone.
  const starts_at = new Date(e.starts_at).toISOString();
  const ends_at = e.ends_at ? new Date(e.ends_at).toISOString() : null;
  const id = `${e.source}:${e.source_id ?? hashKey(e.title + starts_at + (e.venue_name ?? ""))}`;
  const insert = db.prepare(`
    INSERT INTO events (id, source, source_id, title, description, url, starts_at, ends_at, all_day,
                        is_recurring, venue_name, venue_address, city, lat, lon, price_min, price_max,
                        image_url, raw_json, last_seen_at)
    VALUES (@id, @source, @source_id, @title, @description, @url, @starts_at, @ends_at, @all_day,
            @is_recurring, @venue_name, @venue_address, @city, @lat, @lon, @price_min, @price_max,
            @image_url, @raw_json, CURRENT_TIMESTAMP)
    ON CONFLICT(source, source_id) DO UPDATE SET
      title=excluded.title,
      description=excluded.description,
      url=excluded.url,
      starts_at=excluded.starts_at,
      ends_at=excluded.ends_at,
      all_day=excluded.all_day,
      is_recurring=excluded.is_recurring,
      venue_name=excluded.venue_name,
      venue_address=excluded.venue_address,
      city=excluded.city,
      lat=excluded.lat,
      lon=excluded.lon,
      price_min=excluded.price_min,
      price_max=excluded.price_max,
      image_url=excluded.image_url,
      raw_json=excluded.raw_json,
      last_seen_at=CURRENT_TIMESTAMP
  `);
  insert.run({
    id,
    source: e.source,
    source_id: e.source_id ?? null,
    title: e.title,
    description: e.description ?? null,
    url: e.url ?? null,
    starts_at,
    ends_at,
    all_day: e.all_day ? 1 : 0,
    is_recurring: e.is_recurring ? 1 : 0,
    venue_name: e.venue_name ?? null,
    venue_address: e.venue_address ?? null,
    city: e.city ?? null,
    lat: e.lat ?? null,
    lon: e.lon ?? null,
    price_min: e.price_min ?? null,
    price_max: e.price_max ?? null,
    image_url: e.image_url ?? null,
    raw_json: e.raw_json ? JSON.stringify(e.raw_json) : null,
  });

  const delCats = db.prepare("DELETE FROM event_categories WHERE event_id = ?");
  const insCat = db.prepare("INSERT INTO event_categories (event_id, category) VALUES (?, ?)");
  delCats.run(id);
  for (const c of e.categories) insCat.run(id, c);

  return id;
}

function hashKey(s: string): string {
  // Deterministic, no crypto dependency — good enough for dedupe of synthetic seeds.
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
