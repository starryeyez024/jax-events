"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { READ_ONLY } from "@/lib/config";
import type { SourceStatus } from "@/lib/sources";
import { formatDate, relative, daysFromNow } from "@/lib/format-dates";

/**
 * Public "where this comes from" page.
 *
 * Deliberately shows only sources and dates — no scraper health, error text,
 * or run status. Those live on /diagnostics, which is intentionally not
 * linked from anywhere in the UI.
 */
export default function SourcesPage() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = READ_ONLY ? "/sources.json" : "/api/sources";
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        setSources(j.sources ?? []);
        setGeneratedAt(j.generated_at ?? null);
      })
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, []);

  // A source contributing nothing right now isn't a source from the reader's
  // point of view — it's an implementation detail. Those show on /diagnostics.
  const listed = sources
    .filter((s) => s.upcoming > 0)
    .sort((a, b) => b.upcoming - a.upcoming);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <header className="mb-8">
        <Link
          href="/"
          className="text-[12.8px] font-medium text-slate-500 hover:text-slate-900 transition"
        >
          ← Back to events
        </Link>
        <h1 className="font-title text-3xl md:text-4xl tracking-tight text-slate-900 leading-none mt-4">
          Where this comes from
        </h1>
        <p className="text-sm text-slate-600 mt-3 max-w-2xl leading-relaxed">
          Every event here is pulled from a public calendar somewhere else. This page
          lists each one, when it was last updated, and how far ahead it has published
          — so you can judge for yourself whether a quiet week is really quiet.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-5">
        <h2 className="font-display font-semibold text-slate-900 text-sm mb-2">
          The short version
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Coverage is not uniform across time. Big venues publish months ahead; city
          parks, breweries and neighborhood markets publish a rolling three or four
          weeks and no further. So the next month is close to complete, and anything
          past roughly two months out is major venues only — not because nothing is
          happening, but because nobody has posted it yet.
        </p>
      </section>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && listed.length > 0 && (
        <ul className="space-y-3">
          {listed.map((s) => (
            <SourceRow key={s.source} s={s} />
          ))}
        </ul>
      )}

      {!loading && listed.length === 0 && (
        <p className="text-sm text-slate-500">No sources to show yet.</p>
      )}

      {generatedAt && (
        <p className="text-xs text-slate-500 mt-8">
          This page was generated {formatDate(generatedAt)} ({relative(generatedAt)}).
        </p>
      )}
    </div>
  );
}

function SourceRow({ s }: { s: SourceStatus }) {
  const daysOut = s.covers_through ? daysFromNow(s.covers_through) : null;

  return (
    <li className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display font-semibold text-slate-900">
          {s.url ? (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ocean-600 underline decoration-slate-300 underline-offset-4 transition"
            >
              {s.label} ↗
            </a>
          ) : (
            s.label
          )}
        </h3>
        <span className="text-[12.8px] text-slate-500">
          {s.kind === "manual"
            ? "entered by hand"
            : s.last_updated
              ? `updated ${relative(s.last_updated)}`
              : null}
        </span>
      </div>

      <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{s.covers}</p>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Pill>
          {s.upcoming} upcoming event{s.upcoming === 1 ? "" : "s"}
        </Pill>
        {s.covers_through && (
          <Pill>
            published through {formatDate(s.covers_through)}
            {daysOut != null && daysOut >= 0 ? ` · ${daysOut} days out` : ""}
          </Pill>
        )}
      </div>
    </li>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-3 py-1 rounded-full text-[12.8px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
      {children}
    </span>
  );
}
