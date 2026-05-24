// Save a tip — the user-reviewed event candidate gets upserted into the DB
// the same way scraped events do.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, upsertEvent } from "@/lib/db";
import { isCategory, type Category } from "@/lib/categories";

const Body = z.object({
  title: z.string().min(1),
  starts_at: z.string().min(1),
  ends_at: z.string().optional().nullable(),
  venue_name: z.string().optional().nullable(),
  venue_address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  price_min: z.number().optional().nullable(),
  price_max: z.number().optional().nullable(),
  categories: z.array(z.string()).min(1),
  is_recurring: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const cats = d.categories.filter(isCategory) as Category[];
  if (cats.length === 0) {
    return NextResponse.json(
      { error: "No valid categories supplied." },
      { status: 400 }
    );
  }

  const id = upsertEvent(getDb(), {
    source: "tip",
    title: d.title,
    description: d.description ?? null,
    url: d.url ?? null,
    starts_at: d.starts_at,
    ends_at: d.ends_at ?? null,
    venue_name: d.venue_name ?? null,
    venue_address: d.venue_address ?? null,
    city: d.city ?? null,
    price_min: d.price_min ?? null,
    price_max: d.price_max ?? null,
    is_recurring: d.is_recurring ?? false,
    categories: cats,
  });

  return NextResponse.json({ ok: true, id });
}
