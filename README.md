# Jax Events

Personal event-discovery web app for Jacksonville Beach, FL. Local-first (runs in your browser at `localhost:3000`), self-learning (ratings shift the recommendation weights), and portable to a real host later.

## What it does

- **Pulls real events** from Cummer Museum (iCal), Florida Theatre (HTML), Meetup (iCal per group), and Ticketmaster (API). Per-source isolation: one broken source doesn't kill the others.
- **List view** sorted by Best Match score *or* Chronological order (toggle on the page)
- **Calendar view** with Week mode (wide rows, readable wrapped names) and Month mode (compact)
- **Category icons** for quick visual scanning (🎷 jazz, 🛶 kayak, 🧘 yoga, 🧠 philosophy, 🛠️ maker, …)
- **👍 / 👎 + 1–5 ★ after attending** — the system learns what you actually enjoy
- **Ongoing exhibitions** (months-long) surface as evergreen suggestions, not calendar spam
- **Filters**: date range, free-only, max price slider, 28 categories, search, "hide 👎"

## Add-a-tip flow (the social-media gap-filler)

When you see something good on Instagram, Facebook, an email forward, or a flyer, hit **＋ Add tip** in the header. Paste the caption / description / pasted text into the modal, optionally add the source URL, and click **Parse with AI**.

Under the hood: a short call to **Claude Haiku 4.5** extracts title, date+time (resolving relative dates like "this Saturday" against today), venue, address, city, URL, description, price, and categories. You then **review and edit** the extracted fields before saving — Claude isn't trusted unilaterally; you're the final say.

- **Cost:** ~$0.001 per tip (Haiku is cheap, prompt is short).
- **API key:** set `ANTHROPIC_API_KEY` in `.env.local`. Without it, the modal still works — you just fill the form manually.
- **Privacy:** the pasted text is sent to Anthropic's API; nothing else leaves your machine.

This is the deliberate workaround for the social-media scraping problem (IG/FB block scraping aggressively; APIs are owner-only or expensive). You see the post on your phone, hit Add tip, paste — 10 seconds of friction, no scraping infrastructure, no missed events.

## Setup

```bash
cd ~/jax-events
npm install
cp .env.example .env.local        # contains a curated starter list of Meetup groups
npm run seed                       # load verified-real Jacksonville-area events
npm run dev                        # open http://localhost:3000
```

Click **↻ Refresh** in the UI to pull live data from all configured sources.

## API keys & config

`.env.local` controls everything. Suggested keys to add:

| Source | Required? | How to get | Free tier |
|---|---|---|---|
| Cummer Museum | nothing | iCal feed, public | unlimited |
| Florida Theatre | nothing | HTML scrape, public | unlimited |
| Meetup | nothing | iCal per group, public | unlimited |
| Ticketmaster | optional API key | https://developer-acct.ticketmaster.com/user/register | 5,000 calls/day |

`MEETUP_GROUPS` in `.env.local` controls which Meetup groups get scanned. Add or remove slugs (the part after `meetup.com/`) freely.

## Match score, explained

The number on each event card is a **Match score** (0–100+, higher = closer fit to your tastes). Not stars. Stars (★ 1–5) only appear when you mark an event attended and rate it.

```
match = avg(category_weights for the event)
      + venue_affinity_bonus           (learned per-venue bump)
      + source_affinity_bonus          (learned per-Meetup-group bump)
      + 8 if free
      + 15 if tagged 'experiential'
      − 25 if tagged ONLY 'market-shopping'
      − 10 if it's an evergreen ongoing place
      + distance_penalty               (0 / −3 / −15 / −30, source-modified)
```

Color cues on the card: green ≥ 80, blue ≥ 50, slate ≥ 20, faded otherwise.

### Distance & driving radius

Every event lands in one of four buckets based on its city:

| Bucket | Penalty | Includes |
|---|---|---|
| **Local** | 0 | Jacksonville, Jax Beach, Atlantic/Neptune Beach, Ponte Vedra, Mayport |
| **Nearby** (~1 hr) | −3 (or ~−5 for meetups) | St Augustine, Fernandina, Amelia, Orange Park, Fleming Island |
| **Drive** (1–3 hr) | −15 (or ~−22 for meetups) | Daytona, Gainesville, Ocala, Brunswick GA, St Simons |
| **Far** (3+ hr) | −30 (or ~−45 for meetups) | Orlando, Tampa, Miami, Pensacola, Tallahassee, … |

The **Driving radius** filter in the sidebar hard-filters to events in or below the selected bucket. Default is "Nearby" (Jax metro + 1-hour cities).

Distance penalties are stronger for Meetups (small events) and lighter for destination venues like Florida Theatre or Daily's Place — those "earn" the drive.

Each card also shows an **approximate drive distance** from `915 8th Ave S, Jacksonville Beach, FL 32250` (your default home — change via `HOME_LAT` / `HOME_LON` in `.env.local`). Values prefixed with `~` mean the venue had no exact coordinates and we used city-center as a fallback — click **Directions** on the card for Google's actual ETA. Tap the **📍 venue line** to open Google Maps, or **Directions** to start navigation.

### Five feedback states

| Action | What it does | Card treatment |
|---|---|---|
| **👍 Interested** | +2 to every category on the event, +1 to venue | Green border + "✓ You marked this Interested" |
| **📅 Register** | Marks "I signed up / bought a ticket". Doesn't shift weights. **Surfaces in iCal export.** | Violet border + "📅 You're registered for this" |
| **👎 Not for me** | −2 to every category, −1 to venue | Faded |
| **🚗 Too far for this** | Penalizes the **source/group** by −8 and venue by −8. **Does NOT touch category weights.** | Faded |
| **✓ I went to this** + ★ 1–5 | (stars − 3) × 4 to every category; half that to the venue | Blue border, persistent star count |

All clicks are **optimistic** — the card updates instantly, then the list refetches in the background, so positions don't jump while you're rating.

Weights are clamped to ±100 so one bad night doesn't blackball a category.

**Why three negatives?** A book club in Orlando might score well on category (philosophy ✓, intellectual-discussion ✓, experiential ✓) but be ridiculous because of distance. 👎 would punish the categories you actually like; 🚗 only punishes that specific Meetup group, so a future Jacksonville-based philosophy event still scores fine.

## Google Calendar / Apple Calendar sync

Every event you mark **📅 Registered** flows into an iCal feed served at:

```
http://localhost:3000/api/calendar.ics?status=registered
```

Available statuses: `registered` (default), `interested` (Interested + Registered), `all`.

Two ways to use it:

1. **One-shot import**: click the **📅 Export** button in the header → downloads a `.ics` file → drag into Google Calendar's "Import" or open in Apple Calendar. Good for one-time sync, no live updates.
2. **Live subscription** (works once the app is hosted on the public internet): Google Calendar → "Other calendars" → "From URL" → paste the URL. Refreshes hourly. Won't work with `localhost` because Google's servers can't reach your Mac.

The calendar feed includes the title, time, full description, venue/city, URL, and category list — everything you need to plan around it.

## Refresh model

There's **no automatic schedule**. Click **↻ Refresh** when you open the app. Each source runs independently and any one failing is reported but doesn't break the others.

Want to script it from a terminal instead? `curl -X POST http://localhost:3000/api/refresh` does the same thing as the button (dev server must be running). Easy to wrap in a cron / launchd job later if you want.

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # main UI — list + calendar + filters + sort + refresh
│   ├── layout.tsx                # shell
│   ├── globals.css
│   └── api/
│       ├── events/route.ts       # GET filtered events
│       ├── interest/route.ts     # POST 👍 / 👎
│       ├── attendance/route.ts   # POST attended + stars
│       ├── preferences/route.ts  # GET current learned weights
│       └── refresh/route.ts      # POST → fans out to all scrapers
├── components/
│   ├── EventCard.tsx
│   ├── Filters.tsx
│   └── CalendarView.tsx          # Week + Month modes
├── lib/
│   ├── categories.ts             # 28 categories + icons + default weights
│   ├── db.ts                     # SQLite schema, upsert, types, UTC normalization
│   ├── scoring.ts                # transparent linear scoring + learning
│   └── events-query.ts           # filter + score query
└── scrapers/
    ├── ticketmaster.ts           # Discovery API (needs key)
    ├── cummer.ts                 # Tribe-Events iCal feed
    ├── florida-theatre.ts        # cheerio HTML scrape
    ├── meetup.ts                 # iCal per group (configurable slugs)
    └── lib/ical.ts               # shared iCal parsing helper
scripts/
└── seed.ts                       # verified-real seed (Cummer, Symphony, Florida Theatre, evergreen places)
data/
└── events.db                     # SQLite (gitignored)
```

## Useful commands

```bash
npm run dev          # local at :3000
npm run seed         # re-seed verified events from scripts/seed.ts
npm run reset-db     # wipe + reseed
npm run build        # production build (for hosting later)
```

## Roadmap

**Phase 3 (when you want it):**
- More venues (Daily's Place when their calendar fills, MOCA exhibitions auto-refresh, dance studios, Jax Symphony — that one needs Playwright or Ticketmaster coverage)
- Florida/Jax Instagram influencer feeds (hardest — IG has no public API; real options are Apify, RSS bridges, or a manual "submit a tip" form)
- Attended-places history page + map view
- Push to Vercel/Railway/Fly for phone access
- Email/Slack weekly digest of top-scored upcoming events
- Scheduled refresh via launchd (Mac) or cron once you have the cadence dialed in

## Notes

- Database lives at `data/events.db` (gitignored). Delete it and run `npm run seed` to start fresh.
- All preferences are stored locally — nothing leaves your machine.
- Adding a new category to `src/lib/categories.ts` won't wipe your learned weights — only new categories get the default weight inserted.
