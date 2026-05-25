// Event-type classification, distinct from category. Drives the leading emoji
// on every card so you can scan for "what KIND of thing is this" at a glance:
//
//   one-off    — a single dated event (festival, concert, specific workshop)
//   monthly    — has a real date but repeats on a cadence (first Friday,
//                third Thursday, monthly luncheon, weekly meetup)
//   evergreen  — no specific date/time (parks, ongoing exhibitions)
//
// Visual weight tiers per Doug's request: bright/colorful for one-off →
// subdued for evergreen.

export type EventType = "one-off" | "monthly" | "evergreen";

export type EventLike = {
  is_recurring: number;
  starts_at: string;
  ends_at: string | null;
  title: string;
  description: string | null;
};

const CADENCE = [
  /\bmonthly\b/i,
  /\bweekly\b/i,
  /\b(every|each)\s+(week|month|day|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  /\b(first|second|third|fourth|last|1st|2nd|3rd|4th)\s+(sun|mon|tue|wed|thu|fri|sat)/i,
  /\b1st\s+(and|&)\s+3rd\b/i,
  /\bevery other\b/i,
  /\brecurring\b/i,
  /\bbi[- ]?weekly\b/i,
  /\b\(tuesdays?\)\b/i,
  /\b\(thursdays?\)\b/i,
  /\b\(saturdays?\)\b/i,
  /\bevery month\b/i,
];

export function eventTypeFor(e: EventLike): EventType {
  // Long-running things flagged as recurring (multi-month exhibitions, parks,
  // ongoing programs) → evergreen, regardless of title.
  if (e.is_recurring) {
    if (!e.ends_at) return "evergreen";
    const days =
      (new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()) /
      (1000 * 60 * 60 * 24);
    return days > 14 ? "evergreen" : "monthly";
  }
  const blob = `${e.title} ${e.description ?? ""}`;
  if (CADENCE.some((re) => re.test(blob))) return "monthly";
  return "one-off";
}

// Glyph per type:
//   one-off  → bullet • (neutral — most events are one-offs, so this is the
//              "default" mark; was a 🎉 originally but turned into visual
//              noise in dense lists like the calendar day view)
//   monthly  → 🔁 (recurring cadence)
//   evergreen → 📍 (always-on / ongoing)
export const TYPE_ICONS: Record<EventType, string> = {
  "one-off": "•",
  monthly: "🔁",
  evergreen: "📍",
};

export const TYPE_LABELS: Record<EventType, string> = {
  "one-off": "One-off event",
  monthly: "Recurring (cadence)",
  evergreen: "Ongoing / evergreen",
};

// Visual opacity hint — pair with the emoji to reinforce the brightness tier.
// Applied as a Tailwind class on the wrapping span.
export const TYPE_OPACITY: Record<EventType, string> = {
  "one-off": "opacity-100",
  monthly: "opacity-80",
  evergreen: "opacity-50",
};

export function typeFor(e: EventLike): {
  type: EventType;
  icon: string;
  label: string;
  opacityClass: string;
} {
  const type = eventTypeFor(e);
  return {
    type,
    icon: TYPE_ICONS[type],
    label: TYPE_LABELS[type],
    opacityClass: TYPE_OPACITY[type],
  };
}
