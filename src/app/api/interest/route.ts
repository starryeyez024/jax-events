import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { applyInterest, applyTooFar } from "@/lib/scoring";

const Body = z.object({
  event_id: z.string().min(1),
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  too_far: z.boolean().optional(),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { event_id, value, too_far, note } = parsed.data;

  const db = getDb();
  db.prepare(
    `INSERT INTO interest (event_id, value, note) VALUES (?, ?, ?)
     ON CONFLICT(event_id) DO UPDATE SET value=excluded.value, note=excluded.note, updated_at=CURRENT_TIMESTAMP`
  ).run(event_id, value, note ?? (too_far ? "too far" : null));

  if (too_far) {
    // "Interesting but too far" — penalize the source/venue without touching
    // category weights. You still like the topic; you just don't want events
    // from this specific Meetup group or venue.
    applyTooFar(db, event_id);
  } else {
    applyInterest(db, event_id, value);
  }

  return NextResponse.json({ ok: true });
}
