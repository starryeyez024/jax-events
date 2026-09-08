import { NextResponse } from "next/server";
import { getDb, getSourceStatuses } from "@/lib/db";

export const dynamic = "force-dynamic";

// Local/dev counterpart to the static public/sources.json that scripts/
// export-json.ts writes for the read-only deploy. Same shape, live data.
export async function GET() {
  return NextResponse.json({
    generated_at: new Date().toISOString(),
    sources: getSourceStatuses(getDb()),
  });
}
