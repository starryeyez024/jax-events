"use client";

import { useEffect, useState } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  type Category,
  isCategory,
} from "@/lib/categories";

type Candidate = {
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  url: string | null;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  categories: string[];
  is_recurring: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const EMPTY_CANDIDATE: Candidate = {
  title: "",
  starts_at: "",
  ends_at: null,
  venue_name: null,
  venue_address: null,
  city: null,
  url: null,
  description: null,
  price_min: null,
  price_max: null,
  categories: [],
  is_recurring: false,
};

export function TipModal({ open, onClose, onSaved }: Props) {
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [parseEnabled, setParseEnabled] = useState<boolean | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetch("/api/tip/parse")
      .then((r) => r.json())
      .then((j) => setParseEnabled(!!j.enabled))
      .catch(() => setParseEnabled(false));
  }, [open]);

  function reset() {
    setText("");
    setSourceUrl("");
    setCandidate(null);
    setError(null);
  }

  async function handleParse() {
    setParsing(true);
    setError(null);
    try {
      const res = await fetch("/api/tip/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          url: sourceUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Parse failed");
      setCandidate(json.candidate);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setParsing(false);
    }
  }

  function startManual() {
    setCandidate({
      ...EMPTY_CANDIDATE,
      url: sourceUrl || null,
      categories: ["experiential"],
    });
  }

  async function handleSave() {
    if (!candidate) return;
    if (!candidate.title || !candidate.starts_at) {
      setError("Title and start date/time are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: candidate.title,
          starts_at: candidate.starts_at,
          ends_at: candidate.ends_at,
          venue_name: candidate.venue_name,
          venue_address: candidate.venue_address,
          city: candidate.city,
          url: candidate.url,
          description: candidate.description,
          price_min: candidate.price_min,
          price_max: candidate.price_max,
          categories: candidate.categories.filter(isCategory),
          is_recurring: candidate.is_recurring,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      reset();
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Add a tip</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!candidate ? (
          <div className="p-4 space-y-3">
            <p className="text-sm text-slate-600">
              Saw something on Instagram, Facebook, an email, or a flyer? Paste the
              text or description here and {parseEnabled ? "Claude will extract" : "you'll fill in"} the
              details.
            </p>
            <label className="block">
              <span className="text-xs text-slate-600">Pasted text or description</span>
              <textarea
                className="w-full mt-1 px-3 py-2 border rounded text-sm font-mono"
                rows={8}
                placeholder="Paste an Instagram caption, an email forward, a flyer description, etc."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-600">Source URL (optional)</span>
              <input
                type="url"
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
                placeholder="https://instagram.com/p/..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </label>

            {parseEnabled === false && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                AI parsing is off (ANTHROPIC_API_KEY not set in <code>.env.local</code>).
                You can still fill the form manually below.
              </div>
            )}

            {error && <div className="text-sm text-rose-700 bg-rose-50 border rounded p-2">{error}</div>}

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={startManual}
                className="px-3 py-1.5 text-sm border rounded hover:bg-slate-50"
              >
                Skip — fill manually
              </button>
              <button
                onClick={handleParse}
                disabled={parsing || text.length < 3 || !parseEnabled}
                className="px-3 py-1.5 text-sm rounded bg-ocean-500 text-white hover:bg-ocean-600 disabled:opacity-50"
              >
                {parsing ? "Parsing…" : "Parse with AI"}
              </button>
            </div>
          </div>
        ) : (
          <CandidateForm
            value={candidate}
            onChange={setCandidate}
            error={error}
            saving={saving}
            onCancel={() => setCandidate(null)}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}

// ─── candidate review form ───

function CandidateForm({
  value,
  onChange,
  error,
  saving,
  onCancel,
  onSave,
}: {
  value: Candidate;
  onChange: (next: Candidate) => void;
  error: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  function up<K extends keyof Candidate>(key: K, v: Candidate[K]) {
    onChange({ ...value, [key]: v });
  }

  function toggleCat(c: Category) {
    const has = value.categories.includes(c);
    up(
      "categories",
      has ? value.categories.filter((x) => x !== c) : [...value.categories, c]
    );
  }

  // Convert ISO timestamps to/from <input type="datetime-local"> values.
  const startLocal = isoToLocal(value.starts_at);
  const endLocal = isoToLocal(value.ends_at);

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-slate-500">
        Review and edit, then save. Times are in your local timezone.
      </p>

      <label className="block">
        <span className="text-xs text-slate-600">Title *</span>
        <input
          className="w-full mt-1 px-3 py-2 border rounded text-sm"
          value={value.title}
          onChange={(e) => up("title", e.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-slate-600">Starts *</span>
          <input
            type="datetime-local"
            className="w-full mt-1 px-3 py-2 border rounded text-sm"
            value={startLocal}
            onChange={(e) => up("starts_at", localToIso(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-600">Ends</span>
          <input
            type="datetime-local"
            className="w-full mt-1 px-3 py-2 border rounded text-sm"
            value={endLocal}
            onChange={(e) =>
              up("ends_at", e.target.value ? localToIso(e.target.value) : null)
            }
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-slate-600">Venue name</span>
        <input
          className="w-full mt-1 px-3 py-2 border rounded text-sm"
          value={value.venue_name ?? ""}
          onChange={(e) => up("venue_name", e.target.value || null)}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-slate-600">Street address</span>
          <input
            className="w-full mt-1 px-3 py-2 border rounded text-sm"
            value={value.venue_address ?? ""}
            onChange={(e) => up("venue_address", e.target.value || null)}
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-600">City</span>
          <input
            className="w-full mt-1 px-3 py-2 border rounded text-sm"
            value={value.city ?? ""}
            onChange={(e) => up("city", e.target.value || null)}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-slate-600">URL</span>
        <input
          type="url"
          className="w-full mt-1 px-3 py-2 border rounded text-sm"
          value={value.url ?? ""}
          onChange={(e) => up("url", e.target.value || null)}
        />
      </label>

      <label className="block">
        <span className="text-xs text-slate-600">Description</span>
        <textarea
          rows={3}
          className="w-full mt-1 px-3 py-2 border rounded text-sm"
          value={value.description ?? ""}
          onChange={(e) => up("description", e.target.value || null)}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-slate-600">Price min ($)</span>
          <input
            type="number"
            min={0}
            step="any"
            className="w-full mt-1 px-3 py-2 border rounded text-sm"
            value={value.price_min ?? ""}
            onChange={(e) =>
              up("price_min", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-600">Price max ($)</span>
          <input
            type="number"
            min={0}
            step="any"
            className="w-full mt-1 px-3 py-2 border rounded text-sm"
            value={value.price_max ?? ""}
            onChange={(e) =>
              up("price_max", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </label>
      </div>

      <div>
        <div className="text-xs text-slate-600 mb-1">Categories</div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => {
            const active = value.categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCat(c)}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  active
                    ? "bg-ocean-500 text-white border-ocean-500"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span aria-hidden>{CATEGORY_ICONS[c]}</span> {CATEGORY_LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.is_recurring}
          onChange={(e) => up("is_recurring", e.target.checked)}
        />
        Ongoing / evergreen (no specific date)
      </label>

      {error && <div className="text-sm text-rose-700 bg-rose-50 border rounded p-2">{error}</div>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border rounded hover:bg-slate-50"
        >
          Back
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm rounded bg-ocean-500 text-white hover:bg-ocean-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add to my events"}
        </button>
      </div>
    </div>
  );
}

// `<input type="datetime-local">` uses `YYYY-MM-DDTHH:MM` in the user's
// local timezone with no offset. Convert to/from full ISO with offset for
// storage so it round-trips correctly through the API.
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function localToIso(local: string): string {
  // new Date(local) interprets the string as the user's local time, which is what
  // <datetime-local> means; toISOString() then normalizes to UTC for storage.
  return new Date(local).toISOString();
}
