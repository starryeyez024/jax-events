// Bold City Swing — the Jacksonville swing-dance organizer.
// They embed a public Google Calendar on boldcityswing.com, which we pull
// directly via its iCal export. The same calendar carries events at
// multiple venues (Murray Hill Theatre, The Volstead, Diva Dance, San Marco
// Community Center), so this single scraper effectively aggregates the
// city's swing-dance scene.
//
// Calendar ID was extracted from the embed iframe src= on their homepage,
// base64-decoded:
//   bHRrbjR2amJqZTBhdjRzdGYydm91NXRmMzBAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ==
//   → ltkn4vjbje0av4stf2vou5tf30@group.calendar.google.com

import type { EventInput } from "@/lib/db";
import type { Category } from "@/lib/categories";
import { fetchIcal, stringy } from "./lib/ical";

const CAL_ID = "ltkn4vjbje0av4stf2vou5tf30@group.calendar.google.com";
const ICS_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CAL_ID)}/public/basic.ics`;

export async function fetchBoldCitySwing(): Promise<EventInput[]> {
  return fetchIcal({
    url: ICS_URL,
    source: "bold-city-swing",
    // No fixed venue — every event in the calendar carries its own LOCATION
    // string. fetchIcal already pipes that through to venue_name/venue_address.
    city: "Jacksonville",
    // Every Bold City Swing event is, by definition, swing dance. The
    // classify function below adds extra tags when the title or description
    // signals lessons / lindy / blues / etc.
    defaultCategories: ["swing-dance", "dance-other"],
    classify: (e) => {
      const blob = `${stringy(e.summary)} ${stringy(e.description)}`.toLowerCase();
      const cats = new Set<Category>(["swing-dance", "dance-other"]);
      // Lindy hop is the most common style they teach.
      if (/lindy|charleston|balboa/.test(blob)) cats.add("swing-dance");
      // "Lessons" and "intro" events double as learning workshops.
      if (/lesson|intro|workshop|class|beginner/.test(blob)) {
        cats.add("learning-workshop");
      }
      // Blues dance is adjacent but distinct — still tag as dance-other.
      if (/blues/.test(blob)) cats.add("dance-other");
      // Live jazz/swing-music nights at dance venues.
      if (/jazz|swing band|big band|hot club/.test(blob)) {
        cats.add("music-swing-jazz");
      }
      return Array.from(cats);
    },
  });
}
