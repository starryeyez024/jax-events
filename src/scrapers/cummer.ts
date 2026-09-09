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
      // Activity signals are read from the TITLE, not the description.
      // A museum description says what the art is ABOUT — "landscape
      // paintings", "guest curated by ... students in Dr. Fowler's class",
      // "gift of Mr. and Mrs. Faure ... from family, friends and patrons" —
      // and matching activity words against that made a passive exhibition
      // register as an art class, a workshop, a maker space and family
      // programming all at once. What you will DO is in the title.
      const title = stringy(e.summary).toLowerCase();

      // Credit and acquisition blocks are pure noise for classification:
      // they are full of names, media and donor language.
      const desc = stringy(e.description)
        .toLowerCase()
        .split(/image credit:|photo credit:|acquired in memory of/)[0];

      const cats = new Set<Category>();
      const inTitle = (re: RegExp) => re.test(title);

      // Does the title say this is a THING TO DO rather than art to look at?
      const isActivity = inTitle(
        /\b(workshop|class|hands[- ]on|studio|make|making|craft|demo|tour|storytime|lecture|talk|conversation|panel|symposium)\b/
      );

      // Exhibition: from the title, or from the description only when the
      // title does not already say this is an activity. Nearly every Cummer
      // description mentions "exhibition" somewhere, so unguarded it labelled
      // flower-arranging workshops as exhibitions too.
      if (inTitle(/\b(exhibition|on view|gallery)\b/) || (!isActivity && /\bexhibition\b/.test(desc))) {
        cats.add("art-exhibition");
      }

      // Hands-on making. "Studio", "make", "craft" and friends have to be in
      // the title; a description mentioning someone else's class does not
      // make this event a class.
      if (inTitle(/\b(workshop|class|hands[- ]on|studio|make|making|craft|demo)\b/)) {
        cats.add("learning-workshop");
        cats.add("maker-space");
        cats.add("experiential");
      }

      // A medium named in the title implies doing it; named in a description
      // it usually just describes the works on the wall.
      if (
        inTitle(
          /\b(draw|drawing|paint|painting|sketch|sculpt|pottery|ceramics|printmaking|watercolor|collage|ikebana)\b/
        )
      ) {
        cats.add("art-class");
        cats.add("experiential");
      }

      if (inTitle(/\b(lecture|talk|conversation|panel|symposium)\b/)) {
        cats.add("intellectual-discussion");
        cats.add("learning-workshop");
      }

      // Gardens are a real feature of this museum, but a garden is somewhere
      // you walk, not a maker space.
      if (inTitle(/\b(garden|horticulture|propagation|plant)\b/)) {
        cats.add("outdoor-nature");
      }

      if (inTitle(/\b(kids|children|family day|family[- ]friendly|all ages|storytime)\b/)) {
        cats.add("kids-family");
      }

      if (inTitle(/\b(jazz|swing|concert|live music)\b/)) cats.add("music-swing-jazz");

      if (inTitle(/\btour\b/)) cats.add("experiential");

      return Array.from(cats);
    },
  });
}
