import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const prefs = db.prepare("SELECT category, weight FROM preferences ORDER BY weight DESC").all();
  const venues = db
    .prepare("SELECT venue_name, bonus FROM venue_affinity ORDER BY bonus DESC")
    .all();
  return NextResponse.json({ prefs, venues });
}
