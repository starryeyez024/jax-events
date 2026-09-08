// Date formatting shared by /sources and /diagnostics.

/** Whole days between an ISO timestamp and now. Negative = in the past. */
export function daysFromNow(iso: string): number {
  return Math.round((new Date(normalize(iso)).getTime() - Date.now()) / 86_400_000);
}

/**
 * SQLite's CURRENT_TIMESTAMP is 'YYYY-MM-DD HH:MM:SS' in UTC with no zone
 * marker, which Date() parses as *local* time and silently shifts by the
 * offset. Everything here goes through this first.
 */
function normalize(iso: string): string {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(iso) ? iso.replace(" ", "T") + "Z" : iso;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(normalize(iso)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(normalize(iso)).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "3 days ago" / "today" — the thing people actually want to know. */
export function relative(iso: string | null): string {
  if (!iso) return "never";
  const days = -daysFromNow(iso);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}
