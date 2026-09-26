import { Gauge } from "lucide-react";
import type { Scores } from "@/lib/schemas";

type Band = {
  label: string;
  color: string;
  glyph: string;
};

/** Status never rides on color alone, so each band ships a label and a glyph. */
function band(score: number): Band {
  if (score >= 50) return { label: "Strong", color: "var(--color-good)", glyph: "●" };
  if (score >= 25) return { label: "Contested", color: "var(--color-warning)", glyph: "◆" };
  if (score >= 10) return { label: "Weak", color: "var(--color-serious)", glyph: "▲" };
  return { label: "Invisible", color: "var(--color-critical)", glyph: "■" };
}

function Stat({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="border-line border-t pt-3">
      <div className="text-ink text-2xl">{value}</div>
      <div className="text-ink-2 mt-0.5 text-sm">{label}</div>
      {hint ? <div className="text-ink-muted mt-0.5 text-xs">{hint}</div> : null}
    </div>
  );
}

export function ScoreCard({ scores, brand }: { scores: Scores; brand: string }) {
  const status = band(scores.visibilityScore);

  return (
    <section className="border-line bg-surface rounded-lg border p-6 sm:p-8">
      <h2 className="text-ink-muted flex items-center gap-2 font-mono text-xs tracking-widest uppercase">
        <Gauge size={14} className="text-mark" aria-hidden />
        AI visibility score
      </h2>

      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="text-ink text-7xl leading-none sm:text-8xl">
          {scores.visibilityScore}
          <span className="text-ink-muted text-3xl">%</span>
        </div>
        <div
          className="mb-2 flex items-center gap-2 text-sm"
          style={{ color: status.color }}
        >
          <span aria-hidden>{status.glyph}</span>
          <span>{status.label}</span>
        </div>
      </div>

      <p className="text-ink-2 mt-3 max-w-prose text-sm">
        {brand} appeared in{" "}
        <span className="text-ink">
          {scores.unbrandedHits} of {scores.unbrandedTotal}
        </span>{" "}
        buying questions where its name was never mentioned.
      </p>

      {/* Meter. The number above is the message; this only gives it a scale. */}
      <div
        className="bg-raised border-line mt-5 h-2 w-full overflow-hidden rounded-full border"
        role="img"
        aria-label={`Visibility ${scores.visibilityScore} out of 100 — ${status.label}`}
      >
        <div
          className="bar-grow h-full rounded-full"
          style={{
            width: `${Math.max(scores.visibilityScore, 1)}%`,
            background: status.color,
          }}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat
          value={`${scores.shareOfVoice}%`}
          label="Share of voice"
          hint="of all products named"
        />
        <Stat
          value={scores.avgRank === null ? "—" : `#${scores.avgRank}`}
          label="Average position"
          hint={scores.avgRank === null ? "never ranked" : "when recommended"}
        />
        <Stat
          value={`${scores.positiveRate}%`}
          label="Positive framing"
          hint="when mentioned"
        />
        <Stat
          value={
            scores.accuracyRate === null ? "—" : `${scores.accuracyRate}%`
          }
          label="Description accuracy"
          hint="is the model right about you"
        />
      </div>
    </section>
  );
}
