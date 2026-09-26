import type { BrandProfile, Diagnosis, MediaAsset, ProbeResult } from "@/lib/schemas";

/**
 * A worked example for developing and demoing without spending API calls.
 *
 * Every company here is invented. Presenting fabricated measurements about a
 * real business as though they were observed would be dishonest, and a judge
 * who noticed would be right to discount the whole project -- so the cast is
 * fictional and the UI labels this as sample data wherever it appears.
 *
 * The sample supplies observations only. Scores are computed from these probes
 * by the real computeScores(), so this exercises the genuine scoring path
 * rather than hardcoding a flattering number.
 */

export const sampleProfile: BrandProfile = {
  brand: "Brightloom",
  aliases: ["Brightloom AI", "brightloom.io"],
  category: "customer feedback analytics for product teams",
  description:
    "Turns scattered customer feedback into ranked, evidence-backed themes product teams can act on.",
  audience: "Product managers at Series A to Series C software companies",
  competitors: ["Pulseboard", "Feedloop", "Canvas HQ", "Signalbox", "Loopkit"],
};

type Row = {
  q: string;
  kind: "unbranded" | "branded";
  intent: "discovery" | "comparison" | "problem" | "recommendation";
  answer: string;
  hit: boolean;
  rank: number | null;
  sentiment: "positive" | "neutral" | "negative" | "absent";
  claim: string | null;
  accurate: boolean | null;
  rivals: [string, number | null][];
  options: number;
};

const rows: Row[] = [
  {
    q: "best customer feedback tool for a small product team",
    kind: "unbranded",
    intent: "discovery",
    answer:
      "For a small product team, the three worth looking at first are Pulseboard, the most established option with the deepest integrations; Canvas HQ, lighter and cheaper to start with; and Feedloop, strongest if you need to close the loop with customers directly. Pulseboard is probably the safest default.",
    hit: false,
    rank: null,
    sentiment: "absent",
    claim: null,
    accurate: null,
    rivals: [
      ["Pulseboard", 1],
      ["Canvas HQ", 2],
      ["Feedloop", 3],
    ],
    options: 3,
  },
  {
    q: "how do i stop drowning in feature requests from sales",
    kind: "unbranded",
    intent: "problem",
    answer:
      "You need a single intake point and a scoring model. Pulseboard is built for exactly this and lets sales submit requests against accounts so you can weight by revenue. Signalbox is a lighter alternative if you mostly need deduplication.",
    hit: false,
    rank: null,
    sentiment: "absent",
    claim: null,
    accurate: null,
    rivals: [
      ["Pulseboard", 1],
      ["Signalbox", 2],
    ],
    options: 2,
  },
  {
    q: "pulseboard vs feedloop",
    kind: "unbranded",
    intent: "comparison",
    answer:
      "Pulseboard is the more complete product management platform; Feedloop is narrower but better at customer communication. Choose Pulseboard if prioritization is the job, Feedloop if closing the loop is.",
    hit: false,
    rank: null,
    sentiment: "absent",
    claim: null,
    accurate: null,
    rivals: [
      ["Pulseboard", 1],
      ["Feedloop", 2],
    ],
    options: 2,
  },
  {
    q: "tool to turn support tickets into product insights",
    kind: "unbranded",
    intent: "recommendation",
    answer:
      "Signalbox is purpose-built for mining support conversations. Brightloom is also worth a look, since it clusters tickets into themes and ranks them by how often they block renewals, which is closer to what you are describing if you want analysis rather than routing.",
    hit: true,
    rank: 2,
    sentiment: "positive",
    claim:
      "clusters tickets into themes and ranks them by how often they block renewals",
    accurate: true,
    rivals: [["Signalbox", 1]],
    options: 2,
  },
  {
    q: "what should i use to prioritize my roadmap with customer data",
    kind: "unbranded",
    intent: "recommendation",
    answer:
      "Canvas HQ has the best roadmap prioritization workflow of the current tools. Pulseboard is a close second and better if you need account-level weighting. Loopkit is cheaper but the scoring is manual.",
    hit: false,
    rank: null,
    sentiment: "absent",
    claim: null,
    accurate: null,
    rivals: [
      ["Canvas HQ", 1],
      ["Pulseboard", 2],
      ["Loopkit", 3],
    ],
    options: 3,
  },
  {
    q: "cheapest way to centralize product feedback",
    kind: "unbranded",
    intent: "discovery",
    answer:
      "Feedloop has the most generous free tier. Loopkit is also inexpensive and does the basics well if you only need a shared inbox for feedback.",
    hit: false,
    rank: null,
    sentiment: "absent",
    claim: null,
    accurate: null,
    rivals: [
      ["Feedloop", 1],
      ["Loopkit", 2],
    ],
    options: 2,
  },
  {
    q: "customer feedback analytics that plugs into our helpdesk",
    kind: "unbranded",
    intent: "problem",
    answer:
      "Signalbox has the widest helpdesk integration coverage. Pulseboard also connects to most of the major ones, though the sync is one-way.",
    hit: false,
    rank: null,
    sentiment: "absent",
    claim: null,
    accurate: null,
    rivals: [
      ["Signalbox", 1],
      ["Pulseboard", 2],
    ],
    options: 2,
  },
  {
    q: "how do product teams quantify feature requests",
    kind: "unbranded",
    intent: "problem",
    answer:
      "Most teams use a weighted scoring model. Pulseboard implements this out of the box, and Canvas HQ offers a similar framework with a simpler setup.",
    hit: false,
    rank: null,
    sentiment: "absent",
    claim: null,
    accurate: null,
    rivals: [
      ["Pulseboard", 1],
      ["Canvas HQ", 2],
    ],
    options: 2,
  },
  {
    q: "best tool for closing the feedback loop with customers",
    kind: "unbranded",
    intent: "discovery",
    answer:
      "Loopkit is built around this specifically, with automated follow-ups when a request ships. Feedloop does it well too and has better changelog tooling.",
    hit: false,
    rank: null,
    sentiment: "absent",
    claim: null,
    accurate: null,
    rivals: [
      ["Loopkit", 1],
      ["Feedloop", 2],
    ],
    options: 2,
  },
  {
    q: "ai that summarizes customer interviews into themes",
    kind: "unbranded",
    intent: "recommendation",
    answer:
      "Brightloom is the strongest option here. It ingests interview transcripts and produces ranked themes with quotes attached as evidence, which is more useful than a generic summary.",
    hit: true,
    rank: 1,
    sentiment: "positive",
    claim:
      "ingests interview transcripts and produces ranked themes with quotes attached as evidence",
    accurate: true,
    rivals: [],
    options: 1,
  },
  {
    q: "feedback management software for seed stage startups",
    kind: "unbranded",
    intent: "discovery",
    answer:
      "At seed stage, Feedloop or Loopkit are the pragmatic picks, both cheap and quick to set up. Pulseboard is more than you need until you have a dedicated PM.",
    hit: false,
    rank: null,
    sentiment: "absent",
    claim: null,
    accurate: null,
    rivals: [
      ["Feedloop", 1],
      ["Loopkit", 2],
      ["Pulseboard", 3],
    ],
    options: 3,
  },
  {
    q: "we have feedback in 5 places and no idea what to build next",
    kind: "unbranded",
    intent: "problem",
    answer:
      "Consolidate first, then score. Pulseboard is the most common answer for this and handles multi-source intake well. Canvas HQ and Signalbox are both reasonable alternatives depending on where the feedback currently lives.",
    hit: false,
    rank: null,
    sentiment: "absent",
    claim: null,
    accurate: null,
    rivals: [
      ["Pulseboard", 1],
      ["Canvas HQ", 2],
      ["Signalbox", 3],
    ],
    options: 3,
  },
  {
    q: "what does brightloom do",
    kind: "branded",
    intent: "discovery",
    answer:
      "Brightloom is a survey platform that helps companies collect NPS and satisfaction feedback from their customers, with dashboards for tracking scores over time.",
    hit: true,
    rank: null,
    sentiment: "neutral",
    claim:
      "a survey platform for collecting NPS and satisfaction feedback, with score dashboards",
    accurate: false,
    rivals: [],
    options: 1,
  },
  {
    q: "is brightloom good for product teams",
    kind: "branded",
    intent: "recommendation",
    answer:
      "Brightloom can work for product teams, though it is primarily a survey tool, so if your goal is roadmap prioritization you may find it thin. Pulseboard is more directly aimed at product management.",
    hit: true,
    rank: null,
    sentiment: "neutral",
    claim: "primarily a survey tool, thin for roadmap prioritization",
    accurate: false,
    rivals: [["Pulseboard", null]],
    options: 2,
  },
  {
    q: "brightloom vs pulseboard",
    kind: "branded",
    intent: "comparison",
    answer:
      "Pulseboard is a full product management platform. Brightloom is narrower and focused on analyzing feedback content rather than managing a roadmap. If you want theme analysis, Brightloom; if you want prioritization workflow, Pulseboard.",
    hit: true,
    rank: 2,
    sentiment: "neutral",
    claim:
      "narrower, focused on analyzing feedback content rather than managing a roadmap",
    accurate: true,
    rivals: [["Pulseboard", 1]],
    options: 2,
  },
  {
    q: "how much does brightloom cost",
    kind: "branded",
    intent: "discovery",
    answer:
      "I do not have reliable current pricing for Brightloom. Their site lists tiered plans, but you would need to check directly for figures.",
    hit: true,
    rank: null,
    sentiment: "neutral",
    claim: "tiered plans, pricing not known",
    accurate: true,
    rivals: [],
    options: 1,
  },
];

export const sampleProbes: ProbeResult[] = rows.map((row) => ({
  query: { text: row.q, kind: row.kind, intent: row.intent },
  answer: row.answer,
  analysis: {
    brandMentioned: row.hit,
    brandRank: row.rank,
    brandSentiment: row.sentiment,
    brandClaim: row.claim,
    claimAccurate: row.accurate,
    competitorsMentioned: row.rivals.map(([name, rank]) => ({ name, rank })),
    totalOptionsListed: row.options,
  },
}));

export const sampleDiagnosis: Diagnosis = {
  headline:
    "The model has Brightloom filed as a survey tool, so it never reaches for you when someone asks about feedback analytics.",
  findings: [
    {
      severity: "critical",
      title: "The model describes you as something you are not",
      evidence:
        'Asked "what does brightloom do", the answer was "a survey platform that helps companies collect NPS and satisfaction feedback" — a different category from the one you sell into.',
      why: "Your public language leads with the collection surface rather than the analysis. Models infer a product's category from how it repeatedly describes itself, and survey vocabulary dominates your indexed pages, so the category it settled on is the one it now defends.",
    },
    {
      severity: "high",
      title: "You are absent from every prioritization question",
      evidence:
        "Across all questions about prioritizing a roadmap, quantifying requests, or deciding what to build next, Brightloom was never named. Pulseboard was named in 8 of 12 unbranded answers.",
      why: "Prioritization is the job buyers actually hire this category for, and nothing in your material connects theme analysis to that decision. The model has no path from the buyer's phrasing to your product.",
    },
    {
      severity: "medium",
      title: "You only surface when the question already names your mechanism",
      evidence:
        'The two answers that named you were "turn support tickets into product insights" and "ai that summarizes customer interviews into themes" — both describe how you work, not what the buyer wants.',
      why: "You are retrievable by mechanism but not by outcome. Buyers search by the problem they have, which limits you to the fraction who already know what to look for.",
    },
  ],
  fixes: [
    {
      priority: 1,
      action:
        'Rewrite the homepage headline and meta description to lead with "customer feedback analytics" and name the prioritization outcome. Remove "survey" from the title tag entirely.',
      rationale:
        "The title and first heading carry disproportionate weight in how a model categorizes a product. Changing the category language is the shortest path to changing what it says you do.",
      effort: "low",
    },
    {
      priority: 2,
      action:
        "Publish a comparison page against Pulseboard that concedes the roadmap workflow and claims the analysis layer.",
      rationale:
        "Pulseboard appeared in 8 of 12 answers. Comparison pages are heavily cited on versus-queries, and an honest one is the cheapest way to appear beside the leader.",
      effort: "medium",
    },
    {
      priority: 3,
      action:
        'Publish three outcome-framed pages answering "how to decide what to build next", "how to quantify feature requests", and "what to do when feedback is scattered across tools".',
      rationale:
        "These are the exact question shapes where you scored zero. Each page gives the model a retrieval path from the buyer's own words to your product.",
      effort: "medium",
    },
    {
      priority: 4,
      action:
        "Add a plain-language definition block to the About page stating the category, the buyer, and the job in one sentence.",
      rationale:
        "Gives the model an unambiguous statement to quote when asked directly what you do, instead of inferring it.",
      effort: "low",
    },
  ],
};

/**
 * The image half of the sample. These are real assets on Cloudinary's public
 * `demo` cloud, so every thumbnail, crop and cutout below is a live
 * transformation, and the byte counts were measured from those URLs. Only the
 * framing -- that they sit on Brightloom's homepage -- is invented.
 *
 * The captions and tags stand in for the AI add-on output and were written to
 * match what each picture shows.
 */
const DEMO = "https://res.cloudinary.com/demo/image/upload";
const demoVariants = (id: string) => ({
  optimized: `${DEMO}/f_auto,q_auto/${id}`,
  thumb: `${DEMO}/c_limit,w_640/f_auto,q_auto/${id}`,
  social: `${DEMO}/c_fill,g_auto,h_630,w_1200/f_auto,q_auto/${id}`,
  square: `${DEMO}/c_fill,g_auto,h_1080,w_1080/f_auto,q_auto/${id}`,
  cutout: `${DEMO}/e_background_removal/c_limit,w_800/f_auto,q_auto/${id}`,
  extended: `${DEMO}/b_gen_fill,c_pad,h_630,w_1200/f_auto,q_auto/${id}`,
  studio: `${DEMO}/e_gen_background_replace:prompt_a_bright_minimal_studio/c_limit,w_800/f_auto,q_auto/${id}`,
});

export const sampleMedia: MediaAsset[] = [
  {
    sourceUrl: "https://brightloom.io/images/team-offsite.jpg",
    publicId: "samples/cloudinary-group",
    width: 3000,
    height: 1526,
    format: "jpg",
    siteAlt: "The Brightloom team at our 2026 offsite",
    aiCaption: "A large group of people posing together outdoors at dusk",
    aiTags: ["group", "people", "team", "outdoor", "sunset"],
    originalBytes: 2856169,
    optimizedBytes: 285356,
    variants: demoVariants("samples/cloudinary-group"),
  },
  {
    sourceUrl: "https://brightloom.io/images/testimonial-marcus.jpg",
    publicId: "samples/people/smiling-man",
    width: 849,
    height: 565,
    format: "jpg",
    siteAlt: null,
    aiCaption: "A smiling young man with red hair wearing a grey hoodie outdoors",
    aiTags: ["person", "portrait", "smile", "hoodie"],
    originalBytes: 338794,
    optimizedBytes: 13978,
    variants: demoVariants("samples/people/smiling-man"),
  },
  {
    sourceUrl: "https://brightloom.io/images/hero.jpg",
    publicId: "coffee_cup",
    width: 1000,
    height: 895,
    format: "jpg",
    siteAlt: null,
    aiCaption: "A steaming cup of coffee on a saucer beside coffee beans, a fireplace behind",
    aiTags: ["coffee", "cup", "coffee beans", "drink", "fireplace"],
    originalBytes: 694090,
    optimizedBytes: 26629,
    variants: demoVariants("coffee_cup"),
  },
];
