// Runtime UI mode flag.
//
// READ_ONLY hides every personalization / write control (per-event feedback
// buttons, attendance rating, "Add tip", "Refresh") so the app renders as a
// plain public list of events. The underlying handlers and API routes are
// left fully intact — this only gates the UI — so flipping the flag back to
// false restores the complete personalized experience with no code changes.
//
// Set NEXT_PUBLIC_READ_ONLY=1 in the environment (e.g. on Vercel) to enable
// public mode. Unset / anything else = full personalized mode (local dev).
export const READ_ONLY = process.env.NEXT_PUBLIC_READ_ONLY === "1";
