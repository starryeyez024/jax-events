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
      className="fixed bottom-6 right-6 z-50 flex items-center gap-4 rounded-2xl border border-slate-300 bg-white/95 backdrop-blur-md text-slate-800 px-5 py-3 text-sm max-w-sm"
    >
      <span className="flex-1 min-w-0 truncate">{toast.message}</span>
      <button
        type="button"
        disabled={busy}
        onClick={handleUndo}
        className="font-semibold text-ocean-600 hover:text-ocean-700 transition disabled:opacity-50 underline-offset-2 hover:underline"
      >
        {busy ? "Undoing…" : "Undo"}
      </button>
    </div>
  );
}
