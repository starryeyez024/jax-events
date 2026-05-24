"use client";

import { useMemo, useState } from "react";
import { typeFor } from "@/lib/event-type";
import type { EventWithExtras } from "@/lib/db";

type Props = {
  events: EventWithExtras[];
};

type Mode = "month" | "week";

export function CalendarView({ events }: Props) {
  const [mode, setMode] = useState<Mode>("week");
  // Two independent toggles. Both off = "All". Both on = events matching
  // either filter (union). One on = just that filter.
  const [showInterested, setShowInterested] = useState(false);
  const [showRegistered, setShowRegistered] = useState(false);
  const showAll = !showInterested && !showRegistered;

  const filteredEvents = useMemo(() => {
    if (showAll) return events;
    return events.filter(
      (e) =>
        (showInterested && e.interest === 1) ||
        (showRegistered && e.registered === 1)
    );
  }, [events, showInterested, showRegistered, showAll]);
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Split events: dated events go on the grid, ongoing exhibitions surface in
  // a separate row below so a 6-month-long exhibition doesn't clutter every day.
  const { byDate, ongoing } = useMemo(() => {
    const m = new Map<string, EventWithExtras[]>();
    const og: EventWithExtras[] = [];
    for (const e of filteredEvents) {
      if (e.is_recurring) {
        og.push(e);
        continue;
      }
      const d = new Date(e.starts_at);
      const key = dayKey(d);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return { byDate: m, ongoing: og };
  }, [filteredEvents]);

  const today = new Date();

  // Compute the visible date range based on mode.
  const cells: Array<{ date: Date | null; key: string }> = [];
  let headerLabel = "";

  if (mode === "week") {
    const start = new Date(cursor);
    start.setDate(start.getDate() - start.getDay()); // Sunday-start
    headerLabel = `Week of ${start.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push({ date: d, key: d.toISOString() });
    }
  } else {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    headerLabel = monthStart.toLocaleString("en-US", { month: "long", year: "numeric" });
    const firstDay = monthStart.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) cells.push({ date: null, key: `pad-${i}` });
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      cells.push({ date: d, key: d.toISOString() });
    }
  }

  function jump(direction: -1 | 1) {
    const d = new Date(cursor);
    if (mode === "week") d.setDate(d.getDate() + 7 * direction);
    else d.setMonth(d.getMonth() + direction);
    setCursor(d);
  }

  const counts = useMemo(() => {
    let interested = 0;
    let registered = 0;
    for (const e of events) {
      if (e.interest === 1) interested++;
      if (e.registered === 1) registered++;
    }
    return { all: events.length, interested, registered };
  }, [events]);

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="px-2 py-1 text-sm border rounded hover:bg-slate-50"
            onClick={() => jump(-1)}
            aria-label="Previous"
          >
            ←
          </button>
          <h2 className="font-semibold">{headerLabel}</h2>
          <button
            className="px-2 py-1 text-sm border rounded hover:bg-slate-50"
            onClick={() => jump(1)}
            aria-label="Next"
          >
            →
          </button>
          <button
            className="px-2 py-1 text-xs border rounded hover:bg-slate-50 ml-1"
            onClick={() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              setCursor(d);
            }}
          >
            Today
          </button>
        </div>
        <div className="rounded border bg-white p-0.5 text-sm">
          <button
            onClick={() => setMode("week")}
            className={`px-3 py-1 rounded ${mode === "week" ? "bg-ocean-500 text-white" : ""}`}
          >
            Week
          </button>
          <button
            onClick={() => setMode("month")}
            className={`px-3 py-1 rounded ${mode === "month" ? "bg-ocean-500 text-white" : ""}`}
          >
            Month
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-3 flex-wrap text-sm">
        <span className="text-xs text-slate-500 mr-1">Show:</span>
        <button
          onClick={() => {
            setShowInterested(false);
            setShowRegistered(false);
          }}
          className={`px-2 py-1 rounded border text-xs ${
            showAll ? "bg-ocean-500 text-white border-ocean-500" : "hover:bg-slate-50"
          }`}
          title="Clear filters and show everything"
        >
          All ({counts.all})
        </button>
        <button
          onClick={() => setShowInterested((v) => !v)}
          className={`px-2 py-1 rounded border text-xs ${
            showInterested
              ? "bg-emerald-600 text-white border-emerald-600"
              : "hover:bg-slate-50"
          }`}
          aria-pressed={showInterested}
        >
          👍 Interested ({counts.interested})
        </button>
        <button
          onClick={() => setShowRegistered((v) => !v)}
          className={`px-2 py-1 rounded border text-xs ${
            showRegistered
              ? "bg-violet-600 text-white border-violet-600"
              : "hover:bg-slate-50"
          }`}
          aria-pressed={showRegistered}
        >
          📅 Registered ({counts.registered})
        </button>
        <a
          href="/api/calendar.ics?status=registered"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-slate-600 underline hover:text-ocean-700"
          title="Subscribe in Google Calendar with this URL, or click to download .ics"
          download
        >
          ⬇ Export registered (.ics)
        </a>
      </div>

      {mode === "week" ? (
        <WeekGrid cells={cells} byDate={byDate} today={today} />
      ) : (
        <MonthGrid cells={cells} byDate={byDate} today={today} />
      )}

      {ongoing.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <div className="text-xs font-semibold text-slate-600 mb-2">
            Ongoing &amp; evergreen — available across multiple days
          </div>
          <div className="flex flex-wrap gap-2">
            {ongoing.map((e) => (
              <OngoingChip key={e.id} event={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────── grids ─────────────

function WeekGrid({
  cells,
  byDate,
  today,
}: {
  cells: Array<{ date: Date | null; key: string }>;
  byDate: Map<string, EventWithExtras[]>;
  today: Date;
}) {
  return (
    <div className="space-y-2">
      {cells.map((cell) => {
        if (!cell.date) return null;
        const dayEvents = byDate.get(dayKey(cell.date)) ?? [];
        const isToday = cell.date.toDateString() === today.toDateString();
        return (
          <div
            key={cell.key}
            className={`rounded border p-3 ${
              isToday ? "border-ocean-500 bg-ocean-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-sm font-semibold">
                {cell.date.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
                {isToday && <span className="text-xs text-ocean-700 ml-2">(today)</span>}
              </div>
              <div className="text-xs text-slate-500">
                {dayEvents.length === 0 ? "—" : `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
              </div>
            </div>
            {dayEvents.length === 0 ? (
              <div className="text-xs text-slate-400 italic">No scheduled events</div>
            ) : (
              <ul className="space-y-1">
                {dayEvents
                  .sort(
                    (a, b) =>
                      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
                  )
                  .map((e) => (
                    <WeekEventRow key={e.id} event={e} />
                  ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeekEventRow({ event }: { event: EventWithExtras }) {
  const time = new Date(event.starts_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const statusBadge =
    event.registered === 1 ? (
      <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-violet-100 text-violet-800">
        📅 Registered
      </span>
    ) : event.interest === 1 ? (
      <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-800">
        ✓ Interested
      </span>
    ) : null;
  const t = typeFor(event);
  const content = (
    <div className="flex items-start gap-2 text-sm py-1">
      <span
        className={`shrink-0 text-base leading-none ${t.opacityClass}`}
        aria-label={t.label}
        title={t.label}
      >
        {t.icon}
      </span>
      <span className="shrink-0 text-xs text-slate-500 w-16 pt-0.5">{time}</span>
      <span className="break-words flex-1 leading-snug">
        {event.title}
        {event.venue_name && (
          <span className="text-xs text-slate-500"> — {event.venue_name}</span>
        )}
      </span>
      {statusBadge}
    </div>
  );
  return (
    <li>
      {event.url ? (
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded px-2 hover:bg-ocean-50 hover:underline"
        >
          {content}
        </a>
      ) : (
        <div className="px-2">{content}</div>
      )}
    </li>
  );
}

function MonthGrid({
  cells,
  byDate,
  today,
}: {
  cells: Array<{ date: Date | null; key: string }>;
  byDate: Map<string, EventWithExtras[]>;
  today: Date;
}) {
  return (
    <>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (!cell.date)
            return <div key={cell.key} className="h-28 rounded bg-slate-50/50" />;
          const dayEvents = byDate.get(dayKey(cell.date)) ?? [];
          const isToday = cell.date.toDateString() === today.toDateString();
          return (
            <div
              key={cell.key}
              className={`h-28 rounded border p-1 text-xs overflow-hidden flex flex-col ${
                isToday ? "border-ocean-500 bg-ocean-50" : "border-slate-200"
              }`}
            >
              <div className="font-medium">{cell.date.getDate()}</div>
              <div className="space-y-0.5 mt-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((e) => {
                  const t = typeFor(e);
                  return e.url ? (
                    <a
                      key={e.id}
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate px-1 rounded bg-ocean-100 text-ocean-900 hover:bg-ocean-200 hover:underline"
                      title={`${e.title} — ${t.label}`}
                    >
                      <span className={`mr-1 ${t.opacityClass}`} aria-hidden>
                        {t.icon}
                      </span>
                      {e.title}
                    </a>
                  ) : (
                    <div
                      key={e.id}
                      className="truncate px-1 rounded bg-slate-100 text-slate-700"
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-slate-500 px-1">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function OngoingChip({ event }: { event: EventWithExtras }) {
  const t = typeFor(event);
  const inner = (
    <>
      <span aria-hidden className={`mr-1 ${t.opacityClass}`}>
        {t.icon}
      </span>
      {event.title}
    </>
  );
  if (!event.url)
    return <span className="text-xs px-2 py-1 rounded border bg-sand-50">{inner}</span>;
  return (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs px-2 py-1 rounded border bg-sand-50 hover:bg-sand-100 hover:underline"
      title={event.venue_name ?? undefined}
    >
      {inner}
    </a>
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
