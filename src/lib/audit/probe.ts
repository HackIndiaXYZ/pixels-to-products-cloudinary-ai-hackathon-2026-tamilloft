import { generateText, PROBE_EFFORT } from "@/lib/llm";
import type { ProbeQuery } from "@/lib/schemas";

/**
 * Step 3 -- ask the question the way a buyer would, and take what comes back.
 *
 * This call is deliberately bare. No system prompt, no profile, no hint that
 * anything is being measured. The moment a probe is told which brand matters,
 * the answer is contaminated and the resulting score is worthless. Everything
 * Echo claims rests on this function staying uninstructed -- note that it
 * passes no `system`, and that is the point, not an omission.
 */
export async function probe(query: ProbeQuery): Promise<string> {
  const answer = await generateText({
    prompt: query.text,
    maxTokens: 1500,
    effort: PROBE_EFFORT,
    role: "probe",
  });

  return answer || "[no answer returned]";
}

/** Run tasks in parallel with a ceiling, reporting each as it lands. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onSettled?: (index: number, result: R) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
      onSettled?.(index, results[index]);
    }
  });

  await Promise.all(runners);
  return results;
}
