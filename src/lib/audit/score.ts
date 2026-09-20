import type {
  BrandProfile,
  CompetitorScore,
  ProbeResult,
  Scores,
} from "@/lib/schemas";

const pct = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

const mean = (values: number[]) =>
  values.length === 0
    ? null
    : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

/**
 * Step 5 -- turn observations into numbers.
 *
 * Deliberately free of model calls. Every figure Echo puts in front of a user
 * is computed here, from counts the extraction step recorded, so a disputed
 * number can be traced to the exact answers that produced it. A language model
 * is good at reading an answer and bad at being an accountant; this is the
 * line between those two jobs.
 */
export function computeScores(
  probes: ProbeResult[],
  profile: BrandProfile,
): Scores {
  const unbranded = probes.filter((p) => p.query.kind === "unbranded");
  const branded = probes.filter((p) => p.query.kind === "branded");

  const unbrandedHits = unbranded.filter((p) => p.analysis.brandMentioned).length;
  const brandedHits = branded.filter((p) => p.analysis.brandMentioned).length;

  // Share of voice is measured on unbranded queries only. Branded queries name
  // the brand in the question, so counting them would flatter the score.
  const brandMentions = unbrandedHits;
  const competitorTally = new Map<string, { mentions: number; ranks: number[] }>();

  for (const result of unbranded) {
    for (const competitor of result.analysis.competitorsMentioned) {
      const key = competitor.name.trim();
      if (!key) continue;
      const entry = competitorTally.get(key) ?? { mentions: 0, ranks: [] };
      entry.mentions += 1;
      if (competitor.rank !== null) entry.ranks.push(competitor.rank);
      competitorTally.set(key, entry);
    }
  }

  const competitorMentions = [...competitorTally.values()].reduce(
    (sum, entry) => sum + entry.mentions,
    0,
  );
  const totalMentions = brandMentions + competitorMentions;

  const brandRanks = unbranded
    .map((p) => p.analysis.brandRank)
    .filter((rank): rank is number => rank !== null);

  const leaderboard: CompetitorScore[] = [
    {
      name: profile.brand,
      mentions: brandMentions,
      shareOfVoice: pct(brandMentions, totalMentions),
      avgRank: mean(brandRanks),
      isTarget: true,
    },
    ...[...competitorTally.entries()].map(([name, entry]) => ({
      name,
      mentions: entry.mentions,
      shareOfVoice: pct(entry.mentions, totalMentions),
      avgRank: mean(entry.ranks),
      isTarget: false,
    })),
  ].sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));

  const mentioned = probes.filter((p) => p.analysis.brandMentioned);
  const positive = mentioned.filter(
    (p) => p.analysis.brandSentiment === "positive",
  ).length;

  const claimed = probes.filter((p) => p.analysis.claimAccurate !== null);
  const accurate = claimed.filter((p) => p.analysis.claimAccurate === true).length;

  // The losses that matter: the model answered the buying question, named
  // somebody, and it was not you.
  const blindSpots = unbranded
    .filter(
      (p) =>
        !p.analysis.brandMentioned && p.analysis.competitorsMentioned.length > 0,
    )
    .map((p) => p.query.text)
    .slice(0, 6);

  return {
    visibilityScore: pct(unbrandedHits, unbranded.length),
    shareOfVoice: pct(brandMentions, totalMentions),
    avgRank: mean(brandRanks),
    positiveRate: pct(positive, mentioned.length),
    accuracyRate: claimed.length === 0 ? null : pct(accurate, claimed.length),
    unbrandedTotal: unbranded.length,
    unbrandedHits,
    brandedTotal: branded.length,
    brandedHits,
    leaderboard,
    blindSpots,
  };
}
