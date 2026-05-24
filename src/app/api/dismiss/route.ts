import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";

// 'Not this time' — pure UI dismissal. No category/venue/source side effects.
// Distinct from 👎 (which moves category weights) and 🚗 (which penalizes
// source + venue). Persists across refreshes so dismissed events stay hidden.

const Body = z.object({
  event_id: z.string().min(1),
  dismissed: z.boolean(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { event_id, dismissed } = parsed.data;

  const db = getDb();
  db.prepare(
    `INSERT INTO dismissed (event_id, dismissed) VALUES (?, ?)
     ON CONFLICT(event_id) DO UPDATE SET dismissed=excluded.dismissed, dismissed_at=CURRENT_TIMESTAMP`
  ).run(event_id, dismissed ? 1 : 0);

  return NextResponse.json({ ok: true });
}
