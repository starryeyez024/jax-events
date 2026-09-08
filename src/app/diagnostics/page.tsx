"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { READ_ONLY } from "@/lib/config";
import type { SourceStatus } from "@/lib/sources";
import { formatDate, formatDateTime, relative } from "@/lib/format-dates";

/**
 * Scraper health. Deliberately NOT linked from anywhere in the UI — reachable
 * only by typing /diagnostics. The public-facing counterpart is /sources,
 * which shows sources and dates and nothing about scraper internals.
 *
 * A broken scraper is invisible in the events table: it just stops
 * contributing rows, which looks identical to "that venue has nothing on".
 * This page is the only place that distinction is visible.
 */
export default function DiagnosticsPage() {
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

  const broken = sources.filter((s) => s.last_status === "error");
  const ok = sources.filter((s) => s.last_status !== "error");

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <header className="mb-8">
        <Link
          href="/"
          className="text-[12.8px] font-medium text-slate-500 hover:text-slate-900 transition"
        >
          ← Back to events
        </Link>
        <h1 className="font-display font-bold text-2xl md:text-3xl tracking-tight text-slate-900 mt-4">
          Scraper diagnostics
        </h1>
        <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
          Internal. Outcome of the most recent run for every configured source.
          Not linked from the site — see{" "}
          <Link href="/sources" className="underline underline-offset-4">
            /sources
          </Link>{" "}
          for the public version.
        </p>
        {generatedAt && (
          <p className="text-xs text-slate-500 mt-2">
            Data generated {formatDateTime(generatedAt)} ({relative(generatedAt)}).
          </p>
        )}
      </header>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && broken.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display font-semibold text-slate-900 mb-1">
            Failing ({broken.length})
          </h2>
          <p className="text-sm text-slate-600 mb-3">
            These ran and errored. Anything they would have contributed is missing.
          </p>
          <div className="space-y-2">
            {broken.map((s) => (
              <div
                key={s.source}
                className="rounded-xl border border-rose-200 bg-rose-50/60 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <code className="font-mono text-[13px] font-semibold text-slate-900">
                    {s.source}
                  </code>
                  <span className="text-[12.8px] text-slate-500">
                    ran {relative(s.last_run_at)}
                  </span>
                </div>
                <p className="text-[12.8px] text-rose-700 mt-1 font-medium">
                  {s.last_error}
                </p>
                <p className="text-[12.8px] text-slate-500 mt-1">
                  {s.upcoming} stale event{s.upcoming === 1 ? "" : "s"} still in the app
                  {" · "}
                  {s.last_ok_at
                    ? `last succeeded ${relative(s.last_ok_at)}`
                    : "never succeeded since tracking began"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && ok.length > 0 && (
        <section>
          <h2 className="font-display font-semibold text-slate-900 mb-3">
            Healthy ({ok.length})
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/70 backdrop-blur">
            <table className="w-full text-[13px]">
              <thead className="text-left text-slate-500 border-b border-slate-200">
                <tr>
                  <Th>source</Th>
                  <Th>kind</Th>
                  <Th className="text-right">upcoming</Th>
                  <Th>last run</Th>
                  <Th>last success</Th>
                  <Th>published through</Th>
                </tr>
              </thead>
              <tbody>
                {ok.map((s) => (
                  <tr key={s.source} className="border-b border-slate-100 last:border-0">
                    <Td>
                      <code className="font-mono">{s.source}</code>
                    </Td>
                    <Td className="text-slate-500">{s.kind}</Td>
                    <Td className="text-right tabular-nums">{s.upcoming}</Td>
                    <Td className="text-slate-500">
                      {s.kind === "manual" ? "—" : relative(s.last_run_at)}
                    </Td>
                    <Td className="text-slate-500">
                      {s.kind === "manual" ? "—" : relative(s.last_ok_at)}
                    </Td>
                    <Td className="text-slate-500">{formatDate(s.covers_through)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && sources.length === 0 && (
        <p className="text-sm text-slate-500">
          No run data yet — run <code className="font-mono">npm run scrape</code>.
        </p>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
