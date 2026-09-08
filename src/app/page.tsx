"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EventWithExtras } from "@/lib/db";
import { EventCard } from "@/components/EventCard";
import { CalendarView } from "@/components/CalendarView";
import { Filters, type FilterState } from "@/components/Filters";
import { TipModal } from "@/components/TipModal";
import { UndoToast, type ToastState } from "@/components/UndoToast";
import { ShareMenu } from "@/components/ShareMenu";
import { READ_ONLY } from "@/lib/config";
import { filterEvents } from "@/lib/filter-events";
import { decodeViewState, encodeViewState, type Defaults } from "@/lib/url-state";

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

const DEFAULT_FILTERS: FilterState = {
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
};

export default function Home() {
  // Public read-only mode has no visible match score, so default to a plain
  // chronological list.
  const defaults: Defaults = useMemo(
    () => ({ filters: DEFAULT_FILTERS, sort: READ_ONLY ? "chrono" : "match" }),
    []
  );

  const [view, setView] = useState<"list" | "calendar">("list");
  const [sort, setSort] = useState<SortMode>(defaults.sort);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [calendarMode, setCalendarMode] = useState<"week" | "month">("week");
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  // Until the URL has been read, don't write to it — otherwise the first
  // render would immediately overwrite an incoming shared link with defaults.
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Restore the collapse preference after mount. Reading localStorage during
  // the initial render would desync server and client markup and trip
  // hydration, so it happens in an effect like the URL read below.
  useEffect(() => {
    if (window.localStorage.getItem("wavelength:filters-collapsed") === "1") {
      setSidebarOpen(false);
    }
  }, []);

  function toggleSidebar() {
    setSidebarOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("wavelength:filters-collapsed", next ? "0" : "1");
      } catch {
        // Private-mode Safari throws on setItem; the toggle still works, it
        // just won't be remembered.
      }
      return next;
    });
  }

  // Read the incoming link once, on mount. Using window.location rather than
  // useSearchParams keeps this component out of Next's Suspense requirement
  // for static rendering, which the read-only export depends on.
  useEffect(() => {
    const { state } = decodeViewState(window.location.search, defaults);
    setFilters(state.filters);
    setView(state.view);
    setSort(state.sort);
    setCalendarMode(state.calendarMode);
    setCalendarDate(state.calendarDate);
    setHydrated(true);
  }, [defaults]);

  // Mirror state back into the URL. replaceState, not push — every chip click
  // would otherwise add a history entry and make Back unusable.
  useEffect(() => {
    if (!hydrated) return;
    const qs = encodeViewState(
      { filters, view, sort, calendarMode, calendarDate },
      defaults
    );
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [hydrated, filters, view, sort, calendarMode, calendarDate, defaults]);

  function buildShareUrl(): string {
    const qs = encodeViewState(
      { filters, view, sort, calendarMode, calendarDate },
      defaults
    );
    return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
  }

  // Sort and view were two controls with an impossible combination between
  // them: the calendar grid is laid out by date, so "Best match" had no
  // meaning there. Presenting one control of three mutually exclusive
  // choices removes the dead state instead of hiding it.
  const viewControl: string = view === "calendar" ? "calendar" : sort;
  function setViewControl(v: string) {
    if (v === "calendar") {
      setView("calendar");
      return;
    }
    setView("list");
    setSort(v as SortMode);
  }

  // Drives the badge on the collapsed-sidebar button, so filters narrowing
  // the list stay visible after the panel they live in is hidden.
  const activeFilterCount = useMemo(() => {
    const d = DEFAULT_FILTERS;
    let n = 0;
    if (filters.search) n++;
    if (!filters.allCategories) n++;
    if (filters.freeOnly) n++;
    if (filters.maxPrice != null) n++;
    if (filters.includeRecurring !== d.includeRecurring) n++;
    if (filters.includeMonthly !== d.includeMonthly) n++;
    if (filters.hideUninterested !== d.hideUninterested) n++;
    if (filters.maxDistance !== d.maxDistance) n++;
    if (filters.from !== d.from || filters.to !== d.to) n++;
    return n;
  }, [filters]);
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
    if (READ_ONLY) {
      // Static public mode: no API/database. Load the whole snapshot and
      // narrow it in the browser (mirrors the server filters).
      const res = await fetch("/events.json");
      const json = await res.json();
      setEvents(filterEvents(json.events ?? [], filters));
    } else {
      const res = await fetch(`/api/events?${query}`);
      const json = await res.json();
      setEvents(json.events ?? []);
    }
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
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-title text-3xl md:text-4xl tracking-tight text-slate-900 leading-none">
            <span aria-hidden className="mr-2">🏄</span>
            Wavelength
          </h1>
          <p className="text-base text-slate-700 mt-2 font-medium">
            Events on your wavelength · Jacksonville
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Link
            href="/sources"
            className="px-4 py-2 text-[12.8px] font-medium rounded-full border border-slate-200 bg-white/70 backdrop-blur hover:bg-white hover:border-slate-300 transition"
            title="Where these events come from and how current each source is"
          >
            Sources &amp; freshness
          </Link>
          {!READ_ONLY && (
            <button
              onClick={() => setTipOpen(true)}
              className="px-4 py-2 text-[12.8px] font-medium rounded-full border border-slate-200 bg-white/70 backdrop-blur hover:bg-white hover:border-slate-300 transition"
              title="Saw an event on Instagram, Facebook, or elsewhere? Paste it here and Claude will extract the details."
            >
              ＋ Add tip
            </button>
          )}
          <ShareMenu getShareUrl={buildShareUrl} showIcsExport={!READ_ONLY} />
          {!READ_ONLY && (
            <button
              onClick={refreshScrapers}
              disabled={refreshing}
              className="px-4 py-2 text-sm font-medium rounded-full border border-slate-200 bg-white/70 backdrop-blur hover:bg-white hover:border-slate-300 transition disabled:opacity-50"
              title="Pull fresh events from configured sources"
            >
              {refreshing ? "Refreshing…" : "↻ Refresh"}
            </button>
          )}
        </div>
      </header>

      {refreshReport && (
        <div className="text-xs text-slate-600 mb-2 px-2">{refreshReport}</div>
      )}

      <TipModal open={tipOpen} onClose={() => setTipOpen(false)} onSaved={load} />
      <UndoToast toast={toast} onDismiss={() => setToast(null)} />


      {/* Flex rather than a grid whose column count changes: the aside stays
          mounted and animates its width, so collapsing slides the content over
          instead of snapping it 300px. On mobile the column is full-width and
          the panel simply behaves as an accordion. */}
      <div
        className={`flex flex-col md:flex-row gap-6 transition-[column-gap] duration-300 ease-out motion-reduce:transition-none ${
          sidebarOpen ? "md:gap-10" : "md:gap-4"
        }`}
      >
        {/* sticky lives on the aside itself, not on an inner div. This
            element has overflow-hidden (to clip the width animation), which
            makes it a scroll container — so a sticky child resolves against
            the aside rather than the viewport, which both pushed the panel
            down by `top` at every scroll position and stopped it ever
            tracking the viewport. self-start is required too: a stretched
            flex item fills the row, leaving nothing to scroll past. */}
        <aside
          className={`shrink-0 overflow-hidden md:sticky md:top-6 md:self-start transition-[width] duration-300 ease-out motion-reduce:transition-none w-full ${
            sidebarOpen ? "md:w-[300px]" : "md:w-[56px]"
          }`}
        >
          <div>
            <Filters
              value={filters}
              onChange={setFilters}
              collapsed={!sidebarOpen}
              onToggle={toggleSidebar}
              activeFilterCount={activeFilterCount}
            />
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {/* Sits with the content it controls rather than up in the header,
              where it read as site chrome. */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="font-display text-3xl font-medium text-slate-900 tracking-tight leading-none">
                {loading ? (
                  <span className="text-slate-400">Loading…</span>
                ) : (
                  <>
                    {events.length}{" "}
                    <span className="text-slate-400 text-xl font-normal">
                      event{events.length === 1 ? "" : "s"}
                    </span>
                  </>
                )}
              </div>
            </div>

            <SegmentedToggle
              options={[
                ...(READ_ONLY ? [] : [{ value: "match", label: "Best match" }]),
                { value: "chrono", label: "Chronological" },
                { value: "calendar", label: "Calendar" },
              ]}
              value={viewControl}
              onChange={setViewControl}
            />
          </div>

          {view === "list" ? (
            <>
              {!READ_ONLY && (
                <div className="text-xs text-slate-500 px-1 mb-3 leading-relaxed">
                  <strong className="text-slate-700">Match score</strong> — how well an event fits your stated tastes
                  (higher = better). Shifts as you 👍/👎 and rate things you attend.
                </div>
              )}
              <div className="space-y-3">
                {visible.length === 0 && !loading && (
                  <div className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl p-6 text-center">
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
            <CalendarView
              events={events}
              mode={calendarMode}
              onModeChange={setCalendarMode}
              date={calendarDate}
              onDateChange={setCalendarDate}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// Small segmented control used in the header for sort + view toggles.
// Visual: pill-shaped track, soft white background, active state is a darker
// pill that floats inside. Replaces the older square-ish bordered version.
function SegmentedToggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 backdrop-blur p-1 text-[12.8px] font-medium">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-4 py-1.5 rounded-full transition ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
