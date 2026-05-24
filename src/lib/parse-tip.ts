// Parse an arbitrary blob of text (or a fetched URL) into a structured event
// candidate, ready to be reviewed and upserted. Uses Claude Haiku 4.5 because
// this is a tightly-scoped structured-extraction task — Haiku is plenty
// capable here and ~5× cheaper than Opus.
//
// Falls back gracefully if ANTHROPIC_API_KEY is not set: the API route still
// works, the user just fills the form manually.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CATEGORIES, type Category } from "./categories";

const PARSE_MODEL = "claude-haiku-4-5";

// Zod schema for what Claude extracts. We post-validate categories against
// our enum since Claude may invent ones that don't exist; unrecognized
// categories are dropped.
const TipSchema = z.object({
  title: z.string().min(1).describe("The event's name as it would appear on a poster."),
  starts_at: z
    .string()
    .nullable()
    .describe(
      "Start date+time in ISO 8601 (YYYY-MM-DDTHH:MM:SS with timezone offset like -04:00 or Z). Null if not specified."
    ),
  ends_at: z
    .string()
    .nullable()
    .describe("End date+time in ISO 8601. Null if not specified."),
  venue_name: z.string().nullable().describe("The specific venue name (e.g. 'Florida Theatre')."),
  venue_address: z.string().nullable().describe("The street address if mentioned."),
  city: z.string().nullable().describe("The city (e.g. 'Jacksonville Beach')."),
  url: z.string().nullable().describe("A canonical URL for the event if visible."),
  description: z.string().nullable().describe("A 1–3 sentence summary of what the event is."),
  price_min: z.number().nullable().describe("Minimum ticket price in USD. 0 if free. Null if unknown."),
  price_max: z.number().nullable().describe("Maximum ticket price in USD. Null if unknown."),
  categories: z
    .array(z.string())
    .describe(
      `Pick 1–4 categories that fit. Choose ONLY from this list: ${CATEGORIES.join(
        ", "
      )}. Prefer specific over generic (e.g. swing-dance over dance-other).`
    ),
  is_recurring: z
    .boolean()
    .describe(
      "True if the text describes an evergreen / ongoing thing (a park, an exhibition that runs for months, a weekly meetup with no specific date). False for one-off dated events."
    ),
});

export type ParsedTip = z.infer<typeof TipSchema> & {
  categories: Category[];
};

const SYSTEM_PROMPT = `You extract event details from arbitrary user-pasted text. The user has seen an event somewhere (Instagram post, Facebook event, email forward, flyer photo OCR, a venue webpage) and wants to add it to their personal event calendar for the Jacksonville, FL area.

Be precise: only fill fields the text actually supports. Use null for missing fields rather than guessing. For dates, ALWAYS include a timezone offset — assume America/New_York (Eastern Time) unless the text says otherwise. Eastern is -05:00 in standard time (Nov–early Mar) and -04:00 in daylight time (Mar–early Nov).

For relative dates ("this Saturday", "tonight", "next Thursday"), resolve them using the current date provided in the user message.

For categories, only use values from the allowed list. Common mappings:
- "concert", "band", "music" → music-live-other (unless genre is clear)
- "jazz night" → music-swing-jazz
- "art walk", "gallery opening", "exhibition" → art-exhibition
- "yoga class", "yoga in the park" → yoga + health-wellness
- "sound bath", "sound healing" → sound-bath + health-wellness
- "philosophy talk", "discussion group" → philosophy + intellectual-discussion
- "AI/tech meetup" → tech-ai-design + intellectual-discussion
- "kayak", "paddle" → kayaking + outdoor-nature
- "swing dance", "lindy" → swing-dance
- Maker/pottery/ceramics/3D printing/laser/painting workshops, hands-on art classes, or anything where the attendee is actively building/making something → also add experiential. Do NOT add experiential to passive events (talks, lectures, concerts, exhibitions, listening sessions). Yoga classes should NOT get experiential — yoga is its own category.`;

export function isParseEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function parseTip(text: string, sourceUrl?: string): Promise<ParsedTip> {
  if (!isParseEnabled()) {
    throw new Error(
      "ANTHROPIC_API_KEY not set in .env.local — AI parsing disabled. You can still add events manually."
    );
  }
  const client = new Anthropic();

  const today = new Date();
  const todayStr = today.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  const userContent = [
    `Today is ${todayStr} (America/New_York).`,
    sourceUrl ? `Source URL (if useful): ${sourceUrl}` : "",
    "",
    "Pasted text to parse:",
    "---",
    text,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse({
    model: PARSE_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // The system prompt is identical across requests — cache it so
        // repeated tips only pay ~0.1× for the prefix tokens.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
    output_config: {
      format: zodFormat(TipSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude returned no parsed output (possibly a refusal).");
  }

  // Post-validate categories against our enum; drop any hallucinations.
  const allowed = new Set<string>(CATEGORIES);
  const cleanCats = (response.parsed_output.categories || []).filter((c) =>
    allowed.has(c)
  ) as Category[];

  return {
    ...response.parsed_output,
    // Neutral fallback when Claude returns nothing usable. Previously this
    // was 'experiential' (+95 score) which over-promoted unclassifiable tips;
    // 'uncategorized' (weight 0) lets the event score on venue/source alone.
    categories: cleanCats.length > 0 ? cleanCats : (["uncategorized"] as Category[]),
  };
}

// The SDK's zodOutputFormat helper lives under a deep path that pulls in
// React Server Component shims that don't compile under Next's app router.
// Inline an equivalent JSON-schema converter using zod's built-in helper.
function zodFormat(schema: z.ZodTypeAny) {
  const jsonSchema = zodToJsonSchemaCompact(schema);
  return {
    type: "json_schema" as const,
    schema: jsonSchema,
  };
}

// Tiny zod → JSON Schema converter sufficient for our schema shape.
// We don't use zod-to-json-schema as a dependency just for this one call.
function zodToJsonSchemaCompact(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = (schema as { _def?: { typeName?: string } })._def;
  switch (def?.typeName) {
    case "ZodObject": {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        properties[k] = zodToJsonSchemaCompact(v as z.ZodTypeAny);
        if (!(v instanceof z.ZodOptional)) required.push(k);
      }
      return { type: "object", properties, required, additionalProperties: false };
    }
    case "ZodString":
      return withDesc(schema, { type: "string" });
    case "ZodNumber":
      return withDesc(schema, { type: "number" });
    case "ZodBoolean":
      return withDesc(schema, { type: "boolean" });
    case "ZodArray": {
      const inner = (schema as z.ZodArray<z.ZodTypeAny>)._def.type;
      return withDesc(schema, { type: "array", items: zodToJsonSchemaCompact(inner) });
    }
    case "ZodNullable": {
      const inner = (schema as z.ZodNullable<z.ZodTypeAny>)._def.innerType;
      const innerSchema = zodToJsonSchemaCompact(inner);
      return withDesc(schema, { ...innerSchema, type: [innerSchema.type, "null"] });
    }
    case "ZodOptional": {
      const inner = (schema as z.ZodOptional<z.ZodTypeAny>)._def.innerType;
      return zodToJsonSchemaCompact(inner);
    }
    default:
      return { type: "string" };
  }
}

function withDesc(
  schema: z.ZodTypeAny,
  base: Record<string, unknown>
): Record<string, unknown> {
  const desc = (schema as { description?: string }).description;
  return desc ? { ...base, description: desc } : base;
}
