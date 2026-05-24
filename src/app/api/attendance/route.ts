import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { applyStars } from "@/lib/scoring";

const Body = z.object({
  event_id: z.string().min(1),
  attended: z.boolean(),
  stars: z.number().int().min(1).max(5).optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { event_id, attended, stars, note, tags } = parsed.data;

  const db = getDb();
  db.prepare(
    `INSERT INTO attendance (event_id, attended, stars, note, tags) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(event_id) DO UPDATE SET attended=excluded.attended, stars=excluded.stars,
        note=excluded.note, tags=excluded.tags, visited_at=CURRENT_TIMESTAMP`
  ).run(event_id, attended ? 1 : 0, stars ?? null, note ?? null, tags ? JSON.stringify(tags) : null);

  if (attended && typeof stars === "number") {
    applyStars(db, event_id, stars as 1 | 2 | 3 | 4 | 5);
  }

  return NextResponse.json({ ok: true });
}
