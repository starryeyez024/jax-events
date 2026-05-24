-- Initial Postgres schema, translated from the SQLite DDL in src/lib/db.ts.
--
-- Type mapping decisions:
--   SQLite INTEGER (0/1 booleans)  →  smallint  (we keep numeric 0/1 rather
--     than switching to BOOLEAN, so existing client code that compares against
--     0/1 doesn't all have to change at once).
--   SQLite REAL                    →  double precision
--   SQLite TEXT DEFAULT CURRENT_TS →  timestamptz default now()
--
-- All other syntax (ON CONFLICT, INDEX IF NOT EXISTS, REFERENCES ... ON
-- DELETE CASCADE) is identical between SQLite and Postgres.
--
-- Apply via `supabase db push` or paste into the Supabase SQL editor.
-- One-shot — safe to re-run (every statement is IF NOT EXISTS-guarded).

create table if not exists events (
    id              text primary key,
    source          text not null,
    source_id       text,
    title           text not null,
    description     text,
    url             text,
    starts_at       timestamptz not null,
    ends_at         timestamptz,
    all_day         smallint not null default 0,
    is_recurring    smallint not null default 0,
    venue_name      text,
    venue_address   text,
    city            text,
    lat             double precision,
    lon             double precision,
    price_min       double precision,
    price_max       double precision,
    image_url       text,
    raw_json        text,
    first_seen_at   timestamptz not null default now(),
    last_seen_at    timestamptz not null default now(),
    unique(source, source_id)
);

create index if not exists idx_events_starts on events(starts_at);
create index if not exists idx_events_source on events(source);

create table if not exists event_categories (
    event_id   text not null references events(id) on delete cascade,
    category   text not null,
    primary key (event_id, category)
);

create index if not exists idx_event_categories_cat on event_categories(category);

create table if not exists interest (
    event_id   text primary key references events(id) on delete cascade,
    value      smallint not null,
    note       text,
    updated_at timestamptz not null default now()
);

create table if not exists attendance (
    event_id   text primary key references events(id) on delete cascade,
    attended   smallint not null,
    stars      smallint,
    note       text,
    tags       text,
    visited_at timestamptz not null default now()
);

create table if not exists preferences (
    category text primary key,
    weight   double precision not null
);

create table if not exists venue_affinity (
    venue_name text primary key,
    bonus      double precision not null default 0
);

create table if not exists source_affinity (
    source text primary key,
    bonus  double precision not null default 0
);

create table if not exists registration (
    event_id      text primary key references events(id) on delete cascade,
    registered    smallint not null,
    note          text,
    registered_at timestamptz not null default now()
);

create table if not exists dismissed (
    event_id     text primary key references events(id) on delete cascade,
    dismissed    smallint not null,
    dismissed_at timestamptz not null default now()
);

-- Row-Level Security (RLS) — Supabase enables this on every table by default
-- and will silently reject all reads/writes until policies are added. This
-- app is single-user (you, via the service-role key on the server), so the
-- simplest policy is: deny all anon access, allow service-role full access.
-- The service role bypasses RLS automatically, so we just need to disable
-- the anon policy for now. If you ever add per-user auth, replace these with
-- proper auth.uid()-scoped policies.
alter table events enable row level security;
alter table event_categories enable row level security;
alter table interest enable row level security;
alter table attendance enable row level security;
alter table preferences enable row level security;
alter table venue_affinity enable row level security;
alter table source_affinity enable row level security;
alter table registration enable row level security;
alter table dismissed enable row level security;

-- No policies means no access for anon users. Server-side calls using the
-- SUPABASE_SERVICE_ROLE_KEY bypass RLS, which is what we want for this app.
