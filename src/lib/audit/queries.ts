import { generateObject, ANALYST_EFFORT } from "@/lib/llm";
import {
  QuerySetSchema,
  type BrandProfile,
  type ProbeQuery,
} from "@/lib/schemas";

/** Reduce text to space-separated lowercase words, padded so edges match too. */
function tokenize(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/**
 * Does this text name the brand or any alias? Matched on whole words, so
 * "Linear" does not fire on "linearly" but does fire on "Linear's roadmap",
 * and multi-word names still match as a unit.
 */
function namesBrand(text: string, profile: BrandProfile): boolean {
  const haystack = tokenize(text);
  return [profile.brand, ...profile.aliases]
    .filter(Boolean)
    .map(tokenize)
    .some((needle) => needle.trim().length > 0 && haystack.includes(needle));
}

/**
 * Step 2 -- what would a real buyer ask an AI?
 *
 * The split matters more than the count. Unbranded queries never name the
 * brand, so a mention there is genuinely earned and measures recommendation
 * share. Branded queries name it directly and measure something different:
 * whether the model knows what the product actually does.
 */
export async function generateQueries(
  profile: BrandProfile,
  total = 24,
): Promise<ProbeQuery[]> {
  const brandedTarget = Math.max(3, Math.round(total * 0.25));
  const unbrandedTarget = total - brandedTarget;

  const result = await generateObject({
    schema: QuerySetSchema,
    maxTokens: 8000,
    effort: ANALYST_EFFORT,
    system: [
      "You write the questions real buyers type into AI assistants when they",
      "are deciding what to buy. Write how people actually type: lowercase is",
      "fine, fragments are fine, some are long and specific.",
      "",
      "Two kinds, and the distinction is strict:",
      `- "unbranded" (${unbrandedTarget} of them): MUST NOT contain the brand`,
      "  name or any alias. These measure whether the brand gets recommended",
      "  unprompted. Spread them across intents: discovery (best X for Y),",
      "  problem (I need to solve Z), comparison (competitor vs competitor),",
      "  and recommendation (what should I use for...).",
      `- "branded" (${brandedTarget} of them): MUST name the brand directly.`,
      "  These measure whether the model knows what the product really does.",
      "",
      "Cover the realistic range of buyers in this category, including the",
      "narrow use cases where a smaller player would plausibly win.",
    ].join("\n"),
    prompt: [
      `Brand: ${profile.brand}`,
      `Aliases: ${profile.aliases.join(", ") || "none"}`,
      `Category: ${profile.category}`,
      `What it does: ${profile.description}`,
      `Who buys it: ${profile.audience}`,
      `Competitors: ${profile.competitors.join(", ")}`,
      "",
      `Write exactly ${total} queries.`,
    ].join("\n"),
  });

  if (!result) {
    throw new Error("Could not generate a query set.");
  }

  // The measurement is only valid if unbranded queries are genuinely
  // unbranded, so that is enforced here rather than trusted to the
  // instruction above.
  const cleaned = result.queries.filter((query) =>
    query.kind === "unbranded" ? !namesBrand(query.text, profile) : true,
  );

  if (cleaned.filter((q) => q.kind === "unbranded").length === 0) {
    throw new Error("No valid unbranded queries survived validation.");
  }

  return cleaned.slice(0, total);
}
