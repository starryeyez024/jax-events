// Subject-matter tags derived at write time rather than inside each scraper.
//
// The same subject arrives from different feeds tagged wildly differently.
// "Jacksonville Jaguars vs. Cleveland Browns" comes through Visit Jax with no
// category at all; "Jags Watch Party" arrives from Eventbrite filed under
// outdoor-nature. A per-scraper classifier cannot fix that, because each one
// only ever sees its own feed. Deriving here means one rule covers every
// source at once, hand-entered tips included.
//
// These ADD to whatever the scraper decided, unlike isProceduralMeeting(),
// which replaces. The category filter is an OR across an event's categories,
// so adding "sports" to a Jags game surfaces it under the Sports chip without
// taking away however else it was already findable.

import type { Category } from "./categories";

type SubjectRule = {
  re: RegExp;
  add: Category;
  /**
   * Match the title only. For subjects that body copy name-drops in passing,
   * where a mention is not evidence the event is about them.
   */
  titleOnly?: boolean;
};

const RULES: SubjectRule[] = [
  // The football team. Title-only, and plural-only for "jaguars": the zoo's
  // cat and the car are both singular "jaguar", and neither is a sporting
  // event. "Jags" is unambiguous in this city.
  { re: /\bjags\b|\bjaguars\b/i, add: "sports", titleOnly: true },

  // A billed DJ is live music. Matched in body copy too, because the DJ is
  // routinely the draw without ever making the title — "8th Annual
  // Oktoberfest" carries only "DJ 3-9pm" in its description.
  { re: /\bdjs?\b|\bdeejays?\b/i, add: "music-live-other" },
];

/** Extra categories implied by what an event is about. May be empty. */
export function subjectTags(
  title: string,
  description?: string | null
): Category[] {
  const t = title ?? "";
  const full = `${t} ${description ?? ""}`;
  return RULES.filter((r) => r.re.test(r.titleOnly ? t : full)).map((r) => r.add);
}
