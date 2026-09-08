"use client";

import {
  CATEGORIES,
  CATEGORY_GROUPS,
  CATEGORY_LABELS,
  PASTEL_CHIP_SIDEBAR_INACTIVE,
  PASTEL_CHIP_ACTIVE_CLASSES,
  type Category,
} from "@/lib/categories";
import { BUCKET_LABELS, BUCKET_SHORT, BUCKET_ORDER, type DistanceBucket } from "@/lib/distance";
import { PRICE_BANDS, PRICE_BAND_LABELS, type PriceBand } from "@/lib/price-estimate";
import { READ_ONLY } from "@/lib/config";

export type FilterState = {
  search: string;
  selectedCategories: Category[];
  // True = "Select all" is on; ignore selectedCategories and show every event.
  // False + non-empty selectedCategories = filter to those categories.
  // False + empty selectedCategories = explicit "show no events".
  // This three-state model is the only way to distinguish "all" from "none"
  // when the user toggles Select all off without picking any chips.
  allCategories: boolean;
  /**
   * Which price bands to show. Multi-select rather than a slider: only 197
   * of 721 events have a real price, so a continuum implied precision the
   * data cannot support, and "unknown" — the largest group — has no place
   * on a monotonic axis.
   */
  priceBands: PriceBand[];
  includeRecurring: boolean;
  includeMonthly: boolean;
  /** Standing committee/commission business. Off by default. */
  includeProcedural: boolean;
  hideUninterested: boolean;
  maxDistance: DistanceBucket;
  from: string;
  to: string;
};

type Props = {
  value: FilterState;
  onChange: (next: FilterState) => void;
  collapsed: boolean;
  /** Toggles the panel. The trigger lives in this column and, crucially,
   *  stays at the same position in both states — see the header below. */
  onToggle: () => void;
  /** Shown on the rail so a narrowed list is still explained while hidden. */
  activeFilterCount: number;
};

export function Filters({
  value,
  onChange,
  collapsed,
  onToggle,
  activeFilterCount,
}: Props) {
  const allOn = value.allCategories;

  function toggleCat(c: Category) {
    if (allOn) {
      // Clicking a chip while "Select all" is on should just turn that one
      // chip OFF and leave every other chip selected — it's a single-toggle,
      // not a "reset to only this one" action.
      onChange({
        ...value,
        allCategories: false,
        selectedCategories: CATEGORIES.filter((x) => x !== c),
      });
      return;
    }
    const next = value.selectedCategories.includes(c)
      ? value.selectedCategories.filter((x) => x !== c)
      : [...value.selectedCategories, c];
    // If the user has manually re-added every category back, normalize to
    // "Select all" — visually and semantically identical, but keeps the
    // checkbox correctly checked.
    if (next.length === CATEGORIES.length) {
      onChange({ ...value, allCategories: true, selectedCategories: [] });
      return;
    }
    onChange({ ...value, selectedCategories: next });
  }

  function toggleAll(next: boolean) {
    // Either direction clears the explicit list. When on, it means "no filter";
    // when off, it means "show no events until the user picks some chips".
    onChange({ ...value, allCategories: next, selectedCategories: [] });
  }

  function toggleGroup(groupCats: readonly Category[]) {
    // From the user's perspective: clicking a group heading toggles every
    // chip in that group on or off. Whether we "select all" or "deselect all"
    // depends on whether every chip in the group is currently active.
    const currentlySelected = allOn
      ? new Set<Category>(CATEGORIES) // everything is on
      : new Set<Category>(value.selectedCategories);
    const allInGroupOn = groupCats.every((c) => currentlySelected.has(c));

    let next: Category[];
    if (allInGroupOn) {
      // Deselect the group — remove its chips from the active set.
      for (const c of groupCats) currentlySelected.delete(c);
      next = [...currentlySelected];
    } else {
      // Select the group — add every chip in the group to the active set.
      for (const c of groupCats) currentlySelected.add(c);
      next = [...currentlySelected];
    }

    // Normalize the same way toggleCat does: full set → allOn; otherwise
    // explicit subset.
    if (next.length === CATEGORIES.length) {
      onChange({ ...value, allCategories: true, selectedCategories: [] });
    } else {
      onChange({ ...value, allCategories: false, selectedCategories: next });
    }
  }

  return (
    <div
      className={`bg-white rounded-3xl border border-slate-200 space-y-5 p-5 ${
        collapsed ? "md:p-2" : ""
      }`}
    >
      {/* The trigger is anchored to the LEFT edge of the card, which is the
          one x-position that is identical whether the column is 300px or a
          52px rail. So it stays put across the toggle instead of vanishing
          and reappearing somewhere else. */}
      <div
        className={`flex items-center gap-2 ${
          collapsed ? "md:flex-col md:gap-3" : ""
        }`}
      >
        <button
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls="filter-body"
          className="relative shrink-0 w-9 h-9 grid place-items-center rounded-full border border-slate-200 bg-sand-50 hover:bg-white hover:border-slate-300 transition"
          title={collapsed ? "Show filters" : "Hide filters"}
        >
          <span
            aria-hidden
            className={`text-slate-600 leading-none transition-transform duration-300 motion-reduce:transition-none ${
              collapsed ? "" : "rotate-180"
            }`}
          >
            ❯
          </span>
          <span className="sr-only">{collapsed ? "Show filters" : "Hide filters"}</span>
          {collapsed && activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-ocean-600 text-white text-[10px] font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>
        {/* The label never goes away — only its orientation changes.
            Horizontal whenever there is width for it: always when open, and
            on mobile even when collapsed, where the panel is a full-width
            accordion rather than a rail. */}
        <h2
          className={`font-display text-lg font-semibold text-slate-900 tracking-tight ${
            collapsed ? "md:hidden" : ""
          }`}
        >
          Filters
        </h2>

        {/* Desktop rail only: turned on its side to use the vertical space a
            56px column has plenty of, so the rail still says what it is. */}
        {collapsed && (
          <h2
            aria-hidden
            className="hidden md:block [writing-mode:vertical-rl] rotate-180 font-display text-sm font-semibold uppercase tracking-[0.18em] text-slate-400 select-none"
          >
            Filters
          </h2>
        )}
      </div>
      <div id="filter-body" className={collapsed ? "hidden" : "space-y-5"}>

        <input
          className="w-full px-4 py-2 border border-slate-200 rounded-full text-sm bg-sand-50 focus:outline-none focus:bg-white focus:border-slate-300 transition placeholder:text-slate-400"
          placeholder="Search title or description…"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">From</span>
            <input
              type="date"
              className="border border-slate-200 rounded-xl px-3 py-1.5 bg-sand-50 focus:outline-none focus:bg-white focus:border-slate-300 transition"
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">To</span>
            <input
              type="date"
              className="border border-slate-200 rounded-xl px-3 py-1.5 bg-sand-50 focus:outline-none focus:bg-white focus:border-slate-300 transition"
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </label>
        </div>

        {/* These qualify the date range directly above — an evergreen listing
            has no single date, and a monthly series only touches the window
            once — so they belong with it rather than down beside price. */}
        <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs text-slate-700">
          <FilterCheckbox
            checked={value.includeRecurring}
            onChange={(b) => onChange({ ...value, includeRecurring: b })}
            label="Include 📍 evergreen"
          />
          <FilterCheckbox
            checked={value.includeMonthly}
            onChange={(b) => onChange({ ...value, includeMonthly: b })}
            label="Include 🔁 monthly"
          />
          <FilterCheckbox
            checked={value.includeProcedural}
            onChange={(b) => onChange({ ...value, includeProcedural: b })}
            label="Include 🏛 govt meetings"
          />
          {/* 👎 is a personalization signal; read-only builds cannot set one. */}
          {!READ_ONLY && (
            <FilterCheckbox
              checked={value.hideUninterested}
              onChange={(b) => onChange({ ...value, hideUninterested: b })}
              label="Hide 👎"
            />
          )}
        </div>

        {/* Distances are measured from one fixed origin, which means nothing
            to a visitor who could be anywhere in the city — the same reason
            the per-card drive time is local-only. And 720 of 721 upcoming
            events are Jax metro, so the control had almost nothing to do. */}
        {!READ_ONLY && (
          <div className="text-xs">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Driving radius</span>
              <span className="font-medium text-slate-700" title={BUCKET_LABELS[value.maxDistance]}>
                {BUCKET_SHORT[value.maxDistance]}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={BUCKET_ORDER.length - 1}
              step={1}
              value={BUCKET_ORDER.indexOf(value.maxDistance)}
              onChange={(e) =>
                onChange({ ...value, maxDistance: BUCKET_ORDER[Number(e.target.value)] })
              }
              className="w-full accent-slate-900"
              list="distance-buckets"
              aria-label="Maximum driving radius"
            />
            <datalist id="distance-buckets">
              {BUCKET_ORDER.map((_, i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
            <div className="flex justify-between mt-1 text-[10px] text-slate-400">
              {BUCKET_ORDER.map((b) => (
                <button
                  key={b}
                  onClick={() => onChange({ ...value, maxDistance: b })}
                  className={`px-1 hover:text-slate-700 transition ${
                    value.maxDistance === b ? "text-slate-900 font-medium" : ""
                  }`}
                  title={BUCKET_LABELS[b]}
                >
                  {BUCKET_SHORT[b]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Price</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRICE_BANDS.map((b) => {
              const on = value.priceBands.includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onChange({
                      ...value,
                      priceBands: on
                        ? value.priceBands.filter((x) => x !== b)
                        : [...value.priceBands, b],
                    })
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    on
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-sand-50 text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                  title={
                    b === "unknown"
                      ? "Most sources don't publish a price — these are events we simply don't know about"
                      : undefined
                  }
                >
                  {PRICE_BAND_LABELS[b]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="font-display text-base font-medium text-slate-900">
              Categories
            </div>
            <FilterCheckbox
              checked={allOn}
              onChange={(b) => toggleAll(b)}
              label="Select all"
            />
          </div>
          <div className="space-y-3">
            {CATEGORY_GROUPS.map((group) => (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.categories as readonly Category[])}
                  className="text-[10px] uppercase tracking-wider font-bold text-slate-500 hover:text-slate-900 mb-1.5 cursor-pointer block text-left transition"
                  title={`Toggle all ${group.label.toLowerCase()} chips`}
                >
                  {group.label}
                </button>
                <div className="flex flex-wrap gap-1.5">
                  {group.categories.map((c) => {
                    const active = allOn || value.selectedCategories.includes(c);
                    const cls = active
                      ? PASTEL_CHIP_ACTIVE_CLASSES[group.pastel]
                      : `${PASTEL_CHIP_SIDEBAR_INACTIVE[group.pastel]} opacity-60 hover:opacity-100`;
                    return (
                      <button
                        key={c}
                        onClick={() => toggleCat(c as Category)}
                        className={`text-[11px] px-2.5 py-0.5 rounded-full border border-transparent transition ${cls}`}
                      >
                        {CATEGORY_LABELS[c as Category]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom checkbox styled to feel modern — replaces the default browser
// checkbox (which never quite matches the rest of the UI).
function FilterCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span
        onClick={() => onChange(!checked)}
        className={`inline-flex items-center justify-center w-4 h-4 rounded border transition ${
          checked
            ? "bg-slate-900 border-slate-900 text-white"
            : "bg-white border-slate-300 hover:border-slate-500"
        }`}
      >
        {checked && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 12 12"
            className="w-3 h-3 fill-current"
            aria-hidden
          >
            <path d="M4.5 8.7 2.3 6.5l-.9.9 3.1 3.1L11.6 4 10.7 3z" />
          </svg>
        )}
      </span>
      <span onClick={() => onChange(!checked)}>{label}</span>
    </label>
  );
}
