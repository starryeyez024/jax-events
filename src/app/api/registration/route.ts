import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";

const Body = z.object({
  event_id: z.string().min(1),
  registered: z.boolean(),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { event_id, registered, note } = parsed.data;

  const db = getDb();
  db.prepare(
    `INSERT INTO registration (event_id, registered, note) VALUES (?, ?, ?)
     ON CONFLICT(event_id) DO UPDATE SET registered=excluded.registered,
        note=excluded.note, registered_at=CURRENT_TIMESTAMP`
  ).run(event_id, registered ? 1 : 0, note ?? null);

  return NextResponse.json({ ok: true });
}
