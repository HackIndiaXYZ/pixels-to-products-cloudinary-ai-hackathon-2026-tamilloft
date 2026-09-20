import type { Diagnosis, Scores } from "@/lib/schemas";

const SEVERITY: Record<string, { color: string; glyph: string }> = {
  critical: { color: "var(--color-critical)", glyph: "■" },
  high: { color: "var(--color-serious)", glyph: "▲" },
  medium: { color: "var(--color-warning)", glyph: "◆" },
  low: { color: "var(--color-ink-muted)", glyph: "●" },
};

export function Findings({
  diagnosis,
  scores,
}: {
  diagnosis: Diagnosis;
  scores: Scores;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="border-line bg-surface rounded-lg border p-6 sm:p-8">
        <h2 className="text-ink-muted text-xs tracking-widest uppercase">
          Diagnosis
        </h2>
        <p className="text-ink mt-3 text-xl leading-snug">{diagnosis.headline}</p>

        <div className="mt-7 flex flex-col gap-5">
          {diagnosis.findings.map((finding, index) => {
            const severity = SEVERITY[finding.severity] ?? SEVERITY.low;
            return (
              <article key={index} className="border-line border-t pt-4">
                <div className="flex items-center gap-2">
                  <span aria-hidden style={{ color: severity.color }}>
                    {severity.glyph}
                  </span>
                  <span
                    className="text-xs tracking-wide uppercase"
                    style={{ color: severity.color }}
                  >
                    {finding.severity}
                  </span>
                </div>
                <h3 className="text-ink mt-2">{finding.title}</h3>
                <p className="text-ink-2 mt-1.5 text-sm">{finding.why}</p>
                <p className="text-ink-muted mt-2 border-l border-[var(--color-baseline)] pl-3 text-sm">
                  {finding.evidence}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {scores.blindSpots.length > 0 ? (
        <section className="border-line bg-surface rounded-lg border p-6 sm:p-8">
          <h2 className="text-ink text-lg">Questions you lost</h2>
          <p className="text-ink-muted mt-1 text-sm">
            The model answered, named somebody, and it was not you.
          </p>
          <ul className="mt-5 flex flex-col gap-2">
            {scores.blindSpots.map((query, index) => (
              <li
                key={index}
                className="bg-raised border-line text-ink-2 rounded border px-3 py-2 text-sm"
              >
                {query}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-line bg-surface rounded-lg border p-6 sm:p-8">
        <h2 className="text-ink text-lg">What to do</h2>
        <ol className="mt-5 flex flex-col gap-5">
          {[...diagnosis.fixes]
            .sort((a, b) => a.priority - b.priority)
            .map((fix, index) => (
              <li key={index} className="border-line flex gap-4 border-t pt-4">
                <span className="text-ink-muted shrink-0 text-sm tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h3 className="text-ink">{fix.action}</h3>
                  <p className="text-ink-2 mt-1.5 text-sm">{fix.rationale}</p>
                  <span className="text-ink-muted mt-2 inline-block text-xs">
                    {fix.effort} effort
                  </span>
                </div>
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}
