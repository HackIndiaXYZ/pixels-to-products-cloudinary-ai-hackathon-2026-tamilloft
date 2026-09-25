import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScores } from "./score";
import type { BrandProfile, MentionAnalysis, ProbeResult } from "@/lib/schemas";

const profile: BrandProfile = {
  brand: "Acme",
  aliases: [],
  category: "widgets",
  description: "Makes widgets",
  audience: "widget buyers",
  competitors: ["Globex", "Initech"],
};

const absent: MentionAnalysis = {
  brandMentioned: false,
  brandRank: null,
  brandSentiment: "absent",
  brandClaim: null,
  claimAccurate: null,
  competitorsMentioned: [],
  totalOptionsListed: 0,
};

function probe(
  kind: "unbranded" | "branded",
  text: string,
  analysis: Partial<MentionAnalysis>,
): ProbeResult {
  return {
    query: { text, kind, intent: "discovery" },
    answer: "",
    analysis: { ...absent, ...analysis },
  };
}

const hit = (rank: number | null, extra: Partial<MentionAnalysis> = {}) => ({
  brandMentioned: true,
  brandRank: rank,
  brandSentiment: "positive" as const,
  ...extra,
});

test("returns zeros rather than NaN when there are no probes", () => {
  const s = computeScores([], profile);
  assert.equal(s.visibilityScore, 0);
  assert.equal(s.shareOfVoice, 0);
  assert.equal(s.positiveRate, 0);
  assert.equal(s.avgRank, null);
  assert.equal(s.accuracyRate, null);
  assert.deepEqual(s.blindSpots, []);
  assert.deepEqual(s.leaderboard.map((e) => e.name), ["Acme"]);
});

test("visibility counts unbranded hits only, rounded to one decimal", () => {
  const s = computeScores(
    [
      probe("unbranded", "q1", hit(1)),
      probe("unbranded", "q2", {}),
      probe("unbranded", "q3", {}),
      probe("branded", "q4", hit(1)),
    ],
    profile,
  );
  assert.equal(s.unbrandedTotal, 3);
  assert.equal(s.unbrandedHits, 1);
  assert.equal(s.brandedTotal, 1);
  assert.equal(s.brandedHits, 1);
  assert.equal(s.visibilityScore, 33.3);
});

test("share of voice ignores branded queries", () => {
  const s = computeScores(
    [
      probe("unbranded", "q1", {
        ...hit(2),
        competitorsMentioned: [{ name: "Globex", rank: 1 }],
      }),
      // A branded query naming the brand must not inflate share of voice.
      probe("branded", "q2", {
        ...hit(1),
        competitorsMentioned: [{ name: "Initech", rank: 2 }],
      }),
    ],
    profile,
  );
  assert.equal(s.shareOfVoice, 50);
  assert.deepEqual(
    s.leaderboard.map((e) => [e.name, e.mentions, e.shareOfVoice]),
    [
      ["Acme", 1, 50],
      ["Globex", 1, 50],
    ],
  );
});

test("leaderboard merges padded names, skips blanks, averages ranks, and sorts", () => {
  const s = computeScores(
    [
      probe("unbranded", "q1", {
        competitorsMentioned: [
          { name: "Globex", rank: 1 },
          { name: "  ", rank: 2 },
        ],
      }),
      probe("unbranded", "q2", {
        ...hit(3),
        competitorsMentioned: [
          { name: " Globex ", rank: 2 },
          { name: "Initech", rank: null },
        ],
      }),
    ],
    profile,
  );
  assert.deepEqual(
    s.leaderboard.map((e) => [e.name, e.mentions, e.avgRank, e.isTarget]),
    [
      ["Globex", 2, 1.5, false],
      // Ties on mentions break alphabetically.
      ["Acme", 1, 3, true],
      ["Initech", 1, null, false],
    ],
  );
  assert.equal(s.shareOfVoice, 25);
});

test("positive rate and accuracy use only the answers they apply to", () => {
  const s = computeScores(
    [
      probe("unbranded", "q1", hit(1)),
      probe("branded", "q2", hit(null, { brandSentiment: "negative", claimAccurate: false })),
      probe("branded", "q3", hit(null, { brandSentiment: "neutral", claimAccurate: true })),
      probe("branded", "q4", hit(null, { claimAccurate: true })),
      probe("unbranded", "q5", {}),
    ],
    profile,
  );
  // 2 of the 4 answers that mention the brand are positive.
  assert.equal(s.positiveRate, 50);
  // 2 of the 3 answers that made a claim got it right.
  assert.equal(s.accuracyRate, 66.7);
  // Only the ranked unbranded hit feeds the brand's average rank.
  assert.equal(s.avgRank, 1);
});

test("blind spots are unbranded losses to a competitor, capped at six", () => {
  const lost = { competitorsMentioned: [{ name: "Globex", rank: 1 }] };
  const s = computeScores(
    [
      probe("unbranded", "no one named", {}),
      probe("unbranded", "we won", { ...hit(1), ...lost }),
      probe("branded", "branded loss", lost),
      ...Array.from({ length: 7 }, (_, i) => probe("unbranded", `lost ${i}`, lost)),
    ],
    profile,
  );
  assert.deepEqual(s.blindSpots, [0, 1, 2, 3, 4, 5].map((i) => `lost ${i}`));
});
