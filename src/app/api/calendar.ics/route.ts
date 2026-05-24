// iCalendar export — subscribe to this URL in Google Calendar / Apple Calendar
// / Outlook to get your Interested + Registered events on your phone.
//
// Examples:
//   /api/calendar.ics                          → all upcoming
//   /api/calendar.ics?status=registered        → only events you Registered for
//   /api/calendar.ics?status=interested        → 👍 Interested + Registered
//
// Subscribe URL in Google Calendar: "Add by URL" with the same link.

import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { queryEvents } from "@/lib/events-query";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "registered"; // safest default

  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const interestedOnly = status === "interested";
  const registeredOnly = status === "registered";

  const events = queryEvents(getDb(), {
    from: from.toISOString(),
    interestedOnly,
    registeredOnly,
    // include recurring/ongoing so multi-day exhibitions show up too
    includeRecurring: true,
  });

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//jax-events//Personal Event Radar//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(
    `X-WR-CALNAME:Jax Events — ${
      status === "registered"
        ? "Registered"
        : status === "interested"
        ? "Interested"
        : "All Upcoming"
    }`
  );
  lines.push("X-WR-TIMEZONE:America/New_York");
  lines.push("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
  lines.push("X-PUBLISHED-TTL:PT1H");

  for (const e of events) {
    const start = formatIcs(new Date(e.starts_at));
    const end = formatIcs(e.ends_at ? new Date(e.ends_at) : oneHourLater(new Date(e.starts_at)));
    const stamp = formatIcs(new Date());
    const uid = `${e.id}@jax-events.local`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${ icsEscape(e.title) }`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(truncate(e.description, 1200))}`);
    if (e.url) lines.push(`URL:${e.url}`);
    const loc = [e.venue_name, e.venue_address, e.city].filter(Boolean).join(", ");
    if (loc) lines.push(`LOCATION:${icsEscape(loc)}`);
    if (e.categories.length) lines.push(`CATEGORIES:${e.categories.join(",")}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const body = lines.join("\r\n") + "\r\n";
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="jax-events-${status}.ics"`,
      "cache-control": "no-store",
    },
  });
}

function formatIcs(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function oneHourLater(d: Date): Date {
  return new Date(d.getTime() + 60 * 60 * 1000);
}

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
