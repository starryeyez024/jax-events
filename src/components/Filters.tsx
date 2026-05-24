"use client";

import { CATEGORIES, CATEGORY_GROUPS, CATEGORY_LABELS, type Category } from "@/lib/categories";
import { BUCKET_LABELS, BUCKET_ORDER, type DistanceBucket } from "@/lib/distance";

// Short, scannable labels for the slider tick row. The full description still
// lives in BUCKET_LABELS and is wired up as a tooltip on each tick.
const BUCKET_SHORT_LABEL: Record<DistanceBucket, string> = {
  local: "local",
  nearby: "nearby",
  drive: "~hr drive",
  far: "far",
};

export type FilterState = {
  search: string;
  selectedCategories: Category[];
  // True = "Select all" is on; ignore selectedCategories and show every event.
  // False + non-empty selectedCategories = filter to those categories.
  // False + empty selectedCategories = explicit "show no events".
  // This three-state model is the only way to distinguish "all" from "none"
  // when the user toggles Select all off without picking any chips.
  allCategories: boolean;
  freeOnly: boolean;
  maxPrice: number | null;
  includeRecurring: boolean;
  includeMonthly: boolean;
  hideUninterested: boolean;
  maxDistance: DistanceBucket;
  from: string;
  to: string;
};

type Props = {
  value: FilterState;
  onChange: (next: FilterState) => void;
  // Surfaces the current result count at the top of the panel. Lives here
  // (rather than as a sibling) so it sits inside the white card frame.
  count: number;
  loading: boolean;
};

export function Filters({ value, onChange, count, loading }: Props) {
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
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="text-lg font-bold text-slate-800">
        {loading ? "Loading…" : `${count} event${count === 1 ? "" : "s"}`}
      </div>

      <div>
        <input
          className="w-full px-3 py-2 border rounded text-sm"
          placeholder="Search title or description…"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">From</span>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">To</span>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </label>
      </div>

      <div className="text-xs">
        <div className="flex justify-between items-center mb-1">
          <span className="text-slate-600">Driving radius</span>
          <span className="font-medium text-ocean-700" title={BUCKET_LABELS[value.maxDistance]}>
            {BUCKET_SHORT_LABEL[value.maxDistance]}
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
          className="w-full accent-ocean-500"
          // Render notch ticks underneath via a datalist (browser-rendered hints).
          list="distance-buckets"
          aria-label="Maximum driving radius"
        />
        <datalist id="distance-buckets">
          {BUCKET_ORDER.map((_, i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
        <div className="flex justify-between mt-1 text-[10px] text-slate-500">
          {BUCKET_ORDER.map((b) => (
            <button
              key={b}
              onClick={() => onChange({ ...value, maxDistance: b })}
              className={`px-1 hover:text-ocean-700 ${
                value.maxDistance === b ? "text-ocean-700 font-medium" : ""
              }`}
              title={BUCKET_LABELS[b]}
            >
              {BUCKET_SHORT_LABEL[b]}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs">
        <div className="flex justify-between items-center mb-1">
          <span className="text-slate-600">Max price</span>
          <span className="font-medium">
            {value.maxPrice == null ? "Any" : `$${value.maxPrice}`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={200}
          step={5}
          className="w-full"
          value={value.maxPrice ?? 200}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ ...value, maxPrice: v >= 200 ? null : v });
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.freeOnly}
            onChange={(e) => onChange({ ...value, freeOnly: e.target.checked })}
          />
          Free only
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.hideUninterested}
            onChange={(e) => onChange({ ...value, hideUninterested: e.target.checked })}
          />
          Hide 👎
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.includeRecurring}
            onChange={(e) => onChange({ ...value, includeRecurring: e.target.checked })}
          />
          Include 📍 evergreen
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.includeMonthly}
            onChange={(e) => onChange({ ...value, includeMonthly: e.target.checked })}
          />
          Include 🔁 monthly
        </label>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-semibold text-slate-700">Categories</div>
          <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={allOn}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            Select all
          </label>
        </div>
        <div className="space-y-2">
          {CATEGORY_GROUPS.map((group) => (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.categories as readonly Category[])}
                className="text-[10px] uppercase tracking-wide font-bold text-slate-600 hover:text-ocean-700 mb-1 cursor-pointer block text-left"
                title={`Toggle all ${group.label.toLowerCase()} chips`}
              >
                {group.label}
              </button>
              <div className="flex flex-wrap gap-1">
                {group.categories.map((c) => {
                  // Chip is "active" (blue) when Select-all is on OR when it
                  // has been individually picked.
                  const active = allOn || value.selectedCategories.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggleCat(c as Category)}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        active
                          ? "bg-ocean-500 text-white border-ocean-500"
                          : "bg-white text-slate-700 hover:bg-slate-50"
                      }`}
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
  );
}
