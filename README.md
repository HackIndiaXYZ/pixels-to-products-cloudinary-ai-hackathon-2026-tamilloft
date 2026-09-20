# Echo â€” AI visibility auditor

*Do AI models recommend your brand? Find out before your competitors do.*

Buyers now ask an AI what to buy before they ask Google. Almost no company can
measure whether they appear in that answer. Echo measures it.

Give it a domain. Echo researches what the company actually sells, writes the
questions a real buyer would ask, asks them with no mention of the brand, reads
every answer, and reports the share of the conversation you own â€” against the
competitors who took the rest.

Built for the AI-First Startup Hackathon by **TamilLoft**.

## How it works

| Step | What happens | Who does it |
|---|---|---|
| 1. Profile | Fetches the company's own pages, then structures them: category, audience, real competitors | direct fetch + Claude |
| 2. Queries | Writes ~24 buyer questions, split into unbranded and branded | Claude |
| 3. Probe | Asks each question with **no system prompt and no mention of the brand** | Claude |
| 4. Extract | Reads each answer and records what it said â€” who was named, in what order, how framed | Claude |
| 5. Score | Computes visibility, share of voice, average rank, accuracy | **Plain TypeScript** |
| 6. Diagnose | Explains the cause and prescribes specific fixes | Claude |

### Two design decisions worth knowing

**Probes are uninstructed.** `src/lib/audit/probe.ts` sends the buyer's question
and nothing else â€” no system prompt, no profile, no hint that a brand is being
measured. The moment a probe knows which brand matters, the answer is
contaminated and the score is worthless. Everything Echo claims rests on that
function staying bare.

**No number comes from a model.** The model reads answers; `src/lib/audit/score.ts`
does the arithmetic in TypeScript. Any figure in the report traces back to the
specific answers that produced it. A language model is good at reading and bad
at being an accountant, and the code keeps those jobs apart.

A third guard sits in `src/lib/audit/queries.ts`: unbranded queries are
re-checked in code to confirm they genuinely never name the brand, because the
validity of the headline metric depends on it.

### Why there is no web search

Step 1 originally used the `web_search` server tool, which Bedrock does not
support. Fetching the company's pages directly turned out to be better anyway:
it is deterministic, costs no tokens, and reads the exact words the company
publishes about itself — which is the signal the whole audit is about. Nothing
in the pipeline now depends on a feature that only one provider has.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in ONE provider
npm run check                # verify the credentials actually work
npm run dev
```

`npm run check` makes one cheap model call and tells you which thing is wrong
if it fails — key rejected, quota exhausted, model unavailable to your key. On
Gemini it will also list the models your key can actually use, so you can set
`GEMINI_MODEL` if the default is not one of them.

Open http://localhost:3000 and enter a domain.

Echo runs on Gemini, the Claude API, or Claude on Bedrock, chosen
automatically from whichever credentials are present:

- **Google Gemini** — set `GEMINI_API_KEY` ([get one here](https://aistudio.google.com/apikey)).
- **First-party Claude API** — set `ANTHROPIC_API_KEY`.
- **Claude on Amazon Bedrock** — set `AWS_REGION` plus AWS credentials.

All provider differences live in one file, `src/lib/llm.ts`, which exposes
exactly two operations: produce text, and produce a schema-validated object.
The six audit steps never touch a provider SDK.

### Three roles, not one model

An audit makes three kinds of call, in very different volumes:

| Role | Calls | Job | Default |
|---|---|---|---|
| `analyst` | 3 | Profile the company, write the queries, diagnose | `gemini-pro-latest` |
| `reader` | ~24 | Record what one answer said | `gemini-flash-latest` |
| `probe` | ~24 | Simulate a buyer asking a question | `gemini-flash-latest` |

Only `analyst` benefits from a Pro model, and free-tier Pro quotas are small —
so routing the other ~48 calls to flash is what makes an audit runnable at all.
A fast model is also the *more faithful* probe, since that is what real buyers
get.

Defaults are `-latest` aliases rather than pinned versions on purpose. Pinned
names rot: `gemini-2.5-flash` still appears in the model listing but returns
404 for keys created after its cutoff.

`npm run check` calls each distinct model and reports per role.

No credentials to hand? Click **view a sample report** on the landing page. It
replays a stored audit through the real UI and the real scoring code. The
companies in it are invented and the UI says so.

An audit runs ~24 probes at concurrency 6 and takes roughly a minute. Results
stream as they land over server-sent events.

## Stack

Next.js 16 (App Router) Â· TypeScript Â· Tailwind v4 Â· Claude Opus 5 via
`@anthropic-ai/sdk` Â· zod-validated structured outputs
