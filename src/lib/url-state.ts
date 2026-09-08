// Shareable view state <-> URL query string.
//
// The whole point is that a link reproduces what the sender was looking at:
// same date window, same categories, same view mode. So everything that
// changes what's on screen round-trips through here.
//
// Two deliberate choices:
//
//   1. Only non-default values are written. A pristine view has a clean URL,
//      and a shared link stays short and readable.
//   2. Decoding is total — unknown categories, malformed dates and junk
//      values are dropped rather than throwing. These strings arrive from
//      other people's messaging apps, which mangle URLs routinely, so a
//      damaged link should degrade to a sane view instead of a blank page.

import { isCategory, type Category } from "./categories";
import { BUCKET_ORDER, type DistanceBucket } from "./distance";
import type { FilterState } from "@/components/Filters";

export type ViewState = {
  filters: FilterState;
  view: "list" | "calendar";
  sort: "match" | "chrono";
  /** Calendar sub-mode. Ignored when view is "list". */
  calendarMode: "week" | "month";
  /** Which week/month the calendar is parked on, as YYYY-MM-DD. */
  calendarDate: string | null;
};

/** Values that don't need to appear in the URL. Must match page.tsx defaults. */
export function defaultFilters(from: string, to: string): FilterState {
  return {
    search: "",
    selectedCategories: [],
    allCategories: true,
    freeOnly: false,
    maxPrice: null,
    includeRecurring: false,
    includeMonthly: true,
    hideUninterested: true,
    maxDistance: "nearby",
    from,
    to,
  };
}

export type Defaults = {
  filters: FilterState;
  /** Differs by mode: read-only public builds default to chronological. */
  sort: "match" | "chrono";
};

export function encodeViewState(s: ViewState, d: Defaults): string {
  const p = new URLSearchParams();
  const defaults = d.filters;
  const f = s.filters;

  if (f.from !== defaults.from) p.set("from", f.from);
  if (f.to !== defaults.to) p.set("to", f.to);
  if (f.search) p.set("q", f.search);
  if (f.freeOnly) p.set("free", "1");
  if (f.maxPrice != null) p.set("maxPrice", String(f.maxPrice));
  if (f.includeRecurring !== defaults.includeRecurring) p.set("recurring", f.includeRecurring ? "1" : "0");
  if (f.includeMonthly !== defaults.includeMonthly) p.set("monthly", f.includeMonthly ? "1" : "0");
  if (f.hideUninterested !== defaults.hideUninterested) p.set("hideDown", f.hideUninterested ? "1" : "0");
  if (f.maxDistance !== defaults.maxDistance) p.set("dist", f.maxDistance);

  // Three-state category model: "all" is the default and written as nothing;
  // an explicit empty selection has to be distinguishable from it, so it gets
  // its own marker rather than an empty categories= that would decode as absent.
  if (!f.allCategories) {
    p.set("categories", f.selectedCategories.length ? f.selectedCategories.join(",") : "none");
  }

  if (s.view !== "list") p.set("view", s.view);
  // Sort only means something in list view — the calendar grid is inherently
  // date-ordered. Omitting it keeps shared calendar links free of state that
  // would have no visible effect for the recipient.
  if (s.view === "list" && s.sort !== d.sort) p.set("sort", s.sort);
  if (s.view === "calendar") {
    if (s.calendarMode !== "week") p.set("cal", s.calendarMode);
    if (s.calendarDate) p.set("on", s.calendarDate);
  }

  return p.toString();
}

export function decodeViewState(
  search: string,
  d: Defaults
): { state: ViewState; hadParams: boolean } {
  const defaults = d.filters;
  const p = new URLSearchParams(search);
  const hadParams = [...p.keys()].length > 0;

  const cats = p.get("categories");
  let allCategories = defaults.allCategories;
  let selectedCategories: Category[] = defaults.selectedCategories;
  if (cats === "none") {
    allCategories = false;
    selectedCategories = [];
  } else if (cats) {
    const parsed = cats.split(",").filter(isCategory);
    // A categories= list that survives none of the validation means the link is
    // from an older taxonomy. Fall back to "all" rather than showing nothing.
    if (parsed.length) {
      allCategories = false;
      selectedCategories = parsed;
    }
  }

  return {
    hadParams,
    state: {
      filters: {
        ...defaults,
        from: isoDate(p.get("from")) ?? defaults.from,
        to: isoDate(p.get("to")) ?? defaults.to,
        search: p.get("q") ?? "",
        freeOnly: p.get("free") === "1",
        maxPrice: numberOrNull(p.get("maxPrice")),
        includeRecurring: bool(p.get("recurring"), defaults.includeRecurring),
        includeMonthly: bool(p.get("monthly"), defaults.includeMonthly),
        hideUninterested: bool(p.get("hideDown"), defaults.hideUninterested),
        maxDistance: bucket(p.get("dist")) ?? defaults.maxDistance,
        allCategories,
        selectedCategories,
      },
      view: p.get("view") === "calendar" ? "calendar" : "list",
      sort: p.get("sort") === "chrono" ? "chrono" : p.get("sort") === "match" ? "match" : d.sort,
      calendarMode: p.get("cal") === "month" ? "month" : "week",
      calendarDate: isoDate(p.get("on")),
    },
  };
}

function bool(v: string | null, fallback: boolean): boolean {
  if (v === "1") return true;
  if (v === "0") return false;
  return fallback;
}

function numberOrNull(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function bucket(v: string | null): DistanceBucket | null {
  return v && (BUCKET_ORDER as readonly string[]).includes(v) ? (v as DistanceBucket) : null;
}

/** Accept only YYYY-MM-DD that names a real date. */
function isoDate(v: string | null): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : v;
}
