import { z } from "zod";

/** What the brand actually is, grounded in its live site rather than model memory. */
export const BrandProfileSchema = z.object({
  brand: z.string().describe("The company or product's canonical name"),
  aliases: z
    .array(z.string())
    .describe("Other names the brand is known by, including common misspellings"),
  category: z
    .string()
    .describe("The product category, phrased the way a buyer would say it"),
  description: z.string().describe("One sentence on what the product does"),
  audience: z.string().describe("Who buys this"),
  competitors: z
    .array(z.string())
    .describe("4 to 6 direct competitors a buyer would genuinely weigh against this brand"),
});
export type BrandProfile = z.infer<typeof BrandProfileSchema>;

/**
 * Unbranded queries measure whether the model recommends you unprompted --
 * that is the real share-of-voice signal. Branded queries measure whether the
 * model knows what you actually do, which catches the separate and painful
 * failure of being known incorrectly.
 */
export const QueryKind = z.enum(["unbranded", "branded"]);
export const QueryIntent = z.enum([
  "discovery",
  "comparison",
  "problem",
  "recommendation",
]);

export const ProbeQuerySchema = z.object({
  text: z.string().describe("The question exactly as a real buyer would type it"),
  kind: QueryKind,
  intent: QueryIntent,
});
export type ProbeQuery = z.infer<typeof ProbeQuerySchema>;

export const QuerySetSchema = z.object({
  queries: z.array(ProbeQuerySchema),
});

/** Structured reading of one probe answer. The model extracts; code scores. */
export const MentionAnalysisSchema = z.object({
  brandMentioned: z.boolean(),
  brandRank: z
    .number()
    .nullable()
    .describe("1-based position of the brand among the options presented, else null"),
  brandSentiment: z.enum(["positive", "neutral", "negative", "absent"]),
  brandClaim: z
    .string()
    .nullable()
    .describe("What the answer asserted about the brand, verbatim-ish, else null"),
  claimAccurate: z
    .boolean()
    .nullable()
    .describe("Whether that claim matches the real profile. Null when nothing was claimed"),
  competitorsMentioned: z.array(
    z.object({ name: z.string(), rank: z.number().nullable() }),
  ),
  totalOptionsListed: z
    .number()
    .describe("How many distinct products the answer put forward"),
});
export type MentionAnalysis = z.infer<typeof MentionAnalysisSchema>;

/**
 * Several answers read in one call.
 *
 * Free-tier quotas are counted per request, not per token, so reading a batch
 * costs the same as reading one. The index is carried explicitly rather than
 * inferred from array position, so a short or reordered reply can be realigned
 * instead of silently mislabelling every finding after the gap.
 */
export const BatchAnalysisSchema = z.object({
  analyses: z.array(
    z.object({
      index: z.number().describe("The question number this analysis is for"),
      analysis: MentionAnalysisSchema,
    }),
  ),
});

export const DiagnosisSchema = z.object({
  headline: z.string().describe("One blunt sentence stating the visibility problem"),
  findings: z.array(
    z.object({
      severity: z.enum(["critical", "high", "medium", "low"]),
      title: z.string(),
      evidence: z.string().describe("Cite the specific query or answer that shows this"),
      why: z.string().describe("The underlying cause, not a restatement of the symptom"),
    }),
  ),
  fixes: z.array(
    z.object({
      priority: z.number().describe("1 is most important"),
      action: z.string().describe("A specific thing to do, not a platitude"),
      rationale: z.string(),
      effort: z.enum(["low", "medium", "high"]),
    }),
  ),
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

/* ---------- Derived, computed in code ---------- */

export interface CompetitorScore {
  name: string;
  mentions: number;
  shareOfVoice: number;
  avgRank: number | null;
  isTarget: boolean;
}

export interface Scores {
  visibilityScore: number;
  shareOfVoice: number;
  avgRank: number | null;
  positiveRate: number;
  accuracyRate: number | null;
  unbrandedTotal: number;
  unbrandedHits: number;
  brandedTotal: number;
  brandedHits: number;
  leaderboard: CompetitorScore[];
  blindSpots: string[];
}

export interface ProbeResult {
  query: ProbeQuery;
  answer: string;
  analysis: MentionAnalysis;
}

/* ---------- Image audit, run through Cloudinary ---------- */

export interface MediaVariants {
  /** Same pixels, delivered with f_auto,q_auto. */
  optimized: string;
  thumb: string;
  /** 1200x630 link-preview crop, subject found by g_auto. */
  social: string;
  square: string;
  /** Background removed. Generated on demand, since it is the costly one. */
  cutout: string;
}

export interface MediaAsset {
  sourceUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  /** The alt text the site ships. Null when missing or empty. */
  siteAlt: string | null;
  /** Cloudinary AI caption. Null when the add-on is unavailable. */
  aiCaption: string | null;
  aiTags: string[];
  originalBytes: number;
  /** Size delivered with f_auto,q_auto. Null when it could not be measured. */
  optimizedBytes: number | null;
  variants: MediaVariants;
}

export interface MediaScores {
  audited: number;
  skipped: number;
  altCoverage: number;
  missingAlt: number;
  captioned: number;
  originalBytes: number;
  optimizedBytes: number;
  savedPct: number;
}

export interface AuditReport {
  id: string;
  domain: string;
  createdAt: string;
  profile: BrandProfile;
  probes: ProbeResult[];
  scores: Scores;
  diagnosis: Diagnosis;
  media: MediaAsset[];
  mediaScores: MediaScores | null;
}
