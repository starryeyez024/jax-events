# Jax Beach Fun Times — Todos & Followups

## Code todos

### RRULE expansion in the iCal lib

**Why:** Google Calendar–backed feeds (Bold City Swing, possibly others added
later) encode recurring events as a single VEVENT with an `RRULE` field
(e.g. `RRULE:FREQ=MONTHLY;BYDAY=3SU`). Our current parser at
`src/scrapers/lib/ical.ts` reads only `v.start` from each VEVENT and ignores
the recurrence rule, so a "Swing Dance Night every 3rd Sunday" entry created
in 2022 shows up as a single 2022 event instead of the next dozen upcoming
occurrences.

**What to do:**
- Add the [`rrule`](https://www.npmjs.com/package/rrule) library to deps.
- In `fetchIcal`, when a VEVENT has an `rrule` field, expand it into
  occurrences within a sensible window (e.g. today → today + 90 days).
- Emit one `EventInput` per occurrence, with a stable `source_id` that
  encodes the recurrence date (e.g. `${uid}#${YYYYMMDD}`) so each occurrence
  upserts independently.
- Respect `EXDATE` (excluded dates) and the existing `cutoff` filter that
  skips past events.

**Estimated effort:** 30–45 minutes. Mostly contained in `lib/ical.ts`.

**Impact:** Surfaces the monthly Volstead swing nights via Bold City Swing,
plus any Cummer / Meetup recurring entries we currently miss.

---

## Venues / feeds we cannot scrape today

These sources are worth knowing about — either to contact the venue and ask
them to publish a real calendar feed, or to bookmark for manual tip
submission via the `+ Add tip` button.

### Blocked or unstructured (could be unblocked with venue cooperation)

| Venue / Site | URL | Status | Ask |
|---|---|---|---|
| Murray Hill Theatre | https://www.murrayhilltheatre.com/ | Returns HTTP 403 to any non-browser User-Agent. They list swing dance nights and concerts but their site rejects scrapers. | Ask them to either drop the bot-block or publish an iCal feed. Their Eventbrite org page (`/o/murray-hill-theatre`) is 404, so no easy fallback. |
| The Dance Shack | https://thedanceshack.com/ | WordPress site without The Events Calendar plugin. Their `/calendar/` page is hand-written prose. Real updates live on their Facebook page. | Ask them to add the free WordPress Events Calendar plugin (one click, gives us a `/events/feed/` iCal feed). |
| The Volstead | https://www.thevolstead.com/ | Connection timeout — site appears down/firewalled from outside Jax. Their swing dance nights are referenced on the Bold City Swing calendar. | Worth a poke — their site might just be intermittently up. |
| Jacksonville West Coast Swing Club | (no domain resolves) | They appear to run entirely on Facebook (no public website). | Ask if they'd publish a Google Calendar — that's what Bold City Swing does, and it's free. |
| Neptune Beach | https://www.nbfl.gov/ | HTTP 403 to scrapers regardless of UA. Has a Cloudflare/WAF in front. | Email the city IT contact and ask for whitelisting or a public iCal export — same way coab.us (Atlantic Beach) ships theirs. |
| Visit Jacksonville Beach Chamber | `visitjacksonvillebeach.com` / `jaxbchchamber.com` | Domains don't resolve. Closest active site (`beachestowncenter.com`) embeds MembershipWorks, which is auth-gated and doesn't expose a public events API. | Probably a dead organization — skip unless it resurfaces. |

### Sites where scraping is possible but inefficient

| Site | URL | Why not yet |
|---|---|---|
| JaxToday.org | https://jaxtoday.org/category/arts-culture-events/ | Local news site with curated "what to do" roundup articles (e.g. "Memorial Day Events Northeast Florida"). Each article is unstructured prose listing multiple events. Could be parsed via Claude (~$0.001 per article, weekly cost ~2¢) but adds operational complexity. Worth revisiting if event coverage gaps remain after RRULE expansion lands. |
| Beaches Leader | https://www.beachesleader.com/ | Local newspaper. No `/events` URL works. Possibly has events in print only. |

### Dormant feeds

| Source | Status |
|---|---|
| Bold City Swing | Active scraper, but their public Google Calendar has gone mostly quiet — last one-off event was March 2026. Their one remaining recurring entry (Swing Dance Night at the Volstead, 3rd Sunday monthly) is RRULE-encoded — see RRULE expansion todo above. |

---

## How to keep this list fresh

When you discover a new venue or source that's interesting but unscrapable,
add a row to the table above. When a venue starts publishing a real feed,
remove its row, add a scraper, and register it in
`src/app/api/refresh/route.ts` + `scripts/scrape.ts`.
