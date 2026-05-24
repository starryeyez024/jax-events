"use client";

import { useEffect, useState } from "react";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/lib/categories";
import { BUCKET_LABELS } from "@/lib/distance";
import { typeFor } from "@/lib/event-type";
import { renderDescription } from "@/lib/render-text";
import { priceDisplayFor } from "@/lib/price-estimate";
import type { EventWithExtras } from "@/lib/db";

type Props = {
  event: EventWithExtras;
  onChange?: () => void;
};

export function EventCard({ event, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  // Optimistic local state — we mutate the visible state instantly when you
  // click a feedback button, then refresh the list in the background. This
  // prevents the list from reshuffling and your scroll from jumping while
  // also giving you immediate visual confirmation.
  const [localInterest, setLocalInterest] = useState<number | null>(event.interest);
  const [localAttended, setLocalAttended] = useState<number | null>(event.attended);
  const [localStars, setLocalStars] = useState<number | null>(event.stars);
  const [localRegistered, setLocalRegistered] = useState<number | null>(event.registered);
  const [localDismissed, setLocalDismissed] = useState<number | null>(event.dismissed);

  // If the server data changes (refresh, filter change), sync local state.
  useEffect(() => {
    setLocalInterest(event.interest);
    setLocalAttended(event.attended);
    setLocalStars(event.stars);
    setLocalRegistered(event.registered);
    setLocalDismissed(event.dismissed);
  }, [event.id, event.interest, event.attended, event.stars, event.registered, event.dismissed]);

  const dateStr = formatEventDateLabel(event);

  const price = priceDisplayFor(event);

  async function setInterest(value: -1 | 0 | 1) {
    setLocalInterest(value === localInterest ? 0 : value); // optimistic
    setBusy(true);
    await fetch("/api/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: event.id, value: value === localInterest ? 0 : value }),
    });
    setBusy(false);
    onChange?.();
  }

  async function markTooFar() {
    setLocalInterest(-1);
    setBusy(true);
    await fetch("/api/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: event.id, value: -1, too_far: true }),
    });
    setBusy(false);
    onChange?.();
  }

  async function toggleDismissed() {
    const next = localDismissed === 1 ? 0 : 1;
    setLocalDismissed(next);
    setBusy(true);
    await fetch("/api/dismiss", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: event.id, dismissed: next === 1 }),
    });
    setBusy(false);
    onChange?.();
  }

  async function toggleRegistered() {
    const next = localRegistered === 1 ? 0 : 1;
    setLocalRegistered(next);
    setBusy(true);
    await fetch("/api/registration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: event.id, registered: next === 1 }),
    });
    setBusy(false);
    onChange?.();
  }

  async function setAttended(stars: 1 | 2 | 3 | 4 | 5) {
    setLocalAttended(1);
    setLocalStars(stars);
    setBusy(true);
    await fetch("/api/attendance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: event.id, attended: true, stars }),
    });
    setBusy(false);
    setShowAttendance(false);
    onChange?.();
  }

  // Visual treatment by interest state — distinct enough that you can scan a
  // long list and see at a glance what you've already rated.
  const cardBorder =
    localRegistered === 1
      ? "border-violet-500 ring-2 ring-violet-200"
      : localInterest === 1
      ? "border-emerald-500 ring-2 ring-emerald-200"
      : localInterest === -1 || localDismissed === 1
      ? "border-slate-300 opacity-50"
      : localAttended === 1
      ? "border-ocean-500"
      : "border-slate-200";

  const matchTone =
    event.score >= 80
      ? "bg-emerald-100 text-emerald-800"
      : event.score >= 50
      ? "bg-ocean-100 text-ocean-800"
      : event.score >= 20
      ? "bg-slate-100 text-slate-700"
      : "bg-slate-50 text-slate-500";

  const bucketChip = {
    local: "bg-emerald-50 text-emerald-700",
    nearby: "bg-sky-50 text-sky-700",
    drive: "bg-amber-50 text-amber-800",
    far: "bg-rose-50 text-rose-700",
  }[event.distance_bucket];

  const addressLine = [event.venue_name, event.venue_address, event.city]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={`rounded-lg border-2 bg-white p-4 shadow-sm hover:shadow transition ${cardBorder}`}>
      {localRegistered === 1 && (
        <div className="text-xs font-medium text-violet-700 mb-1 flex items-center gap-1">
          <span>📅</span>
          <span>You're registered for this</span>
        </div>
      )}
      {localRegistered !== 1 && localInterest === 1 && (
        <div className="text-xs font-medium text-emerald-700 mb-1 flex items-center gap-1">
          <span>✓</span>
          <span>You marked this Interested</span>
        </div>
      )}

      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
            {(() => {
              const t = typeFor(event);
              return (
                <span
                  className={`text-base leading-none ${t.opacityClass}`}
                  aria-label={t.label}
                  title={t.label}
                >
                  {t.icon}
                </span>
              );
            })()}
            <span>{dateStr}</span>
            {event.is_recurring ? (
              <span
                className="px-1.5 py-0.5 rounded bg-sand-100"
                style={{ color: "#97896d" }}
              >
                Ongoing
              </span>
            ) : null}
            <span
              className={`px-1.5 py-0.5 rounded ${bucketChip}`}
              title={BUCKET_LABELS[event.distance_bucket]}
            >
              {event.distance_bucket === "local"
                ? "Local"
                : event.distance_bucket === "nearby"
                ? "Nearby"
                : event.distance_bucket === "drive"
                ? "Drive"
                : "Far"}
              {event.city ? ` · ${event.city}` : ""}
            </span>
            {event.drive_miles != null && (
              <span
                className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-600"
                title={
                  event.drive_precise
                    ? "Estimated driving distance from 915 8th Ave S, Jax Beach"
                    : "Approximate — city-center used because the venue has no exact coordinates"
                }
              >
                {event.drive_precise ? "" : "~"}
                {event.drive_miles} mi · ~{event.drive_minutes} min
              </span>
            )}
          </div>
          <h3 className="font-semibold text-base mt-0.5">
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {event.title}
              </a>
            ) : (
              event.title
            )}
          </h3>
          {addressLine && (
            <div className="text-xs text-slate-500 mt-0.5">
              {event.map_link ? (
                <a
                  href={event.map_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline hover:text-ocean-700"
                  title="Open in Google Maps"
                >
                  📍 {addressLine}
                </a>
              ) : (
                <>📍 {addressLine}</>
              )}
              {event.directions_link && (
                <>
                  {" · "}
                  <a
                    href={event.directions_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline hover:text-ocean-700"
                  >
                    Directions
                  </a>
                </>
              )}
            </div>
          )}
        </div>
        <div className="text-right text-sm shrink-0 space-y-1">
          {price.text && (
            <div
              className={
                price.isEstimate
                  ? "font-normal italic text-slate-500"
                  : "font-medium"
              }
              title={
                price.isEstimate
                  ? "Estimated price — actual ticket cost may vary. Click the event link for exact pricing."
                  : undefined
              }
            >
              {price.text}
            </div>
          )}
          <div
            className={`text-xs px-1.5 py-0.5 rounded ${matchTone}`}
            title="Match score (0–100+). Higher = better fit. Includes distance penalty."
          >
            Match {event.score}
          </div>
          {event.distance_penalty < 0 && (
            <div className="text-[10px] text-slate-500" title="Distance penalty applied">
              {event.distance_penalty} dist
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {event.categories.map((c) => (
          <span
            key={c}
            className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700"
          >
            <span aria-hidden>{CATEGORY_ICONS[c]}</span> {CATEGORY_LABELS[c]}
          </span>
        ))}
      </div>

      {event.description && (
        <div className="text-sm text-slate-700 mt-2">
          <div className={descExpanded ? "" : "line-clamp-3"}>
            {renderDescription(event.description)}
          </div>
          {event.description.length > 180 && (
            <button
              onClick={() => setDescExpanded((s) => !s)}
              className="text-xs text-slate-500 hover:text-ocean-700 mt-1 underline"
            >
              {descExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 text-sm flex-wrap">
        <button
          disabled={busy}
          onClick={() => setInterest(1)}
          className={`px-2 py-1 rounded border ${
            localInterest === 1
              ? "bg-emerald-600 text-white border-emerald-600"
              : "hover:bg-slate-50"
          }`}
        >
          👍 Interested
        </button>
        <button
          disabled={busy}
          onClick={() => setInterest(-1)}
          className={`px-2 py-1 rounded border ${
            localInterest === -1 ? "bg-slate-700 text-white border-slate-700" : "hover:bg-slate-50"
          }`}
        >
          👎 Not for me
        </button>
        <button
          disabled={busy}
          onClick={markTooFar}
          className="px-2 py-1 rounded border hover:bg-slate-50"
          title="Topic fits, but this venue/group is too far or too small for the drive. Penalizes the source heavily without touching your category interests."
        >
          🚗 Too far for this
        </button>
        <button
          disabled={busy}
          onClick={toggleDismissed}
          className={`px-2 py-1 rounded border ${
            localDismissed === 1
              ? "bg-slate-700 text-white border-slate-700"
              : "hover:bg-slate-50"
          }`}
          title="Hide this specific event without any learning effect. Doesn't shift category weights, venue affinity, or source affinity — purely a visual dismissal."
        >
          {localDismissed === 1 ? "⏭ Dismissed" : "⏭ Not this time"}
        </button>
        <button
          disabled={busy}
          onClick={toggleRegistered}
          className={`px-2 py-1 rounded border ${
            localRegistered === 1
              ? "bg-violet-600 text-white border-violet-600"
              : "hover:bg-slate-50"
          }`}
          title="I signed up / bought a ticket. Registered events sync to your Google Calendar."
        >
          {localRegistered === 1 ? "📅 Registered" : "📅 Register"}
        </button>
        <button
          disabled={busy}
          onClick={() => setShowAttendance((s) => !s)}
          className={`px-2 py-1 rounded border ${
            localAttended === 1 ? "bg-ocean-100 border-ocean-500" : "hover:bg-slate-50"
          }`}
        >
          {localAttended === 1
            ? `✓ Went${localStars ? ` · rated ${localStars}/5` : ""}`
            : "✓ I went to this"}
        </button>
      </div>

      {showAttendance && (
        <div className="mt-2">
          <div className="text-xs text-slate-500 mb-1">
            How was it? (1 = bad, 5 = loved it — this teaches the system what you actually enjoy)
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                disabled={busy}
                onClick={() => setAttended(n as 1 | 2 | 3 | 4 | 5)}
                className="text-lg hover:scale-110 transition px-1"
                title={`${n} of 5`}
              >
                {"★".repeat(n)}{"☆".repeat(5 - n)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// What date label belongs at the top of an event card?
//
//   one-off → full date + time          ("Tue, May 27, 6:00 PM")
//   evergreen with ends_at → end date   ("Through Aug 23")
//   evergreen with no ends_at → blank   (the 📍 Ongoing badge says it all)
//
// Showing the start date for a months-long exhibition is misleading — the
// opening day isn't what the user cares about, when they can visit is.
function formatEventDateLabel(event: EventWithExtras): string {
  if (event.is_recurring) {
    if (event.ends_at) {
      return `Through ${new Date(event.ends_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
      })}`;
    }
    return ""; // the "Ongoing" badge carries the meaning
  }
  return new Date(event.starts_at).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
