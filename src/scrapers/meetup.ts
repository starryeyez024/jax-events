// Meetup groups — Meetup auto-publishes an iCal feed per group at
//   https://www.meetup.com/{group-slug}/events/ical/
// (no auth needed for public groups). Configure groups via MEETUP_GROUPS in .env.local:
//
//   MEETUP_GROUPS=jaxbookclub,jax-women-in-technology,jacksonville-florida-yoga
//
// Each group's events are fetched independently — one bad group doesn't kill the rest.

import type { EventInput } from "@/lib/db";
import type { Category } from "@/lib/categories";
import { fetchIcal, stringy } from "./lib/ical";

export async function fetchMeetup(): Promise<EventInput[]> {
  const raw = process.env.MEETUP_GROUPS ?? "";
  const groups = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (groups.length === 0) {
    throw new Error(
      "MEETUP_GROUPS not set — add comma-separated group slugs to .env.local"
    );
  }

  const results = await Promise.allSettled(
    groups.map((slug) =>
      fetchIcal({
        url: `https://www.meetup.com/${slug}/events/ical/`,
        source: `meetup:${slug}`,
        // Neutral fallback. The blanket-experiential default was inflating
        // scores for events that aren't actually participatory — bias toward
        // 'uncategorized' (weight 0) and let the explicit classifier earn it.
        defaultCategories: ["uncategorized"],
        classify: (e) => classifyMeetup(slug, e.summary, e.description),
        // Meetup's iCal doesn't ship LOCATION at all, so we infer city from the
        // group slug. Groups containing 'jax', 'jacksonville', or 'first coast'
        // are assumed to be Jax-based; everything else leaves city null and
        // relies on the title-haystack scan to catch Orlando/Tampa/Miami/etc.
        city: inferCityFromSlug(slug),
      })
    )
  );

  const out: EventInput[] = [];
  const errors: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") out.push(...r.value);
    else errors.push(`${groups[i]}: ${(r.reason as Error).message}`);
  }
  if (errors.length && out.length === 0) {
    throw new Error(errors.join("; "));
  }
  // Surface partial failures in console but don't fail the whole call.
  if (errors.length) console.warn("[meetup] partial failures:", errors.join("; "));
  return out;
}

function inferCityFromSlug(slug: string): string | undefined {
  const s = slug.toLowerCase();
  if (/jax|jacksonville|first[- ]coast/.test(s)) return "Jacksonville";
  return undefined;
}

function classifyMeetup(
  slug: string,
  summary: unknown,
  description: unknown
): Category[] {
  const blob = `${slug} ${stringy(summary)} ${stringy(description)}`.toLowerCase();
  const cats = new Set<Category>();

  // Group-slug hints
  if (/swing|lindy|blues|partner.?dance/.test(slug)) cats.add("swing-dance");
  if (/latin|salsa|bachata|tango/.test(slug)) cats.add("dance-other");
  if (/philosophy|socratic|wisdom|stoic|freethought/.test(slug)) {
    cats.add("philosophy");
    cats.add("intellectual-discussion");
  }
  if (/node|ai|tech|developer|dug|women.?in.?tech/.test(slug)) {
    cats.add("tech-ai-design");
    cats.add("intellectual-discussion");
  }
  if (/yoga|meditation|wellness|isha|sahaja/.test(slug)) {
    cats.add("yoga");
    cats.add("health-wellness");
  }
  if (/kayak|paddle|sup/.test(slug)) cats.add("kayaking");
  if (/snorkel|dive|scuba/.test(slug)) cats.add("snorkeling");
  if (/sail|boat/.test(slug)) cats.add("boat-ride");
  if (/bike|cycl/.test(slug)) cats.add("cycling");
  if (/book.?club|read/.test(slug)) cats.add("intellectual-discussion");

  // Content hints
  if (/swing dance|lindy hop|west coast swing/.test(blob)) cats.add("swing-dance");
  if (/sound bath|crystal bowl|gong/.test(blob)) cats.add("sound-bath");
  if (/maker|3d print|laser/.test(blob)) cats.add("maker-space");
  if (/kayak|paddle/.test(blob)) cats.add("kayaking");
  if (/snorkel|dive|reef/.test(blob)) cats.add("snorkeling");
  if (/sail|boat ride|harbor cruise/.test(blob)) cats.add("boat-ride");

  // Only mark as experiential when an explicit signal in the slug or content
  // says so. Blanket-tagging every meetup was double-counting on top of the
  // event's actual interests (philosophy book clubs, virtual AI panels, etc.
  // are not "experiential" in the maker/hands-on sense).
  if (/maker|3d print|laser|pottery|ceramics|hands.?on/.test(blob)) {
    cats.add("experiential");
  }
  return Array.from(cats);
}
