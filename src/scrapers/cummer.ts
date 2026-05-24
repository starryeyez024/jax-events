// Cummer Museum — uses the Tribe Events iCal feed.
// Source: https://www.cummermuseum.org/events/?ical=1

import type { EventInput } from "@/lib/db";
import type { Category } from "@/lib/categories";
import { fetchIcal, stringy } from "./lib/ical";

export async function fetchCummer(): Promise<EventInput[]> {
  return fetchIcal({
    url: "https://www.cummermuseum.org/events/?ical=1",
    source: "cummer",
    venueName: "Cummer Museum of Art & Gardens",
    city: "Jacksonville",
    // The default is "art-exhibition" only — a generic Cummer event without
    // any classifier match (most often a passive viewing) shouldn't earn the
    // experiential bonus. Workshops and art classes still get it via the
    // explicit triggers below.
    defaultCategories: ["art-exhibition"],
    classify: (e) => {
      const blob = `${stringy(e.summary)} ${stringy(e.description)}`.toLowerCase();
      const cats = new Set<Category>();
      if (/exhibition|gallery|on view/.test(blob)) cats.add("art-exhibition");
      if (/garden|propagation|horticulture|plant/.test(blob)) {
        cats.add("outdoor-nature");
        cats.add("maker-space");
      }
      if (/lecture|talk|conversation|panel/.test(blob)) {
        cats.add("intellectual-discussion");
        cats.add("learning-workshop");
      }
      if (/workshop|class|hands[- ]on/.test(blob)) {
        cats.add("learning-workshop");
        cats.add("maker-space");
        cats.add("experiential");
      }
      if (/draw|paint|portrait|sketch|sculpt|pottery|ceramics|print/.test(blob)) {
        cats.add("art-class");
        cats.add("experiential");
      }
      if (/kids|family|children/.test(blob)) cats.add("kids-family");
      if (/jazz|swing/.test(blob)) cats.add("music-swing-jazz");
      // No blanket experiential — passive lectures and curator talks at Cummer
      // were getting the +15 bonus undeservedly. The workshop/class/hands-on
      // and draw/paint/sculpt branches above still add experiential when
      // there's a real hands-on signal in the title or description.
      return Array.from(cats);
    },
  });
}
