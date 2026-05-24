import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseTip, isParseEnabled } from "@/lib/parse-tip";

export const dynamic = "force-dynamic";

const Body = z.object({
  text: z.string().min(3),
  url: z.string().url().optional(),
});

export async function GET() {
  // Cheap probe so the UI can show "AI parse disabled" without trying.
  return NextResponse.json({ enabled: isParseEnabled() });
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const candidate = await parseTip(parsed.data.text, parsed.data.url);
    return NextResponse.json({ candidate });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
