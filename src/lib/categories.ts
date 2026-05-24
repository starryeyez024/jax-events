// Category taxonomy + default preference weights (-100..100).
// Positive = you like it, negative = you dislike it.
// These shift over time based on your ratings (see scoring.ts).

// Grouped category taxonomy. This is the single source of truth — both the
// flat CATEGORIES list (used for type, validation, scoring) and the chip-row
// rendering in Filters.tsx are derived from it. Reordering or moving an
// entry between groups changes ONLY the display order; DEFAULT_WEIGHTS and
// stored preferences are keyed by name, so no migration is needed.
export const CATEGORY_GROUPS = [
  {
    label: "Music",
    categories: ["music-90s-rock", "music-00s-hiphop", "music-swing-jazz", "music-live-other"],
  },
  {
    label: "Dance",
    categories: ["swing-dance", "dance-other"],
  },
  {
    label: "Mind & learning",
    categories: ["philosophy", "intellectual-discussion", "tech-ai-design", "learning-workshop"],
  },
  {
    label: "Arts & making",
    categories: ["art-exhibition", "art-class", "maker-space", "experiential"],
  },
  {
    label: "Outdoor & active",
    categories: ["outdoor-nature", "cycling", "kayaking", "boat-ride", "snorkeling"],
  },
  {
    label: "Wellness",
    categories: ["health-wellness", "yoga", "sound-bath"],
  },
  {
    label: "Theater & comedy",
    categories: ["theater", "comedy"],
  },
  {
    label: "Social & community",
    categories: ["festival", "food-drink", "market-shopping", "kids-family", "sports"],
  },
  {
    label: "Other",
    categories: ["uncategorized"],
  },
] as const;

export type Category = (typeof CATEGORY_GROUPS)[number]["categories"][number];

// Flat list derived from groups — preserves the grouped order for any code
// that needs to iterate categories without caring about grouping.
export const CATEGORIES: readonly Category[] = CATEGORY_GROUPS.flatMap(
  (g) => g.categories as readonly Category[]
);

export const DEFAULT_WEIGHTS: Record<Category, number> = {
  // strong positives — your stated interests
  experiential: 80,
  "maker-space": 90,
  "art-exhibition": 80,
  "art-class": 75,
  "music-90s-rock": 70,
  "music-00s-hiphop": 70,
  "music-swing-jazz": 85,
  "swing-dance": 95,
  philosophy: 85,
  "intellectual-discussion": 85,
  "learning-workshop": 80,
  "tech-ai-design": 80,
  "health-wellness": 75,
  yoga: 70,
  "sound-bath": 75,
  cycling: 70,
  "outdoor-nature": 65,
  kayaking: 85,
  "boat-ride": 75,
  snorkeling: 80,

  // neutral / context-dependent
  "music-live-other": 30,
  "dance-other": 40,
  "food-drink": 20,
  festival: 30,
  theater: 30,
  comedy: 25,
  "kids-family": 0,
  sports: 0,

  // Neutral classifier fallback — score 0 so it neither boosts nor penalizes.
  // Used when a scraper can't confidently tag an event, instead of polluting
  // 'experiential' (which earns a +15 bonus and should be reserved for things
  // that genuinely are participatory).
  uncategorized: 0,

  // mild negative — you'd rather not, but not zero
  "market-shopping": -20,
};

export const CATEGORY_LABELS: Record<Category, string> = {
  experiential: "Experiential",
  "maker-space": "Maker Space",
  "art-exhibition": "Art Exhibition",
  "art-class": "Art Class",
  "music-90s-rock": "90s Rock",
  "music-00s-hiphop": "00s Hip Hop",
  "music-swing-jazz": "Swing/Jazz",
  "music-live-other": "Live Music",
  "swing-dance": "Swing Dance",
  "dance-other": "Dance",
  philosophy: "Philosophy",
  "intellectual-discussion": "Discussion",
  "learning-workshop": "Workshop",
  "tech-ai-design": "Tech / AI / Design",
  "health-wellness": "Health & Wellness",
  yoga: "Yoga",
  "sound-bath": "Sound Bath",
  cycling: "Cycling",
  "outdoor-nature": "Outdoor / Nature",
  kayaking: "Kayaking / Paddle",
  "boat-ride": "Boat Ride",
  snorkeling: "Snorkel / Dive",
  "food-drink": "Food & Drink",
  "market-shopping": "Market",
  festival: "Festival",
  theater: "Theater",
  comedy: "Comedy",
  "kids-family": "Family",
  sports: "Sports",
  uncategorized: "Other",
};

// Emoji icons for quick visual scanning. Kept intentionally consistent so
// the same idea (music, art, outdoors) always reads the same way at a glance.
export const CATEGORY_ICONS: Record<Category, string> = {
  experiential: "✨",
  "maker-space": "🛠️",
  "art-exhibition": "🖼️",
  "art-class": "🎨",
  "music-90s-rock": "🎸",
  "music-00s-hiphop": "🎤",
  "music-swing-jazz": "🎷",
  "music-live-other": "🎵",
  "swing-dance": "💃",
  "dance-other": "🕺",
  philosophy: "🧠",
  "intellectual-discussion": "💬",
  "learning-workshop": "📚",
  "tech-ai-design": "💻",
  "health-wellness": "🌿",
  yoga: "🧘",
  "sound-bath": "🔔",
  cycling: "🚴",
  "outdoor-nature": "🌳",
  kayaking: "🛶",
  "boat-ride": "⛵",
  snorkeling: "🤿",
  "food-drink": "🍽️",
  "market-shopping": "🛍️",
  festival: "🎪",
  theater: "🎭",
  comedy: "😂",
  "kids-family": "👨‍👩‍👧",
  sports: "⚽",
  uncategorized: "📄",
};

// Pick the single most representative icon for an event with multiple categories.
// Priority order roughly matches what you'd glance at first.
const PRIMARY_ORDER: Category[] = [
  "swing-dance",
  "music-swing-jazz",
  "music-90s-rock",
  "music-00s-hiphop",
  "music-live-other",
  "philosophy",
  "intellectual-discussion",
  "tech-ai-design",
  "maker-space",
  "art-class",
  "art-exhibition",
  "yoga",
  "sound-bath",
  "kayaking",
  "snorkeling",
  "boat-ride",
  "cycling",
  "health-wellness",
  "outdoor-nature",
  "learning-workshop",
  "theater",
  "comedy",
  "festival",
  "dance-other",
  "experiential",
  "food-drink",
  "kids-family",
  "sports",
  "market-shopping",
  "music-live-other",
];

export function primaryIconFor(cats: Category[]): string {
  for (const c of PRIMARY_ORDER) if (cats.includes(c)) return CATEGORY_ICONS[c];
  return "📅";
}

export function isCategory(x: string): x is Category {
  return (CATEGORIES as readonly string[]).includes(x);
}
