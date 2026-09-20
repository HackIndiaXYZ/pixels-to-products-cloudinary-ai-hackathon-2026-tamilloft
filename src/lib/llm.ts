import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import { GoogleGenAI, ThinkingLevel, type ThinkingConfig } from "@google/genai";

/**
 * One call surface over several model providers.
 *
 * Echo's pipeline needs exactly two operations -- produce text, and produce a
 * validated object -- so provider differences are collapsed here rather than
 * branching inside every step. That keeps the six audit steps readable, and it
 * is what makes probing more than one model feasible later: a probe against a
 * second provider becomes an argument, not a rewrite.
 */

export type Provider = "gemini" | "anthropic" | "bedrock";
export type Effort = "low" | "high";

/**
 * Three jobs, not one.
 *
 * An audit makes ~24 probe calls, ~24 reader calls and 3 analyst calls. Those
 * have genuinely different requirements, and collapsing them onto one model
 * wastes the scarcest quota on the most repetitive work:
 *
 * - `probe`   simulates a buyer. Buyers get the fast default model, so a quick
 *             model is the MORE faithful probe, not a compromise.
 * - `reader`  records what one answer said. High volume, low judgement.
 * - `analyst` profiles the company, writes the queries, and diagnoses the
 *             result. Three calls, and the ones worth spending a strong model
 *             on.
 *
 * On a free-tier key this is the difference between an audit that runs and one
 * that exhausts a Pro quota on the twenty-fourth extraction.
 */
export type Role = "probe" | "reader" | "analyst";

/**
 * Probes deliberately run at low effort. This is a fidelity decision, not a
 * cost one: a buyer asking "what should I use?" gets a quick answer, not a
 * deliberated research report. It also keeps a 24-query audit inside
 * serverless time limits.
 */
export const PROBE_EFFORT: Effort = "low";

/** Analysis steps reason over evidence, so they get more room. */
export const ANALYST_EFFORT: Effort = "high";

let cachedProvider: Provider | null = null;

function detect(): Provider {
  const forced = process.env.ECHO_PROVIDER;
  if (forced === "gemini" || forced === "anthropic" || forced === "bedrock") {
    return forced;
  }
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    return "anthropic";
  }
  if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_BEARER_TOKEN_BEDROCK) {
    return "bedrock";
  }
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return "gemini";
  }
  throw new Error(
    "No credentials found. Set GEMINI_API_KEY (or ANTHROPIC_API_KEY, or AWS " +
      "credentials) in .env.local. See .env.example.",
  );
}

export function provider(): Provider {
  cachedProvider ??= detect();
  return cachedProvider;
}

/**
 * Which model serves a role.
 *
 * The Gemini defaults are the `-latest` aliases rather than pinned versions.
 * Pinned names rot: `gemini-2.5-flash` still appears in the model listing but
 * returns 404 for new keys, and a hardcoded default would strand anyone who
 * set this up after that cutoff. The aliases track whatever is current.
 */
export function modelName(role: Role = "analyst"): string {
  switch (provider()) {
    case "gemini":
      switch (role) {
        case "probe":
          return process.env.GEMINI_PROBE_MODEL ?? "gemini-flash-latest";
        case "reader":
          // Deliberately a different model from the probe. Quota is enforced
          // per model, so splitting these two gives each its own budget
          // instead of making them compete -- and reading a fenced answer into
          // a fixed shape is well within a lite model's range.
          return process.env.GEMINI_READER_MODEL ?? "gemini-flash-lite-latest";
        default:
          return process.env.GEMINI_MODEL ?? "gemini-pro-latest";
      }
    case "bedrock":
      return "anthropic.claude-opus-5";
    default:
      return "claude-opus-5";
  }
}

/**
 * The models to try for a role, in order.
 *
 * A 503 means that specific model is busy, not that the key or the request is
 * wrong, so the right response is to ask a different model rather than fail
 * the audit. Duplicates are removed, and the role's own model always leads.
 *
 * Fallbacks are aliases so they keep resolving as the model line moves.
 */
export function modelChain(role: Role): string[] {
  if (provider() !== "gemini") return [modelName(role)];

  const fallbacks =
    role === "analyst"
      ? ["gemini-flash-latest", "gemini-flash-lite-latest"]
      : ["gemini-flash-lite-latest", "gemini-flash-latest"];

  return [...new Set([modelName(role), ...fallbacks])];
}

/**
 * Which setting chose this role's model -- an env var name, or "default".
 *
 * When a model fails, the first question is always "where did that name come
 * from?", and a stale pin in .env.local looks identical to a bad default from
 * the outside. The preflight reports this so the fix names a specific line.
 */
export function modelSource(role: Role = "analyst"): string {
  if (provider() !== "gemini") return "built-in";
  switch (role) {
    case "probe":
      return process.env.GEMINI_PROBE_MODEL ? "GEMINI_PROBE_MODEL" : "default";
    case "reader":
      if (process.env.GEMINI_READER_MODEL) return "GEMINI_READER_MODEL";
      return process.env.GEMINI_PROBE_MODEL ? "GEMINI_PROBE_MODEL" : "default";
    default:
      return process.env.GEMINI_MODEL ? "GEMINI_MODEL" : "default";
  }
}

let gemini: GoogleGenAI | null = null;
let claude: Anthropic | AnthropicBedrockMantle | null = null;

export function geminiClient(): GoogleGenAI {
  gemini ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
  });
  return gemini;
}

function claudeClient(): Anthropic | AnthropicBedrockMantle {
  claude ??=
    provider() === "bedrock" ? new AnthropicBedrockMantle() : new Anthropic();
  return claude;
}

/* ------------------------------ retries ------------------------------ */

function statusOf(error: unknown): number | undefined {
  if (error instanceof Anthropic.APIError) return error.status ?? undefined;
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

export function isRetryable(error: unknown): boolean {
  const status = statusOf(error);
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  if (error instanceof Anthropic.APIConnectionError) return true;
  const message = error instanceof Error ? error.message : "";
  return /RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|fetch failed|ECONNRESET/i.test(
    message,
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * On a 429, Google states exactly how long to wait. Guessing with exponential
 * backoff either wastes time or retries too early; the server's own number is
 * better than either.
 */
function serverRetryDelayMs(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error);
  const match =
    /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(message) ??
    /retry in (\d+(?:\.\d+)?)\s*s/i.exec(message);
  if (!match) return null;
  // Cap it: a multi-minute wait should surface as a failure, not a hang.
  return Math.min(Number(match[1]) * 1000 + 750, 75_000);
}

/** A model that is temporarily overloaded, as opposed to a quota or key problem. */
export function isOverloaded(error: unknown): boolean {
  const status = statusOf(error);
  const message = error instanceof Error ? error.message : String(error);
  return status === 503 || /UNAVAILABLE|high demand|overloaded/i.test(message);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 4, baseMs = 900 }: { attempts?: number; baseMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === attempts - 1) throw error;

      const stated = serverRetryDelayMs(error);
      // A demand spike lasts seconds to minutes, so sub-second backoff just
      // burns the retry budget before the spike has passed.
      const base = isOverloaded(error) ? 4000 : baseMs;
      await sleep(stated ?? base * 2 ** attempt + Math.random() * 500);
    }
  }
  throw lastError;
}

/* ---------------------------- rate limiting ---------------------------- */

/**
 * Free-tier Gemini allows a handful of requests per minute *per model*, so a
 * burst of concurrent probes fails instantly without pacing. Calls are
 * throttled against a rolling one-minute window, keyed by model.
 *
 * The per-model key matters twice over: it is how the quota is actually
 * enforced, and it means spreading work across several models multiplies the
 * available throughput rather than sharing one budget.
 */
const callTimes = new Map<string, number[]>();

function limitFor(): number {
  const configured = Number(process.env.GEMINI_RPM);
  return Number.isFinite(configured) && configured > 0 ? configured : 5;
}

async function acquireSlot(model: string): Promise<void> {
  if (provider() !== "gemini") return;
  const limit = limitFor();

  for (;;) {
    const now = Date.now();
    const recent = (callTimes.get(model) ?? []).filter((t) => now - t < 60_000);

    if (recent.length < limit) {
      recent.push(now);
      callTimes.set(model, recent);
      return;
    }

    callTimes.set(model, recent);
    await sleep(60_000 - (now - recent[0]) + 250);
  }
}

/* --------------------------- schema dialect --------------------------- */

/**
 * zod emits `type: ["string", "null"]` for nullable fields, which Gemini's
 * schema dialect does not accept. Rewrite those into `nullable: true` and drop
 * the keywords it rejects. The result is still validated with zod afterwards,
 * so a schema the provider silently ignores cannot produce a bad object.
 */
function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (typeof node !== "object" || node === null) return node;

  const source = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === "$schema" || key === "additionalProperties") continue;

    if (key === "type" && Array.isArray(value)) {
      const types = value.filter((entry) => entry !== "null");
      if (value.includes("null")) out.nullable = true;
      out.type = types.length === 1 ? types[0] : types;
      continue;
    }

    out[key] = toGeminiSchema(value);
  }

  return out;
}

/* ------------------------------ gemini ------------------------------ */

/**
 * Thinking is configured differently across Gemini generations: the 3.x models
 * take a `thinkingLevel`, while 2.5 takes a token budget instead (-1 meaning
 * dynamic). Sending the wrong one is rejected, so the shape is chosen from the
 * model name -- and `callGemini` retries without it if that guess is wrong,
 * because the model list moves faster than this code does.
 */
function thinkingFor(model: string, effort: Effort): ThinkingConfig | undefined {
  if (/gemini-[3-9]/.test(model)) {
    return {
      thinkingLevel: effort === "low" ? ThinkingLevel.LOW : ThinkingLevel.HIGH,
    };
  }
  if (/gemini-2\.5/.test(model)) {
    return { thinkingBudget: effort === "low" ? 128 : -1 };
  }
  return undefined;
}

function rejectsThinking(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /thinking|thought/i.test(message) && /not supported|invalid|unknown|unsupported/i.test(message);
}

type GeminiConfig = Record<string, unknown>;

/**
 * One Gemini call, with the thinking config treated as optional. If the model
 * rejects it, the call is retried without it rather than failing the audit --
 * thinking depth is a refinement, not a requirement.
 */
async function callOneModel(
  model: string,
  contents: string,
  config: GeminiConfig,
  effort: Effort,
): Promise<string> {
  const thinkingConfig = thinkingFor(model, effort);

  const send = (body: GeminiConfig) =>
    withRetry(async () => {
      await acquireSlot(model);
      return geminiClient().models.generateContent({ model, contents, config: body });
    });

  try {
    const response = await send(
      thinkingConfig ? { ...config, thinkingConfig } : config,
    );
    return (response.text ?? "").trim();
  } catch (error) {
    if (!thinkingConfig || !rejectsThinking(error)) throw error;
    const response = await send(config);
    return (response.text ?? "").trim();
  }
}

/**
 * Try the role's models in order, moving on when one is overloaded or has run
 * out of quota -- both are properties of that model, not of the request. A
 * rejected key or a malformed request fails immediately instead, since another
 * model would fail identically.
 */
async function callGemini(
  role: Role,
  contents: string,
  config: GeminiConfig,
  effort: Effort,
): Promise<string> {
  const chain = modelChain(role);
  let lastError: unknown;

  for (let index = 0; index < chain.length; index++) {
    try {
      return await callOneModel(chain[index], contents, config, effort);
    } catch (error) {
      lastError = error;
      const worthSwitching = isOverloaded(error) || statusOf(error) === 429;
      if (!worthSwitching || index === chain.length - 1) throw error;
    }
  }

  throw lastError;
}

/* ------------------------------ generation ------------------------------ */

export interface TextRequest {
  prompt: string;
  system?: string;
  maxTokens: number;
  effort: Effort;
  role?: Role;
}

/** Plain text out. Used by the probe, which must stay uninstructed. */
export async function generateText({
  prompt,
  system,
  maxTokens,
  effort,
  role = "analyst",
}: TextRequest): Promise<string> {
  const model = modelName(role);

  if (provider() === "gemini") {
    return callGemini(
      role,
      prompt,
      {
        ...(system ? { systemInstruction: system } : {}),
        maxOutputTokens: maxTokens,
      },
      effort,
    );
  }

  const response = await withRetry(() =>
    claudeClient().messages.create({
      model,
      max_tokens: maxTokens,
      output_config: { effort },
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: prompt }],
    }),
  );

  if (response.stop_reason === "refusal") return "";

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export interface ObjectRequest<T> {
  schema: z.ZodType<T>;
  prompt: string;
  system: string;
  maxTokens: number;
  effort: Effort;
  role?: Role;
}

/**
 * A schema-validated object, or null if the model could not produce one.
 *
 * Both providers are asked to emit structured output, and the result is parsed
 * with zod either way. The provider constraint is an optimisation; zod is the
 * guarantee.
 */
export async function generateObject<T>({
  schema,
  prompt,
  system,
  maxTokens,
  effort,
  role = "analyst",
}: ObjectRequest<T>): Promise<T | null> {
  const model = modelName(role);

  if (provider() !== "gemini") {
    const response = await withRetry(() =>
      claudeClient().messages.parse({
        model,
        max_tokens: maxTokens,
        output_config: { effort, format: zodOutputFormat(schema) },
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    );
    return response.parsed_output ?? null;
  }

  const jsonSchema = toGeminiSchema(z.toJSONSchema(schema));

  // Two attempts: a malformed object is worth one retry, and the second pass
  // is told what went wrong rather than just repeating the request.
  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callGemini(
      role,
      feedback ? `${prompt}\n\n${feedback}` : prompt,
      {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
      },
      effort,
    );

    if (!raw) {
      feedback = "Your previous reply was empty. Return only the JSON object.";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFence(raw));
    } catch {
      feedback =
        "Your previous reply was not valid JSON. Return only a single JSON object, with no prose and no code fence.";
      continue;
    }

    const result = schema.safeParse(parsed);
    if (result.success) return result.data;

    feedback = [
      "Your previous reply did not match the required shape:",
      result.error.issues
        .slice(0, 6)
        .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("\n"),
      "Return a corrected JSON object.",
    ].join("\n");
  }

  return null;
}

/** Models sometimes wrap JSON in a fence despite being told not to. */
function stripFence(text: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text.trim());
  return fenced ? fenced[1] : text;
}
