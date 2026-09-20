import { generateObject, ANALYST_EFFORT } from "@/lib/llm";
import {
  DiagnosisSchema,
  type BrandProfile,
  type Diagnosis,
  type ProbeResult,
  type Scores,
} from "@/lib/schemas";

/** The losses, with enough of the answer to see who won instead. */
function evidenceDigest(probes: ProbeResult[], limit = 10): string {
  return probes
    .filter((p) => p.query.kind === "unbranded" && !p.analysis.brandMentioned)
    .slice(0, limit)
    .map((p) => {
      const winners = p.analysis.competitorsMentioned
        .map((c) => c.name)
        .join(", ");
      return [
        `Q (${p.query.intent}): ${p.query.text}`,
        `Recommended instead: ${winners || "nothing specific"}`,
        `Excerpt: ${p.answer.slice(0, 400).replace(/\s+/g, " ")}`,
      ].join("\n");
    })
    .join("\n\n");
}

/** What the model believes about the brand, right or wrong. */
function beliefDigest(probes: ProbeResult[], limit = 6): string {
  return probes
    .filter((p) => p.analysis.brandClaim)
    .slice(0, limit)
    .map(
      (p) =>
        `Claim: ${p.analysis.brandClaim}` +
        (p.analysis.claimAccurate === false ? "  [INACCURATE]" : ""),
    )
    .join("\n");
}

/**
 * Step 6 -- explain the number and say what to do about it.
 *
 * The scores are handed over already computed. This step is asked to reason
 * about cause and remedy, never to recalculate, so it cannot quietly
 * contradict the arithmetic the user is looking at.
 */
export async function diagnose(
  profile: BrandProfile,
  scores: Scores,
  probes: ProbeResult[],
): Promise<Diagnosis> {
  const rivals = scores.leaderboard
    .filter((entry) => !entry.isTarget)
    .slice(0, 5)
    .map(
      (entry) => `${entry.name}: ${entry.mentions} mentions (${entry.shareOfVoice}%)`,
    )
    .join("\n");

  const diagnosis = await generateObject({
    schema: DiagnosisSchema,
    maxTokens: 8000,
    effort: ANALYST_EFFORT,
    system: [
      "You explain why a brand does or does not get recommended by AI",
      "assistants, and what to change.",
      "",
      "The figures you are given are final. Interpret them; never restate a",
      "different number.",
      "",
      "Findings must name a cause, not repeat a symptom. 'Low visibility' is",
      "a symptom. 'Nothing on the site frames the product in the words buyers",
      "use for this category, so the model has no basis to retrieve it for",
      "those questions' is a cause.",
      "",
      "Fixes must be specific enough to assign to someone on Monday. Reject",
      "'improve your SEO' and anything else a consultant could have said",
      "without reading this report. If the brand is doing well, say so",
      "plainly and give fewer fixes rather than inventing problems.",
    ].join("\n"),
    prompt: [
      `Brand: ${profile.brand} -- ${profile.description}`,
      `Category: ${profile.category}`,
      `Audience: ${profile.audience}`,
      "",
      "MEASURED RESULTS",
      `Appears in ${scores.unbrandedHits} of ${scores.unbrandedTotal} unbranded buying questions (${scores.visibilityScore}%)`,
      `Share of voice against competitors: ${scores.shareOfVoice}%`,
      `Average position when named: ${scores.avgRank ?? "never ranked"}`,
      `Positive framing rate: ${scores.positiveRate}%`,
      `Description accuracy when the model does describe it: ${scores.accuracyRate ?? "no claims made"}%`,
      `Recognised in ${scores.brandedHits} of ${scores.brandedTotal} direct questions about it`,
      "",
      "COMPETITOR SHARE",
      rivals || "no competitors recorded",
      "",
      "QUESTIONS LOST",
      evidenceDigest(probes) || "none",
      "",
      "WHAT THE MODEL BELIEVES ABOUT THIS BRAND",
      beliefDigest(probes) || "the model made no claims about it",
    ].join("\n"),
  });

  if (!diagnosis) {
    throw new Error("Could not produce a diagnosis.");
  }

  return diagnosis;
}
