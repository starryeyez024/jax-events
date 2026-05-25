"use client";

import { useEffect, useState } from "react";
import {
  CATEGORY_LABELS,
  CATEGORY_PASTEL,
  PASTEL_CHIP_CARD_CLASSES,
} from "@/lib/categories";
import { BUCKET_LABELS } from "@/lib/distance";
import { typeFor } from "@/lib/event-type";
import { renderDescription } from "@/lib/render-text";
import { priceDisplayFor } from "@/lib/price-estimate";
import type { EventWithExtras } from "@/lib/db";

type Props = {
  event: EventWithExtras;
  onChange?: () => void;
  // Fires after a negative action (👎, 🚗, ⏭) so a global Undo toast can appear.
  // Each handler builds an undo callback that reverses its own side effects.
  onShowToast?: (message: string, onUndo: () => void | Promise<void>) => void;
};

export function EventCard({ event, onChange, onShowToast }: Props) {
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
    const prev = localInterest ?? 0;
    const next = value === localInterest ? 0 : value;
    setLocalInterest(next); // optimistic
    setBusy(true);
    await fetch("/api/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: event.id, value: next }),
    });
    setBusy(false);
    onChange?.();
    // Only surface an undo for the negative click (👎 → -1). Going back to
    // neutral via a second click on 👎 is itself an undo, no toast needed.
    if (next === -1 && onShowToast) {
      onShowToast(`Marked "${truncate(event.title, 40)}" as Not for me`, async () => {
        setLocalInterest(prev);
        await fetch("/api/interest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event_id: event.id, value: prev }),
        });
        onChange?.();
      });
    }
  }

  async function markTooFar() {
    const prev = localInterest ?? 0;
    setLocalInterest(-1);
    setBusy(true);
    await fetch("/api/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: event.id, value: -1, too_far: true }),
    });
    setBusy(false);
    onChange?.();
    onShowToast?.(
      `Marked "${truncate(event.title, 40)}" as Too far`,
      async () => {
        setLocalInterest(prev);
        // Reverse: clear the interest AND undo the source/venue affinity hit
        // that applyTooFar applied. revert_too_far is handled by the API.
        await fetch("/api/interest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event_id: event.id, value: prev, revert_too_far: true }),
        });
        onChange?.();
      }
    );
  }

  async function toggleDismissed() {
    const prev = localDismissed;
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
    if (next === 1 && onShowToast) {
      onShowToast(`Dismissed "${truncate(event.title, 40)}"`, async () => {
        setLocalDismissed(prev ?? 0);
        await fetch("/api/dismiss", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event_id: event.id, dismissed: false }),
        });
        onChange?.();
      });
    }
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

  // Visual treatment by interest state — subtle, no heavy rings. Modern
  // apps signal state through accent strokes + faded card rather than thick
  // colored borders.
  const cardAccent =
    localRegistered === 1
      ? "ring-1 ring-pastel-ink-lilac/40 bg-pastel-lilac/30"
      : localInterest === 1
      ? "ring-1 ring-pastel-ink-mint/40 bg-pastel-mint/30"
      : localInterest === -1 || localDismissed === 1
      ? "opacity-50"
      : localAttended === 1
      ? "ring-1 ring-ocean-300/40"
      : "";

  const matchTone =
    event.score >= 80
      ? "bg-pastel-mint text-pastel-ink-mint"
      : event.score >= 50
      ? "bg-pastel-sky text-pastel-ink-sky"
      : event.score >= 20
      ? "bg-sand-100 text-slate-600"
      : "bg-sand-50 text-slate-500";

  const bucketChip = {
    local: "bg-pastel-mint/60 text-pastel-ink-mint",
    nearby: "bg-pastel-sky/60 text-pastel-ink-sky",
    drive: "bg-pastel-butter/60 text-pastel-ink-butter",
    far: "bg-pastel-blush/60 text-pastel-ink-blush",
  }[event.distance_bucket];

  const addressLine = [event.venue_name, event.venue_address, event.city]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={`rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-sand-50/70 p-5 transition hover:border-slate-300 hover:-translate-y-px duration-150 ${cardAccent}`}>
      {localRegistered === 1 && (
        <div className="text-xs font-medium text-pastel-ink-lilac mb-2 flex items-center gap-1.5">
          <span>📅</span>
          <span>You&apos;re registered</span>
        </div>
      )}
      {localRegistered !== 1 && localInterest === 1 && (
        <div className="text-xs font-medium text-pastel-ink-mint mb-2 flex items-center gap-1.5">
          <span>✓</span>
          <span>Interested</span>
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
            <span className="text-slate-600">{dateStr}</span>
            {event.is_recurring ? (
              <span className="px-2 py-0.5 rounded-full bg-sand-100 text-slate-500 text-[11px]">
                Ongoing
              </span>
            ) : null}
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] ${bucketChip}`}
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
                className="px-2 py-0.5 rounded-full bg-sand-50 text-slate-500 text-[11px]"
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
          <h3 className="font-display font-bold text-xl tracking-tight mt-1.5 leading-snug">
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ocean-600 transition"
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
        <div className="text-right text-sm shrink-0 space-y-1.5">
          {price.text && (
            <div
              className={
                price.isEstimate
                  ? "font-normal italic text-slate-500"
                  : "font-display font-medium text-base text-slate-700"
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
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full inline-block ${matchTone}`}
            title="Match score (0–100+). Higher = better fit. Includes distance penalty."
          >
            {event.score}
          </div>
          {event.distance_penalty < 0 && (
            <div className="text-[10px] text-slate-400" title="Distance penalty applied">
              {event.distance_penalty} dist
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {event.categories.map((c) => {
          const pastel = CATEGORY_PASTEL[c] ?? "sage";
          return (
            <span
              key={c}
              className={`text-[11px] px-2.5 py-0.5 rounded-full border ${PASTEL_CHIP_CARD_CLASSES[pastel]}`}
            >
              {CATEGORY_LABELS[c]}
            </span>
          );
        })}
      </div>

      {event.description && (
        <div className="text-[12.8px] text-slate-700 mt-2 leading-relaxed">
          <div className={descExpanded ? "" : "line-clamp-3"}>
            {renderDescription(
              descExpanded
                ? event.description
                : truncateForPreview(event.description, 180)
            )}
          </div>
          {event.description.length > 180 && (
            <button
              onClick={() => setDescExpanded((s) => !s)}
              className="text-[11px] text-slate-500 hover:text-ocean-700 mt-1 underline"
            >
              {descExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-4 text-sm flex-wrap">
        <ActionBtn
          disabled={busy}
          active={localInterest === 1}
          activeClass="bg-pastel-mint text-pastel-ink-mint border-pastel-ink-mint/40"
          onClick={() => setInterest(1)}
        >
          👍 Interested
        </ActionBtn>
        <ActionBtn
          disabled={busy}
          active={localInterest === -1}
          activeClass="bg-slate-700 text-white border-slate-700"
          onClick={() => setInterest(-1)}
        >
          👎 Not for me
        </ActionBtn>
        <ActionBtn
          disabled={busy}
          active={false}
          onClick={markTooFar}
          title="Topic fits, but this venue/group is too far or too small for the drive. Penalizes the source heavily without touching your category interests."
        >
          🚗 Too far
        </ActionBtn>
        <ActionBtn
          disabled={busy}
          active={localDismissed === 1}
          activeClass="bg-slate-700 text-white border-slate-700"
          onClick={toggleDismissed}
          title="Hide this specific event without any learning effect. Doesn't shift category weights, venue affinity, or source affinity — purely a visual dismissal."
        >
          {localDismissed === 1 ? "⏭ Dismissed" : "⏭ Not this time"}
        </ActionBtn>
        <ActionBtn
          disabled={busy}
          active={localRegistered === 1}
          activeClass="bg-pastel-lilac text-pastel-ink-lilac border-pastel-ink-lilac/40"
          onClick={toggleRegistered}
          title="I signed up / bought a ticket. Registered events sync to your Google Calendar."
        >
          {localRegistered === 1 ? "📅 Registered" : "📅 Register"}
        </ActionBtn>
        <ActionBtn
          disabled={busy}
          active={localAttended === 1}
          activeClass="bg-pastel-sky text-pastel-ink-sky border-pastel-ink-sky/40"
          onClick={() => setShowAttendance((s) => !s)}
        >
          {localAttended === 1
            ? `✓ Went${localStars ? ` · ${localStars}/5` : ""}`
            : "✓ I went"}
        </ActionBtn>
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

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// Trim a description down to a preview length, prefer breaking at the last
// word boundary, and append a real "…" character. We append the ellipsis in
// content (rather than rely on `-webkit-line-clamp`'s built-in one) because
// the latter doesn't render reliably when the description contains <br>s
// or inline anchor tags — both of which our renderDescription emits.
function truncateForPreview(s: string, n: number): string {
  if (s.length <= n) return s;
  const slice = s.slice(0, n);
  const lastSpace = slice.lastIndexOf(" ");
  // Only break at the space if we don't lose too much (>30%) — otherwise
  // just hard-cut at n. Avoids "Roll up …" when text is dense.
  const cut = lastSpace > n * 0.7 ? lastSpace : n;
  return `${slice.slice(0, cut).trimEnd()}…`;
}

// Compact pill-shaped action button used in the EventCard footer row.
// Centralizes the active/inactive styling so each button stays consistent
// with the others (border, padding, transition).
function ActionBtn({
  active,
  activeClass = "bg-slate-700 text-white border-slate-700",
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean;
  activeClass?: string;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`px-3 py-1 rounded-full border text-xs font-medium transition ${
        active
          ? activeClass
          : "border-slate-200 text-slate-600 bg-white hover:border-slate-300 hover:text-slate-900"
      } disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
