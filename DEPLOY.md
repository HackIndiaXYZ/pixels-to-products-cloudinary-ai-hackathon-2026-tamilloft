# Deploying Echo

Two routes. The CLI one needs no GitHub access, so it works today.

## Route A — Vercel CLI (works now)

Deploys straight from this folder. No repository required.

```bash
npx vercel login      # opens a browser once
npx vercel            # first run: answer the setup prompts, creates a preview
npx vercel --prod     # the live URL you submit
```

Then set the environment variables, either in the Vercel dashboard under
**Project → Settings → Environment Variables**, or from the CLI:

```bash
npx vercel env add GEMINI_API_KEY production
npx vercel env add GEMINI_MODEL production        # gemini-3.5-flash
npx vercel env add ECHO_QUERY_COUNT production    # 6 to start
```

Redeploy after adding them — env vars are read at request time, but a fresh
deploy is the reliable way to be sure they are attached:

```bash
npx vercel --prod
```

## Route B — GitHub integration (once you have push access)

The repository `HackIndiaXYZ/…tamilloft` is currently **read-only** for the
`KPRAHUL1` account, so this is blocked until a collaborator invite lands. Once
it does:

```bash
git push -u origin main
```

Then at vercel.com: **Add New → Project → import the repo**, set the same
environment variables, and deploy. Every later push deploys automatically,
which is the better setup for the rest of the hackathon.

## Environment variables

| Variable | Needed | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Yes | From https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | Recommended | `gemini-3.5-flash`. The Pro default has a very small free-tier quota |
| `ECHO_QUERY_COUNT` | Recommended | `6` for a deployed demo. See the timeout note below |
| `GEMINI_RPM` | Only on a paid key | Defaults to 5, matching the free tier |

Never commit these. `.env` and `.env.local` are gitignored; `.env.example` is
the template and holds no values.

## The timeout to watch for

A serverless function has a wall-clock limit, and a free-tier Gemini key is
capped at roughly five requests per minute per model. Those two facts fight
each other: a 12-question audit takes two to three minutes, which is close to
the ceiling on a Hobby plan.

The route already sets `maxDuration = 300`. If a deployed audit still dies
partway with a gateway timeout while the same audit finishes locally, the
function limit is the cause, not the pipeline. Lower `ECHO_QUERY_COUNT` to 6
and it will comfortably fit.

For a demo, six questions is plenty: the score, the competitor chart, the lost
questions and the diagnosis all render exactly the same.

## Before you call it deployed

- [ ] The landing page loads at the production URL
- [ ] **Run one real audit on the deployed URL**, not just locally
- [ ] The sample report button works — it needs no API calls, so it is your
      fallback if the live key is rate-limited during judging
