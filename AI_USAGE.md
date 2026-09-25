# AI usage report

Echo was built AI-first. This log is written as the work happens, not
reconstructed afterwards.

## Tools

| Tool | Role |
|---|---|
| Claude Opus 5 via Claude Code | Product strategy, architecture, and essentially all source code |
| Claude Opus 5 via `@anthropic-ai/sdk` | The product's own runtime — every pipeline step |

## Session 1 — idea selection and build kickoff

**Human input:** the hackathon brief, a team situation (solo, 72h), and a
request to choose a project and start.

**AI contribution:**

1. **Competitive analysis of the brief.** Predicted which ideas ~881 teams
   would flood (study-buddy chatbots, resume builders, symptom checkers) and
   argued that differentiation beats polish at that field size.
2. **Eighteen candidate ideas** generated across five strategic angles —
   adversarial agents, money-recovery agents, agents for the AI era itself,
   Tamil/India language moats, and time-based agents — each rated for crowding,
   solo-72h feasibility, and demo impact.
3. **Selection.** Echo was chosen for the best ratio of feasibility to
   memorability, and because it is the most AI-native idea in the set: the
   product could not have existed before LLMs became a buying channel.
4. **Architecture.** The six-step pipeline, and the two decisions the product's
   credibility rests on — uninstructed probes, and scoring in code rather than
   by model.
5. **Implementation.** All of `src/` written by Claude.

**Human judgment applied:** delegated the project choice; approved the
direction.

### Notable AI-driven engineering decisions

- **Probe isolation.** Identified that a probe carrying any brand context
  invalidates the measurement, and enforced a bare, system-prompt-free call.
- **Deterministic scoring boundary.** Split "read this answer" (model) from
  "compute the metric" (TypeScript) so no reported figure is model-generated.
- **Code-enforced query validity.** Unbranded queries are re-validated in code
  rather than trusted to the prompt that produced them.
- **Probe effort set to `low` deliberately.** A fidelity choice — a real
  consumer gets a quick answer, not a deliberated report — that also keeps a
  24-query run inside serverless time limits.
- **Palette validated, not eyeballed.** Chart colors were run through a
  contrast/colorblind validator; the competitor gray was lifted from `#4a4a47`
  to `#626260` to clear the 3:1 contrast floor.
- **API correctness.** The Claude API reference was consulted before any
  integration code was written, so model IDs, adaptive thinking, effort
  configuration, and structured outputs follow the current API rather than
  recalled patterns.

## Session 2 — provider pivot and hardening

**Human input:** no Anthropic API key available; AWS credentials and a Gemini
key available instead.

**AI contribution:**

1. **Diagnosed the options.** Identified that AWS credentials already grant
   Claude access through Amazon Bedrock, so no new account was needed, and
   advised against Gemini — switching providers would have meant rewriting all
   six pipeline steps and losing the structured-output plumbing for no gain.
2. **Checked feature parity before editing.** Consulted the platform
   availability matrix and found two features in use that Bedrock does not
   support: the `web_search` server tool and server-side refusal `fallbacks`.
   Both were removed rather than discovered at runtime.
3. **Replaced web search with a direct site fetch.** This turned a constraint
   into an improvement: grounding is now deterministic, costs no tokens, and
   reads the exact words the company publishes about itself — the signal the
   audit is actually about. Nothing in the pipeline now depends on a
   single-provider feature.
4. **Dual-provider client.** Echo now selects Bedrock or the first-party API
   from whichever credentials are present, with the model id adjusted for
   Bedrock's prefix. The pipeline code is identical on both.
5. **Closed an SSRF hole.** The new site fetch takes a user-supplied host and
   runs server-side, which would have allowed a request to the AWS metadata
   endpoint at 169.254.169.254 — credential disclosure on a deployed instance.
   IP literals and non-public hostnames are now rejected, verified against
   live requests.
6. **Sample report mode.** A fictional worked example replays through the real
   UI and the real scoring function, so development and demoing need no API
   calls. The cast is invented and the UI labels it as sample data, because
   presenting fabricated measurements about a real company as observed would
   be dishonest.
7. **Followed the project's Next.js guidance.** Read the bundled version docs
   as AGENTS.md requires and removed two route exports that are redundant or
   deprecated in Next 16.

**Human judgment applied:** supplied the credential constraint that redirected
the architecture.

## Session 3 — provider abstraction

**Human input:** the AWS credentials were not actually available; a Gemini API
key was.

**AI contribution:**

1. **Corrected an earlier overstatement.** Session 2 claimed a Gemini port
   would mean losing structured outputs. That was wrong — Gemini supports
   JSON-schema-constrained responses and zod v4 emits JSON Schema — and the
   correction changed the decision, so it was stated plainly rather than
   quietly worked around.
2. **Built a provider adapter instead of a second implementation.** All model
   differences now sit in `src/lib/llm.ts`, which exposes two operations:
   generate text, and generate a schema-validated object. The six audit steps
   lost all provider-specific code and got shorter. Echo now runs on Gemini,
   the Claude API, or Bedrock from the same pipeline.
3. **Handled a schema dialect mismatch.** zod emits `type: ["string","null"]`
   for nullable fields, which Gemini's schema dialect rejects. The adapter
   rewrites those to `nullable: true` and strips unsupported keywords — and
   validates the result with zod regardless, so a constraint the provider
   ignores cannot produce a bad object.
4. **Added a self-correcting retry.** When a structured response fails
   validation, the second attempt is told which fields were wrong rather than
   simply repeating the request.
5. **Preflight diagnostics.** `npm run check` makes one cheap call and
   classifies the failure — key rejected, quota exhausted, model unavailable —
   and on Gemini lists the models the key can actually use. Verified against
   live requests with deliberately invalid keys.

**Human judgment applied:** supplied the credential reality that drove the
abstraction. The result is better architecture than the single-provider
version it replaced.

## Estimated AI share of execution

Code: ~100%. Architecture and product strategy: AI-proposed, human-approved.
