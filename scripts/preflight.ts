/**
 * Preflight: prove the credentials work before blaming the pipeline.
 *
 * Every provider fails in several ways that look identical from inside the
 * app -- key rejected, model unavailable to this key, quota exhausted, an
 * unsupported request field. This calls each distinct model Echo would use and
 * says which of those it is.
 *
 * Two lessons are baked in. The raw provider message is always printed next to
 * the interpretation, because an earlier version showed only its own reading
 * and a loose pattern match sent a real failure to the wrong fix. And the
 * model listing is never truncated, because the one entry that got cut was the
 * replacement model the error was pointing at.
 *
 * Run with: npm run check
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type Check = { label: string; ok: boolean; detail: string; raw?: string };

const checks: Check[] = [];
const add = (label: string, ok: boolean, detail: string, raw?: string) =>
  checks.push({ label, ok, detail, raw });

function report(): never {
  const pad = Math.max(...checks.map((c) => c.label.length));
  console.log("");
  for (const c of checks) {
    console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.label.padEnd(pad)}  ${c.detail}`);
    if (c.raw) console.log(`  ${" ".repeat(pad + 6)}raw: ${c.raw}`);
  }
  const failed = checks.some((c) => !c.ok);
  console.log(failed ? "\n  Not ready.\n" : "\n  Ready. Run: npm run dev\n");
  process.exit(failed ? 1 : 0);
}

type Role = "probe" | "reader" | "analyst";
const ROLES: Role[] = ["analyst", "reader", "probe"];

async function main() {
  const hasGemini = Boolean(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  );
  const hasAnthropic = Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
  );
  const hasAws = Boolean(
    process.env.AWS_ACCESS_KEY_ID || process.env.AWS_BEARER_TOKEN_BEDROCK,
  );

  if (!hasGemini && !hasAnthropic && !hasAws) {
    add(
      "credentials",
      false,
      "none found. Copy .env.example to .env.local and set GEMINI_API_KEY.",
    );
    report();
  }

  const llm = await import("../src/lib/llm");
  const chosen = llm.provider();
  add("provider", true, chosen);

  if (chosen === "bedrock" && !process.env.AWS_REGION) {
    add("AWS_REGION", false, "not set. Bedrock needs an explicit region.");
    report();
  }

  // Roles often share a model; call each distinct one once.
  const byModel = new Map<string, Role[]>();
  for (const role of ROLES) {
    const model = llm.modelName(role);
    byModel.set(model, [...(byModel.get(model) ?? []), role]);
  }

  const suggestions = new Set<string>();
  let anyFailed = false;

  for (const [model, roles] of byModel) {
    const label = roles.join(" + ");
    process.stdout.write(`\n  ${label} -> ${model} ...`);
    try {
      const reply = await llm.generateText({
        prompt: "Reply with the single word: ready",
        maxTokens: 32,
        effort: roles.includes("analyst") ? "high" : "low",
        role: roles[0],
      });
      process.stdout.write(" ok.");
      add(label, true, `${model}${reply ? ` replied "${reply.slice(0, 24)}"` : " gave an empty reply"}`);
    } catch (error) {
      process.stdout.write(" failed.");
      anyFailed = true;
      const replacement = suggestedReplacement(error);
      if (replacement) suggestions.add(`${model} -> ${replacement}`);

      // Name where the model came from. A stale pin in .env.local and a bad
      // built-in default look identical from the error alone.
      const sources = [...new Set(roles.map((r) => llm.modelSource(r)))].filter(
        (s) => s !== "default" && s !== "built-in",
      );
      const origin = sources.length
        ? ` (pinned by ${sources.join(" / ")} — remove that line to use the default)`
        : "";

      add(label, false, `${model}: ${explain(error)}${origin}`, rawOf(error));
    }
  }
  process.stdout.write("\n");

  if (suggestions.size) {
    add("provider suggests", true, [...suggestions].join("; "));
  }
  if (anyFailed && chosen === "gemini") {
    await listModels(llm);
    add(
      "how to fix",
      true,
      "set GEMINI_MODEL (analysis), GEMINI_READER_MODEL and GEMINI_PROBE_MODEL in .env.local",
    );
  }

  report();
}

/**
 * Every model this key can call, uncapped. A listed model is not guaranteed
 * usable -- some are listed but closed to new keys -- which is exactly why the
 * calls above are made rather than inferred from this list.
 */
async function listModels(llm: typeof import("../src/lib/llm")) {
  try {
    const usable: string[] = [];
    const pager = await llm.geminiClient().models.list();
    for await (const entry of pager) {
      const name = (entry.name ?? "").replace(/^models\//, "");
      const actions = entry.supportedActions ?? [];
      const generates = !actions.length || actions.includes("generateContent");
      if (generates && name.startsWith("gemini") && !/tts|image|embedding/i.test(name)) {
        usable.push(name);
      }
    }
    if (usable.length) {
      add("models listed", true, usable.join(", "));
      add(
        "note",
        true,
        "listed does not mean callable -- some are closed to new keys. Trust the calls above.",
      );
    }
  } catch {
    // Listing is a convenience; its failure is not the headline.
  }
}

/** Google often names the replacement model in a 404. Surface it. */
function suggestedReplacement(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = /use\s+models\/([a-z0-9.\-]+)/i.exec(message);
  return match ? match[1] : null;
}

function rawOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 300);
}

/**
 * Interpret the provider's error. Patterns are deliberately narrow and
 * anchored to the provider's own status names -- a loose match here produces
 * confident, wrong advice, which is worse than no advice at all.
 */
function explain(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined;

  if (/API_KEY_INVALID|API key not valid/i.test(message)) {
    return "API key rejected. Check it was copied whole, with no quotes or spaces.";
  }
  if (/PERMISSION_DENIED/i.test(message)) {
    return "permission denied. The key is valid but not allowed to use this model.";
  }
  if (/RESOURCE_EXHAUSTED/i.test(message) || status === 429) {
    return "quota exhausted for this model. Free-tier Pro limits are small -- switch this role to a flash model.";
  }
  if (/no longer available/i.test(message)) {
    return "retired for new keys. Use the replacement named below.";
  }
  if (/NOT_FOUND/i.test(message) || status === 404) {
    return "not available to this key. Pick one from the listed models.";
  }
  if (/INVALID_ARGUMENT/i.test(message) || status === 400) {
    return "request rejected as invalid. See the raw message for the offending field.";
  }
  if (/UnrecognizedClient|InvalidSignature|security token/i.test(message)) {
    return "AWS credentials rejected.";
  }
  if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(message)) {
    return "could not reach the endpoint. Check network and proxy settings.";
  }
  return "unrecognised failure.";
}

main().catch((error) => {
  console.error("\n  Preflight crashed:", error);
  process.exit(1);
});
