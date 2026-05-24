import { NextResponse } from "next/server";
import { getDb, upsertEvent, type EventInput } from "@/lib/db";
import { fetchTicketmaster } from "@/scrapers/ticketmaster";
import { fetchCummer } from "@/scrapers/cummer";
import { fetchFloridaTheatre } from "@/scrapers/florida-theatre";
import { fetchMeetup } from "@/scrapers/meetup";
import { fetchJaxBeachCity } from "@/scrapers/jax-beach-city";
import { fetchVisitJax } from "@/scrapers/visit-jax";
import { fetchKickers } from "@/scrapers/kickers";
import { fetchAtlanticBeach } from "@/scrapers/atlantic-beach";
import { fetchEventbrite } from "@/scrapers/eventbrite";

export const dynamic = "force-dynamic";

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

export async function POST() {
  const db = getDb();
  const report: Record<string, { fetched: number; error?: string }> = {};

  await Promise.all(
    Object.entries(SOURCES).map(async ([name, fn]) => {
      try {
        const events = await fn();
        const tx = db.transaction(() => {
          for (const e of events) upsertEvent(db, e);
        });
        tx();
        report[name] = { fetched: events.length };
      } catch (err) {
        report[name] = { fetched: 0, error: (err as Error).message };
      }
    })
  );

  return NextResponse.json({ ok: true, report });
}
