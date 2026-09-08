"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Built lazily so the URL reflects state at click time, not render time. */
  getShareUrl: () => string;
  /** Hidden in read-only mode, where there is no registration to export. */
  showIcsExport: boolean;
};

/**
 * Single home for "get this out of the app": copy a link to the current view,
 * or take your registered events to a calendar app.
 *
 * These used to be three separate controls — a Share button and an Export
 * button in the header, plus a duplicate .ics link inside the calendar — which
 * read as three unrelated features rather than one idea.
 */
export function ShareMenu({ getShareUrl, showIcsExport }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "feed" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on outside click and Escape — a menu you can only close by
  // reselecting the trigger feels broken.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy(text: string, which: "link" | "feed") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard needs a secure context and permission, neither guaranteed.
      window.prompt("Copy this link:", text);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="px-4 py-2 text-[12.8px] font-medium rounded-full border border-slate-200 bg-white/70 backdrop-blur hover:bg-white hover:border-slate-300 transition"
        title="Copy a link to this view, or export to a calendar app"
      >
        🔗 Share <span aria-hidden className="ml-0.5 text-slate-400">▾</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-ring-strong"
        >
          <MenuItem
            onClick={() => copy(getShareUrl(), "link")}
            label={copied === "link" ? "✓ Link copied" : "Copy link to this view"}
            hint="Same dates, filters and layout as you're seeing now"
            active={copied === "link"}
          />

          {showIcsExport && (
            <>
              <div className="my-1 h-px bg-slate-100" />
              <MenuItem
                onClick={() => {
                  window.location.href = "/api/calendar.ics?status=registered";
                  setOpen(false);
                }}
                label="Download registered events (.ics)"
                hint="Opens in Apple Calendar, Outlook, or import to Google"
              />
              <MenuItem
                onClick={() =>
                  copy(
                    `${window.location.origin}/api/calendar.ics?status=registered`,
                    "feed"
                  )
                }
                label={copied === "feed" ? "✓ Feed URL copied" : "Copy calendar feed URL"}
                hint="Subscribe in Google Calendar so it stays in sync"
                active={copied === "feed"}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  label,
  hint,
  active,
}: {
  onClick: () => void;
  label: string;
  hint: string;
  active?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-xl transition ${
        active ? "bg-ocean-50 text-ocean-800" : "hover:bg-slate-50"
      }`}
    >
      <div className="text-[13px] font-medium text-slate-900">{label}</div>
      <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">{hint}</div>
    </button>
  );
}
