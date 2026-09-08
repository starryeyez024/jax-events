// Telling "things you could go to" apart from "notices a calendar happens to
// carry". City calendars publish both through the same feed.
//
// Three classes, deliberately treated differently:
//
//   1. Not an event at all — "City Offices Closed for Holiday". There is
//      nothing to attend. Dropped at ingest.
//   2. Procedural government business — union negotiations, standing
//      committee and board meetings. Real, attendable, public, and of no
//      interest to almost anyone browsing for something to do. Kept, but
//      behind a filter that is off by default.
//   3. Civic events people actually want — public-input sessions, town
//      halls, community meetings. These LOOK like class 2 by keyword, so
//      they get an explicit carve-out. "Emerald Trail Community Meeting"
//      was hand-added to this app on purpose; a naive "Meeting" blocklist
//      would silently delete it.

/** Class 1: a notice, not an event. Nothing to attend. */
export function isNotAnEvent(title: string): boolean {
  const t = title.toLowerCase();
  return (
    /\boffices?\s+closed\b/.test(t) ||
    /\bclosed\s+for\b/.test(t) ||
    /\bholiday\s*[-–—:]\s*closed\b/.test(t) ||
    /\bno\s+(meeting|class|session|market)\b/.test(t) ||
    /\b(cancell?ed|postponed|rescheduled)\b/.test(t) ||
    /\bclosure\b/.test(t)
  );
}

// Class 3 wins over class 2 — checked first below.
const PUBLIC_INTEREST = [
  /\bpublic\s+(input|comment|hearing|forum|workshop|meeting)\b/,
  /\bcommunity\s+meeting\b/,
  /\btown\s+hall\b/,
  /\bopen\s+house\b/,
  /\bcharrette\b/,
  /\bvisioning\b/,
  /\bmaster\s+plan\b/,
  // A committee can host a genuine public programme; the body's name in the
  // title should not condemn the event it is running.
  /\bspeaker\s+series\b/,
  /\blecture\b/,
  /\bfestival\b/,
  /\bcelebration\b/,
];

const PROCEDURAL = [
  /\bcommittee\b/,
  /\bcommission\s+meeting\b/,
  /\bcity\s+council\b/,
  /\bboard\s+(meeting|of\s+adjustment)\b/,
  /\bnegotiation\b/,
  /\bexecutive\s+session\b/,
  /\bbudget\s+(workshop|hearing|session)\b/,
  /\bagenda\s+(review|session)\b/,
  /\bworkshop\s+session\b/,
  /\b\(cdb\)|\(arcc\)|\(esc\)\b/,
];

/** Class 2: procedural government business. */
export function isProceduralMeeting(title: string): boolean {
  const t = title.toLowerCase();
  if (PUBLIC_INTEREST.some((re) => re.test(t))) return false;
  return PROCEDURAL.some((re) => re.test(t));
}
