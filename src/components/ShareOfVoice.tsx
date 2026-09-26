import { ChartBar } from "lucide-react";
import type { Scores } from "@/lib/schemas";

/**
 * Magnitude comparison across named entities, so: horizontal bars, sorted,
 * with every bar directly labelled. One series with the audited brand
 * emphasised -- competitors are deliberately recessive, which is why no
 * legend is needed. Color follows the entity, never its rank.
 */
export function ShareOfVoice({
  scores,
  totalQuestions,
}: {
  scores: Scores;
  totalQuestions: number;
}) {
  const rows = scores.leaderboard.slice(0, 8);
  const max = Math.max(...rows.map((row) => row.mentions), 1);

  return (
    <section className="border-line bg-surface rounded-lg border p-6 sm:p-8">
      <h2 className="text-ink flex items-center gap-2 text-lg">
        <ChartBar size={18} className="text-mark" aria-hidden />
        Who the model recommends instead
      </h2>
      <p className="text-ink-muted mt-1 text-sm">
        Mentions across {totalQuestions} unbranded buying questions.
      </p>

      <div className="mt-6 flex flex-col gap-[2px]">
        {rows.map((row) => (
          <div
            key={row.name}
            className="group grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 rounded py-1.5 hover:bg-white/[0.03]"
            title={`${row.name}: named in ${row.mentions} of ${totalQuestions} answers${
              row.avgRank === null ? "" : `, average position #${row.avgRank}`
            }`}
          >
            <span
              className={`truncate text-sm ${
                row.isTarget ? "text-ink" : "text-ink-2"
              }`}
            >
              {row.name}
              {row.isTarget ? (
                <span className="text-ink-muted ml-1.5 text-xs">you</span>
              ) : null}
            </span>

            <div className="h-5">
              <div
                className="bar-grow h-full rounded-r-[4px]"
                style={{
                  width: `${Math.max((row.mentions / max) * 100, row.mentions > 0 ? 1.5 : 0)}%`,
                  background: row.isTarget
                    ? "var(--color-mark)"
                    : "var(--color-mark-rival)",
                }}
              />
            </div>

            <span className="text-ink-2 w-20 text-right text-sm tabular-nums">
              {row.mentions}
              <span className="text-ink-muted"> · {row.shareOfVoice}%</span>
            </span>
          </div>
        ))}
      </div>

      {scores.leaderboard.length === 0 ? (
        <p className="text-ink-muted mt-4 text-sm">
          No products were named in any answer.
        </p>
      ) : null}
    </section>
  );
}
