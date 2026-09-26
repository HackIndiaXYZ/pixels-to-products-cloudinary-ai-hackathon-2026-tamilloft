import { buildProfile } from "./profile";
import { generateQueries } from "./queries";
import { probe, mapWithConcurrency } from "./probe";
import { analyzeAnswers } from "./extract";
import { computeScores } from "./score";
import { diagnose } from "./diagnose";
import { auditMedia, type MediaEvent } from "@/lib/media/audit";
import type {
  AuditReport,
  BrandProfile,
  Diagnosis,
  ProbeQuery,
  ProbeResult,
  Scores,
} from "@/lib/schemas";

export type AuditEvent =
  | { type: "status"; step: string; message: string }
  | { type: "profile"; profile: BrandProfile }
  | { type: "queries"; queries: ProbeQuery[] }
  | { type: "probe"; index: number; result: ProbeResult }
  | { type: "scores"; scores: Scores }
  | { type: "diagnosis"; diagnosis: Diagnosis }
  | { type: "done"; report: AuditReport }
  | { type: "error"; message: string }
  | MediaEvent;

/**
 * Work is done a chunk at a time: probe the chunk, then read all of its
 * answers in one call. Reading in batches is what keeps the request count low
 * enough for a rate-limited key, and chunking rather than batching everything
 * at the end means results still stream to the UI as the audit runs.
 */
const CHUNK_SIZE = 6;

/**
 * Deliberately modest. Free-tier Gemini allows a few requests per minute per
 * model, and the limiter in llm.ts will simply stall a wider fan-out -- extra
 * concurrency here buys nothing and makes failures burstier.
 */
const PROBE_CONCURRENCY = 3;

/**
 * Turn whatever went wrong into something a person can act on.
 *
 * The provider's own errors are JSON blobs meant for logs. Showing one to
 * someone auditing their website tells them nothing about whether to wait,
 * change a setting, or give up -- which is the only thing they need to know.
 */
function humanize(error: unknown, step: string): string {
  const message = error instanceof Error ? error.message : String(error);

  // Messages Echo raised itself are already written for a person.
  if (error instanceof Error && !message.trimStart().startsWith("{")) {
    if (!/^\s*\[?\{|googleapis|GoogleGenerativeAI/i.test(message)) return message;
  }

  if (/UNAVAILABLE|high demand|overloaded/i.test(message)) {
    return `The model is busy right now (this happens, and it passes). Echo retried and also tried a backup model. Give it a minute and run it again. Failed while: ${step}.`;
  }
  if (/PerDay/.test(message)) {
    return `The daily free-tier Gemini quota is used up for every model Echo can fall back to. It resets at midnight Pacific time. The image audit above does not use Gemini and is unaffected. Failed while: ${step}.`;
  }
  if (/RESOURCE_EXHAUSTED|quota/i.test(message)) {
    return `Rate limit reached. Free-tier Gemini allows about 5 requests per minute per model. Wait a minute, then try again — or lower the question count. Failed while: ${step}.`;
  }
  if (/API_KEY_INVALID|API key not valid/i.test(message)) {
    return "Your Gemini API key was rejected. Check GEMINI_API_KEY in .env.local, then run `npm run check`.";
  }
  if (/NOT_FOUND|no longer available/i.test(message)) {
    return "The configured model is not available to this key. Run `npm run check` to see which models you can use.";
  }
  if (/PERMISSION_DENIED/i.test(message)) {
    return "Your key is not permitted to use this model. Run `npm run check` for the models it can use.";
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(message)) {
    return `Could not reach the model provider. Check your connection. Failed while: ${step}.`;
  }

  return `The audit failed while ${step}. ${message.slice(0, 160)}`;
}

export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const withoutScheme = trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "");
  return withoutScheme.split("/")[0];
}

/**
 * The full audit, emitting events as it goes so the UI can show the work
 * rather than a spinner.
 */
export async function runAudit(
  rawDomain: string,
  emit: (event: AuditEvent) => void,
  queryCount = 12,
): Promise<void> {
  const domain = normalizeDomain(rawDomain);
  let stage = "starting up";
  let media: ReturnType<typeof auditMedia> | null = null;

  try {
    stage = `reading ${domain}`;
    emit({ type: "status", step: "profile", message: `Reading ${domain}` });
    const profile = await buildProfile(domain);
    emit({ type: "profile", profile });

    // The image audit needs no model, so it runs alongside everything below
    // and survives a model failure.
    media = auditMedia(domain, emit).catch(() => {
      emit({ type: "media-note", message: "The image audit failed. Check the Cloudinary credentials with `npm run check`." });
      return null;
    });

    stage = "writing the questions buyers ask";
    emit({
      type: "status",
      step: "queries",
      message: "Writing the questions buyers actually ask",
    });
    const queries = await generateQueries(profile, queryCount);
    emit({ type: "queries", queries });

    const probes: ProbeResult[] = [];

    for (let start = 0; start < queries.length; start += CHUNK_SIZE) {
      const chunk = queries.slice(start, start + CHUNK_SIZE);

      stage = `asking questions ${start + 1}-${start + chunk.length} of ${queries.length}`;
      emit({
        type: "status",
        step: "probe",
        message: `Asking questions ${start + 1}-${start + chunk.length} of ${queries.length}, with no mention of ${profile.brand}`,
      });

      const answers = await mapWithConcurrency(chunk, PROBE_CONCURRENCY, (query) =>
        probe(query),
      );

      stage = `reading ${chunk.length} answers`;
      emit({
        type: "status",
        step: "read",
        message: `Reading ${chunk.length} answers`,
      });

      const analyses = await analyzeAnswers(
        chunk.map((query, offset) => ({ query, answer: answers[offset] })),
        profile,
      );

      chunk.forEach((query, offset) => {
        const result: ProbeResult = {
          query,
          answer: answers[offset],
          analysis: analyses[offset],
        };
        probes.push(result);
        emit({ type: "probe", index: start + offset, result });
      });
    }

    emit({ type: "status", step: "score", message: "Scoring the results" });
    const scores = computeScores(probes, profile);
    emit({ type: "scores", scores });

    stage = "working out the diagnosis";
    emit({
      type: "status",
      step: "diagnose",
      message: "Working out why, and what to do about it",
    });
    const diagnosis = await diagnose(profile, scores, probes);
    emit({ type: "diagnosis", diagnosis });

    const mediaResult = await media;

    const report: AuditReport = {
      id: crypto.randomUUID(),
      domain,
      createdAt: new Date().toISOString(),
      profile,
      probes,
      scores,
      diagnosis,
      media: mediaResult?.assets ?? [],
      mediaScores: mediaResult?.scores ?? null,
    };
    emit({ type: "done", report });
  } catch (error) {
    emit({ type: "error", message: humanize(error, stage) });
    await media;
  }
}
