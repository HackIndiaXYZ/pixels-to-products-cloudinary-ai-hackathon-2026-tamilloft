# Echo — AI visibility auditor

*Do AI models recommend your brand? Find out before your competitors do.*

Built for **Pixels to Products — Cloudinary AI Hackathon 2026** by **TamilLoft**.
**Track 1 — AI Media Pipelines.**

## The problem

Buyers now ask an AI what to buy before they ask Google, and AI answers, link
previews and image search all describe a brand partly from its pictures.
Almost no company can measure whether the AI answer includes them, or whether
their images tell a machine anything at all. A homepage hero with no alt text
and a stock photo of coffee says "coffee" to every crawler that reads it.

Give Echo a domain and it answers both questions:

- **Words:** it writes the questions a real buyer would ask, asks them with no
  mention of the brand, and reports the share of the conversation you own
  against the competitors who took the rest.
- **Pictures:** it runs every image on the homepage through a Cloudinary AI
  pipeline and reports what the AI sees in each one, which images have no alt
  text, how much weight optimized delivery saves, and ready-made crops for
  where the images will be shown.

## How Echo uses Cloudinary

Media goes in, Cloudinary's AI does the work, and the output is a report plus
assets you can use directly. The code is in `src/lib/media/`.

| Stage | Cloudinary capability | What it does in Echo |
|---|---|---|
| Ingest | **Upload API** (remote URL) | Each homepage image is uploaded by URL, so Cloudinary fetches it. The public ID is derived from the source URL and uploads never overwrite, so re-auditing a site reuses its assets. |
| Organize | **Tags + contextual metadata** | Assets are tagged `echo` and `site:<domain>`. The site's own alt text, the source URL and the AI caption are stored as context on the asset. |
| Analyze | **AI captioning** (AI Content Analysis) and **auto-tagging** (Google / Amazon Rekognition) | The caption is what the AI sees, offered as alt text when the site ships none. Tags show what the image is actually about. |
| Optimize | **`f_auto`, `q_auto`** | Echo downloads the optimized delivery the way a modern browser would and measures the bytes. The savings figure is observed, not estimated. |
| Transform | **`g_auto` content-aware crop** | A 1200×630 link-preview crop and a 1080×1080 square, cropped around the subject. |
| Generate | **`b_gen_fill`** generative fill | Extends an image to 1200×630 by generating the missing edges, so a link preview shows the whole picture instead of a crop. |
| Generate | **`e_gen_background_replace`** | Puts the subject on a generated studio backdrop, for product-style shots from lifestyle photos. |
| Transform | **`e_background_removal`** | An AI cutout per image. |
| Deliver | **Delivery URLs** | Every thumbnail and preview in the report is a live Cloudinary URL. |

The AI add-ons are optional. If one isn't enabled on the account, Echo notes
it in the report and everything else still runs. The image audit makes no
language-model calls, runs alongside the text audit, and still finishes if the
model provider is rate limited.

## How to test it

1. **No credentials:** run `npm run dev`, open http://localhost:3000 and click
   **view a sample report**. The brand is invented and labeled as such, but the
   images are real assets on Cloudinary's public `demo` cloud, so every crop,
   cutout and optimized delivery is a live transformation. Open the **Images**
   tab and try **Extend to 1200×630**, **Remove background** and **New
   background** on any image. Each takes 5–15 seconds the first time.
2. **Your own site:** set the Cloudinary and Gemini variables (see below), run
   `npm run check`, then enter a domain such as `allbirds.com`. The image audit
   section fills in as each image is processed. The assets appear in your
   Cloudinary Media Library under `echo/<domain>`.
3. **Unit tests:** `npm test` covers the scoring code and the image extraction.
   No API calls are made.

## How it works

| Step | What happens | Who does it |
|---|---|---|
| 1. Profile | Fetches the company's own pages, then structures them: category, audience, real competitors | direct fetch + model |
| 2. Queries | Writes buyer questions (12 by default), split into unbranded and branded | model |
| 3. Probe | Asks each question with **no system prompt and no mention of the brand** | model |
| 4. Extract | Reads each answer and records what it said — who was named, in what order, how framed | model |
| 5. Score | Computes visibility, share of voice, average rank, accuracy | **Plain TypeScript** |
| 6. Diagnose | Explains the cause and prescribes specific fixes | model |
| Images (in parallel) | Collects homepage images, then uploads, analyzes, optimizes and crops them | **Cloudinary** |

### Two design decisions worth knowing

**Probes are uninstructed.** `src/lib/audit/probe.ts` sends the buyer's question
and nothing else — no system prompt, no profile, no hint that a brand is being
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
cp .env.example .env.local   # fill in Cloudinary and ONE model provider
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
| `reader` | ~2 | Read a batch of up to 6 answers at once | `gemini-flash-lite-latest` |
| `probe` | ~12 | Simulate a buyer asking a question | `gemini-flash-latest` |

Only `analyst` benefits from a Pro model, and free-tier Pro quotas are small —
so routing the other ~14 calls to flash models is what makes an audit runnable at all.
A fast model is also the *more faithful* probe, since that is what real buyers
get.

Defaults are `-latest` aliases rather than pinned versions on purpose. Pinned
names rot: `gemini-2.5-flash` still appears in the model listing but returns
404 for keys created after its cutoff.

`npm run check` calls each distinct model and reports per role.

No credentials to hand? Click **view a sample report** on the landing page. It
replays a stored audit through the real UI and the real scoring code. The
companies in it are invented and the UI says so.

An audit runs 12 probes by default (`ECHO_QUERY_COUNT`), three at a time, and
takes two to three minutes on a free-tier Gemini key. Results stream as they
land over server-sent events.

## Tests

```bash
npm test
```

Covers both scoring steps (`src/lib/audit/score.ts`, `src/lib/media/score.ts`),
since every figure in the report comes from them, and the homepage image
extraction. No API calls are made.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Cloudinary Node SDK ·
Gemini via `@google/genai`
(Claude API and Bedrock also supported) · zod-validated structured outputs
