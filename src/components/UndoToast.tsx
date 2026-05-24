"use client";

import { useEffect, useState } from "react";

export type ToastState = {
  // The message displayed on the left side, e.g. "Marked 'Yoga in the Park' as Not for me".
  message: string;
  // Called when the user clicks Undo. Should fully reverse the original action.
  onUndo: () => void | Promise<void>;
  // Stamp used to reset the auto-dismiss timer when a new toast appears for
  // the same component instance.
  id: number;
} | null;

type Props = {
  toast: ToastState;
  onDismiss: () => void;
  // Auto-dismiss delay in ms. Defaults to 5000 per spec.
  durationMs?: number;
};

export function UndoToast({ toast, onDismiss, durationMs = 5000 }: Props) {
  const [busy, setBusy] = useState(false);

  // Reset the dismiss timer whenever a new toast.id arrives.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [toast?.id, onDismiss, durationMs]);

  if (!toast) return null;

  async function handleUndo() {
    if (!toast) return;
    setBusy(true);
    try {
      await toast.onUndo();
    } finally {
      setBusy(false);
      onDismiss();
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 text-white shadow-lg px-4 py-2.5 text-sm max-w-sm animate-in fade-in slide-in-from-bottom-2"
    >
      <span className="flex-1 min-w-0 truncate">{toast.message}</span>
      <button
        type="button"
        disabled={busy}
        onClick={handleUndo}
        className="font-semibold text-ocean-300 hover:text-white disabled:opacity-50"
      >
        {busy ? "Undoing…" : "Undo"}
      </button>
    </div>
  );
}
