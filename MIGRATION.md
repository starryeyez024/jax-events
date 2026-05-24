# Migrating from SQLite to Supabase + Vercel

This branch (`refactor-supabase`) replaces the local `data/events.db` SQLite
file with a hosted Postgres database on Supabase, so the app can run on Vercel
where the filesystem is ephemeral.

The work is split into **(A) one-time setup you do in Supabase + Vercel**,
which can happen any time, and **(B) code changes in this branch**, which I
land incrementally on top of the scaffolding already committed.

## What's already done on this branch

- [x] `@supabase/supabase-js` installed
- [x] `.env.example` updated with `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- [x] `supabase/migrations/0001_initial_schema.sql` — Postgres translation
      of the SQLite schema in `src/lib/db.ts`, including all 9 tables, both
      indexes, and Row Level Security enablement
- [x] `src/lib/supabase.ts` — server + browser Supabase client wrappers

## What's NOT done yet (the rest of the refactor)

- [ ] Replace `db.prepare(...).all()` / `.run()` / `.get()` calls throughout
      the codebase with async Supabase queries. Touches:
      `src/lib/events-query.ts`, `src/lib/scoring.ts`, `src/lib/db.ts`
      (the upsert helpers), every API route under `src/app/api/`, and every
      scraper that calls `upsertEvent`.
- [ ] Make all the above async and `await` them at the right places.
- [ ] Remove `better-sqlite3` once nothing references it.
- [ ] Decide where the scrapers run on Vercel. (See "Scraper hosting" below.)

---

## A. One-time setup (do these now, in this order)

### A1. Create a Supabase project

1. Go to <https://supabase.com> → "New project".
2. Pick a name (e.g. `jax-events`), generate a strong DB password, choose a
   region close to Jacksonville (us-east-1 = N. Virginia is fine).
3. Wait ~2 minutes for provisioning.

### A2. Run the schema migration

1. In the Supabase dashboard, open **SQL Editor** → "New query".
2. Paste the entire contents of `supabase/migrations/0001_initial_schema.sql`.
3. Click **Run**. Should succeed with no errors.
4. In the **Table Editor**, confirm you see all 9 tables: `events`,
   `event_categories`, `interest`, `attendance`, `preferences`,
   `venue_affinity`, `source_affinity`, `registration`, `dismissed`.

### A3. Copy your keys into `.env.local`

In Supabase: **Project Settings → API**.

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the long JWT labeled "anon public">
SUPABASE_SERVICE_ROLE_KEY=<the long JWT labeled "service_role secret">
```

> The `service_role` key bypasses Row Level Security. Treat it like a
> password — only set it on the server, never in `NEXT_PUBLIC_*` vars.

### A4. (Optional now, required later) Seed your existing events

You already have ~430 events sitting in `data/events.db`. To carry them
forward instead of starting fresh:

```bash
# Export to CSV (one file per table, then upload via Supabase Table Editor),
# OR use a one-time migration script that reads sqlite and inserts into
# Supabase. I'll write that script when we get to that step.
```

For now, the simpler path is: don't migrate the data. Once the code-side
refactor lands, run the scrapers fresh against Supabase and they'll
re-populate the events. Your manual feedback (`interest`, `attendance`,
`registration`, `dismissed`) is the only data that'd be lost — accept
that as a known cost or do the export.

### A5. Vercel deploy (only after the code refactor is complete)

1. <https://vercel.com> → "Add new project" → import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected).
3. Environment variables: paste the three Supabase vars from A3, plus
   `ANTHROPIC_API_KEY`, `TICKETMASTER_API_KEY`, `MEETUP_GROUPS`, `HOME_LAT`,
   `HOME_LON` from your local `.env.local`.
4. Click **Deploy**.

---

## B. Code refactor — the plan

The shape of the refactor: every `better-sqlite3` call becomes an async
Supabase call. Better-sqlite3 is synchronous; Supabase is HTTP-based, so
every function that touches the DB becomes async-flavored.

### Migration order

Smallest blast radius first → biggest:

1. **`src/lib/db.ts`** — keep the type exports (`EventRow`, `EventInput`,
   `EventWithExtras`) where they are. Replace `getDb()` with a no-op or
   delete entirely. Rewrite `upsertEvent()` to use `supabase.from('events').upsert()`.
2. **`src/lib/events-query.ts`** — the central read path. Rewrite to use
   Supabase's query builder (`supabase.from('events').select(...).gte(...).lte(...)`)
   instead of raw SQL. **All call-sites of `queryEvents` become `await`d.**
   This is the biggest single change.
3. **`src/lib/scoring.ts`** — has both sync (`scoreEvent`) and DB-touching
   functions (`applyInterest`, `applyStars`, `applyTooFar`, `revertTooFar`,
   `loadPreferences`, etc.). The DB-touching ones become async.
4. **`src/app/api/*/route.ts`** — every route calls one of the above. Mostly
   small changes: add `await` where needed.
5. **Scrapers** — they call `upsertEvent`. Wrap in a `Promise.all` per
   source if Supabase upserts are slow enough to matter.

### Specific gotchas to watch for

- **Transactions.** `better-sqlite3.transaction(() => { ... })()` is a
  major idiom in this codebase (`upsertEvent`, `applyInterest`,
  `applyStars`, `applyTooFar`). Supabase doesn't expose transactions over
  HTTP — we need to either:
  - Move the multi-row updates into Postgres **RPC functions** (defined in
    a follow-up SQL migration), called via `supabase.rpc('apply_interest', { ... })`, OR
  - Accept that some operations are no longer atomic (low risk for this
    single-user app, but worth flagging).
  Recommendation: RPC for the affinity bumps (cleaner, atomic), inline
  upserts for the rest.
- **`ON CONFLICT(col) DO UPDATE SET` syntax.** Postgres supports the
  same syntax SQLite uses. Supabase client's `.upsert({...}, { onConflict: 'col' })`
  abstracts it cleanly.
- **`CURRENT_TIMESTAMP`** in SQL → `now()` in Postgres. Already handled in
  the migration SQL.
- **Date storage.** SQLite stores `starts_at` as ISO strings; Postgres
  uses `timestamptz`. The Supabase client serializes JS Date objects
  correctly, but raw string filtering (`gte('2026-05-22T04:00:00Z')`)
  also works. The `localDateToIso` helper in `events-query.ts` stays.
- **Boolean columns.** I kept these as `smallint 0/1` in the Postgres
  schema (`is_recurring`, `all_day`, `attended`, `value` on `interest`,
  `dismissed`, `registered`) so the existing TypeScript code that
  compares against numeric 0/1 doesn't all need rewriting. Could
  re-evaluate later.

### Scraper hosting on Vercel

The launchd cron currently runs `scripts/scrape.ts` weekly on your Mac
and writes to the local DB. With Supabase, the same script writes to
Supabase instead — the launchd job keeps working as-is.

Three other options if you want to move it off your Mac:

- **Vercel Cron Jobs.** Define a `vercel.json` cron that hits
  `/api/refresh` weekly. Limited to 10s on the Hobby plan, 60s on Pro.
  VisitJax alone took 17s last run, so this would fail unless we
  parallelize harder or upgrade to Pro.
- **GitHub Actions.** Free for public repos, generous for private. Schedule
  a weekly workflow that runs `npm run scrape` against Supabase. No
  timeout pressure.
- **Supabase Edge Functions + pg_cron.** Most "native" option but needs
  Deno-ported scraper code. Not recommended unless you really want one
  platform.

**Recommendation:** keep the launchd cron pointing at Supabase. Move to
GitHub Actions later if your Mac is ever off when refresh time comes.

---

## C. Rollback plan

This branch doesn't touch `main`. To abandon:

```bash
git checkout main
git branch -D refactor-supabase
```

Your local SQLite app keeps working from `main`.
