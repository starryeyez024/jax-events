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
import { PRICE_BANDS, type PriceBand } from "./price-estimate";
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
    priceBands: ["free", "paid", "unknown"],
    includeRecurring: true,
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
  // Only written when it differs from the default set; order-insensitive so
  // toggling a band off and back on doesn't churn the URL.
  if (!sameBands(f.priceBands, defaults.priceBands)) {
    p.set("price", f.priceBands.length ? [...f.priceBands].sort().join(",") : "none");
  }
  if (f.includeRecurring !== defaults.includeRecurring) p.set("recurring", f.includeRecurring ? "1" : "0");
  if (f.includeMonthly !== defaults.includeMonthly) p.set("monthly", f.includeMonthly ? "1" : "0");
  if (f.hideUninterested !== defaults.hideUninterested) p.set("hideDown", f.hideUninterested ? "1" : "0");
  if (f.maxDistance !== defaults.maxDistance) p.set("dist", f.maxDistance);

  // Three-state category model. The default is no longer "all" — it is
  // everything except Govt Meetings — so the comparison is against the
  // default rather than against allCategories, otherwise every page load
  // would write the whole category list into the URL. "all" and "none" need
  // explicit markers: both are states an empty categories= cannot express.
  const catsAtDefault =
    f.allCategories === defaults.allCategories &&
    sameList(f.selectedCategories, defaults.selectedCategories);
  if (!catsAtDefault) {
    p.set(
      "categories",
      f.allCategories
        ? "all"
        : f.selectedCategories.length
          ? [...f.selectedCategories].sort().join(",")
          : "none"
    );
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
  if (cats === "all") {
    allCategories = true;
    selectedCategories = [];
  } else if (cats === "none") {
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
        priceBands: decodeBands(p, defaults.priceBands),
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

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

function sameBands(a: PriceBand[], b: PriceBand[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

function decodeBands(p: URLSearchParams, fallback: PriceBand[]): PriceBand[] {
  const raw = p.get("price");
  // Legacy links: free=1 was the old "Free only" checkbox.
  if (raw == null) return p.get("free") === "1" ? ["free"] : fallback;
  if (raw === "none") return [];
  const parsed = raw.split(",").filter((x): x is PriceBand =>
    (PRICE_BANDS as string[]).includes(x)
  );
  return parsed.length ? parsed : fallback;
}

const LEGACY_BUCKETS: Record<string, DistanceBucket> = {
  local: "nearby",   // the old 4-bucket scale split Jax metro out as "local"
  drive: "far",      // and split 1-3hr from 3hr+; both are now "far"
};

function bucket(v: string | null): DistanceBucket | null {
  if (!v) return null;
  if ((BUCKET_ORDER as readonly string[]).includes(v)) return v as DistanceBucket;
  return LEGACY_BUCKETS[v] ?? null;
}

/** Accept only YYYY-MM-DD that names a real date. */
function isoDate(v: string | null): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : v;
}
