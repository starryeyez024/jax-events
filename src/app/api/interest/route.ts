import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { applyInterest, applyTooFar, revertTooFar } from "@/lib/scoring";

const Body = z.object({
  event_id: z.string().min(1),
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  too_far: z.boolean().optional(),
  // Sent by the Undo toast: clears the interest flag AND reverses the
  // source/venue affinity penalties applied by the original 🚗 Too far click.
  revert_too_far: z.boolean().optional(),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { event_id, value, too_far, revert_too_far, note } = parsed.data;

  const db = getDb();
  db.prepare(
    `INSERT INTO interest (event_id, value, note) VALUES (?, ?, ?)
     ON CONFLICT(event_id) DO UPDATE SET value=excluded.value, note=excluded.note, updated_at=CURRENT_TIMESTAMP`
  ).run(event_id, value, note ?? (too_far ? "too far" : null));

  if (revert_too_far) {
    // Undo path for the 🚗 Too far click: reverse the source/venue penalties
    // applied by applyTooFar. Skip applyInterest so category weights aren't
    // touched (the original click didn't move them either).
    revertTooFar(db, event_id);
  } else if (too_far) {
    applyTooFar(db, event_id);
  } else {
    applyInterest(db, event_id, value);
  }

  return NextResponse.json({ ok: true });
}
