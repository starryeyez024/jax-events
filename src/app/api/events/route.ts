import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { queryEvents } from "@/lib/events-query";
import { isCategory, type Category } from "@/lib/categories";
import { PRICE_BANDS, type PriceBand } from "@/lib/price-estimate";
import { BUCKET_ORDER, type DistanceBucket } from "@/lib/distance";

export const dynamic = "force-dynamic";

function isPriceBand(s: string): s is PriceBand {
  return (PRICE_BANDS as string[]).includes(s);
}

function isBucket(s: string): s is DistanceBucket {
  return (BUCKET_ORDER as readonly string[]).includes(s);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const cats = sp.getAll("category").filter(isCategory) as Category[];
  const maxDist = sp.get("maxDistance");

  const events = queryEvents(getDb(), {
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    categories: cats.length ? cats : undefined,
    noCategories: sp.get("noCategories") === "1",
    priceBands: sp.getAll("price").filter(isPriceBand),
    includeRecurring: sp.get("includeRecurring") !== "0",
    includeMonthly: sp.get("includeMonthly") !== "0",
    hideUninterested: sp.get("hideUninterested") === "1",
    maxDistance: maxDist && isBucket(maxDist) ? maxDist : undefined,
    interestedOnly: sp.get("interestedOnly") === "1",
    registeredOnly: sp.get("registeredOnly") === "1",
    search: sp.get("q") ?? undefined,
  });

  return NextResponse.json({ events });
}
