"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventWithExtras } from "@/lib/db";
import { EventCard } from "@/components/EventCard";
import { CalendarView } from "@/components/CalendarView";
import { Filters, type FilterState } from "@/components/Filters";
import { TipModal } from "@/components/TipModal";
import { UndoToast, type ToastState } from "@/components/UndoToast";

function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function plusDaysIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

type SortMode = "match" | "chrono";

export default function Home() {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [sort, setSort] = useState<SortMode>("match");
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    selectedCategories: [],
    allCategories: true,
    freeOnly: false,
    maxPrice: null,
    includeRecurring: false,
    includeMonthly: true,
    hideUninterested: true,
    maxDistance: "nearby", // default: Jax metro + ~1hr radius
    from: todayIso(),
    to: plusDaysIso(7),
  });
  const [events, setEvents] = useState<EventWithExtras[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshReport, setRefreshReport] = useState<string | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  function showToast(message: string, onUndo: () => void | Promise<void>) {
    // New id forces the UndoToast effect to reset the dismiss timer when
    // a second negative action happens before the first toast has expired.
    setToast({ message, onUndo, id: Date.now() });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    // Send raw YYYY-MM-DD; the server interprets it as a local-time date
    // (see localDateToIso in events-query.ts). Converting here via new Date()
    // treats it as UTC midnight, which produces off-by-one results around
    // event times that fall in the early-AM UTC / late-PM Eastern window.
    if (filters.from) sp.set("from", filters.from);
    if (filters.to) sp.set("to", filters.to);
    if (filters.freeOnly) sp.set("freeOnly", "1");
    if (filters.maxPrice != null) sp.set("maxPrice", String(filters.maxPrice));
    if (!filters.includeRecurring) sp.set("includeRecurring", "0");
    if (!filters.includeMonthly) sp.set("includeMonthly", "0");
    if (filters.hideUninterested) sp.set("hideUninterested", "1");
    if (filters.maxDistance) sp.set("maxDistance", filters.maxDistance);
    if (filters.search) sp.set("q", filters.search);
    // Send categories only when in subset mode. "Select all on" sends nothing
    // (= no filter); "Select all off with empty subset" sends noCategories=1
    // (= show nothing).
    if (!filters.allCategories) {
      if (filters.selectedCategories.length === 0) {
        sp.set("noCategories", "1");
      } else {
        for (const c of filters.selectedCategories) sp.append("category", c);
      }
    }
    return sp.toString();
  }, [filters]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/events?${query}`);
    const json = await res.json();
    setEvents(json.events ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [query]);

  async function refreshScrapers() {
    setRefreshing(true);
    setRefreshReport(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const json = await res.json();
      const lines = Object.entries(json.report ?? {}).map(([src, r]: [string, any]) =>
        r.error ? `${src}: error (${r.error})` : `${src}: +${r.fetched}`
      );
      setRefreshReport(lines.join(" · "));
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const visible = useMemo(() => {
    const arr = [...events];
    if (sort === "match") arr.sort((a, b) => b.score - a.score);
    else
      arr.sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      );
    return arr;
  }, [events, sort]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-ocean-900">
            <span aria-hidden className="mr-1">📅</span>
            Jax Beach Fun Times
          </h1>
          <p className="text-sm text-slate-600">
            Personal event radar for Jacksonville Beach
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="rounded border bg-white p-0.5 text-sm">
            <button
              onClick={() => setSort("match")}
              className={`px-3 py-1 rounded ${
                sort === "match" ? "bg-ocean-500 text-white" : ""
              }`}
            >
              Best match
            </button>
            <button
              onClick={() => setSort("chrono")}
              className={`px-3 py-1 rounded ${
                sort === "chrono" ? "bg-ocean-500 text-white" : ""
              }`}
            >
              Chronological
            </button>
          </div>
          <div className="rounded border bg-white p-0.5 text-sm">
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1 rounded ${
                view === "list" ? "bg-ocean-500 text-white" : ""
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`px-3 py-1 rounded ${
                view === "calendar" ? "bg-ocean-500 text-white" : ""
              }`}
            >
              Calendar
            </button>
          </div>
          <button
            onClick={() => setTipOpen(true)}
            className="px-3 py-1 text-sm rounded border bg-white hover:bg-slate-50"
            title="Saw an event on Instagram, Facebook, or elsewhere? Paste it here and Claude will extract the details."
          >
            ＋ Add tip
          </button>
          <a
            href="/api/calendar.ics?status=registered"
            className="px-3 py-1 text-sm rounded border bg-white hover:bg-slate-50"
            title="Download .ics of your registered events, or use this URL to subscribe in Google Calendar"
            download
          >
            📅 Export
          </a>
          <button
            onClick={refreshScrapers}
            disabled={refreshing}
            className="px-3 py-1 text-sm rounded border bg-white hover:bg-slate-50 disabled:opacity-50"
            title="Pull fresh events from configured sources"
          >
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </header>

      {refreshReport && (
        <div className="text-xs text-slate-600 mb-2 px-2">{refreshReport}</div>
      )}

      <TipModal open={tipOpen} onClose={() => setTipOpen(false)} onSaved={load} />
      <UndoToast toast={toast} onDismiss={() => setToast(null)} />


      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <aside>
          <Filters
            value={filters}
            onChange={setFilters}
            count={events.length}
            loading={loading}
          />
        </aside>

        <main>
          {view === "list" ? (
            <>
              <div className="text-xs text-slate-500 px-1 mb-2">
                <strong>Match score</strong>: how well an event fits your stated tastes
                (higher = better). Shifts as you 👍/👎 and rate things you attend. Stars
                (★ 1–5) only appear when you rate an event after attending.
              </div>
              <div className="space-y-3">
                {visible.length === 0 && !loading && (
                  <div className="text-sm text-slate-600 bg-white border rounded p-4">
                    No events match. Try widening the date range or clearing filters.
                  </div>
                )}
                {visible.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    onChange={load}
                    onShowToast={showToast}
                  />
                ))}
              </div>
            </>
          ) : (
            <CalendarView events={events} />
          )}
        </main>
      </div>
    </div>
  );
}
